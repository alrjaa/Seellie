import type { Message } from '@/data/initial-data';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

export type MessageRow = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  recipient_id: string;
  subject: string;
  body: string;
  read: boolean | null;
  created_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): boolean {
  return !!value && UUID_RE.test(value);
}

export function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderAvatar: row.sender_avatar || '',
    recipientId: row.recipient_id,
    subject: row.subject,
    body: row.body,
    timestamp: new Date(row.created_at),
    read: !!row.read,
  };
}

export async function fetchMessagesForUser(
  userId: string
): Promise<{ messages: Message[]; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(userId)) {
    return { messages: [], error: 'not_cloud_user' };
  }
  const sb = getSupabase();
  if (!sb) return { messages: [], error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { messages: [], error: 'no_session' };
  }
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.warn('[supabase] fetchMessages', error.message);
    return { messages: [], error: error.message };
  }
  return {
    messages: ((data || []) as MessageRow[]).map(rowToMessage),
  };
}

/** اشتراك فوري برسائل المستلم */
export function subscribeMessagesForUser(
  userId: string,
  onMessage: (msg: Message) => void
): (() => void) | null {
  if (!isSupabaseConfigured() || !isUuid(userId)) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const channel = sb
    .channel(`messages-inbox-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow;
        if (row?.id) onMessage(rowToMessage(row));
      }
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

export async function insertMessage(input: {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  subject: string;
  body: string;
}): Promise<{ message: Message | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { message: null, error: 'Supabase غير مهيأ في التطبيق.' };
  }
  if (!isUuid(input.senderId) || !isUuid(input.recipientId)) {
    return {
      message: null,
      error:
        'المرسل أو المستلم ليس حساباً سحابياً. سجّل كلا الحسابين عبر Sign up.',
    };
  }
  const sb = getSupabase();
  if (!sb) return { message: null, error: 'عميل Supabase غير متاح.' };

  const { data: sessionData } = await sb.auth.getSession();
  const authId = sessionData.session?.user?.id;
  if (!authId) {
    return {
      message: null,
      error: 'لا توجد جلسة سحابية. اخرج ثم ادخل مجدداً بحساب Sign up.',
    };
  }
  if (authId !== input.senderId) {
    return {
      message: null,
      error:
        'جلسة السحابة لا تطابق الحساب الحالي. اخرج ثم ادخل بالإيميل السحابي.',
    };
  }

  const { data, error } = await sb
    .from('messages')
    .insert({
      sender_id: input.senderId,
      sender_name: input.senderName,
      sender_avatar: input.senderAvatar || null,
      recipient_id: input.recipientId,
      subject: input.subject,
      body: input.body,
      read: false,
    })
    .select('*')
    .single();
  if (error || !data) {
    console.warn('[supabase] insertMessage', error?.message);
    const msg = error?.message || 'insert_failed';
    if (/relation .*messages.* does not exist/i.test(msg)) {
      return {
        message: null,
        error: 'خدمة الرسائل غير مهيأة بعد. أعد المحاولة لاحقاً أو تواصل مع الدعم.',
      };
    }
    if (/row-level security|rls|policy/i.test(msg)) {
      return {
        message: null,
        error: 'تعذّر الإرسال بسبب صلاحيات الحساب. سجّل دخولاً سحابياً ثم أعد المحاولة.',
      };
    }
    if (/foreign key|violates/i.test(msg)) {
      return {
        message: null,
        error: 'المستلم غير موجود. تأكد أنه سجّل عبر التسجيل السحابي.',
      };
    }
    return { message: null, error: msg };
  }
  return { message: rowToMessage(data as MessageRow) };
}

export async function markMessageReadRemote(
  messageId: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !isUuid(messageId)) return false;
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from('messages')
    .update({ read: true })
    .eq('id', messageId);
  if (error) {
    console.warn('[supabase] markMessageRead', error.message);
    return false;
  }
  return true;
}

export function mergeMessagesById(
  remote: Message[],
  local: Message[]
): Message[] {
  const map = new Map<string, Message>();
  for (const m of local) map.set(m.id, m);
  for (const m of remote) map.set(m.id, m);
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function findProfileIdByEmail(
  email: string
): Promise<{ id: string; name: string; email: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('id, name, email')
    .ilike('email', normalized)
    .maybeSingle();
  if (error || !data) {
    // جرّب مطابقة جزئية إن اللصق فيه مسافات
    const { data: loose } = await sb
      .from('profiles')
      .select('id, name, email')
      .ilike('email', `%${normalized}%`)
      .limit(1)
      .maybeSingle();
    if (!loose) return null;
    return {
      id: loose.id as string,
      name: loose.name as string,
      email: loose.email as string,
    };
  }
  return {
    id: data.id as string,
    name: data.name as string,
    email: data.email as string,
  };
}

export async function findSuperadminProfile(): Promise<{
  id: string;
  name: string;
  email: string;
} | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('id, name, email, role, active_role, roles')
    .or('role.eq.superadmin,active_role.eq.superadmin')
    .order('created_at', { ascending: true })
    .limit(5);
  if (error || !data?.length) {
    console.warn('[supabase] findSuperadminProfile', error?.message);
    return null;
  }
  const row =
    data.find(
      (r) =>
        r.role === 'superadmin' ||
        r.active_role === 'superadmin' ||
        (Array.isArray(r.roles) && r.roles.includes('superadmin'))
    ) || data[0];
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
  };
}

export async function getCloudSessionEmail(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.email?.toLowerCase() ?? null;
}
