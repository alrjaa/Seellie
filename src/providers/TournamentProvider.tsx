import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'expo-router';
import { createId } from '@/utils/id';
import { useToast } from '@/providers/ToastProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { getJson, removeJson, setJson } from '@/services/storage';
import {
  loadCompetitionRequests,
  loadStoredCompetitions,
  mergeCompetitionsById,
  saveCompetitionRequests,
  saveCompetitions,
  subscribeCompetitionRequests,
  subscribeCompetitions,
} from '@/services/competition-sync';
import { isValidEmail, normalizeEmail, allocateUniqueHandle, ensureAccountIdentity, nextRegistrationId, formatArabicDate } from '@/utils';
import {
  ensurePasswordHashed,
  hashPassword,
  verifyPassword,
} from '@/utils/password';
import { isSupabaseConfigured } from '@/services/supabase';
import {
  cloudWriteErrorMessage,
  requireCloudSession,
  resolvePublicMediaUrl,
} from '@/services/cloud-write';
import { upsertUserContentCloud } from '@/services/supabase-user-content';
import {
  appendGiftTransaction,
  fetchAppBlob,
  upsertAppBlob,
} from '@/services/supabase-app-blobs';
import {
  DEFAULT_FAB_ICONS,
  FAB_ICONS_STORAGE_KEY,
  type FabIconConfig,
} from '@/types/fab-icons';
import {
  fetchAllProfiles,
  mergeUsersPreferCloud,
  restoreSupabaseSession,
  supabaseSignIn,
  supabaseSignOut,
  supabaseSignUp,
  supabaseUpdatePassword,
  updateProfileRolesCloud,
  updateProfileAdminCloud,
  adminPurgeUserCloud,
  adminPurgeUserByEmailCloud,
} from '@/services/supabase-auth';
import {
  deleteCompetitionRequestCloud,
  fetchCompetitionRequestsCloud,
  mergeCompetitionRequestsById,
  reconcileCompetitionRequestsWithCloud,
  subscribeCompetitionRequestsCloud,
  upsertCompetitionRequestCloud,
  updateCompetitionRequestCloud,
} from '@/services/supabase-competition-requests';
import {
  deleteCompetitionCloud,
  fetchCompetitionsCloud,
  mergeCloudCompetitions,
  reconcileCompetitionsWithCloud,
  subscribeCompetitionsCloud,
  upsertCompetitionCloud,
} from '@/services/supabase-competitions';
import {
  fetchShareCardsForUser,
  insertShareCard,
  updateShareCardRemote,
} from '@/services/supabase-share';
import {
  fetchMessagesForUser,
  insertMessage,
  isUuid,
  markMessageReadRemote,
  mergeMessagesById,
  subscribeMessagesForUser,
} from '@/services/supabase-messages';
import {
  fetchForumComments,
  insertForumComment,
  mergeCommentsById,
  subscribeForumComments,
  toggleForumCommentLikeRemote,
  updateForumCommentStatusRemote,
} from '@/services/supabase-forum-comments';
import { generateAnalystAccessCode } from '@/utils/analyst';
import {
  clearSeedUserContent,
  filterSeedComments,
  filterSeedCompetitionRequests,
  filterSeedCompetitions,
  filterSeedGifts,
  filterSeedOffers,
} from '@/utils/seed-data';
import {
  initialComments,
  initialCompetitions,
  initialCompetitionRequests,
  initialGiftTransactions,
  initialOffers,
  initialQuickComments,
  initialMessages,
  initialReferees,
  initialSupporters,
  initialSupportLevels,
  initialUsers,
  type Comment,
  type Competition,
  type CompetitionRequest,
  type GiftTransaction,
  type Match,
  type Message,
  type Offer,
  type Player,
  type Referee,
  type Supporter,
  type SupportLevel,
  type User,
  type ShareCard,
  type ShareCardKind,
  type ShareCardStatus,
} from '@/data/initial-data';
import { i18n, t } from '@/i18n';
import { localizeContentTree } from '@/i18n/localize-content';
import type { CommentTarget, UserRole } from '@/types';
import { buildRoundRobinFixtures } from '@/utils/competition';
import {
  getSecondaryRole,
  normalizeUserRoles,
  userHasRole,
  type SecondaryRole,
} from '@/utils/roles';
import {
  ensureSocialLists,
  seedSocialRelations,
} from '@/utils/social-stats';
import {
  MIN_COMPETITION_TEAMS,
  buildCompetitionVenueAddress,
  nextCompetitionVisibleId,
} from '@/utils/competition-request';

export type {
  Comment,
  Competition,
  CompetitionRequest,
  CompetitionStaff,
  CompetitionVenue,
  GiftTransaction,
  Match,
  Message,
  Offer,
  Player,
  Referee,
  ShareCard,
  Supporter,
  SupportLevel,
  Team,
  User,
} from '@/data/initial-data';

import { DEFAULT_LOGO, APP_DISPLAY_NAME } from '@/theme/brand';
import { certificateImageUri } from '@/theme/certificates';

const USER_STORAGE_KEY = 'tajjd.secure.currentUser';
const USER_CREDENTIAL_OVERRIDES_KEY = 'seellie.userCredentialOverrides.v1';
const REFEREES_STORAGE_KEY = 'seellie.referees';
const SHARE_CARDS_STORAGE_KEY = 'seellie.shareCards';
const MESSAGES_STORAGE_KEY = 'seellie.messages';
/** حسابات المشرف التجريبية القديمة — تُحذف ولا يُسمح بدخولها */
const LOCAL_DEMO_ADMIN_IDS = new Set(['superadmin-1']);
const LOCAL_DEMO_ADMIN_EMAILS = new Set(['super.admin@test.com']);

function isLegacyLocalDemoAdmin(
  user: { id?: string; email?: string } | null | undefined
) {
  if (!user) return false;
  if (user.id && LOCAL_DEMO_ADMIN_IDS.has(user.id)) return true;
  if (user.email && LOCAL_DEMO_ADMIN_EMAILS.has(normalizeEmail(user.email))) {
    return true;
  }
  return false;
}

type UserCredentialOverride = {
  email?: string;
  passwordHash?: string;
  name?: string;
};

function applyCredentialOverrides(
  list: User[],
  overrides: Record<string, UserCredentialOverride> | null | undefined
): User[] {
  if (!overrides || !Object.keys(overrides).length) return list;
  return list.map((u) => {
    const patch = overrides[u.id];
    if (!patch) return u;
    return {
      ...u,
      ...(patch.email ? { email: normalizeEmail(patch.email) } : null),
      ...(patch.passwordHash
        ? { passwordHash: ensurePasswordHashed(patch.passwordHash) }
        : null),
      ...(patch.name ? { name: patch.name } : null),
    };
  });
}

function mergeRefereesById(base: Referee[], stored: Referee[]): Referee[] {
  const map = new Map<string, Referee>();
  for (const ref of base) map.set(ref.id, ref);
  for (const ref of stored) map.set(ref.id, { ...map.get(ref.id), ...ref });
  return Array.from(map.values());
}

async function saveReferees(items: Referee[]) {
  await setJson(REFEREES_STORAGE_KEY, items);
  if (isSupabaseConfigured()) {
    void upsertAppBlob('referees', items);
  }
}

const APP_LOGO_KEY = 'seellie.appLogo.v3';
const APP_NAME_KEY = 'seellie.appName';
const SUPPORT_LEVELS_KEY = 'seellie.supportLevels.v1';

function normalizeSupportLevels(levels: SupportLevel[]): SupportLevel[] {
  return levels
    .filter((l) => (l.name as string) !== 'محلل')
    .map((level, index) => {
      const bundled = certificateImageUri(level.name);
      return {
        id: level.id || `level-${index + 1}-${level.name}`,
        name: String(level.name || '').trim() || `مستوى ${index + 1}`,
        price: Number(level.price) || 0,
        description: String(level.description || ''),
        imageUrl: level.imageUrl || bundled || '',
      };
    });
}

async function saveSupportLevels(levels: SupportLevel[]) {
  await setJson(SUPPORT_LEVELS_KEY, levels);
  if (isSupabaseConfigured()) {
    void upsertAppBlob('support_levels', levels);
  }
}

async function saveOffersCloud(items: Offer[]) {
  if (isSupabaseConfigured()) {
    void upsertAppBlob('offers', items);
  }
}

async function saveGiftCloudAppend(gift: GiftTransaction) {
  if (!isSupabaseConfigured()) return;
  const payload = {
    ...gift,
    timestamp:
      gift.timestamp instanceof Date
        ? gift.timestamp.toISOString()
        : gift.timestamp,
  };
  void appendGiftTransaction(payload);
}

async function saveBrandingCloud(appName: string, appLogo: string) {
  if (isSupabaseConfigured()) {
    void upsertAppBlob('app_branding', { appName, appLogo });
  }
}

type GlobalAppBlobs = {
  referees: Referee[] | null;
  offers: Offer[] | null;
  levels: SupportLevel[] | null;
  gifts: GiftTransaction[] | null;
  branding: { appName?: string; appLogo?: string } | null;
};

async function fetchGlobalAppBlobs(): Promise<GlobalAppBlobs> {
  const empty: GlobalAppBlobs = {
    referees: null,
    offers: null,
    levels: null,
    gifts: null,
    branding: null,
  };
  if (!isSupabaseConfigured()) return empty;
  const [
    cloudReferees,
    cloudOffers,
    cloudLevels,
    cloudGifts,
    cloudBrand,
  ] = await Promise.all([
    fetchAppBlob<Referee[]>('referees'),
    fetchAppBlob<Offer[]>('offers'),
    fetchAppBlob<SupportLevel[]>('support_levels'),
    fetchAppBlob<GiftTransaction[]>('gift_transactions'),
    fetchAppBlob<{ appName?: string; appLogo?: string }>('app_branding'),
  ]);
  return {
    referees: Array.isArray(cloudReferees.data) ? cloudReferees.data : null,
    offers: Array.isArray(cloudOffers.data) ? cloudOffers.data : null,
    levels: Array.isArray(cloudLevels.data) ? cloudLevels.data : null,
    gifts: Array.isArray(cloudGifts.data) ? cloudGifts.data : null,
    branding: cloudBrand.data || null,
  };
}

export interface TournamentContextType {
  loading: boolean;
  appName: string;
  appLogo: string;
  fabIcons: FabIconConfig[];
  setFabIcons: (icons: FabIconConfig[]) => void;
  personalitySectionBg: string;
  highlightsSectionBg: string;
  users: User[];
  competitions: Competition[];
  competitionRequests: CompetitionRequest[];
  comments: Comment[];
  quickComments: Comment[];
  messages: Message[];
  referees: Referee[];
  offers: Offer[];
  shareCards: ShareCard[];
  supporters: Supporter[];
  supportLevels: SupportLevel[];
  giftTransactions: GiftTransaction[];
  currentUser: User | null;
  login: (
    email: string,
    password: string,
    options?: { portal?: 'app' | 'admin' }
  ) => Promise<boolean>;
  /** to: 'admin' يخرج من المتابع/المنظم ويفتح بوابة المشرف */
  logout: (options?: { to?: 'login' | 'admin'; silent?: boolean }) => void;
  signUp: (
    userData: Pick<User, 'name' | 'email'>,
    password: string
  ) => Promise<boolean>;
  /** تفعيل مسار ثانٍ واحد: منظم أو لاعب حر (مع المتابع) */
  enableSecondaryRole: (
    role: SecondaryRole,
    termsAccepted: boolean
  ) => Promise<boolean>;
  /** التبديل بين المتابع والمسار الثانوي */
  switchActiveRole: (role: UserRole) => boolean;
  setAppName: (name: string) => void;
  setAppLogo: (logo: string) => void;
  updateUser: (user: User, successMessage?: string) => void;
  /** مزامنة كل حسابات profiles من Supabase إلى قائمة إدارة المستخدمين */
  syncCloudUsers: () => Promise<number>;
  /** جلب طلبات تنظيم المسابقات من السحابة */
  refreshCloudCompetitionRequests: () => Promise<number>;
  /** تثبيت/إلغاء تثبيت بطولة في الرئيسية الشخصية */
  togglePinnedCompetition: (competitionId: string) => void;
  deleteUser: (
    userId: string,
    successMessage?: string
  ) => Promise<boolean>;
  /** حذف نهائي بالبريد من Auth (يحرّر الإيميل للتسجيل) */
  purgeUserByEmail: (email: string) => Promise<boolean>;
  addReferee: (
    data: Omit<Referee, 'id'>,
    successMessage?: string
  ) => string | null;
  /** تسجيل حكم جديد وربطه مباشرة بمسابقة المنظم */
  registerRefereeForCompetition: (
    competitionId: string,
    data: {
      name: string;
      role: Referee['role'];
      mobile?: string;
      city?: string;
      avatar?: string;
    },
    successMessage?: string
  ) => boolean;
  updateReferee: (referee: Referee, successMessage?: string) => void;
  deleteReferee: (refereeId: string, successMessage?: string) => void;
  markMessageAsRead: (messageId: string) => void;
  deleteQuickComment: (commentId: string, successMessage?: string) => void;
  addQuickComment: (text: string) => void;
  addComment: (
    text: string,
    audioUrl?: string,
    target?: CommentTarget,
    extras?: { videoUrl?: string; videoDurationSec?: number }
  ) => void;
  toggleCommentLike: (commentId: string) => void;
  updateDiscussionStatus: (
    payload: {
      type: 'comment' | 'analysis';
      id: string;
      authorId?: string;
      status: 'active' | 'warned' | 'suspended' | 'blocked';
      reason?: string;
    },
    successMessage?: string
  ) => void;
  updateSupportLevels: (levels: SupportLevel[]) => void;
  /** شراء شهادة دعم وتوجيهها للاعب أو منظم */
  purchaseSupportGift: (payload: {
    certificateType: string;
    recipientId: string;
    recipientName: string;
    recipientType: GiftTransaction['recipientType'];
    recipientVisibleId?: string;
  }) => GiftTransaction | null;
  updateCompetition: (
    competition: Competition,
    successMessage?: string
  ) => void;
  updateCompetitionStatus: (
    competitionId: string,
    status: Competition['status'],
    options?: { reason?: string; successMessage?: string }
  ) => void;
  /** إيقاف أو تفعيل جدول المباريات مع سبب عند الإيقاف */
  setCompetitionFixturesSuspended: (
    competitionId: string,
    suspended: boolean,
    options?: { reason?: string; successMessage?: string }
  ) => boolean;
  updatePlayerStatus: (
    competitionId: string,
    teamId: string,
    playerId: string,
    status: Player['status'],
    options?: { reason?: string; successMessage?: string }
  ) => void;
  generateFixturesForCompetition: (competitionId: string) => boolean;
  /** طلب منظم لإنشاء مسابقة جديدة (شروط + تعهدات) */
  applyForCompetition: (payload: {
    name: string;
    region: string;
    city: string;
    neighborhood: string;
    venueName: string;
    termsAccepted: boolean;
    diligencePledge: boolean;
    stadiumPledge: boolean;
    minTeamsPledge: boolean;
    firstAidPledge: boolean;
    orderPledge: boolean;
  }) => Promise<boolean>;
  approveCompetitionRequest: (requestId: string) => Promise<boolean>;
  rejectCompetitionRequest: (requestId: string, reason?: string) => Promise<boolean>;
  updateMatchResult: (
    competitionId: string,
    matchId: string,
    team1Score: number,
    team2Score: number
  ) => void;
  assignRefereeToCompetition: (
    competitionId: string,
    refereeId: string,
    successMessage?: string
  ) => void;
  removeRefereeFromCompetition: (
    competitionId: string,
    refereeId: string,
    successMessage?: string
  ) => void;
  updateOfferStatus: (
    offerId: string,
    status: 'accepted' | 'declined',
    successMessage?: string
  ) => void;
  sendOffer: (freelancerId: string, teamId: string, message: string) => boolean;
  sendMessage: (payload: {
    recipientId: string;
    subject: string;
    body: string;
  }) => Promise<boolean>;
  mergeRemoteMessages: (remote: Message[]) => void;
  refreshCloudMessages: () => Promise<void>;
  refreshCloudForumComments: () => Promise<void>;
  sendShareCard: (input: {
    kind: ShareCardKind;
    recipientId: string;
    recipientName: string;
    recipientKind?: 'user' | 'referee';
    title?: string;
    body?: string;
    mediaUrl?: string;
    mediaKind?: 'photo' | 'video' | 'text' | 'link';
    competitionId?: string;
    competitionName?: string;
    teamId?: string;
    teamName?: string;
    position?: string;
  }) => Promise<boolean>;

  updateShareCardStatus: (
    cardId: string,
    status: ShareCardStatus
  ) => boolean;
  markShareCardRead: (cardId: string) => void;
  addTeam: (
    competitionId: string,
    teamData: { name: string; logo?: string },
    successMessage?: string
  ) => void;
  renameCompetition: (
    competitionId: string,
    name: string,
    successMessage?: string
  ) => boolean;
  deleteCompetition: (
    competitionId: string,
    successMessage?: string
  ) => Promise<boolean>;
  /** حذف طلب تنظيم مسابقة (المنظم لطلباته / المشرف لأي طلب) */
  deleteCompetitionRequest: (
    requestId: string,
    successMessage?: string
  ) => Promise<boolean>;
  renameTeam: (
    competitionId: string,
    teamId: string,
    name: string,
    successMessage?: string
  ) => boolean;
  deleteTeam: (
    competitionId: string,
    teamId: string,
    successMessage?: string
  ) => boolean;
  addPlayerToTeam: (
    competitionId: string,
    teamId: string,
    playerData: {
      name: string;
      jerseyNumber: number;
      position: Player['position'];
      avatar?: string;
    },
    successMessage?: string
  ) => void;
  updatePlayerAvatar: (
    competitionId: string,
    teamId: string,
    playerId: string,
    avatar: string | undefined,
    successMessage?: string
  ) => boolean;
  addStaffToCompetition: (
    competitionId: string,
    staffData: {
      name: string;
      role: string;
      mobile?: string;
      avatar?: string;
    },
    successMessage?: string
  ) => boolean;
  updateStaffAvatar: (
    competitionId: string,
    staffId: string,
    avatar: string | undefined,
    successMessage?: string
  ) => boolean;
  removeStaffFromCompetition: (
    competitionId: string,
    staffId: string,
    successMessage?: string
  ) => boolean;
  addAnalysis: (data: {
    title: string;
    content: string;
    videoUrl?: string;
    matchId?: string;
  }) => Promise<boolean>;
  /** طلب الانضمام كمحلل من صفحة الفريد بعد الموافقة على الشروط */
  applyAsAnalyst: (termsAccepted: boolean) => boolean;
  /** موافقة الإدارة على طلب المحلل + إرسال رمز عبر البريد */
  approveAnalystApplication: (userId: string) => boolean;
  rejectAnalystApplication: (userId: string, reason?: string) => boolean;
  /** إنذار محلل معتمد */
  warnAnalyst: (userId: string, reason: string) => boolean;
  /** إيقاف مؤقت من تاريخ إلى تاريخ */
  suspendAnalyst: (
    userId: string,
    from: Date | string,
    to: Date | string,
    reason: string
  ) => boolean;
  /** إيقاف نهائي لحساب المحلل */
  banAnalyst: (userId: string, reason: string) => boolean;
  /** إعادة تفعيل المحلل بعد إنذار/إيقاف */
  reinstateAnalyst: (userId: string) => boolean;
  /** تفعيل النشر بعد إدخال الرمز المستلم بالإيميل */
  verifyAnalystAccessCode: (code: string) => boolean;
  togglePostLike: (authorId: string, postId: string) => void;
  toggleAnalysisLike: (authorId: string, analysisId: string) => void;
  toggleMediaLike: (
    authorId: string,
    mediaId: string,
    mediaType: 'photo' | 'video',
    source?: 'user' | 'player' | 'match' | 'competition'
  ) => void;
  changePassword: (
    currentPassword: string,
    nextPassword: string
  ) => Promise<boolean>;
  addUserMedia: (
    type: 'photos' | 'videos',
    url: string,
    successMessage?: string
  ) => Promise<boolean>;
  removeUserMedia: (
    type: 'photos' | 'videos',
    mediaId: string,
    successMessage?: string
  ) => Promise<boolean>;
  addCompetitionMedia: (
    competitionId: string,
    type: 'photos' | 'videos',
    url: string,
    successMessage?: string,
    matchId?: string
  ) => Promise<boolean>;
  /** حذف صورة/فيديو من مسابقة أو مباراة أو لاعب (منظّم فقط) */
  removeCompetitionMedia: (input: {
    competitionId: string;
    mediaId: string;
    type: 'photos' | 'videos';
    matchId?: string;
    playerId?: string;
    successMessage?: string;
  }) => Promise<boolean>;
  setUserAvatar: (url: string, successMessage?: string) => Promise<boolean>;
  /** متابعة / إلغاء متابعة حساب آخر */
  toggleFollowUser: (targetUserId: string) => boolean;
  routeForRole: (role: UserRole) => string;
}

const TournamentContext = createContext<TournamentContextType | undefined>(
  undefined
);

function withLocalizedSeed<T>(data: T): T {
  return i18n.locale === 'en' ? localizeContentTree(data) : data;
}

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [appName, setAppNameState] = useState(APP_DISPLAY_NAME);
  const [appLogo, setAppLogoState] = useState(DEFAULT_LOGO);
  const [fabIcons, setFabIconsState] =
    useState<FabIconConfig[]>(DEFAULT_FAB_ICONS);
  const [personalitySectionBg] = useState(
    'https://storage.googleapis.com/stey-public/stey-studio-website/example-images/4bb4e045-b470-4f23-b78c-fd771b6c9c1e.jpg'
  );
  const [highlightsSectionBg] = useState(
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  );
  const [users, setUsers] = useState<User[]>(() =>
    seedSocialRelations(
      withLocalizedSeed(initialUsers).map((u) =>
        ensureSocialLists(
          normalizeUserRoles({
            ...u,
            passwordHash: ensurePasswordHashed(u.passwordHash),
          })
        )
      )
    )
  );
  const [competitions, setCompetitions] = useState<Competition[]>(() =>
    withLocalizedSeed(initialCompetitions)
  );
  const [competitionRequests, setCompetitionRequests] = useState<
    CompetitionRequest[]
  >(() => withLocalizedSeed(initialCompetitionRequests));
  const [comments, setComments] = useState<Comment[]>(() =>
    withLocalizedSeed(initialComments)
  );
  const [quickComments, setQuickComments] = useState<Comment[]>(() =>
    withLocalizedSeed(initialQuickComments)
  );
  const [messages, setMessages] = useState<Message[]>(() =>
    withLocalizedSeed(initialMessages)
  );
  const [referees, setReferees] = useState<Referee[]>(() =>
    withLocalizedSeed(initialReferees)
  );
  const [offers, setOffers] = useState<Offer[]>(() =>
    withLocalizedSeed(initialOffers)
  );
  const [shareCards, setShareCards] = useState<ShareCard[]>([]);
  const [supporters] = useState<Supporter[]>(() =>
    withLocalizedSeed(initialSupporters)
  );
  const [supportLevels, setSupportLevels] = useState<SupportLevel[]>(() =>
    normalizeSupportLevels(withLocalizedSeed(initialSupportLevels))
  );
  const [giftTransactions, setGiftTransactions] = useState<GiftTransaction[]>(
    () => withLocalizedSeed(initialGiftTransactions)
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { addNotification } = useNotifications();

  /** مزامنة مسابقات مع إشعار عند فشل السحابة لحساب سحابي */
  const syncCompetitions = useCallback(
    async (next: Competition[], options?: { fromCloud?: boolean }) => {
      const res = await saveCompetitions(next, options);
      if (
        !options?.fromCloud &&
        !res.ok &&
        res.error &&
        res.error !== 'no_session' &&
        res.error !== 'not_configured' &&
        currentUser &&
        isUuid(currentUser.id)
      ) {
        toast({
          variant: 'destructive',
          title: t('cloud.competitionSyncFailed'),
          description: cloudWriteErrorMessage(res.error),
        });
      }
      return res.ok;
    },
    [currentUser, t, toast]
  );

  /** عند الحساب السحابي: أخفِ مسابقات/محتوى الحسابات التجريبية */
  const purgeDemoSeedForCloudUser = useCallback(() => {
    setCompetitions((prev) => filterSeedCompetitions(prev));
    setComments((prev) => filterSeedComments(prev));
    setQuickComments((prev) => filterSeedComments(prev));
    setUsers((prev) => prev.map(clearSeedUserContent));
    setOffers((prev) => filterSeedOffers(prev));
    setGiftTransactions((prev) => filterSeedGifts(prev));
    setCompetitionRequests((prev) => filterSeedCompetitionRequests(prev));
  }, []);

  useEffect(() => {
    if (!currentUser || !isUuid(currentUser.id)) return;
    purgeDemoSeedForCloudUser();
  }, [currentUser?.id, purgeDemoSeedForCloudUser]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [
          stored,
          storedLogo,
          storedName,
          storedRequests,
          storedCompetitions,
          storedReferees,
          storedSupportLevels,
          storedShareCards,
          storedMessages,
          storedCredentialOverrides,
          storedFabIcons,
        ] = await Promise.all([
          getJson<User>(USER_STORAGE_KEY),
          getJson<string>(APP_LOGO_KEY),
          getJson<string>(APP_NAME_KEY),
          loadCompetitionRequests(),
          loadStoredCompetitions(),
          getJson<Referee[]>(REFEREES_STORAGE_KEY),
          getJson<SupportLevel[]>(SUPPORT_LEVELS_KEY),
          getJson<ShareCard[]>(SHARE_CARDS_STORAGE_KEY),
          getJson<Message[]>(MESSAGES_STORAGE_KEY),
          getJson<Record<string, UserCredentialOverride>>(
            USER_CREDENTIAL_OVERRIDES_KEY
          ),
          getJson<FabIconConfig[]>(FAB_ICONS_STORAGE_KEY),
        ]);
        if (!active) return;
        if (Array.isArray(storedFabIcons) && storedFabIcons.length > 0) {
          setFabIconsState(
            storedFabIcons.filter(
              (i) => i?.id && i?.icon && i?.href
            ) as FabIconConfig[]
          );
        }
        if (storedCredentialOverrides) {
          setUsers((prev) =>
            applyCredentialOverrides(prev, storedCredentialOverrides)
          );
        }
        if (Array.isArray(storedMessages) && storedMessages.length) {
          setMessages(
            storedMessages.map((m) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }))
          );
        }
        if (stored && isLegacyLocalDemoAdmin(stored)) {
          void removeJson(USER_STORAGE_KEY);
          setCurrentUser(null);
        } else if (stored && stored.email && stored.role) {
          try {
            const match =
              initialUsers.find(
                (u) => normalizeEmail(u.email) === normalizeEmail(stored.email)
              ) || initialUsers.find((u) => u.id === stored.id);
            const base = match
              ? {
                  ...match,
                  ...stored,
                  // ثبّت المعرف والدور من البذرة، واسمح بتعديل الإيميل/كلمة المرور المحفوظة
                  id: match.id,
                  email: stored.email || match.email,
                  passwordHash: ensurePasswordHashed(
                    stored.passwordHash || match.passwordHash
                  ),
                  handle: match.handle || stored.handle,
                  visibleId: match.visibleId || stored.visibleId,
                  role: match.role,
                  // احتفظ بتخصيص المستخدم المحلي
                  name: stored.name || match.name,
                  bio: stored.bio ?? match.bio,
                  city: stored.city || match.city,
                  region: stored.region || match.region,
                  country: stored.country || match.country,
                  pinnedCompetitionIds:
                    stored.pinnedCompetitionIds ??
                    match.pinnedCompetitionIds ??
                    [],
                  analyst: stored.analyst ?? match.analyst,
                  roles: stored.roles?.length ? stored.roles : match.roles,
                  activeRole:
                    stored.activeRole ?? match.activeRole ?? match.role,
                  avatar: stored.avatar || match.avatar,
                  permissions: stored.permissions || match.permissions,
                  followers: stored.followers?.length
                    ? stored.followers
                    : match.followers,
                  following: stored.following?.length
                    ? stored.following
                    : match.following,
                }
              : stored;
            const mergedRaw = ensureSocialLists(
              normalizeUserRoles(ensureAccountIdentity(base, initialUsers))
            );
            const merged =
              i18n.locale === 'en'
                ? localizeContentTree(mergedRaw)
                : mergedRaw;
            setCurrentUser(merged);
            void setJson(USER_STORAGE_KEY, merged);
            setUsers((prev) => {
              if (prev.some((u) => u.id === merged.id)) {
                return prev.map((u) =>
                  u.id === merged.id ? normalizeUserRoles({ ...u, ...merged }) : u
                );
              }
              return [...prev, merged];
            });
          } catch (error) {
            console.warn('session restore failed', error);
            void removeJson(USER_STORAGE_KEY);
            setCurrentUser(null);
          }
        }
        if (storedLogo) setAppLogoState(storedLogo);
        if (storedName) setAppNameState(storedName);
        if (storedRequests.length > 0) {
          setCompetitionRequests(storedRequests);
        }
        if (storedCompetitions.length > 0) {
          setCompetitions((prev) =>
            mergeCompetitionsById(prev, storedCompetitions)
          );
        }
        if (storedReferees && storedReferees.length > 0) {
          setReferees((prev) => mergeRefereesById(prev, storedReferees));
        }
        if (storedSupportLevels && storedSupportLevels.length > 0) {
          setSupportLevels(normalizeSupportLevels(storedSupportLevels));
        }
        if (storedShareCards && storedShareCards.length > 0) {
          setShareCards(
            storedShareCards.map((c) => ({
              ...c,
              timestamp: new Date(c.timestamp),
            }))
          );
        }

        // استعادة جلسة Supabase إن وُجدت (لها أولوية على الجلسة المحلية التجريبية)
        if (isSupabaseConfigured()) {
          const remoteUser = await restoreSupabaseSession();
          if (remoteUser) {
            const normalizedUser = ensureSocialLists(
              normalizeUserRoles(remoteUser)
            );
            setCurrentUser(normalizedUser);
            setUsers((prev) => {
              if (prev.some((u) => u.id === normalizedUser.id)) {
                return prev.map((u) =>
                  u.id === normalizedUser.id
                    ? { ...u, ...normalizedUser }
                    : u
                );
              }
              return [...prev, normalizedUser];
            });
            void setJson(USER_STORAGE_KEY, normalizedUser);
            const [
              cards,
              remoteMessagesResult,
              cloudProfiles,
              cloudRequests,
              cloudCompetitions,
            ] = await Promise.all([
              fetchShareCardsForUser(normalizedUser.id),
              fetchMessagesForUser(normalizedUser.id),
              fetchAllProfiles(),
              fetchCompetitionRequestsCloud(),
              fetchCompetitionsCloud(),
            ]);
            if (cloudProfiles.length) {
              setUsers((prev) =>
                mergeUsersPreferCloud(prev, cloudProfiles)
              );
            }
            setCompetitionRequests((prev) => {
              const merged = reconcileCompetitionRequestsWithCloud(
                prev,
                cloudRequests.items
              );
              void saveCompetitionRequests(merged);
              return merged;
            });
            setCompetitions((prev) => {
              const merged = reconcileCompetitionsWithCloud(
                prev,
                cloudCompetitions.items
              );
              void saveCompetitions(merged, { fromCloud: true });
              return merged;
            });
            if (cards.length) {
              setShareCards((prev) => {
                const ids = new Set(cards.map((c) => c.id));
                return [...cards, ...prev.filter((c) => !ids.has(c.id))];
              });
            }
            if (remoteMessagesResult.messages.length) {
              setMessages((prev) =>
                mergeMessagesById(remoteMessagesResult.messages, prev)
              );
            }

            // تحميل نطاقات التطبيق من app_blobs
            const blobs = await fetchGlobalAppBlobs();
            if (blobs.referees?.length) {
              setReferees((prev) => mergeRefereesById(prev, blobs.referees!));
            }
            if (blobs.offers) setOffers(blobs.offers);
            if (blobs.levels?.length) {
              setSupportLevels(normalizeSupportLevels(blobs.levels));
            }
            if (blobs.gifts) {
              setGiftTransactions(
                blobs.gifts.map((g) => ({
                  ...g,
                  timestamp: new Date(g.timestamp as Date | string),
                }))
              );
            }
            if (blobs.branding?.appName) setAppNameState(blobs.branding.appName);
            if (blobs.branding?.appLogo) setAppLogoState(blobs.branding.appLogo);
          }
        }
      } catch (error) {
        console.warn('bootstrap failed', error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    void setJson(SHARE_CARDS_STORAGE_KEY, shareCards);
  }, [shareCards, loading]);

  useEffect(() => {
    if (loading) return;
    void setJson(MESSAGES_STORAGE_KEY, messages);
  }, [messages, loading]);

  useEffect(() => {
    const unsubRequests = isSupabaseConfigured()
      ? null
      : subscribeCompetitionRequests((items) => {
          setCompetitionRequests((prev) =>
            mergeCompetitionRequestsById(prev, items)
          );
        });
    const unsubCloudRequests = subscribeCompetitionRequestsCloud((items) => {
      setCompetitionRequests((prev) => {
        const merged = reconcileCompetitionRequestsWithCloud(prev, items);
        void saveCompetitionRequests(merged);
        return merged;
      });
    });
    const unsubCompetitions = isSupabaseConfigured()
      ? null
      : subscribeCompetitions((items) => {
          setCompetitions((prev) => mergeCompetitionsById(prev, items));
        });
    const unsubCloudCompetitions = subscribeCompetitionsCloud((items) => {
      setCompetitions((prev) => {
        const merged = reconcileCompetitionsWithCloud(prev, items);
        void saveCompetitions(merged, { fromCloud: true });
        return merged;
      });
    });
    return () => {
      unsubRequests?.();
      unsubCloudRequests?.();
      unsubCompetitions?.();
      unsubCloudCompetitions?.();
    };
  }, []);

  const syncCloudUsers = useCallback(async () => {
    if (!isSupabaseConfigured()) return 0;
    const cloudProfiles = await fetchAllProfiles();
    if (!cloudProfiles.length) return 0;
    setUsers((prev) => mergeUsersPreferCloud(prev, cloudProfiles));
    return cloudProfiles.length;
  }, []);

  const refreshCloudCompetitionRequests = useCallback(async () => {
    if (!isSupabaseConfigured()) return 0;
    const [cloud, comps] = await Promise.all([
      fetchCompetitionRequestsCloud(),
      fetchCompetitionsCloud(),
    ]);
    if (cloud.error === 'no_session') return 0;
    if (!cloud.items.length && cloud.error) {
      console.warn('[competition-requests]', cloud.error);
    }
    setCompetitionRequests((prev) => {
      const merged = reconcileCompetitionRequestsWithCloud(prev, cloud.items);
      void saveCompetitionRequests(merged);
      return merged;
    });
    setCompetitions((prev) => {
      const merged = reconcileCompetitionsWithCloud(prev, comps.items);
      void saveCompetitions(merged, { fromCloud: true });
      return merged;
    });
    return cloud.items.length;
  }, []);

  const routeForRole = useCallback((role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return '/(superadmin)';
      case 'organizer':
        return '/(organizer)';
      case 'freelancer':
        return '/(freelancer)';
      case 'follower':
      default:
        return '/(follower)';
    }
  }, []);

  const setAppName = useCallback((name: string) => {
    setAppNameState(name);
    void setJson(APP_NAME_KEY, name);
    void saveBrandingCloud(name, appLogo);
  }, [appLogo]);

  const setAppLogo = useCallback((logo: string) => {
    if (!logo.trim()) {
      setAppLogoState(DEFAULT_LOGO);
      void removeJson(APP_LOGO_KEY);
      void saveBrandingCloud(appName, DEFAULT_LOGO);
      return;
    }
    setAppLogoState(logo);
    void setJson(APP_LOGO_KEY, logo);
    void saveBrandingCloud(appName, logo);
  }, [appName]);

  const setFabIcons = useCallback((icons: FabIconConfig[]) => {
    const next = icons
      .filter((i) => i?.id && String(i.icon || '').trim() && String(i.href || '').trim())
      .map((i) => ({
        id: String(i.id),
        label: String(i.label || '').trim() || i.href,
        icon: String(i.icon).trim(),
        href: String(i.href).trim(),
      }));
    setFabIconsState(next.length ? next : DEFAULT_FAB_ICONS);
    void setJson(FAB_ICONS_STORAGE_KEY, next.length ? next : DEFAULT_FAB_ICONS);
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      options?: { portal?: 'app' | 'admin' }
    ) => {
      const portal = options?.portal ?? 'app';
      const normalized = normalizeEmail(email);
      if (!isValidEmail(normalized) || !password.trim()) {
        toast({
          variant: 'destructive',
          title: t('toasts.t000_c5c614'),
          description: t('toasts.t073_14f14b'),
        });
        return false;
      }

      // 1) Supabase Auth عند التهيئة (التطبيق وبوابة المشرف)
      let supabaseAuthError: string | undefined;
      if (isSupabaseConfigured()) {
        const remote = await supabaseSignIn(normalized, password);
        if (remote.user) {
          if (
            remote.user.status === 'suspended' ||
            remote.user.status === 'blocked'
          ) {
            toast({
              variant: 'destructive',
              title: t('toasts.t001_1a486b'),
              description: t('toasts.t074_7ca6a2'),
            });
            await supabaseSignOut();
            return false;
          }
          const normalizedUser = ensureSocialLists(
            normalizeUserRoles(remote.user)
          );
          const isAdmin = normalizedUser.role === 'superadmin';

          if (portal === 'admin' && !isAdmin) {
            await supabaseSignOut();
            toast({
              variant: 'destructive',
              title: t('auth.adminPortalOnlyTitle'),
              description: t('auth.adminNotPromotedDesc'),
            });
            return false;
          }

          if (portal === 'app' && isAdmin) {
            await supabaseSignOut();
            toast({
              variant: 'destructive',
              title: t('auth.useAdminLoginTitle'),
              description: t('auth.useAdminLoginDesc'),
            });
            return false;
          }

          setCurrentUser(normalizedUser);
          setUsers((prev) => {
            if (prev.some((u) => u.id === normalizedUser.id)) {
              return prev.map((u) =>
                u.id === normalizedUser.id ? { ...u, ...normalizedUser } : u
              );
            }
            return [...prev, normalizedUser];
          });
          void setJson(USER_STORAGE_KEY, normalizedUser);
          const [
            cards,
            remoteMessagesResult,
            cloudProfiles,
            cloudRequests,
            cloudCompetitions,
          ] = await Promise.all([
            fetchShareCardsForUser(normalizedUser.id),
            fetchMessagesForUser(normalizedUser.id),
            fetchAllProfiles(),
            fetchCompetitionRequestsCloud(),
            fetchCompetitionsCloud(),
          ]);
          if (cloudProfiles.length) {
            setUsers((prev) =>
              mergeUsersPreferCloud(prev, cloudProfiles)
            );
          }
          setCompetitionRequests((prev) => {
            const merged = reconcileCompetitionRequestsWithCloud(
              prev,
              cloudRequests.items
            );
            void saveCompetitionRequests(merged);
            return merged;
          });
          setCompetitions((prev) => {
            const merged = reconcileCompetitionsWithCloud(
              prev,
              cloudCompetitions.items
            );
            void saveCompetitions(merged, { fromCloud: true });
            return merged;
          });
          if (cards.length) {
            setShareCards((prev) => {
              const ids = new Set(cards.map((c) => c.id));
              return [...cards, ...prev.filter((c) => !ids.has(c.id))];
            });
          }
          if (remoteMessagesResult.messages.length) {
            setMessages((prev) =>
              mergeMessagesById(remoteMessagesResult.messages, prev)
            );
          }
          const blobs = await fetchGlobalAppBlobs();
          if (blobs.referees?.length) {
            setReferees((prev) => mergeRefereesById(prev, blobs.referees!));
          }
          if (blobs.offers) setOffers(blobs.offers);
          if (blobs.levels?.length) {
            setSupportLevels(normalizeSupportLevels(blobs.levels));
          }
          if (blobs.gifts) {
            setGiftTransactions(
              blobs.gifts.map((g) => ({
                ...g,
                timestamp: new Date(g.timestamp as Date | string),
              }))
            );
          }
          if (blobs.branding?.appName) setAppNameState(blobs.branding.appName);
          if (blobs.branding?.appLogo) setAppLogoState(blobs.branding.appLogo);
          toast({
            variant: 'success',
            title: t('toasts.t002_202a45'),
            description: isAdmin
              ? `مشرف سحابي ✓ ${normalizedUser.email}`
              : t('toasts.welcomeBack', {
                  name: normalizedUser.name,
                }),
          });
          router.replace(
            routeForRole(
              normalizedUser.activeRole || normalizedUser.role
            ) as any
          );
          return true;
        }
        supabaseAuthError = remote.error;
        if (/confirm|confirmation|verify/i.test(remote.error || '')) {
          toast({
            variant: 'destructive',
            title: t('toasts.t003_7a384c'),
            description: t('auth.emailUnconfirmedDesc'),
          });
          return false;
        }

        // بوابة المشرف: سحابة فقط — لا حساب محلي تجريبي
        if (portal === 'admin') {
          const err = (supabaseAuthError || '').toLowerCase();
          let hint = t('auth.adminCloudLoginHint');
          if (/invalid login|invalid credentials|wrong/i.test(err)) {
            hint = t('auth.adminBadCredentialsHint');
          } else if (/confirm|confirmation|verify/i.test(err)) {
            hint = t('auth.adminEmailUnconfirmedHint');
          } else if (/network|fetch|failed to fetch/i.test(err)) {
            hint = t('auth.adminNetworkHint');
          }
          toast({
            variant: 'destructive',
            title: t('auth.adminCloudLoginFailedTitle'),
            description: hint,
          });
          return false;
        }

        // إنتاج: لا تسمح بالحسابات التجريبية المحلية عندما السحابة مهيأة
        const allowLocalDemo =
          typeof __DEV__ !== 'undefined' && __DEV__ === true;
        if (!allowLocalDemo) {
          toast({
            variant: 'destructive',
            title: t('toasts.t003_7a384c'),
            description:
              supabaseAuthError || t('auth.adminCloudLoginFailedTitle'),
          });
          return false;
        }
      } else if (portal === 'admin') {
        toast({
          variant: 'destructive',
          title: t('auth.adminSupabaseMissingTitle'),
          description: t('auth.adminSupabaseMissingDesc'),
        });
        return false;
      }

      // 2) حسابات تجريبية محلية (fallback للتطبيق فقط — ليس للمشرف)
      if (isLegacyLocalDemoAdmin({ email: normalized })) {
        toast({
          variant: 'destructive',
          title: t('toasts.t007_04edd0'),
          description: t('superadmin.settings.localDemoToastDesc'),
        });
        return false;
      }

      const user = users.find((u) => normalizeEmail(u.email) === normalized);
      if (user && verifyPassword(password, user.passwordHash)) {
        if (user.status === 'suspended' || user.status === 'blocked') {
          toast({
            variant: 'destructive',
            title: t('toasts.t001_1a486b'),
            description: t('toasts.t074_7ca6a2'),
          });
          return false;
        }
        const withHashed = {
          ...user,
          passwordHash: ensurePasswordHashed(user.passwordHash),
        };
        const normalizedUser = ensureSocialLists(normalizeUserRoles(withHashed));
        const isAdmin = normalizedUser.role === 'superadmin';

        if (isAdmin) {
          toast({
            variant: 'destructive',
            title: t('auth.useAdminLoginTitle'),
            description: t('auth.useAdminLoginDesc'),
          });
          return false;
        }

        setCurrentUser(normalizedUser);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === normalizedUser.id
              ? { ...u, passwordHash: normalizedUser.passwordHash }
              : u
          )
        );
        void setJson(USER_STORAGE_KEY, normalizedUser);
        toast({
          variant: 'success',
          title: t('toasts.t002_202a45'),
          description: t('toasts.welcomeBack', { name: normalizedUser.name }),
        });
        router.replace(
          routeForRole(normalizedUser.activeRole || normalizedUser.role) as any
        );
        return true;
      }

      toast({
        variant: 'destructive',
        title: t('toasts.t003_7a384c'),
        description:
          supabaseAuthError &&
          /sending confirmation email|email/i.test(supabaseAuthError)
            ? 'تعذّر تأكيد البريد من Supabase. عطّل Confirm email أو استخدم حساباً تجريبياً محلياً.'
            : supabaseAuthError &&
                !/invalid login credentials/i.test(supabaseAuthError)
              ? supabaseAuthError
              : t('toasts.t075_ac9b07'),
      });
      return false;
    },
    [users, toast, router, routeForRole, t]
  );

  const signUp = useCallback(
    async (userData: Pick<User, 'name' | 'email'>, password: string) => {
      const email = normalizeEmail(userData.email);
      if (!userData.name.trim() || !isValidEmail(email) || password.length < 6) {
        toast({
          variant: 'destructive',
          title: t('toasts.t004_8fdbe1'),
          description: t('toasts.t076_91bef0'),
        });
        return false;
      }

      if (isSupabaseConfigured()) {
        const remote = await supabaseSignUp({
          name: userData.name.trim(),
          email,
          password,
        });
        if (remote.user) {
          const newUser = ensureSocialLists(normalizeUserRoles(remote.user));
          setUsers((prev) =>
            prev.some((u) => u.id === newUser.id)
              ? prev.map((u) => (u.id === newUser.id ? newUser : u))
              : [...prev, newUser]
          );
          setCurrentUser(newUser);
          void setJson(USER_STORAGE_KEY, newUser);
          toast({
            variant: 'success',
            title: t('toasts.t006_e4142f'),
            description: t('toasts.t078_462ce2'),
          });
          router.replace(routeForRole('follower') as any);
          return true;
        }
        const rateLimited = /rate limit|too many/i.test(remote.error || '');
        const alreadyExists = /already|exists|registered/i.test(
          remote.error || ''
        );
        toast({
          variant: 'destructive',
          title: t('toasts.t004_8fdbe1'),
          description: rateLimited
            ? 'تم تجاوز حد إيميلات Supabase. انتظر بضع دقائق ثم أنشئ حساباً جديداً.'
            : alreadyExists
              ? 'البريد مسجّل مسبقاً. سجّل الدخول، أو اطلب من المشرف «تحرير بريد عالق» في إدارة المستخدمين.'
              : remote.error ||
                'تعذّر إنشاء الحساب في السحابة. تأكد أن Confirm email معطّل ثم أعد المحاولة.',
        });
        return false;
      }

      if (users.some((u) => normalizeEmail(u.email) === email)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t005_8483e5'),
          description: t('toasts.t077_bf5031'),
        });
        return false;
      }

      const draft: User = {
        name: userData.name.trim(),
        email,
        role: 'follower',
        roles: ['follower'],
        activeRole: 'follower',
        id: createId(),
        passwordHash: hashPassword(password),
        status: 'active',
        permissions: {
          canComment: true,
          canUseVoice: true,
          canNominateToPersonality: false,
          canCreateContent: false,
        },
        handle: allocateUniqueHandle(
          userData.email.split('@')[0] || 'follower',
          users.map((u) => u.handle)
        ),
        visibleId: nextRegistrationId('follower', users),
        posts: [],
        media: { photos: [], videos: [] },
        personalityPhotos: [],
        analysisContent: [],
        comments: [],
      };
      const newUser = normalizeUserRoles(
        ensureAccountIdentity(draft, users)
      );
      setUsers((prev) => [...prev, newUser]);
      setCurrentUser(newUser);
      void setJson(USER_STORAGE_KEY, newUser);
      toast({
        variant: 'success',
        title: t('toasts.t006_e4142f'),
        description: t('toasts.t078_462ce2'),
      });
      router.replace(routeForRole('follower') as any);
      return true;
    },
    [users, toast, router, routeForRole, t]
  );

  const switchActiveRole = useCallback(
    (role: UserRole) => {
      if (!currentUser) return false;
      const normalized = normalizeUserRoles(currentUser);
      if (!normalized.roles.includes(role)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t007_04edd0'),
          description: t('toasts.t079_bbe213'),
        });
        return false;
      }
      const updated = normalizeUserRoles({
        ...normalized,
        activeRole: role,
        role,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setCurrentUser(updated);
      void setJson(USER_STORAGE_KEY, updated);
      if (isSupabaseConfigured() && isUuid(updated.id)) {
        void updateProfileRolesCloud({
          id: updated.id,
          email: updated.email,
          name: updated.name,
          handle: updated.handle,
          visibleId: updated.visibleId,
          role: updated.role,
          roles: updated.roles || [updated.role],
          activeRole: updated.activeRole || updated.role,
        });
      }
      toast({
        variant: 'success',
        title: t('toasts.t008_9e9cc6'),
        description:
          role === 'follower'
            ? t('toasts.switchedFollower')
            : role === 'organizer'
              ? t('toasts.switchedOrganizer')
              : role === 'freelancer'
                ? t('toasts.switchedFreelancer')
                : t('toasts.t008_9e9cc6'),
      });
      setTimeout(() => {
        router.replace(routeForRole(role) as any);
      }, 0);
      return true;
    },
    [currentUser, toast, router, routeForRole, t]
  );

  const enableSecondaryRole = useCallback(
    async (role: SecondaryRole, termsAccepted: boolean) => {
      if (!currentUser || currentUser.role === 'superadmin') {
        toast({
          variant: 'destructive',
          title: t('toasts.t009_eaec5e'),
        });
        return false;
      }
      if (!termsAccepted) {
        toast({
          variant: 'destructive',
          title: t('toasts.t010_79f37b'),
          description: t('toasts.t080_ba840c'),
        });
        return false;
      }

      const normalized = normalizeUserRoles(currentUser);
      const existing = getSecondaryRole(normalized.roles);

      // حسابات تجريبية بدور منظم/لاعب فقط: أضف المتابع عند التفعيل العكسي غير مطلوب
      // المسار العادي: متابع يختار منظماً أو لاعباً حراً
      if (existing && existing !== role) {
        toast({
          variant: 'destructive',
          title: t('toasts.t011_edfc9a'),
          description: t('toasts.pathBoundOnly', { role: existing === 'organizer' ? t('toasts.roleOrganizer') : t('toasts.roleFreelancer') }),
        });
        return false;
      }
      if (existing === role || userHasRole(normalized, role)) {
        return switchActiveRole(role);
      }

      // يجب أن يبقى المتابع في roles مع المسار الثانوي
      const updated = normalizeUserRoles({
        ...normalized,
        roles: ['follower', role],
        activeRole: role,
        role,
      });
      if (isSupabaseConfigured()) {
        if (!isUuid(updated.id)) {
          toast({
            variant: 'destructive',
            title: 'حساب محلي غير مدعوم',
            description:
              'فعّل مسار المنظم من حساب Sign up سحابي حتى تصل الطلبات للمشرف.',
          });
          return false;
        }
        const okCloud = await updateProfileRolesCloud({
          id: updated.id,
          email: updated.email,
          name: updated.name,
          handle: updated.handle,
          visibleId: updated.visibleId,
          role: updated.role,
          roles: updated.roles || [updated.role],
          activeRole: updated.activeRole || updated.role,
        });
        if (!okCloud) {
          toast({
            variant: 'destructive',
            title: 'تعذّر حفظ الدور في السحابة',
            description: 'تحقق من الاتصال وأعد المحاولة.',
          });
          return false;
        }
      }
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setCurrentUser(updated);
      void setJson(USER_STORAGE_KEY, updated);
      toast({
        variant: 'success',
        title:
          role === 'organizer'
            ? t('toasts.enabledOrganizer')
            : t('toasts.enabledFreelancer'),
        description:
          role === 'organizer'
            ? t('toasts.enteredOrganizerNow')
            : t('toasts.enteredFreelancerNow'),
      });
      // تأخير بسيط حتى تُحدَّث الحالة قبل استبدال المسار
      setTimeout(() => {
        router.replace(routeForRole(role) as any);
      }, 0);
      return true;
    },
    [currentUser, toast, router, routeForRole, switchActiveRole]
  );

  const logout = useCallback(
    (options?: { to?: 'login' | 'admin'; silent?: boolean }) => {
      setCurrentUser(null);
      void removeJson(USER_STORAGE_KEY);
      void supabaseSignOut();
      if (options?.silent) return;

      const wasAdmin = currentUser?.role === 'superadmin';
      const dest =
        options?.to === 'admin'
          ? '/admin'
          : options?.to === 'login'
            ? '/(auth)/login'
            : wasAdmin
              ? '/admin'
              : '/(auth)/login';
      router.replace(dest as any);
      toast({ title: t('toasts.t012_fbdcd1') });
    },
    [currentUser, router, toast, t]
  );

  const updateUser = useCallback(
    (updatedUser: User, successMessage?: string) => {
      const normalized = normalizeUserRoles(updatedUser);
      setUsers((prev) =>
        prev.map((u) => (u.id === normalized.id ? normalized : u))
      );
      setCurrentUser((prev) => {
        if (prev?.id !== normalized.id) return prev;
        void setJson(USER_STORAGE_KEY, normalized);
        return normalized;
      });
      // احتفظ بإيميل/كلمة مرور الحسابات التجريبية بعد إعادة التشغيل وتسجيل الخروج
      void (async () => {
        const prev =
          (await getJson<Record<string, UserCredentialOverride>>(
            USER_CREDENTIAL_OVERRIDES_KEY
          )) || {};
        const next = {
          ...prev,
          [normalized.id]: {
            email: normalizeEmail(normalized.email),
            passwordHash: ensurePasswordHashed(normalized.passwordHash),
            name: normalized.name,
          },
        };
        await setJson(USER_CREDENTIAL_OVERRIDES_KEY, next);
      })();
      // مزامنة الملف السحابي (حالة/أدوار) + محتوى المنشورات/الوسائط
      if (isSupabaseConfigured() && isUuid(normalized.id)) {
        void updateProfileAdminCloud({
          id: normalized.id,
          email: normalized.email,
          name: normalized.name,
          handle: normalized.handle,
          visibleId: normalized.visibleId,
          role: normalized.role,
          roles: normalized.roles || [normalized.role],
          activeRole: normalized.activeRole || normalized.role,
          status: normalized.status || 'active',
        });
        void upsertUserContentCloud(normalized, {
          allowCrossUser: normalized.id !== currentUser?.id,
        });
      }
      if (successMessage) {
        toast({ variant: 'success', title: t('toasts.t013_5a42a9'), description: successMessage });
      }
    },
    [toast, t, currentUser?.id]
  );

  const togglePinnedCompetition = useCallback(
    (competitionId: string) => {
      if (!currentUser) return;
      const pinned = currentUser.pinnedCompetitionIds || [];
      const exists = pinned.includes(competitionId);
      const next = exists
        ? pinned.filter((id) => id !== competitionId)
        : [...pinned, competitionId];
      updateUser(
        { ...currentUser, pinnedCompetitionIds: next },
        exists ? t('toasts.unpinnedHome') : t('toasts.pinnedToHome')
      );
    },
    [currentUser, updateUser]
  );

  const deleteUser = useCallback(
    async (userId: string, successMessage?: string) => {
      if (!userId) return false;
      if (currentUser?.id === userId) {
        toast({
          variant: 'destructive',
          title: 'تعذّر الحذف',
          description: 'لا يمكن حذف حسابك الحالي أثناء تسجيل الدخول به.',
        });
        return false;
      }

      const target = users.find((u) => u.id === userId);
      if (target?.role === 'superadmin' || target?.activeRole === 'superadmin') {
        toast({
          variant: 'destructive',
          title: 'تعذّر الحذف',
          description: 'لا يمكن حذف حساب مشرف من هنا.',
        });
        return false;
      }

      if (isSupabaseConfigured() && isUuid(userId)) {
        const purged = await adminPurgeUserCloud(userId);
        if (!purged.ok) {
          toast({
            variant: 'destructive',
            title: 'الحذف النهائي فشل',
            description:
              purged.error ||
              'افتح Supabase → SQL Editor ونفّذ ملف ADMIN-PURGE-USER.sql مرة واحدة، ثم أعد الحذف من هنا.',
          });
          return false;
        }
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({
        variant: 'success',
        title: 'تم الحذف نهائياً',
        description:
          successMessage ||
          'أُزيل الحساب من Authentication ويمكن التسجيل بنفس البريد.',
      });
      return true;
    },
    [toast, currentUser?.id, users]
  );

  const purgeUserByEmail = useCallback(
    async (email: string) => {
      const normalized = normalizeEmail(email);
      if (!isValidEmail(normalized)) {
        toast({
          variant: 'destructive',
          title: 'بريد غير صالح',
          description: 'أدخل بريداً كاملاً مثل name@example.com',
        });
        return false;
      }
      if (!isSupabaseConfigured()) {
        toast({
          variant: 'destructive',
          title: 'السحابة غير مهيأة',
        });
        return false;
      }
      const purged = await adminPurgeUserByEmailCloud(normalized);
      if (!purged.ok) {
        toast({
          variant: 'destructive',
          title: 'تعذّر تحرير البريد',
          description:
            purged.error === 'not_found'
              ? 'لا يوجد مستخدم بهذا البريد في Auth أو profiles.'
              : purged.error ||
                'نفّذ ADMIN-PURGE-USER.sql مرة واحدة ثم أعد المحاولة.',
        });
        return false;
      }
      setUsers((prev) =>
        prev.filter((u) => normalizeEmail(u.email) !== normalized)
      );
      toast({
        variant: 'success',
        title: 'تم تحرير البريد',
        description: `${normalized} جاهز للتسجيل من جديد.`,
      });
      return true;
    },
    [toast]
  );

  const addReferee = useCallback(
    (data: Omit<Referee, 'id'>, successMessage?: string) => {
      const referee: Referee = { ...data, id: createId() };
      setReferees((prev) => {
        const next = [...prev, referee];
        void saveReferees(next);
        return next;
      });
      if (successMessage) {
        toast({
          variant: 'success',
          title: t('toasts.t015_937bdd'),
          description: successMessage,
        });
      }
      return referee.id;
    },
    [toast, t]
  );

  const registerRefereeForCompetition = useCallback(
    (
      competitionId: string,
      data: {
        name: string;
        role: Referee['role'];
        mobile?: string;
        city?: string;
        avatar?: string;
      },
      successMessage?: string
    ) => {
      const name = data.name.trim();
      if (!name) {
        toast({
          variant: 'destructive',
          title: t('toasts.t045_e1da8e'),
          description: t('toasts.refereeFieldsRequired'),
        });
        return false;
      }
      let found = false;
      const referee: Referee = {
        id: createId(),
        name,
        role: data.role,
        mobile: data.mobile?.trim() || undefined,
        city: data.city?.trim() || undefined,
        avatar: data.avatar?.trim() || undefined,
        rating: 5,
        status: 'active',
      };
      setReferees((prev) => {
        const next = [...prev, referee];
        void saveReferees(next);
        return next;
      });
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          found = true;
          return {
            ...c,
            refereeIds: [...new Set([...c.refereeIds, referee.id])],
          };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) {
        toast({
          variant: 'destructive',
          title: t('toasts.t045_e1da8e'),
          description: t('toasts.refereeRegisterFailed'),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: t('toasts.t015_937bdd'),
        description:
          successMessage ||
          t('organizer.competitionManage.refereeRegistered', { name }),
      });
      return true;
    },
    [toast, t]
  );

  const updateReferee = useCallback(
    (referee: Referee, successMessage?: string) => {
      setReferees((prev) => {
        const next = prev.map((r) => (r.id === referee.id ? referee : r));
        void saveReferees(next);
        return next;
      });
      if (successMessage) {
        toast({
          variant: 'success',
          title: t('toasts.t016_71326f'),
          description: successMessage,
        });
      }
    },
    [toast, t]
  );

  const deleteReferee = useCallback(
    (refereeId: string, successMessage?: string) => {
      setReferees((prev) => {
        const next = prev.filter((r) => r.id !== refereeId);
        void saveReferees(next);
        return next;
      });
      if (successMessage) {
        toast({ title: t('toasts.t014_3569a8'), description: successMessage });
      }
    },
    [toast, t]
  );

  const markMessageAsRead = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
    );
    if (isUuid(messageId)) {
      void markMessageReadRemote(messageId);
    }
  }, []);

  const mergeRemoteMessages = useCallback((remote: Message[]) => {
    if (!remote.length) return;
    setMessages((prev) => mergeMessagesById(remote, prev));
  }, []);

  const notifyIncomingMessages = useCallback(
    (arrived: Message[], opts?: { toastOnArrive?: boolean }) => {
      if (!currentUser || !arrived.length) return;
      const mine = arrived.filter(
        (m) => m.recipientId === currentUser.id && !m.read
      );
      if (!mine.length) return;
      for (const msg of mine) {
        const isOrganizerPath =
          (currentUser.activeRole || currentUser.role) === 'organizer';
        addNotification({
          id: `msg-${msg.id}`,
          kind: 'message',
          recipientId: currentUser.id,
          title: msg.subject.startsWith('[نظام]')
            ? 'إشعار النظام'
            : t('home.messages'),
          body: `${msg.senderName}: ${msg.subject}`,
          href: isOrganizerPath
            ? '/(organizer)/messages'
            : '/(follower)/messages',
        });
      }
      if (opts?.toastOnArrive) {
        if (mine.length === 1) {
          toast({
            variant: 'success',
            title: 'رسالة جديدة',
            description: `${mine[0].senderName}: ${mine[0].subject}`,
          });
        } else {
          toast({
            variant: 'success',
            title: 'رسائل جديدة',
            description: `لديك ${mine.length} رسائل غير مقروءة`,
          });
        }
      }
    },
    [currentUser, addNotification, t, toast]
  );

  const refreshCloudMessages = useCallback(async () => {
    if (!currentUser || !isUuid(currentUser.id) || !isSupabaseConfigured()) {
      return;
    }
    const remote = await fetchMessagesForUser(currentUser.id);
    if (remote.error === 'no_session') {
      console.warn('[messages] refresh: no cloud session');
      return;
    }
    let arrived: Message[] = [];
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      arrived = remote.messages.filter(
        (m) =>
          !existingIds.has(m.id) && m.recipientId === currentUser.id
      );
      if (!remote.messages.length) return prev;
      return mergeMessagesById(remote.messages, prev);
    });
    if (arrived.length) {
      notifyIncomingMessages(arrived, { toastOnArrive: true });
    }
  }, [currentUser, notifyIncomingMessages]);

  // استقبال فوري للرسائل السحابية على جهاز المستلم + إشعار محلي
  useEffect(() => {
    if (!currentUser || !isUuid(currentUser.id) || !isSupabaseConfigured()) {
      return;
    }
    const stop = subscribeMessagesForUser(currentUser.id, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return mergeMessagesById([msg], prev);
      });
      notifyIncomingMessages([msg], { toastOnArrive: true });
    });
    void refreshCloudMessages();
    return () => {
      stop?.();
    };
  }, [currentUser?.id, refreshCloudMessages, notifyIncomingMessages]);

  const refreshCloudForumComments = useCallback(async () => {
    if (!currentUser || !isUuid(currentUser.id) || !isSupabaseConfigured()) {
      return;
    }
    const remote = await fetchForumComments();
    if (remote.error === 'no_session') return;
    if (remote.error && !remote.comments.length) {
      // غالباً الجدول غير منشأ بعد
      console.warn('[forum] refresh', remote.error);
      return;
    }
    if (!remote.comments.length) return;
    setComments((prev) => mergeCommentsById(remote.comments, prev));
  }, [currentUser]);

  // مزامنة الساحات بين الأجهزة + بث فوري
  useEffect(() => {
    if (!currentUser || !isUuid(currentUser.id) || !isSupabaseConfigured()) {
      return;
    }
    const stop = subscribeForumComments((comment) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === comment.id)) {
          return mergeCommentsById([comment], prev);
        }
        return mergeCommentsById([comment], prev);
      });
    });
    void refreshCloudForumComments();
    const timer = setInterval(() => {
      void refreshCloudForumComments();
    }, 20000);
    return () => {
      stop?.();
      clearInterval(timer);
    };
  }, [currentUser?.id, refreshCloudForumComments]);

  const sendMessage = useCallback(
    async (payload: {
      recipientId: string;
      subject: string;
      body: string;
    }) => {
      if (!currentUser) return false;
      if (!payload.subject.trim() || !payload.body.trim()) {
        toast({
          variant: 'destructive',
          title: t('toasts.t036_3a814a'),
          description: t('toasts.t093_9edd72'),
        });
        return false;
      }

      const subject = payload.subject.trim();
      const body = payload.body.trim();
      const canCloud =
        isSupabaseConfigured() &&
        isUuid(currentUser.id) &&
        isUuid(payload.recipientId);

      if (canCloud) {
        const remote = await insertMessage({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          recipientId: payload.recipientId,
          subject,
          body,
        });
        if (remote.message) {
          setMessages((prev) => mergeMessagesById([remote.message!], prev));
          // الإشعار يُنشأ على جهاز المستلم عند الاستلام (realtime/refresh)
          toast({ variant: 'success', title: t('toasts.t037_fc3f2d') });
          return true;
        }
        toast({
          variant: 'destructive',
          title: t('toasts.t034_8cbadf'),
          description: remote.error || t('cloud.messageSendFailed'),
        });
        return false;
      }

      if (
        isSupabaseConfigured() &&
        isUuid(payload.recipientId) &&
        !isUuid(currentUser.id)
      ) {
        toast({
          variant: 'destructive',
          title: t('toasts.t034_8cbadf'),
          description: t('cloud.localAccountCannotMessage'),
        });
        return false;
      }

      if (!isUuid(currentUser.id) || !isUuid(payload.recipientId)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t034_8cbadf'),
          description: t('cloud.bothNeedCloudAccounts'),
        });
        return false;
      }

      const msg: Message = {
        id: createId(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar || '',
        recipientId: payload.recipientId,
        subject,
        body,
        timestamp: new Date(),
        read: false,
      };
      setMessages((prev) => [msg, ...prev]);
      addNotification({
        kind: 'message',
        recipientId: payload.recipientId,
        title: t('home.messages'),
        body: `${currentUser.name}: ${msg.subject}`,
        href: '/(follower)/messages',
      });
      toast({ variant: 'success', title: t('toasts.t037_fc3f2d') });
      return true;
    },
    [currentUser, toast, addNotification, t]
  );
  const deleteQuickComment = useCallback(
    (commentId: string, successMessage?: string) => {
      setQuickComments((prev) => prev.filter((c) => c.id !== commentId));
      if (successMessage) {
        toast({ title: t('toasts.t014_3569a8'), description: successMessage });
      }
    },
    [toast]
  );

  const addQuickComment = useCallback(
    (text: string) => {
      if (!currentUser || !text.trim()) return;
      if (currentUser.role !== 'follower') {
        toast({
          variant: 'destructive',
          title: t('toasts.t017_85dc34'),
          description: t('toasts.t082_9502f6'),
        });
        return;
      }
      const comment: Comment = {
        id: createId(),
        text: text.trim(),
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || '',
        timestamp: new Date(),
        likes: [],
        replies: [],
        status: 'active',
      };
      setQuickComments((prev) => [...prev, comment]);
    },
    [currentUser, toast]
  );

  const addComment = useCallback(
    (
      text: string,
      _audioUrl?: string,
      target?: CommentTarget,
      extras?: { videoUrl?: string; videoDurationSec?: number }
    ) => {
      if (!currentUser) return;
      const trimmed = text.trim();
      const videoUrl = extras?.videoUrl?.trim();
      if (!trimmed && !videoUrl) return;

      // فيديو الساحة يُنشر فقط من الحساب المسجّل نفسه
      if (videoUrl && extras?.videoDurationSec != null && extras.videoDurationSec > 30.5) {
        toast({
          variant: 'destructive',
          title: t('toasts.t018_d72661'),
          description: t('toasts.t083_f79b40'),
        });
        return;
      }

      const publishLocal = (comment: Comment) => {
        if (target?.type === 'match') {
          setCompetitions((prev) => {
            const next = prev.map((c) => {
              if (c.id !== target.competitionId) return c;
              return {
                ...c,
                matches: c.matches.map((m) =>
                  m.id === target.matchId
                    ? { ...m, comments: [comment, ...m.comments] }
                    : m
                ),
              };
            });
            void syncCompetitions(next);
            return next;
          });
          toast({ title: t('toasts.t019_7b77aa') });
          return;
        }
        setComments((prev) => mergeCommentsById([comment], prev));
        toast({
          title: videoUrl
            ? t('toasts.postedForumVideo')
            : t('toasts.postedForum'),
        });
      };

      // مساهمات الساحة العامة → سحابة إن أمكن
      if (
        (!target || target.type === 'general') &&
        isSupabaseConfigured() &&
        isUuid(currentUser.id)
      ) {
        void (async () => {
          let finalVideoUrl = videoUrl;
          if (finalVideoUrl) {
            const resolved = await resolvePublicMediaUrl({
              uri: finalVideoUrl,
              kind: 'video',
              folder: 'forums',
              userId: currentUser.id,
              requireCloud: true,
            });
            if (!resolved.url) {
              toast({
                variant: 'destructive',
                title: t('forums.cloudSyncFailed'),
                description: cloudWriteErrorMessage(resolved.error),
              });
              return;
            }
            finalVideoUrl = resolved.url;
          }
          const remote = await insertForumComment({
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            text: trimmed,
            videoUrl: finalVideoUrl,
            videoDurationSec: extras?.videoDurationSec,
          });
          if (remote.comment) {
            publishLocal(remote.comment);
            return;
          }
          toast({
            variant: 'destructive',
            title: t('forums.cloudSyncFailed'),
            description: remote.error || cloudWriteErrorMessage('no_session'),
          });
        })();
        return;
      }

      const comment: Comment = {
        id: createId(),
        text: trimmed,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar || '',
        timestamp: new Date(),
        likes: [],
        replies: [],
        ...(videoUrl
          ? {
              videoUrl,
              videoDurationSec: extras?.videoDurationSec,
            }
          : null),
      };
      publishLocal(comment);
    },
    [currentUser, toast, t]
  );

  const toggleCommentLike = useCallback(
    (commentId: string) => {
      if (!currentUser) return;
      const userId = currentUser.id;
      const toggle = (list: Comment[]) =>
        list.map((c) => {
          if (c.id !== commentId) return c;
          const liked = c.likes.includes(userId);
          return {
            ...c,
            likes: liked
              ? c.likes.filter((id) => id !== userId)
              : [...c.likes, userId],
          };
        });
      setComments(toggle);
      setQuickComments(toggle);
      setCompetitions((prev) => {
        const next = prev.map((comp) => ({
          ...comp,
          matches: comp.matches.map((m) => ({
            ...m,
            comments: toggle(m.comments),
          })),
          teams: comp.teams.map((t) => ({
            ...t,
            comments: toggle(t.comments),
            players: t.players.map((p) => ({
              ...p,
              comments: toggle(p.comments || []),
            })),
          })),
        }));
        void syncCompetitions(next);
        return next;
      });
      if (isUuid(commentId) && isUuid(userId) && isSupabaseConfigured()) {
        void toggleForumCommentLikeRemote(commentId, userId).then((remote) => {
          if (remote.error) return;
          setComments((prev) =>
            prev.map((c) =>
              c.id === commentId ? { ...c, likes: remote.likes } : c
            )
          );
        });
      }
    },
    [currentUser, syncCompetitions]
  );

  const updateDiscussionStatus = useCallback(
    (
      payload: {
        type: 'comment' | 'analysis';
        id: string;
        authorId?: string;
        status: 'active' | 'warned' | 'suspended' | 'blocked';
        reason?: string;
      },
      successMessage?: string
    ) => {
      if (
        payload.status !== 'active' &&
        (!payload.reason || payload.reason.trim().length < 3)
      ) {
        toast({
          variant: 'destructive',
          title: t('toasts.t020_7da332'),
          description: t('toasts.t084_9bedb5'),
        });
        return;
      }

      const reason =
        payload.status === 'active' ? undefined : payload.reason?.trim();

      if (payload.type === 'comment') {
        setComments((prev) =>
          prev.map((c) =>
            c.id === payload.id
              ? { ...c, status: payload.status, statusReason: reason }
              : c
          )
        );
        if (isUuid(payload.id) && isSupabaseConfigured()) {
          void updateForumCommentStatusRemote(
            payload.id,
            payload.status,
            reason
          );
        }
      } else {
        if (!payload.authorId) {
          toast({
            variant: 'destructive',
            title: t('toasts.t021_e06649'),
            description: t('toasts.t085_42b5e8'),
          });
          return;
        }
        setUsers((prev) => {
          const next = prev.map((user) => {
            if (user.id !== payload.authorId) return user;
            return {
              ...user,
              analysisContent: user.analysisContent.map((a) =>
                a.id === payload.id
                  ? { ...a, status: payload.status, statusReason: reason }
                  : a
              ),
            };
          });
          const author = next.find((u) => u.id === payload.authorId);
          if (author && isUuid(author.id) && isSupabaseConfigured()) {
            void upsertUserContentCloud(author, { allowCrossUser: true });
          }
          return next;
        });
      }

      if (successMessage) {
        toast({
          variant:
            payload.status === 'blocked' || payload.status === 'suspended'
              ? 'destructive'
              : 'success',
          title: t('toasts.t022_3451ba'),
          description: successMessage,
        });
      }
    },
    [toast, t]
  );

  const updateSupportLevels = useCallback((levels: SupportLevel[]) => {
    const next = normalizeSupportLevels(levels);
    setSupportLevels(next);
    void saveSupportLevels(next);
  }, []);

  const purchaseSupportGift = useCallback(
    (payload: {
      certificateType: string;
      recipientId: string;
      recipientName: string;
      recipientType: GiftTransaction['recipientType'];
      recipientVisibleId?: string;
    }): GiftTransaction | null => {
      if (!currentUser) {
        toast({
          variant: 'destructive',
          title: t('toasts.t023_bf2703'),
          description: t('toasts.t086_3825c9'),
        });
        return null;
      }

      const level = supportLevels.find((l) => l.name === payload.certificateType);
      if (!level) {
        toast({
          variant: 'destructive',
          title: t('toasts.t024_dc72d1'),
        });
        return null;
      }

      if (payload.recipientId === currentUser.id) {
        toast({
          variant: 'destructive',
          title: t('toasts.t007_04edd0'),
          description: t('toasts.t087_ba6527'),
        });
        return null;
      }

      const certificateNumber = `SUP-${Math.floor(100000 + Math.random() * 900000)}`;
      const gift: GiftTransaction = {
        id: createId('gift'),
        certificateNumber,
        gifterId: currentUser.id,
        gifterName: currentUser.name,
        gifterVisibleId: currentUser.visibleId || currentUser.handle,
        gifterBankAccountNumber: currentUser.bankAccountNumber,
        recipientId: payload.recipientId,
        recipientName: payload.recipientName,
        recipientType: payload.recipientType,
        recipientVisibleId: payload.recipientVisibleId,
        certificateType: level.name,
        amountPaid: level.price,
        timestamp: new Date(),
        // محلي تجريبي — لا بوابة دفع بعد
        status: 'pending_demo',
      };

      setGiftTransactions((prev) => {
        const next = [gift, ...prev];
        void saveGiftCloudAppend(gift);
        return next;
      });
      toast({
        title: t('toasts.giftDemoPendingTitle'),
        description: t('toasts.giftDemoPendingDesc', {
          number: certificateNumber,
          name: payload.recipientName,
        }),
      });
      return gift;
    },
    [currentUser, supportLevels, toast, t]
  );

  const updateCompetition = useCallback(
    (competition: Competition, successMessage?: string) => {
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === competition.id ? competition : c
        );
        void syncCompetitions(next);
        return next;
      });
      if (successMessage) {
        toast({
          variant: 'success',
          title: t('toasts.t016_71326f'),
          description: successMessage,
        });
      }
    },
    [toast]
  );

  const renameCompetition = useCallback(
    (competitionId: string, name: string, successMessage?: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        toast({
          variant: 'destructive',
          title: t('toasts.t045_e1da8e'),
          description: t('toasts.competitionNameRequired'),
        });
        return false;
      }
      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          found = true;
          return { ...c, name: trimmed };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) return false;
      toast({
        variant: 'success',
        title: t('toasts.t016_71326f'),
        description: successMessage || t('toasts.competitionRenamed'),
      });
      return true;
    },
    [toast]
  );

  const deleteCompetition = useCallback(
    async (competitionId: string, successMessage?: string) => {
      const existing = competitions.find((c) => c.id === competitionId);
      if (!existing) return false;

      const isOwner = currentUser?.id === existing.organizerId;
      const isAdmin = currentUser?.role === 'superadmin';
      if (!isOwner && !isAdmin) {
        toast({
          variant: 'destructive',
          title: 'غير مسموح',
          description: 'يمكنك حذف مسابقاتك فقط.',
        });
        return false;
      }

      if (isSupabaseConfigured()) {
        // البذرة المحلية فقط تُحذف محلياً بدون سحابة
        if (!/^comp-\d+$/i.test(competitionId)) {
          const cloud = await deleteCompetitionCloud(competitionId);
          if (!cloud.ok && cloud.error !== 'not_configured') {
            toast({
              variant: 'destructive',
              title: 'تعذّر حذف المسابقة من السحابة',
              description: cloud.error,
            });
            return false;
          }
        }
      }

      setCompetitions((prev) => {
        const next = prev.filter((c) => c.id !== competitionId);
        void syncCompetitions(next);
        return next;
      });
      toast({
        variant: 'success',
        title: t('toasts.t014_3569a8'),
        description: successMessage || t('toasts.competitionDeleted'),
      });
      return true;
    },
    [competitions, currentUser, toast, t]
  );

  const deleteCompetitionRequest = useCallback(
    async (requestId: string, successMessage?: string) => {
      const existing = competitionRequests.find((r) => r.id === requestId);
      if (!existing) return false;

      const isOwner = currentUser?.id === existing.organizerId;
      const isAdmin = currentUser?.role === 'superadmin';
      if (!isOwner && !isAdmin) {
        toast({
          variant: 'destructive',
          title: 'غير مسموح',
          description: 'يمكنك حذف طلباتك فقط.',
        });
        return false;
      }

      if (isSupabaseConfigured() && String(requestId).startsWith('creq_')) {
        const cloud = await deleteCompetitionRequestCloud(requestId);
        if (!cloud.ok) {
          toast({
            variant: 'destructive',
            title: 'تعذّر حذف الطلب من السحابة',
            description:
              (cloud.error || '').includes('policy') ||
              (cloud.error || '').includes('forbidden')
                ? 'نفّذ competition-requests-delete-policy.sql ثم أعد المحاولة.'
                : cloud.error,
          });
          return false;
        }
      }

      setCompetitionRequests((prev) => {
        const next = prev.filter((r) => r.id !== requestId);
        void saveCompetitionRequests(next);
        return next;
      });
      toast({
        variant: 'success',
        title: t('toasts.t014_3569a8'),
        description: successMessage || 'تم حذف طلب التنظيم',
      });
      return true;
    },
    [competitionRequests, currentUser, toast, t]
  );

  const updateCompetitionStatus = useCallback(
    (
      competitionId: string,
      status: Competition['status'],
      options?: { reason?: string; successMessage?: string }
    ) => {
      if (status !== 'active' && (!options?.reason || options.reason.trim().length < 3)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t020_7da332'),
          description: t('toasts.t088_ed0b8f'),
        });
        return;
      }

      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === competitionId
            ? {
                ...c,
                status,
                statusReason:
                  status === 'active' ? undefined : options?.reason?.trim(),
              }
            : c
        );
        void syncCompetitions(next);
        return next;
      });
      if (options?.successMessage) {
        toast({
          variant: status === 'suspended' ? 'destructive' : 'success',
          title: t('toasts.t026_5e74e6'),
          description: options.successMessage,
        });
      }
    },
    [toast, t]
  );

  const setCompetitionFixturesSuspended = useCallback(
    (
      competitionId: string,
      suspended: boolean,
      options?: { reason?: string; successMessage?: string }
    ) => {
      if (suspended && (!options?.reason || options.reason.trim().length < 3)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t020_7da332'),
          description: t('toasts.fixturesSuspendReasonRequired'),
        });
        return false;
      }

      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          found = true;
          return {
            ...c,
            fixturesSuspended: suspended,
            fixturesSuspendReason: suspended
              ? options?.reason?.trim()
              : undefined,
          };
        });
        if (found) void syncCompetitions(next);
        return next;
      });

      if (!found) return false;

      toast({
        variant: suspended ? 'destructive' : 'success',
        title: t('toasts.t026_5e74e6'),
        description:
          options?.successMessage ||
          (suspended
            ? t('toasts.fixturesSuspended')
            : t('toasts.fixturesResumed')),
      });
      return true;
    },
    [toast, t]
  );

  const updatePlayerStatus = useCallback(
    (
      competitionId: string,
      teamId: string,
      playerId: string,
      status: Player['status'],
      options?: { reason?: string; successMessage?: string }
    ) => {
      if (status !== 'active' && (!options?.reason || options.reason.trim().length < 3)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t020_7da332'),
          description: t('toasts.t089_a459a8'),
        });
        return;
      }

      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          return {
            ...c,
            teams: c.teams.map((team) => {
              if (team.id !== teamId) return team;
              return {
                ...team,
                players: team.players.map((player) =>
                  player.id === playerId
                    ? {
                        ...player,
                        status,
                        statusReason:
                          status === 'active'
                            ? undefined
                            : options?.reason?.trim(),
                      }
                    : player
                ),
              };
            }),
          };
        });
        void syncCompetitions(next);
        return next;
      });

      if (options?.successMessage) {
        toast({
          variant: status === 'suspended' ? 'destructive' : 'success',
          title: t('toasts.t027_5e100d'),
          description: options.successMessage,
        });
      }
    },
    [toast]
  );

  const generateFixturesForCompetition = useCallback(
    (competitionId: string) => {
      const competition = competitions.find((c) => c.id === competitionId);
      if (!competition || competition.teams.length < MIN_COMPETITION_TEAMS) {
        toast({
          variant: 'destructive',
          title: t('toasts.t028_8f9d43'),
          description: t('toasts.needMinTeams', { count: MIN_COMPETITION_TEAMS }),
        });
        return false;
      }
      if (competition.matches.length > 0) {
        toast({
          variant: 'destructive',
          title: t('toasts.t029_321652'),
          description:
            t('toasts.t090_b5d697'),
        });
        return false;
      }
      if (competition.status === 'suspended') {
        toast({
          variant: 'destructive',
          title: t('toasts.t030_216321'),
          description: t('toasts.t091_3a3fe9'),
        });
        return false;
      }
      if (competition.fixturesSuspended) {
        toast({
          variant: 'destructive',
          title: t('toasts.t030_216321'),
          description: t('toasts.fixturesSuspendedBlocked'),
        });
        return false;
      }

      const fixtures = buildRoundRobinFixtures(
        competitionId,
        competition.teams,
        new Date()
      );
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === competitionId ? { ...c, matches: fixtures } : c
        );
        void syncCompetitions(next);
        return next;
      });
      toast({
        variant: 'success',
        title: t('toasts.t031_f51c67'),
        description: t('toasts.fixturesCreated', { count: fixtures.length }),
      });
      return true;
    },
    [competitions, toast]
  );

  const updateMatchResult = useCallback(
    (
      competitionId: string,
      matchId: string,
      team1Score: number,
      team2Score: number
    ) => {
      const competition = competitions.find((c) => c.id === competitionId);
      if (competition?.fixturesSuspended) {
        toast({
          variant: 'destructive',
          title: t('toasts.t030_216321'),
          description: t('toasts.fixturesSuspendedBlocked'),
        });
        return;
      }
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id !== competitionId
            ? c
            : {
                ...c,
                matches: c.matches.map((m) =>
                  m.id === matchId
                    ? { ...m, team1Score, team2Score }
                    : m
                ),
              }
        );
        void syncCompetitions(next);
        return next;
      });
    },
    [competitions, toast, t]
  );

  const assignRefereeToCompetition = useCallback(
    (competitionId: string, refereeId: string, successMessage?: string) => {
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === competitionId
            ? {
                ...c,
                refereeIds: [...new Set([...c.refereeIds, refereeId])],
              }
            : c
        );
        void syncCompetitions(next);
        return next;
      });
      if (successMessage) {
        toast({
          variant: 'success',
          title: t('toasts.t015_937bdd'),
          description: successMessage,
        });
      }
    },
    [toast]
  );

  const removeRefereeFromCompetition = useCallback(
    (competitionId: string, refereeId: string, successMessage?: string) => {
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === competitionId
            ? {
                ...c,
                refereeIds: c.refereeIds.filter((id) => id !== refereeId),
              }
            : c
        );
        void syncCompetitions(next);
        return next;
      });
      if (successMessage) {
        toast({ title: t('toasts.t032_19c1d1'), description: successMessage });
      }
    },
    [toast]
  );

  const updateOfferStatus = useCallback(
    (
      offerId: string,
      status: 'accepted' | 'declined',
      successMessage?: string
    ) => {
      setOffers((prev) => {
        const next = prev.map((o) =>
          o.id === offerId ? { ...o, status } : o
        );
        void saveOffersCloud(next);
        return next;
      });
      if (successMessage) {
        toast({
          variant: status === 'accepted' ? 'success' : 'default',
          title: t('toasts.t033_ea2dc0'),
          description: successMessage,
        });
      }
    },
    [toast]
  );

  const sendOffer = useCallback(
    (freelancerId: string, teamId: string, message: string) => {
      if (!currentUser || currentUser.role !== 'organizer') return false;
      const team = competitions
        .flatMap((c) => c.teams.map((t) => ({ ...t, competitionId: c.id, competitionName: c.name })))
        .find((t) => t.id === teamId);
      if (!team || !message.trim()) {
        toast({
          variant: 'destructive',
          title: t('toasts.t034_8cbadf'),
          description: t('toasts.t092_540005'),
        });
        return false;
      }
      const offer: Offer = {
        id: createId(),
        freelancerId,
        organizerId: currentUser.id,
        organizerName: currentUser.name,
        organizerAvatar: currentUser.avatar || '',
        competitionId: team.competitionId,
        competitionName: team.competitionName,
        teamId,
        teamName: team.name,
        message: message.trim(),
        status: 'pending',
        timestamp: new Date(),
      };
      setOffers((prev) => {
        const next = [offer, ...prev];
        void saveOffersCloud(next);
        return next;
      });
      toast({ variant: 'success', title: t('toasts.t035_af963d') });
      return true;
    },
    [currentUser, competitions, toast]
  );

  const sendShareCard = useCallback(
    async (input: {
      kind: ShareCardKind;
      recipientId: string;
      recipientName: string;
      recipientKind?: 'user' | 'referee';
      title?: string;
      body?: string;
      mediaUrl?: string;
      mediaKind?: 'photo' | 'video' | 'text' | 'link';
      competitionId?: string;
      competitionName?: string;
      teamId?: string;
      teamName?: string;
      position?: string;
    }) => {
      if (!currentUser) return false;
      if (!input.recipientId || currentUser.id === input.recipientId) {
        toast({
          variant: 'destructive',
          title: t('shareCards.needRecipient'),
        });
        return false;
      }
      if (input.kind === 'join_request') {
        if (!input.competitionName?.trim() || !input.teamName?.trim()) {
          toast({
            variant: 'destructive',
            title: t('shareCards.needJoinFields'),
          });
          return false;
        }
      } else {
        const hasContent =
          !!input.body?.trim() ||
          !!input.mediaUrl?.trim() ||
          !!input.title?.trim();
        if (!hasContent) {
          toast({
            variant: 'destructive',
            title: t('shareCards.needContent'),
          });
          return false;
        }
      }

      let card: ShareCard = {
        id: createId('share'),
        kind: input.kind,
        status: 'pending',
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderHandle: currentUser.handle,
        senderRole: currentUser.role,
        recipientId: input.recipientId,
        recipientName: input.recipientName,
        recipientKind: input.recipientKind || 'user',
        title: input.title?.trim(),
        body: input.body?.trim(),
        mediaUrl: input.mediaUrl?.trim(),
        mediaKind: input.mediaKind,
        competitionId: input.competitionId,
        competitionName: input.competitionName?.trim(),
        teamId: input.teamId,
        teamName: input.teamName?.trim(),
        position: input.position?.trim(),
        timestamp: new Date(),
        read: false,
      };

      // مزامنة سحابية عندما يكون المستلم حساب Supabase (UUID)
      if (isSupabaseConfigured() && isUuid(input.recipientId)) {
        const remote = await insertShareCard({
          kind: input.kind,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          senderHandle: currentUser.handle,
          senderRole: currentUser.role,
          recipientId: input.recipientId,
          recipientName: input.recipientName,
          recipientKind: input.recipientKind,
          title: input.title?.trim(),
          body: input.body?.trim(),
          mediaUrl: input.mediaUrl?.trim(),
          mediaKind: input.mediaKind,
          competitionId: input.competitionId,
          competitionName: input.competitionName?.trim(),
          teamId: input.teamId,
          teamName: input.teamName?.trim(),
          position: input.position?.trim(),
        });
        if (remote) {
          card = remote;
        } else {
          toast({
            variant: 'destructive',
            title: t('shareCards.cloudSendFailed'),
          });
        }
      }

      setShareCards((prev) => [card, ...prev]);
      addNotification({
        kind: 'system',
        recipientId: input.recipientId,
        title:
          input.kind === 'join_request'
            ? t('shareCards.notifJoinTitle')
            : t('shareCards.notifContentTitle'),
        body: t('shareCards.notifBody', { name: currentUser.name }),
        href: '/share-cards',
      });
      toast({
        variant: 'success',
        title: t('shareCards.sent'),
      });
      return true;
    },
    [currentUser, toast, addNotification, t]
  );

  const updateShareCardStatus = useCallback(
    (cardId: string, status: ShareCardStatus) => {
      if (!currentUser) return false;
      const card = shareCards.find(
        (c) => c.id === cardId && c.recipientId === currentUser.id
      );
      if (!card) return false;

      setShareCards((prev) =>
        prev.map((c) =>
          c.id === cardId && c.recipientId === currentUser.id
            ? { ...c, status, read: true }
            : c
        )
      );
      void updateShareCardRemote(cardId, { status, read: true });

      // قبول طلب انضمام → إضافة اللاعب للفريق فعلياً
      if (
        status === 'accepted' &&
        card.kind === 'join_request' &&
        card.competitionId &&
        card.teamId
      ) {
        const position = (card.position || 'وسط') as Player['position'];
        const validPositions: Player['position'][] = [
          'حارس مرمى',
          'دفاع',
          'وسط',
          'هجوم',
        ];
        const safePosition = validPositions.includes(position)
          ? position
          : 'وسط';
        setCompetitions((prev) => {
          const next = prev.map((c) => {
            if (c.id !== card.competitionId) return c;
            return {
              ...c,
              teams: c.teams.map((team) => {
                if (team.id !== card.teamId) return team;
                if (
                  team.players.some(
                    (p) =>
                      p.id === currentUser.id ||
                      p.name.trim().toLowerCase() ===
                        currentUser.name.trim().toLowerCase()
                  )
                ) {
                  return team;
                }
                const used = new Set(team.players.map((p) => p.jerseyNumber));
                let jersey = 99;
                for (let n = 1; n <= 99; n++) {
                  if (!used.has(n)) {
                    jersey = n;
                    break;
                  }
                }
                return {
                  ...team,
                  players: [
                    ...team.players,
                    {
                      id: currentUser.id,
                      visibleId:
                        currentUser.visibleId ||
                        `P${Math.floor(1000 + Math.random() * 9000)}`,
                      name: currentUser.name,
                      jerseyNumber: jersey,
                      position: safePosition,
                      teamId: team.id,
                      status: 'active' as const,
                      avatar: currentUser.avatar,
                      email: currentUser.email,
                      media: { photos: [], videos: [] },
                      comments: [],
                    },
                  ],
                };
              }),
            };
          });
          void syncCompetitions(next);
          return next;
        });
      }

      toast({
        variant: 'success',
        title:
          status === 'accepted'
            ? t('shareCards.accepted')
            : status === 'declined'
              ? t('shareCards.declined')
              : t('shareCards.updated'),
      });
      return true;
    },
    [currentUser, shareCards, toast, t]
  );

  const markShareCardRead = useCallback(
    (cardId: string) => {
      if (!currentUser) return;
      setShareCards((prev) =>
        prev.map((c) =>
          c.id === cardId && c.recipientId === currentUser.id
            ? { ...c, read: true }
            : c
        )
      );
      if (isUuid(cardId) && isSupabaseConfigured()) {
        void updateShareCardRemote(cardId, { read: true });
      }
    },
    [currentUser]
  );

  const addTeam = useCallback(
    (
      competitionId: string,
      teamData: { name: string; logo?: string },
      successMessage?: string
    ) => {
      if (!teamData.name.trim()) return;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          return {
            ...c,
            teams: [
              ...c.teams,
              {
                id: createId(),
                name: teamData.name.trim(),
                competitionId,
                logo: teamData.logo,
                players: [],
                officials: [],
                status: 'active' as const,
                comments: [],
              },
            ],
          };
        });
        void syncCompetitions(next);
        return next;
      });
      if (successMessage) {
        toast({ variant: 'success', title: t('toasts.t015_937bdd'), description: successMessage });
      }
    },
    [toast]
  );

  const renameTeam = useCallback(
    (
      competitionId: string,
      teamId: string,
      name: string,
      successMessage?: string
    ) => {
      const trimmed = name.trim();
      if (!trimmed) {
        toast({
          variant: 'destructive',
          title: t('toasts.t045_e1da8e'),
          description: t('toasts.teamNameRequired'),
        });
        return false;
      }
      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          return {
            ...c,
            teams: c.teams.map((team) => {
              if (team.id !== teamId) return team;
              found = true;
              return { ...team, name: trimmed };
            }),
          };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) return false;
      toast({
        variant: 'success',
        title: t('toasts.t016_71326f'),
        description: successMessage || t('toasts.teamRenamed'),
      });
      return true;
    },
    [toast]
  );

  const deleteTeam = useCallback(
    (
      competitionId: string,
      teamId: string,
      successMessage?: string
    ) => {
      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          if (!c.teams.some((team) => team.id === teamId)) return c;
          found = true;
          return {
            ...c,
            teams: c.teams.filter((team) => team.id !== teamId),
            matches: c.matches.filter(
              (match) =>
                match.team1Id !== teamId && match.team2Id !== teamId
            ),
          };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) return false;
      toast({
        variant: 'success',
        title: t('toasts.t014_3569a8'),
        description: successMessage || t('toasts.teamDeleted'),
      });
      return true;
    },
    [toast]
  );

  const addPlayerToTeam = useCallback(
    (
      competitionId: string,
      teamId: string,
      playerData: {
        name: string;
        jerseyNumber: number;
        position: Player['position'];
        avatar?: string;
      },
      successMessage?: string
    ) => {
      let jerseyTaken = false;
      let added = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          return {
            ...c,
            teams: c.teams.map((team) => {
              if (team.id !== teamId) return team;
              if (
                team.players.some(
                  (p) => p.jerseyNumber === playerData.jerseyNumber
                )
              ) {
                jerseyTaken = true;
                return team;
              }
              added = true;
              return {
                ...team,
                players: [
                  ...team.players,
                  {
                    id: createId(),
                    visibleId: `P${Math.floor(1000 + Math.random() * 9000)}`,
                    name: playerData.name.trim(),
                    jerseyNumber: playerData.jerseyNumber,
                    position: playerData.position,
                    teamId,
                    status: 'active' as const,
                    avatar: playerData.avatar?.trim() || undefined,
                    media: { photos: [], videos: [] },
                    comments: [],
                  },
                ],
              };
            }),
          };
        });
        if (added) void syncCompetitions(next);
        return next;
      });
      if (jerseyTaken) {
        toast({
          variant: 'destructive',
          title: t('toasts.t038_a459ff'),
          description: t('toasts.jerseyUsed', {
            number: playerData.jerseyNumber,
          }),
        });
        return;
      }
      if (successMessage && added) {
        toast({ variant: 'success', title: t('toasts.t015_937bdd'), description: successMessage });
      }
    },
    [toast]
  );

  const addStaffToCompetition = useCallback(
    (
      competitionId: string,
      staffData: {
        name: string;
        role: string;
        mobile?: string;
        avatar?: string;
      },
      successMessage?: string
    ) => {
      const name = staffData.name.trim();
      const role = staffData.role.trim();
      if (!name || !role) {
        toast({
          variant: 'destructive',
          title: t('toasts.t045_e1da8e'),
          description: t('toasts.staffFieldsRequired'),
        });
        return false;
      }
      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          found = true;
          return {
            ...c,
            staff: [
              ...(c.staff || []),
              {
                id: createId(),
                name,
                role,
                mobile: staffData.mobile?.trim() || undefined,
                avatar: staffData.avatar?.trim() || undefined,
              },
            ],
          };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) return false;
      toast({
        variant: 'success',
        title: t('toasts.t015_937bdd'),
        description: successMessage || t('toasts.staffAdded'),
      });
      return true;
    },
    [toast]
  );

  const updatePlayerAvatar = useCallback(
    (
      competitionId: string,
      teamId: string,
      playerId: string,
      avatar: string | undefined,
      successMessage?: string
    ) => {
      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          return {
            ...c,
            teams: c.teams.map((team) => {
              if (team.id !== teamId) return team;
              return {
                ...team,
                players: team.players.map((p) => {
                  if (p.id !== playerId) return p;
                  found = true;
                  return { ...p, avatar: avatar?.trim() || undefined };
                }),
              };
            }),
          };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) return false;
      if (successMessage) {
        toast({
          variant: 'success',
          title: t('toasts.t072_2a81f2'),
          description: successMessage,
        });
      }
      return true;
    },
    [toast, t]
  );

  const updateStaffAvatar = useCallback(
    (
      competitionId: string,
      staffId: string,
      avatar: string | undefined,
      successMessage?: string
    ) => {
      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          const staff = (c.staff || []).map((s) => {
            if (s.id !== staffId) return s;
            found = true;
            return { ...s, avatar: avatar?.trim() || undefined };
          });
          return { ...c, staff };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) return false;
      if (successMessage) {
        toast({
          variant: 'success',
          title: t('toasts.t072_2a81f2'),
          description: successMessage,
        });
      }
      return true;
    },
    [toast, t]
  );

  const removeStaffFromCompetition = useCallback(
    (competitionId: string, staffId: string, successMessage?: string) => {
      let found = false;
      setCompetitions((prev) => {
        const next = prev.map((c) => {
          if (c.id !== competitionId) return c;
          const before = c.staff?.length || 0;
          const staff = (c.staff || []).filter((s) => s.id !== staffId);
          if (staff.length === before) return c;
          found = true;
          return { ...c, staff };
        });
        if (found) void syncCompetitions(next);
        return next;
      });
      if (!found) return false;
      toast({
        variant: 'success',
        title: t('toasts.t014_3569a8'),
        description: successMessage || t('toasts.staffRemoved'),
      });
      return true;
    },
    [toast]
  );

  const addAnalysis = useCallback(
    async (data: {
      title: string;
      content: string;
      videoUrl?: string;
      matchId?: string;
    }) => {
      if (!currentUser) return false;
      const isAnalyst =
        currentUser.analyst?.status === 'active' ||
        currentUser.permissions.canCreateContent;
      if (!isAnalyst) {
        toast({
          variant: 'destructive',
          title: t('toasts.t039_ceb90c'),
          description: t('toasts.t094_fa723f'),
        });
        return false;
      }
      const title = data.title.trim();
      const content = data.content.trim();
      let videoUrl = data.videoUrl?.trim() || undefined;
      if (!title || (!content && !videoUrl)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t036_3a814a'),
          description: t('toasts.t095_c00483'),
        });
        return false;
      }

      const cloud = await requireCloudSession(currentUser.id);
      if (videoUrl && cloud.session) {
        const resolved = await resolvePublicMediaUrl({
          uri: videoUrl,
          kind: 'video',
          folder: 'analysis',
          userId: cloud.session.userId,
          requireCloud: true,
        });
        if (!resolved.url) {
          toast({
            variant: 'destructive',
            title: t('toasts.t036_3a814a'),
            description: cloudWriteErrorMessage(resolved.error),
          });
          return false;
        }
        videoUrl = resolved.url;
      } else if (videoUrl && !cloud.session) {
        toast({
          variant: 'destructive',
          title: t('toasts.t036_3a814a'),
          description: cloudWriteErrorMessage(cloud.error),
        });
        return false;
      }

      const analysis = {
        id: createId(),
        matchId: data.matchId,
        title,
        content: content || t('toasts.visualAnalysis'),
        videoUrl,
        timestamp: new Date(),
        likes: [] as string[],
        comments: [] as Comment[],
        status: 'active' as const,
      };
      const updated: User = {
        ...currentUser,
        analysisContent: [analysis, ...currentUser.analysisContent],
      };
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      setCurrentUser(updated);
      void setJson(USER_STORAGE_KEY, updated);
      if (cloud.session) {
        const sync = await upsertUserContentCloud(updated);
        if (!sync.ok) {
          toast({
            variant: 'destructive',
            title: t('toasts.t036_3a814a'),
            description: cloudWriteErrorMessage(sync.error),
          });
          return false;
        }
      }
      toast({ variant: 'success', title: t('toasts.t040_286629') });
      return true;
    },
    [currentUser, toast, t]
  );

  const persistUser = useCallback(
    (updated: User) => {
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setCurrentUser((prev) => (prev?.id === updated.id ? updated : prev));
      if (updated.id === currentUser?.id) {
        void setJson(USER_STORAGE_KEY, updated);
      }
      if (isUuid(updated.id) && isSupabaseConfigured()) {
        void upsertUserContentCloud(updated, {
          allowCrossUser: updated.id !== currentUser?.id,
        });
      }
    },
    [currentUser?.id]
  );

  const applyAsAnalyst = useCallback(
    (termsAccepted: boolean) => {
      if (!currentUser) {
        toast({
          variant: 'destructive',
          title: t('toasts.t041_3a5cb4'),
          description: t('toasts.t096_f901c9'),
        });
        return false;
      }
      if (!termsAccepted) {
        toast({
          variant: 'destructive',
          title: t('toasts.t010_79f37b'),
          description: t('toasts.t097_459f7e'),
        });
        return false;
      }
      if (
        currentUser.analyst?.status === 'active' ||
        currentUser.permissions.canCreateContent
      ) {
        toast({ title: t('toasts.t042_3c16c9') });
        return true;
      }
      if (currentUser.analyst?.status === 'pending') {
        toast({
          title: t('toasts.t043_d252d1'),
          description: t('toasts.t098_1fbde3'),
        });
        return false;
      }

      const updated: User = {
        ...currentUser,
        analyst: {
          status: 'pending',
          termsAcceptedAt: new Date(),
          requestedAt: new Date(),
        },
      };
      persistUser(updated);
      toast({
        variant: 'success',
        title: t('toasts.t044_52af04'),
        description:
          t('toasts.t099_383f79'),
      });
      return true;
    },
    [currentUser, persistUser, toast]
  );

  const applyForCompetition = useCallback(
    async (payload: {
      name: string;
      region: string;
      city: string;
      neighborhood: string;
      venueName: string;
      termsAccepted: boolean;
      diligencePledge: boolean;
      stadiumPledge: boolean;
      minTeamsPledge: boolean;
      firstAidPledge: boolean;
      orderPledge: boolean;
    }) => {
      if (!currentUser || !userHasRole(currentUser, 'organizer')) {
        toast({
          variant: 'destructive',
          title: t('toasts.t039_ceb90c'),
          description: t('toasts.t100_dad594'),
        });
        return false;
      }
      const name = payload.name.trim();
      const region = payload.region.trim();
      const city = payload.city.trim();
      const neighborhood = payload.neighborhood.trim();
      const venueName = payload.venueName.trim() || t('toasts.defaultVenue');
      if (!name || !region || !city || !neighborhood) {
        toast({
          variant: 'destructive',
          title: t('toasts.t045_e1da8e'),
          description: t('toasts.t101_dcb526'),
        });
        return false;
      }
      if (
        !payload.termsAccepted ||
        !payload.diligencePledge ||
        !payload.stadiumPledge ||
        !payload.minTeamsPledge ||
        !payload.firstAidPledge ||
        !payload.orderPledge
      ) {
        toast({
          variant: 'destructive',
          title: t('toasts.t046_15200c'),
          description:
            t('toasts.t102_dd4081'),
        });
        return false;
      }
      const hasPending = competitionRequests.some(
        (r) =>
          r.organizerId === currentUser.id &&
          r.status === 'pending' &&
          r.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (hasPending) {
        toast({
          variant: 'destructive',
          title: t('toasts.t047_a7bb8d'),
          description: t('toasts.t103_279ac6'),
        });
        return false;
      }

      const request: CompetitionRequest = {
        id: createId('creq'),
        organizerId: currentUser.id,
        name,
        region,
        city,
        neighborhood,
        venueName,
        termsAcceptedAt: new Date(),
        diligencePledge: true,
        stadiumPledge: true,
        minTeamsPledge: true,
        firstAidPledge: true,
        orderPledge: true,
        status: 'pending',
        requestedAt: new Date(),
      };

      if (isSupabaseConfigured()) {
        if (!isUuid(currentUser.id)) {
          toast({
            variant: 'destructive',
            title: 'تعذّر إرسال الطلب للسحابة',
            description:
              'ادخل بحساب Sign up سحابي (ليس حساباً تجريبياً محلياً).',
          });
          return false;
        }
        const cloud = await upsertCompetitionRequestCloud(request);
        if (!cloud.ok) {
          toast({
            variant: 'destructive',
            title: 'تعذّر إرسال الطلب للسحابة',
            description:
              cloud.error === 'no_session'
                ? 'أعد تسجيل الدخول بحساب Sign up.'
                : (cloud.error || '').includes('competition_requests') ||
                    (cloud.error || '').includes('schema cache') ||
                    (cloud.error || '').includes('does not exist') ||
                    (cloud.error || '').includes('relation')
                  ? 'نفّذ ملف FIX-CLOUD-SYNC.sql في Supabase SQL Editor ثم أعد المحاولة.'
                  : cloud.error || 'تحقق من الاتصال',
          });
          return false;
        }
      }

      setCompetitionRequests((prev) => {
        const next = mergeCompetitionRequestsById([request], prev);
        void saveCompetitionRequests(next);
        return next;
      });
      toast({
        variant: 'success',
        title: t('toasts.t048_edfae9'),
        description: t('toasts.t104_b5049c'),
      });
      return true;
    },
    [currentUser, competitionRequests, toast, t]
  );

  const approveCompetitionRequest = useCallback(
    async (requestId: string) => {
      const request = competitionRequests.find((r) => r.id === requestId);
      if (!request || request.status !== 'pending') {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }

      if (
        isSupabaseConfigured() &&
        (!isUuid(currentUser?.id) || currentUser?.role !== 'superadmin')
      ) {
        toast({
          variant: 'destructive',
          title: 'يلزم مشرف سحابي',
          description:
            'اقبل الطلب بعد الدخول من /admin بحساب Sign up المرقّى superadmin — وليس الحساب التجريبي.',
        });
        return false;
      }

      const competitionId = createId('comp');
      const fullAddress = buildCompetitionVenueAddress({
        venueName: request.venueName,
        neighborhood: request.neighborhood,
        city: request.city,
        region: request.region,
      });
      const competition: Competition = {
        id: competitionId,
        visibleId: nextCompetitionVisibleId(competitions),
        name: request.name,
        organizerId: request.organizerId,
        teams: [],
        matches: [],
        logo: DEFAULT_LOGO,
        status: 'active',
        venue: {
          name: request.venueName,
          region: request.region,
          city: request.city,
          neighborhood: request.neighborhood,
          fullAddress,
        },
        staff: [],
        media: { photos: [], videos: [] },
        refereeIds: [],
      };

      const approvedRequest: CompetitionRequest = {
        ...request,
        status: 'approved',
        reviewedAt: new Date(),
        competitionId,
      };

      if (isSupabaseConfigured()) {
        const cloud = await updateCompetitionRequestCloud(approvedRequest);
        if (!cloud.ok) {
          toast({
            variant: 'destructive',
            title: 'تعذّر تحديث الطلب في السحابة',
            description: cloud.error,
          });
          return false;
        }
        const upComp = await upsertCompetitionCloud(competition);
        if (!upComp.ok) {
          // أعد الطلب معلّقاً حتى لا يبقى approved بلا مسابقة
          await updateCompetitionRequestCloud({
            ...request,
            status: 'pending',
            reviewedAt: undefined,
            competitionId: undefined,
            rejectionReason: undefined,
          });
          toast({
            variant: 'destructive',
            title: 'تعذّر حفظ المسابقة في السحابة',
            description:
              (upComp.error || '').includes('app_competitions') ||
              (upComp.error || '').includes('does not exist') ||
              (upComp.error || '').includes('schema cache')
                ? 'نفّذ FIX-CLOUD-SYNC.sql في Supabase ثم أعد القبول.'
                : upComp.error,
          });
          return false;
        }
      }

      setCompetitions((prev) => {
        const next = mergeCloudCompetitions([competition], prev);
        void syncCompetitions(next);
        return next;
      });
      setCompetitionRequests((prev) => {
        const next = prev.map((r) =>
          r.id === requestId ? approvedRequest : r
        );
        void saveCompetitionRequests(next);
        return next;
      });

      // إشعار المنظم عبر رسالة سحابية (تظهر على جهازه كإشعار + رسائل)
      if (
        isSupabaseConfigured() &&
        isUuid(currentUser?.id) &&
        isUuid(request.organizerId)
      ) {
        const notify = await insertMessage({
          senderId: currentUser!.id,
          senderName: currentUser!.name || 'المشرف',
          senderAvatar: currentUser!.avatar,
          recipientId: request.organizerId,
          subject: `[نظام] تم قبول طلب تنظيم «${request.name}»`,
          body: `تمت الموافقة على طلبك لإنشاء مسابقة «${request.name}». يمكنك الآن إدارتها من شاشة المسابقات وإضافة الفرق (الحد الأدنى ${MIN_COMPETITION_TEAMS}).`,
        });
        if (notify.message) {
          setMessages((prev) => mergeMessagesById([notify.message!], prev));
        }
      }

      toast({
        variant: 'success',
        title: t('toasts.t050_d1ff71'),
        description: t('toasts.competitionCreatedForOrganizer', {
          name: request.name,
          count: MIN_COMPETITION_TEAMS,
        }),
      });
      return true;
    },
    [competitionRequests, competitions, toast, t, currentUser]
  );

  const rejectCompetitionRequest = useCallback(
    async (requestId: string, reason?: string) => {
      const request = competitionRequests.find((r) => r.id === requestId);
      if (!request || request.status !== 'pending') {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }
      if (
        isSupabaseConfigured() &&
        (!isUuid(currentUser?.id) || currentUser?.role !== 'superadmin')
      ) {
        toast({
          variant: 'destructive',
          title: 'يلزم مشرف سحابي',
          description: 'ارفض الطلب من حساب مشرف سحابي عبر /admin.',
        });
        return false;
      }
      const rejectedRequest: CompetitionRequest = {
        ...request,
        status: 'rejected',
        reviewedAt: new Date(),
        rejectionReason: reason?.trim() || t('toasts.requirementsNotMet'),
      };
      if (isSupabaseConfigured()) {
        const cloud = await updateCompetitionRequestCloud(rejectedRequest);
        if (!cloud.ok) {
          toast({
            variant: 'destructive',
            title: 'تعذّر تحديث الطلب في السحابة',
            description: cloud.error,
          });
          return false;
        }
      }
      setCompetitionRequests((prev) => {
        const next = prev.map((r) =>
          r.id === requestId ? rejectedRequest : r
        );
        void saveCompetitionRequests(next);
        return next;
      });

      if (
        isSupabaseConfigured() &&
        isUuid(currentUser?.id) &&
        isUuid(request.organizerId)
      ) {
        const reasonText =
          rejectedRequest.rejectionReason || t('toasts.requirementsNotMet');
        const notify = await insertMessage({
          senderId: currentUser!.id,
          senderName: currentUser!.name || 'المشرف',
          senderAvatar: currentUser!.avatar,
          recipientId: request.organizerId,
          subject: `[نظام] تم رفض طلب تنظيم «${request.name}»`,
          body: `تم رفض طلبك لإنشاء مسابقة «${request.name}». السبب: ${reasonText}`,
        });
        if (notify.message) {
          setMessages((prev) => mergeMessagesById([notify.message!], prev));
        }
      }

      toast({
        variant: 'success',
        title: t('toasts.t051_c3e138'),
        description: reason?.trim() || t('toasts.organizerRejected'),
      });
      return true;
    },
    [competitionRequests, toast, t, currentUser]
  );

  const patchAnalystUser = useCallback(
    (userId: string, updater: (u: User) => User | null) => {
      const target = users.find((u) => u.id === userId);
      if (!target) return null;
      const updated = updater(target);
      if (!updated) return null;
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setCurrentUser((prev) => (prev?.id === userId ? updated : prev));
      if (currentUser?.id === userId) {
        void setJson(USER_STORAGE_KEY, updated);
      }
      if (isUuid(updated.id) && isSupabaseConfigured()) {
        void upsertUserContentCloud(updated, {
          allowCrossUser: updated.id !== currentUser?.id,
        });
      }
      return updated;
    },
    [users, currentUser?.id]
  );

  const approveAnalystApplication = useCallback(
    (userId: string) => {
      const accessCode = generateAnalystAccessCode(10);
      const updated = patchAnalystUser(userId, (target) => {
        if (target.analyst?.status !== 'pending') return null;
        return {
          ...target,
          analyst: {
            ...target.analyst,
            status: 'approved',
            reviewedAt: new Date(),
            accessCode,
            accessCodeSentAt: new Date(),
          },
        };
      });
      if (!updated) {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: t('toasts.t052_01e592'),
        description: t('toasts.codeEmailed', {
          email: updated.email,
          code: accessCode,
        }),
      });
      return true;
    },
    [patchAnalystUser, toast, t]
  );

  const rejectAnalystApplication = useCallback(
    (userId: string, reason?: string) => {
      const updated = patchAnalystUser(userId, (target) => {
        if (target.analyst?.status !== 'pending') return null;
        return {
          ...target,
          analyst: {
            ...target.analyst,
            status: 'rejected',
            reviewedAt: new Date(),
            rejectionReason: reason?.trim() || t('toasts.requirementsNotMet'),
            accessCode: undefined,
          },
          permissions: { ...target.permissions, canCreateContent: false },
        };
      });
      if (!updated) {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: t('toasts.t051_c3e138'),
        description: t('toasts.emailNotified', { email: updated.email }),
      });
      return true;
    },
    [patchAnalystUser, toast, t]
  );

  const warnAnalyst = useCallback(
    (userId: string, reason: string) => {
      const note = reason.trim();
      if (!note) {
        toast({
          variant: 'destructive',
          title: t('toasts.t053_ec1501'),
        });
        return false;
      }
      const updated = patchAnalystUser(userId, (target) => {
        const status = target.analyst?.status;
        if (
          status !== 'active' &&
          status !== 'warned' &&
          status !== 'approved' &&
          status !== 'suspended'
        ) {
          return null;
        }
        return {
          ...target,
          permissions: { ...target.permissions, canCreateContent: true },
          analyst: {
            ...target.analyst!,
            status: 'warned',
            warningReason: note,
            warnedAt: new Date(),
            suspendFrom: undefined,
            suspendTo: undefined,
            suspendReason: undefined,
            banReason: undefined,
            bannedAt: undefined,
          },
        };
      });
      if (!updated) {
        toast({
          variant: 'destructive',
          title: t('toasts.t054_5837c5'),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: t('toasts.t055_565b17'),
        description: t('toasts.emailNotifiedNote', { email: updated.email, note }),
      });
      return true;
    },
    [patchAnalystUser, toast]
  );

  const suspendAnalyst = useCallback(
    (
      userId: string,
      from: Date | string,
      to: Date | string,
      reason: string
    ) => {
      const note = reason.trim();
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (!note) {
        toast({
          variant: 'destructive',
          title: t('toasts.t056_f92f4b'),
        });
        return false;
      }
      if (
        Number.isNaN(fromDate.getTime()) ||
        Number.isNaN(toDate.getTime()) ||
        toDate.getTime() <= fromDate.getTime()
      ) {
        toast({
          variant: 'destructive',
          title: t('toasts.t057_0be4dc'),
          description: t('toasts.t105_eeb0e6'),
        });
        return false;
      }
      const updated = patchAnalystUser(userId, (target) => {
        const status = target.analyst?.status;
        if (
          status !== 'active' &&
          status !== 'warned' &&
          status !== 'approved' &&
          status !== 'suspended'
        ) {
          return null;
        }
        return {
          ...target,
          permissions: { ...target.permissions, canCreateContent: false },
          analyst: {
            ...target.analyst!,
            status: 'suspended',
            suspendFrom: fromDate,
            suspendTo: toDate,
            suspendReason: note,
            banReason: undefined,
            bannedAt: undefined,
          },
        };
      });
      if (!updated) {
        toast({
          variant: 'destructive',
          title: t('toasts.t058_59918f'),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: t('toasts.t059_14e4aa'),
        description: t('toasts.suspendRange', {
          from: formatArabicDate(fromDate),
          to: formatArabicDate(toDate),
        }),
      });
      return true;
    },
    [patchAnalystUser, toast]
  );

  const banAnalyst = useCallback(
    (userId: string, reason: string) => {
      const note = reason.trim();
      if (!note) {
        toast({
          variant: 'destructive',
          title: t('toasts.t060_f2247c'),
        });
        return false;
      }
      const updated = patchAnalystUser(userId, (target) => {
        if (!target.analyst || target.analyst.status === 'none') return null;
        return {
          ...target,
          permissions: { ...target.permissions, canCreateContent: false },
          analyst: {
            ...target.analyst,
            status: 'banned',
            banReason: note,
            bannedAt: new Date(),
            suspendFrom: undefined,
            suspendTo: undefined,
            suspendReason: undefined,
          },
        };
      });
      if (!updated) {
        toast({
          variant: 'destructive',
          title: t('toasts.t061_b33a77'),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: t('toasts.t062_b7c408'),
        description: t('toasts.emailNotifiedNote', { email: updated.email, note }),
      });
      return true;
    },
    [patchAnalystUser, toast]
  );

  const reinstateAnalyst = useCallback(
    (userId: string) => {
      const updated = patchAnalystUser(userId, (target) => {
        const status = target.analyst?.status;
        if (
          status !== 'warned' &&
          status !== 'suspended' &&
          status !== 'banned'
        ) {
          return null;
        }
        return {
          ...target,
          permissions: { ...target.permissions, canCreateContent: true },
          analyst: {
            ...target.analyst!,
            status: 'active',
            warningReason: undefined,
            warnedAt: undefined,
            suspendFrom: undefined,
            suspendTo: undefined,
            suspendReason: undefined,
            banReason: undefined,
            bannedAt: undefined,
          },
        };
      });
      if (!updated) {
        toast({
          variant: 'destructive',
          title: t('toasts.t063_ee8c71'),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: t('toasts.t064_80532d'),
      });
      return true;
    },
    [patchAnalystUser, toast]
  );

  const verifyAnalystAccessCode = useCallback(
    (code: string) => {
      if (!currentUser) return false;
      const expected = currentUser.analyst?.accessCode?.trim();
      const entered = code.trim();
      if (currentUser.analyst?.status !== 'approved' || !expected) {
        toast({
          variant: 'destructive',
          title: t('toasts.t065_0e1830'),
          description: t('toasts.t106_3e9f42'),
        });
        return false;
      }
      if (!entered || entered !== expected) {
        toast({
          variant: 'destructive',
          title: t('toasts.t066_ef1a36'),
          description: t('toasts.t107_c88bd8'),
        });
        return false;
      }
      const updated: User = {
        ...currentUser,
        permissions: { ...currentUser.permissions, canCreateContent: true },
        analyst: {
          ...currentUser.analyst!,
          status: 'active',
          activatedAt: new Date(),
        },
      };
      persistUser(updated);
      toast({
        variant: 'success',
        title: t('toasts.t067_0d3b8c'),
        description: t('toasts.t108_1dc03a'),
      });
      return true;
    },
    [currentUser, persistUser, toast]
  );

  const togglePostLike = useCallback(
    (authorId: string, postId: string) => {
      if (!currentUser) return;
      const uid = currentUser.id;
      const apply = (u: User): User => {
        if (u.id !== authorId) return u;
        return {
          ...u,
          posts: u.posts.map((p) => {
            if (p.id !== postId) return p;
            const liked = p.likes.includes(uid);
            return {
              ...p,
              likes: liked
                ? p.likes.filter((id) => id !== uid)
                : [...p.likes, uid],
            };
          }),
        };
      };
      setUsers((prev) => prev.map(apply));
      setCurrentUser((prev) => {
        if (!prev || prev.id !== authorId) return prev;
        const updated = apply(prev);
        void setJson(USER_STORAGE_KEY, updated);
        if (isUuid(updated.id)) void upsertUserContentCloud(updated);
        return updated;
      });
      // إن أعجب بمحتوى مستخدم آخر — ارفع ملفه أيضاً إن أمكن
      setUsers((prev) => {
        const author = prev.find((u) => u.id === authorId);
        if (author && isUuid(author.id)) {
          void upsertUserContentCloud(apply(author), { allowCrossUser: true });
        }
        return prev;
      });
    },
    [currentUser]
  );

  const toggleAnalysisLike = useCallback(
    (authorId: string, analysisId: string) => {
      if (!currentUser) return;
      const uid = currentUser.id;
      const apply = (u: User): User => {
        if (u.id !== authorId) return u;
        return {
          ...u,
          analysisContent: u.analysisContent.map((a) => {
            if (a.id !== analysisId) return a;
            const liked = a.likes.includes(uid);
            return {
              ...a,
              likes: liked
                ? a.likes.filter((id) => id !== uid)
                : [...a.likes, uid],
            };
          }),
        };
      };
      setUsers((prev) => prev.map(apply));
      setCurrentUser((prev) => {
        if (!prev || prev.id !== authorId) return prev;
        const updated = apply(prev);
        void setJson(USER_STORAGE_KEY, updated);
        if (isUuid(updated.id)) void upsertUserContentCloud(updated);
        return updated;
      });
      setUsers((prev) => {
        const author = prev.find((u) => u.id === authorId);
        if (author && isUuid(author.id)) {
          void upsertUserContentCloud(apply(author), { allowCrossUser: true });
        }
        return prev;
      });
    },
    [currentUser]
  );

  const toggleMediaLike = useCallback(
    (
      authorId: string,
      mediaId: string,
      mediaType: 'photo' | 'video',
      source: 'user' | 'player' | 'match' | 'competition' = 'user'
    ) => {
      if (!currentUser) return;
      const uid = currentUser.id;
      const key = mediaType === 'photo' ? 'photos' : 'videos';

      const toggleList = <
        T extends { id: string; likes: string[] },
      >(
        list: T[]
      ): T[] =>
        list.map((item) => {
          if (item.id !== mediaId) return item;
          const liked = item.likes.includes(uid);
          return {
            ...item,
            likes: liked
              ? item.likes.filter((id) => id !== uid)
              : [...item.likes, uid],
          };
        });

      if (source === 'user') {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== authorId) return u;
            const media = u.media || { photos: [], videos: [] };
            return {
              ...u,
              media: { ...media, [key]: toggleList(media[key] || []) },
            };
          })
        );
        setCurrentUser((prev) => {
          if (!prev || prev.id !== authorId) return prev;
          const media = prev.media || { photos: [], videos: [] };
          const updated = {
            ...prev,
            media: { ...media, [key]: toggleList(media[key] || []) },
          };
          void setJson(USER_STORAGE_KEY, updated);
          if (isUuid(updated.id)) void upsertUserContentCloud(updated);
          return updated;
        });
        setUsers((prev) => {
          const author = prev.find((u) => u.id === authorId);
          if (author && isUuid(author.id)) {
            const media = author.media || { photos: [], videos: [] };
            void upsertUserContentCloud(
              {
                ...author,
                media: { ...media, [key]: toggleList(media[key] || []) },
              },
              { allowCrossUser: true }
            );
          }
          return prev;
        });
        return;
      }

      setCompetitions((prev) => {
        const next = prev.map((comp) => {
          if (source === 'competition') {
            if (comp.id !== authorId) return comp;
            const media = comp.media || { photos: [], videos: [] };
            return {
              ...comp,
              media: { ...media, [key]: toggleList(media[key] || []) },
            };
          }
          if (source === 'match') {
            return {
              ...comp,
              matches: comp.matches.map((m) => {
                if (m.id !== authorId) return m;
                return {
                  ...m,
                  media: {
                    ...m.media,
                    [key]: toggleList(m.media[key] || []),
                  },
                };
              }),
            };
          }
          return {
            ...comp,
            teams: comp.teams.map((team) => ({
              ...team,
              players: team.players.map((player) => {
                if (player.id !== authorId) return player;
                const media = player.media || { photos: [], videos: [] };
                return {
                  ...player,
                  media: { ...media, [key]: toggleList(media[key] || []) },
                };
              }),
            })),
          };
        });
        void syncCompetitions(next);
        return next;
      });
    },
    [currentUser, syncCompetitions]
  );

  const changePassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      if (!currentUser) return false;
      if (nextPassword.length < 6) {
        toast({
          variant: 'destructive',
          title: t('toasts.t069_c382f9'),
          description: t('toasts.t109_275ee0'),
        });
        return false;
      }

      const isCloudAccount =
        isUuid(currentUser.id) && isSupabaseConfigured();

      if (isCloudAccount) {
        // تحقق من كلمة المرور الحالية عبر تسجيل الدخول السحابي
        const reauth = await supabaseSignIn(
          normalizeEmail(currentUser.email),
          currentPassword
        );
        if (!reauth.user) {
          toast({
            variant: 'destructive',
            title: t('toasts.t068_1ed93e'),
          });
          return false;
        }
        const cloud = await supabaseUpdatePassword(nextPassword);
        if (!cloud.ok) {
          toast({
            variant: 'destructive',
            title: t('toasts.t069_c382f9'),
            description: cloud.error || cloudWriteErrorMessage('no_session'),
          });
          return false;
        }
        const updated = {
          ...currentUser,
          passwordHash: 'supabase' as const,
        };
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? updated : u))
        );
        setCurrentUser(updated);
        void setJson(USER_STORAGE_KEY, updated);
        toast({ variant: 'success', title: t('toasts.t070_104895') });
        return true;
      }

      if (!verifyPassword(currentPassword, currentUser.passwordHash)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t068_1ed93e'),
        });
        return false;
      }

      const updated = {
        ...currentUser,
        passwordHash: hashPassword(nextPassword),
      };
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      setCurrentUser(updated);
      void setJson(USER_STORAGE_KEY, updated);
      void (async () => {
        const prev =
          (await getJson<Record<string, UserCredentialOverride>>(
            USER_CREDENTIAL_OVERRIDES_KEY
          )) || {};
        await setJson(USER_CREDENTIAL_OVERRIDES_KEY, {
          ...prev,
          [updated.id]: {
            email: normalizeEmail(updated.email),
            passwordHash: updated.passwordHash,
            name: updated.name,
          },
        });
      })();
      toast({ variant: 'success', title: t('toasts.t070_104895') });
      return true;
    },
    [currentUser, toast, t]
  );

  const persistCurrentUser = useCallback((updated: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setCurrentUser(updated);
    void setJson(USER_STORAGE_KEY, updated);
    if (isUuid(updated.id) && isSupabaseConfigured()) {
      void upsertUserContentCloud(updated);
    }
  }, []);

  const addUserMedia = useCallback(
    async (
      type: 'photos' | 'videos',
      url: string,
      successMessage?: string
    ) => {
      if (!currentUser) return false;
      const trimmed = url.trim();
      if (!trimmed) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: t('toasts.t110_d9551c'),
        });
        return false;
      }

      const cloud = await requireCloudSession(currentUser.id);
      if (!cloud.session) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: cloudWriteErrorMessage(cloud.error),
        });
        return false;
      }

      const resolved = await resolvePublicMediaUrl({
        uri: trimmed,
        kind: type === 'photos' ? 'photo' : 'video',
        folder: 'users',
        userId: cloud.session.userId,
        requireCloud: true,
      });
      if (!resolved.url) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: cloudWriteErrorMessage(resolved.error),
        });
        return false;
      }

      const item = {
        id: createId(),
        url: resolved.url,
        timestamp: new Date(),
        likes: [] as string[],
        comments: [] as Comment[],
      };
      const media = currentUser.media || { photos: [], videos: [] };
      const updated: User = {
        ...currentUser,
        media: {
          ...media,
          [type]: [item, ...(media[type] || [])],
        },
      };
      persistCurrentUser(updated);
      const sync = await upsertUserContentCloud(updated);
      if (!sync.ok) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: cloudWriteErrorMessage(sync.error),
        });
        return false;
      }
      toast({
        variant: 'success',
        title: type === 'photos' ? t('common.photoAdded') : t('common.videoAdded'),
        description: successMessage,
      });
      return true;
    },
    [currentUser, persistCurrentUser, toast, t]
  );

  const removeUserMedia = useCallback(
    async (
      type: 'photos' | 'videos',
      mediaId: string,
      successMessage?: string
    ) => {
      if (!currentUser) return false;
      const media = currentUser.media || { photos: [], videos: [] };
      const updated: User = {
        ...currentUser,
        media: {
          ...media,
          [type]: (media[type] || []).filter((m) => m.id !== mediaId),
        },
      };
      persistCurrentUser(updated);
      if (isUuid(updated.id)) {
        const sync = await upsertUserContentCloud(updated);
        if (!sync.ok) {
          toast({
            variant: 'destructive',
            title: t('toasts.t071_355b33'),
            description: cloudWriteErrorMessage(sync.error),
          });
          return false;
        }
      }
      if (successMessage) {
        toast({ title: t('toasts.t014_3569a8'), description: successMessage });
      }
      return true;
    },
    [currentUser, persistCurrentUser, toast, t]
  );

  const addCompetitionMedia = useCallback(
    async (
      competitionId: string,
      type: 'photos' | 'videos',
      url: string,
      successMessage?: string,
      matchId?: string
    ) => {
      if (!currentUser) return false;
      const trimmed = url.trim();
      if (!trimmed) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: t('toasts.t110_d9551c'),
        });
        return false;
      }
      const owned = competitions.find(
        (c) => c.id === competitionId && c.organizerId === currentUser.id
      );
      if (!owned) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
        });
        return false;
      }

      const cloud = await requireCloudSession(currentUser.id);
      if (!cloud.session) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: cloudWriteErrorMessage(cloud.error),
        });
        return false;
      }

      const resolved = await resolvePublicMediaUrl({
        uri: trimmed,
        kind: type === 'photos' ? 'photo' : 'video',
        folder: matchId ? 'matches' : 'competitions',
        userId: cloud.session.userId,
        requireCloud: true,
      });
      if (!resolved.url) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: cloudWriteErrorMessage(resolved.error),
        });
        return false;
      }

      const item = {
        id: createId(),
        url: resolved.url,
        timestamp: new Date(),
        likes: [] as string[],
        comments: [] as Comment[],
      };

      const toUpsert: Competition = matchId
        ? {
            ...owned,
            matches: owned.matches.map((m) => {
              if (m.id !== matchId) return m;
              const media = m.media || { photos: [], videos: [] };
              return {
                ...m,
                media: {
                  ...media,
                  [type]: [item, ...(media[type] || [])],
                },
              };
            }),
          }
        : {
            ...owned,
            media: {
              ...(owned.media || { photos: [], videos: [] }),
              [type]: [
                item,
                ...((owned.media || { photos: [], videos: [] })[type] || []),
              ],
            },
          };

      setCompetitions((prev) => {
        const next = prev.map((c) => (c.id === competitionId ? toUpsert : c));
        void syncCompetitions(next);
        return next;
      });

      const cloudUpsert = await upsertCompetitionCloud(toUpsert);
      if (!cloudUpsert.ok) {
        toast({
          variant: 'destructive',
          title: t('toasts.t071_355b33'),
          description: cloudWriteErrorMessage(cloudUpsert.error),
        });
        return false;
      }

      toast({
        variant: 'success',
        title: type === 'photos' ? t('common.photoAdded') : t('common.videoAdded'),
        description: successMessage,
      });
      return true;
    },
    [competitions, currentUser, toast, t, syncCompetitions]
  );

  const removeCompetitionMedia = useCallback(
    async (input: {
      competitionId: string;
      mediaId: string;
      type: 'photos' | 'videos';
      matchId?: string;
      playerId?: string;
      successMessage?: string;
    }) => {
      if (!currentUser) return false;

      const owned = competitions.find(
        (c) =>
          c.id === input.competitionId && c.organizerId === currentUser.id
      );
      if (!owned) {
        toast({
          variant: 'destructive',
          title: t('organizer.media.deleteFailed'),
        });
        return false;
      }

      let found = false;
      let toUpsert: Competition = owned;

      if (input.playerId) {
        toUpsert = {
          ...owned,
          teams: owned.teams.map((team) => ({
            ...team,
            players: team.players.map((player) => {
              if (player.id !== input.playerId) return player;
              const media = player.media || { photos: [], videos: [] };
              const before = (media[input.type] || []).length;
              const nextList = (media[input.type] || []).filter(
                (m) => m.id !== input.mediaId
              );
              if (nextList.length !== before) found = true;
              return {
                ...player,
                media: { ...media, [input.type]: nextList },
              };
            }),
          })),
        };
      } else if (input.matchId) {
        toUpsert = {
          ...owned,
          matches: owned.matches.map((m) => {
            if (m.id !== input.matchId) return m;
            const media = m.media || { photos: [], videos: [] };
            const before = (media[input.type] || []).length;
            const nextList = (media[input.type] || []).filter(
              (x) => x.id !== input.mediaId
            );
            if (nextList.length !== before) found = true;
            return {
              ...m,
              media: { ...media, [input.type]: nextList },
            };
          }),
        };
      } else {
        const media = owned.media || { photos: [], videos: [] };
        const before = (media[input.type] || []).length;
        const nextList = (media[input.type] || []).filter(
          (m) => m.id !== input.mediaId
        );
        if (nextList.length !== before) found = true;
        toUpsert = {
          ...owned,
          media: { ...media, [input.type]: nextList },
        };
      }

      if (!found) {
        toast({
          variant: 'destructive',
          title: t('organizer.media.deleteFailed'),
          description: t('organizer.media.deleteNotFound'),
        });
        return false;
      }

      // حدّث الواجهة فوراً ثم ارفع للسحابة
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === input.competitionId ? toUpsert : c
        );
        void syncCompetitions(next);
        return next;
      });

      if (isSupabaseConfigured() && isUuid(currentUser.id)) {
        const cloud = await requireCloudSession(currentUser.id);
        if (!cloud.session) {
          toast({
            variant: 'success',
            title:
              input.type === 'photos'
                ? t('organizer.media.photoDeleted')
                : t('organizer.media.videoDeleted'),
            description: cloudWriteErrorMessage(cloud.error),
          });
          return true;
        }
        const cloudUpsert = await upsertCompetitionCloud(toUpsert);
        if (!cloudUpsert.ok) {
          toast({
            variant: 'success',
            title:
              input.type === 'photos'
                ? t('organizer.media.photoDeleted')
                : t('organizer.media.videoDeleted'),
            description:
              cloudUpsert.error || t('cloud.competitionSyncFailed'),
          });
          return true;
        }
      }

      toast({
        variant: 'success',
        title:
          input.type === 'photos'
            ? t('organizer.media.photoDeleted')
            : t('organizer.media.videoDeleted'),
        description: input.successMessage,
      });
      return true;
    },
    [competitions, currentUser, toast, t, syncCompetitions]
  );

  const setUserAvatar = useCallback(
    async (url: string, successMessage?: string) => {
      if (!currentUser) return false;
      const trimmed = url.trim();
      const clearing = !trimmed;

      let finalUrl = '';
      if (!clearing) {
        const cloud = await requireCloudSession(currentUser.id);
        finalUrl = trimmed;
        if (cloud.session) {
          const resolved = await resolvePublicMediaUrl({
            uri: trimmed,
            kind: 'photo',
            folder: 'avatars',
            userId: cloud.session.userId,
            requireCloud: true,
          });
          if (!resolved.url) {
            toast({
              variant: 'destructive',
              title: t('toasts.t071_355b33'),
              description: cloudWriteErrorMessage(resolved.error),
            });
            return false;
          }
          finalUrl = resolved.url;
        } else if (!/^https?:\/\//i.test(trimmed)) {
          toast({
            variant: 'destructive',
            title: t('toasts.t071_355b33'),
            description: cloudWriteErrorMessage(cloud.error),
          });
          return false;
        }
      }

      const updated: User = {
        ...currentUser,
        avatar: finalUrl || undefined,
      };
      persistCurrentUser(updated);
      if (isUuid(updated.id) && isSupabaseConfigured()) {
        await upsertUserContentCloud(updated);
      }
      toast({
        variant: 'success',
        title: clearing ? t('media.avatarRemoved') : t('toasts.t072_2a81f2'),
        description: successMessage,
      });
      return true;
    },
    [currentUser, persistCurrentUser, toast, t]
  );

  const toggleFollowUser = useCallback(
    (targetUserId: string) => {
      if (!currentUser) return false;
      if (currentUser.id === targetUserId) return false;
      const me = ensureSocialLists(currentUser);
      const isFollowing = (me.following || []).includes(targetUserId);

      setUsers((prev) =>
        prev.map((u) => {
          const user = ensureSocialLists(u);
          if (u.id === me.id) {
            return {
              ...user,
              following: isFollowing
                ? user.following!.filter((id) => id !== targetUserId)
                : [...user.following!, targetUserId],
            };
          }
          if (u.id === targetUserId) {
            return {
              ...user,
              followers: isFollowing
                ? user.followers!.filter((id) => id !== me.id)
                : [...user.followers!, me.id],
            };
          }
          return user;
        })
      );

      const nextFollowing = isFollowing
        ? (me.following || []).filter((id) => id !== targetUserId)
        : [...(me.following || []), targetUserId];
      const updated: User = {
        ...me,
        following: nextFollowing,
      };
      // تحديث followers على الهدف في currentUser غير مطلوب؛ نحدّث فقط following
      setCurrentUser(updated);
      void setJson(USER_STORAGE_KEY, updated);
      if (isUuid(updated.id)) void upsertUserContentCloud(updated);
      // حدّث ملف المتابَع سحابياً إن أمكن
      setUsers((prev) => {
        const target = prev.find((u) => u.id === targetUserId);
        if (target && isUuid(target.id)) {
          const ensured = ensureSocialLists(target);
          void upsertUserContentCloud(
            {
              ...ensured,
              followers: isFollowing
                ? (ensured.followers || []).filter((id) => id !== me.id)
                : [...(ensured.followers || []), me.id],
            },
            { allowCrossUser: true }
          );
        }
        return prev;
      });

      toast({
        variant: 'success',
        title: isFollowing
          ? t('account.stats.unfollowed')
          : t('account.stats.followed'),
      });

      if (!isFollowing) {
        addNotification({
          kind: 'follow',
          recipientId: targetUserId,
          title: t('notifications.followTitle'),
          body: t('notifications.followBody', {
            name: me.name || me.handle,
          }),
          href: `/profile/${me.id}`,
        });
      }
      return true;
    },
    [currentUser, toast, addNotification, t]
  );

  const scopedCompetitions = useMemo(() => {
    if (currentUser?.role === 'organizer') {
      return competitions.filter((c) => c.organizerId === currentUser.id);
    }
    return competitions;
  }, [competitions, currentUser]);

  const scopedOffers = useMemo(() => {
    if (currentUser?.role === 'organizer') {
      return offers.filter((o) => o.organizerId === currentUser.id);
    }
    return offers;
  }, [offers, currentUser]);

  const scopedGiftTransactions = useMemo(() => {
    if (currentUser?.role === 'organizer') {
      return giftTransactions.filter((g) => g.recipientId === currentUser.id);
    }
    return giftTransactions;
  }, [giftTransactions, currentUser]);

  const value = useMemo(
    () => ({
      loading,
      appName,
      appLogo,
      fabIcons,
      personalitySectionBg,
      highlightsSectionBg,
      users,
      competitions: scopedCompetitions,
      competitionRequests,
      comments,
      quickComments,
      messages,
      referees,
      offers: scopedOffers,
      shareCards,
      supporters,
      supportLevels,
      giftTransactions: scopedGiftTransactions,
      currentUser,
      login,
      logout,
      signUp,
      enableSecondaryRole,
      switchActiveRole,
      setAppName,
      setAppLogo,
      setFabIcons,
      updateUser,
      syncCloudUsers,
      refreshCloudCompetitionRequests,
      togglePinnedCompetition,
      deleteUser,
      purgeUserByEmail,
      addReferee,
      registerRefereeForCompetition,
      updateReferee,
      deleteReferee,
      markMessageAsRead,
      deleteQuickComment,
      addQuickComment,
      addComment,
      toggleCommentLike,
      updateDiscussionStatus,
      updateSupportLevels,
      purchaseSupportGift,
      updateCompetition,
      updateCompetitionStatus,
      setCompetitionFixturesSuspended,
      updatePlayerStatus,
      generateFixturesForCompetition,
      applyForCompetition,
      approveCompetitionRequest,
      rejectCompetitionRequest,
      updateMatchResult,
      assignRefereeToCompetition,
      removeRefereeFromCompetition,
      updateOfferStatus,
      sendOffer,
      sendMessage,
      mergeRemoteMessages,
      refreshCloudMessages,
      refreshCloudForumComments,
      sendShareCard,
      updateShareCardStatus,
      markShareCardRead,
      addTeam,
      renameCompetition,
      deleteCompetition,
      deleteCompetitionRequest,
      renameTeam,
      deleteTeam,
      addPlayerToTeam,
      updatePlayerAvatar,
      addStaffToCompetition,
      updateStaffAvatar,
      removeStaffFromCompetition,
      addAnalysis,
      applyAsAnalyst,
      approveAnalystApplication,
      rejectAnalystApplication,
      warnAnalyst,
      suspendAnalyst,
      banAnalyst,
      reinstateAnalyst,
      verifyAnalystAccessCode,
      togglePostLike,
      toggleAnalysisLike,
      toggleMediaLike,
      changePassword,
      addUserMedia,
      removeUserMedia,
      addCompetitionMedia,
      removeCompetitionMedia,
      setUserAvatar,
      toggleFollowUser,
      routeForRole,
    }),
    [
      loading,
      appName,
      appLogo,
      fabIcons,
      personalitySectionBg,
      highlightsSectionBg,
      users,
      scopedCompetitions,
      competitionRequests,
      comments,
      quickComments,
      messages,
      referees,
      scopedOffers,
      shareCards,
      supporters,
      supportLevels,
      scopedGiftTransactions,
      currentUser,
      login,
      logout,
      signUp,
      enableSecondaryRole,
      switchActiveRole,
      setAppName,
      setAppLogo,
      setFabIcons,
      updateUser,
      syncCloudUsers,
      refreshCloudCompetitionRequests,
      togglePinnedCompetition,
      deleteUser,
      purgeUserByEmail,
      addReferee,
      registerRefereeForCompetition,
      updateReferee,
      deleteReferee,
      markMessageAsRead,
      deleteQuickComment,
      addQuickComment,
      addComment,
      toggleCommentLike,
      updateDiscussionStatus,
      updateSupportLevels,
      purchaseSupportGift,
      updateCompetition,
      updateCompetitionStatus,
      setCompetitionFixturesSuspended,
      updatePlayerStatus,
      generateFixturesForCompetition,
      applyForCompetition,
      approveCompetitionRequest,
      rejectCompetitionRequest,
      updateMatchResult,
      assignRefereeToCompetition,
      removeRefereeFromCompetition,
      updateOfferStatus,
      sendOffer,
      sendMessage,
      mergeRemoteMessages,
      refreshCloudMessages,
      refreshCloudForumComments,
      sendShareCard,
      updateShareCardStatus,
      markShareCardRead,
      addTeam,
      renameCompetition,
      deleteCompetition,
      deleteCompetitionRequest,
      renameTeam,
      deleteTeam,
      addPlayerToTeam,
      updatePlayerAvatar,
      addStaffToCompetition,
      updateStaffAvatar,
      removeStaffFromCompetition,
      addAnalysis,
      applyAsAnalyst,
      approveAnalystApplication,
      rejectAnalystApplication,
      warnAnalyst,
      suspendAnalyst,
      banAnalyst,
      reinstateAnalyst,
      verifyAnalystAccessCode,
      togglePostLike,
      toggleAnalysisLike,
      toggleMediaLike,
      changePassword,
      addUserMedia,
      removeUserMedia,
      addCompetitionMedia,
      removeCompetitionMedia,
      setUserAvatar,
      toggleFollowUser,
      routeForRole,
    ]
  );

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) {
    throw new Error('useTournament must be used within TournamentProvider');
  }
  return ctx;
}
