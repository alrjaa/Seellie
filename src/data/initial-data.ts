import { buildInitialSupportLevels } from '@/data/recognition-certificate-levels';

// 1. Data Interfaces

export interface DynamicFloatingIcon {
  id: string;
  label: string;
  iconUrl: string;
  href: string;
  roles: ('organizer' | 'follower' | 'freelancer')[];
}

export type SkillName = 'مهاري' | 'هداف' | 'صخرة دفاعية' | 'قائد' | 'مجهود وافر';

/** حالة طلب الانضمام كمحلل في الفريد */
export type AnalystStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'warned'
  | 'suspended'
  | 'banned';

export type AnalystProfile = {
  status: AnalystStatus;
  termsAcceptedAt?: Date | string;
  requestedAt?: Date | string;
  reviewedAt?: Date | string;
  /** رمز الوصول المرسل عبر البريد بعد الموافقة (أرقام + حروف + إشارات) */
  accessCode?: string;
  accessCodeSentAt?: Date | string;
  activatedAt?: Date | string;
  rejectionReason?: string;
  /** إنذار */
  warningReason?: string;
  warnedAt?: Date | string;
  /** إيقاف مؤقت من — إلى */
  suspendFrom?: Date | string;
  suspendTo?: Date | string;
  suspendReason?: string;
  /** إيقاف نهائي */
  banReason?: string;
  bannedAt?: Date | string;
};

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // In a real app, never store plain text passwords
  /** الدور النشط حالياً (مرادف activeRole للتوافق) */
  role: 'superadmin' | 'organizer' | 'follower' | 'freelancer';
  /** كل الأدوار المفعّلة — متابع + مسار ثانٍ واحد (منظم أو لاعب حر) */
  roles?: Array<'superadmin' | 'organizer' | 'follower' | 'freelancer'>;
  /** الواجهة الحالية */
  activeRole?: 'superadmin' | 'organizer' | 'follower' | 'freelancer';
  status: 'active' | 'suspended' | 'warned' | 'blocked';
  handle: string; // Like a twitter handle, e.g., @username
  avatar?: string;
  /** رقم التسجيل الظاهر للمستخدم (مثال: FOL-1001) */
  visibleId: string;
  country?: string;
  region?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  /** بطولات مثبتة في الرئيسية الشخصية (حتى خارج المدينة) */
  pinnedCompetitionIds?: string[];
  mobile?: string;
  age?: number;
  bankAccountNumber?: string;
  // Freelancer specific fields
  bio?: string;
  posts: { id: string; text: string; timestamp: Date; likes: string[] }[];
  media: {
    photos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
    videos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
  };
  personalityPhotos: string[]; // Nominated photos for "Player Personality"
  participationHistoryText?: string;
  permissions: {
      canComment: boolean;
      canUseVoice: boolean;
      canNominateToPersonality: boolean;
      canCreateContent: boolean;
  };
  /** طلب / اعتماد المحلل لنشر المحتوى في الفريد */
  analyst?: AnalystProfile;
  analysisContent: {
    id: string;
    matchId?: string;
    title: string;
    content: string;
    videoUrl?: string;
    posterUrl?: string;
    timestamp: Date;
    likes: string[];
    comments: Comment[];
    status?: 'active' | 'warned' | 'suspended' | 'blocked';
    statusReason?: string;
  }[];
  comments: Comment[]; // Comments made on this user's profile
  /** معرفات الحسابات التي تتابع هذا المستخدم */
  followers?: string[];
  /** معرفات الحسابات التي يتابعها هذا المستخدم */
  following?: string[];
}

export interface Player {
    id: string;
    visibleId: string;
    name: string;
    jerseyNumber: number;
    position: 'حارس مرمى' | 'دفاع' | 'وسط' | 'هجوم';
    teamId: string;
    status: 'active' | 'suspended' | 'warned';
    statusReason?: string;
    avatar?: string;
    email?: string;
    mobile?: string;
    address?: string;
    bankAccountNumber?: string;
    media: {
        photos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
        videos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
    };
    participationHistoryText?: string;
    bio?: string;
    comments: Comment[];
}

export interface TeamOfficial {
  id: string;
  name: string;
  role: 'مدرب' | 'مساعد مدرب' | 'مدير الفريق' | 'مساعد مدير الفريق' | 'أخصائي علاج طبيعي';
  address?: string;
  mobile?: string;
  email?: string;
  avatar?: string;
  status: 'active' | 'suspended' | 'warned';
}

export interface Team {
    id: string;
    name: string;
    competitionId: string;
    players: Player[];
    officials: TeamOfficial[];
    logo?: string;
    status: 'active' | 'suspended';
    bankAccountNumber?: string;
    comments: Comment[];
}

export interface Referee {
    id: string;
    name: string;
    avatar?: string;
    rating: number;
    status: 'active' | 'suspended' | 'warned';
    statusReason?: string;
    address?: string;
    city?: string;
    mobile?: string;
    role: 'حكم ساحة' | 'رجل خط' | 'مراقب';
}

export interface MatchMedia {
    photos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
    videos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
}
export interface Match {
    id: string;
    competitionId: string;
    team1Id: string;
    team2Id:string;
    team1Score: number;
    team2Score: number;
    date: Date;
    refereeId?: string;
    media: MatchMedia;
    comments: Comment[];
    analysisContent: User['analysisContent'];
}

export interface CompetitionVenue {
  name: string;
  country?: string;
  region?: string;
  city?: string;
  /** الحي */
  neighborhood?: string;
  street?: string;
  buildingNumber?: string;
  fullAddress: string;
}

export type CompetitionRequestStatus = 'pending' | 'approved' | 'rejected';

/** طلب منظم لإنشاء مسابقة جديدة — يراجعها المشرف */
export type CompetitionRequest = {
  id: string;
  organizerId: string;
  name: string;
  region: string;
  city: string;
  neighborhood: string;
  venueName: string;
  termsAcceptedAt: Date | string;
  diligencePledge: boolean;
  stadiumPledge: boolean;
  /** تعهد ألا تقل المسابقة عن 6 فرق */
  minTeamsPledge: boolean;
  /** تعهد بتقديم الإسعافات الأولية لأي مصاب */
  firstAidPledge: boolean;
  /** تعهد بعدم إثارة اضطرابات والحفاظ على النظام */
  orderPledge: boolean;
  status: CompetitionRequestStatus;
  requestedAt: Date | string;
  reviewedAt?: Date | string;
  rejectionReason?: string;
  competitionId?: string;
};

export interface CompetitionStaff {
  id: string;
  name: string;
  role: string;
  mobile?: string;
  avatar?: string;
}

export interface Competition {
  id: string;
  visibleId: string;
  name: string;
  organizerId: string;
  teams: Team[];
  matches: Match[];
  logo?: string;
  status: 'active' | 'suspended' | 'warned';
  statusReason?: string;
  /** إيقاف جدول المباريات من المشرف (منفصل عن حالة المسابقة) */
  fixturesSuspended?: boolean;
  fixturesSuspendReason?: string;
  venue?: CompetitionVenue;
  staff?: CompetitionStaff[];
  media: {
      photos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
      videos: { id: string; url: string; timestamp?: Date; likes: string[]; comments: Comment[] }[];
  };
  refereeIds: string[];
}

export interface Supporter {
  id: string;
  name: string;
  accountNumber: string;
  level: 'ماسي' | 'ذهبي' | 'فضي' | 'برونزي' | 'شريك';
}

export type SupportLevelName = string;
/** هدية تقدير اعتيادي أو شهادة تقدير استثنائية */
export type AppreciationKind = 'gift' | 'certificate';

export interface SupportLevel {
    id: string;
    name: string;
    price: number;
    description: string;
    imageUrl: string;
    /** gift = تقدير اعتيادي · certificate = شهادة تقدير */
    kind?: AppreciationKind;
};

/** حالة عملية التقدير — الدفع الحقيقي لاحقاً يؤكد paid من الخادم فقط */
export type AppreciationProcessStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  /** سجلات قديمة من الخادم — تُعرض كـ pending */
  | 'pending_demo';

/** حالة كيان الشهادة بعد إنشاء النية / بعد الدفع */
export type AppreciationCertificateStatus =
  | 'awaiting_payment'
  | 'issued'
  | 'void';


export interface Comment {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    text: string;
    audioUrl?: string;
    /** فيديو مساهمة في الساحة — من حساب الناشر نفسه، بحد أقصى 30 ثانية */
    videoUrl?: string;
    /** مدة الفيديو بالثواني */
    videoDurationSec?: number;
    timestamp: Date;
    replies: Comment[];
    likes: string[];
    status?: 'active' | 'warned' | 'suspended' | 'blocked';
    statusReason?: string;
}

export interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    recipientId: string;
    subject: string;
    body: string;
    timestamp: Date;
    read: boolean;
}

export interface Offer {
    id: string;
    freelancerId: string;
    organizerId: string;
    organizerName: string;
    organizerAvatar: string;
    competitionId: string;
    competitionName: string;
    teamId: string;
    teamName: string;
    message: string;
    status: 'pending' | 'accepted' | 'declined';
    timestamp: Date;
}

/** بطاقة مشاركة: محتوى أو طلب انضمام كلاعب */
export type ShareCardKind = 'content' | 'join_request';
export type ShareCardStatus = 'pending' | 'accepted' | 'declined' | 'seen';

export interface ShareCard {
  id: string;
  kind: ShareCardKind;
  status: ShareCardStatus;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderHandle?: string;
  senderRole?: string;
  recipientId: string;
  recipientName: string;
  recipientKind: 'user' | 'referee';
  /** محتوى مشارك */
  title?: string;
  body?: string;
  mediaUrl?: string;
  mediaKind?: 'photo' | 'video' | 'text' | 'link';
  /** طلب انضمام كلاعب */
  competitionId?: string;
  competitionName?: string;
  teamId?: string;
  teamName?: string;
  position?: string;
  timestamp: Date;
  read: boolean;
}

export interface GiftTransaction {
  id: string; // Unique transaction ID
  /**
   * رقم مرجعي / رقم شهادة.
   * FUTURE SERVER-SIDE: يجب أن يصدره الخادم عند الدفع الحقيقي — العميل لا يُعتمد كمصدر حقيقة.
   */
  certificateNumber: string;
  gifterId: string;
  gifterName: string;
  gifterVisibleId?: string; // or handle
  gifterBankAccountNumber?: string;
  recipientId: string;
  recipientName: string;
  recipientType: 'organizer' | 'team' | 'player' | 'freelancer' | 'follower';
  recipientVisibleId?: string; // or handle
  certificateType: string;
  amountPaid: number;
  timestamp: Date;
  status: AppreciationProcessStatus;
  /** هدية اعتيادية أو شهادة تقدير */
  appreciationKind?: AppreciationKind;
  /** سبب التقدير (اختياري) */
  reason?: string;
  /** حالة الشهادة — للهدايا قد تُترك فارغة */
  certificateStatus?: AppreciationCertificateStatus;
  /** مستوى الشهادة (1، 2، …) عند كونها شهادة */
  certificateTier?: number;
  competitionName?: string;
  teamName?: string;
}

// 2. Initial Data
export const initialDynamicFloatingIcons: DynamicFloatingIcon[] = [];
export const initialPlayerProfileHeaderBg = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4';

export const initialUsers: User[] = [
    { id: 'organizer-1', handle: '@organizer1', name: 'منظم بطولة الأبطال', email: 'organizer1@test.com', passwordHash: 'password123', role: 'organizer', status: 'active', visibleId: 'ORG-1001', country: 'المملكة العربية السعودية', region: 'منطقة الرياض', city: 'الرياض', street: '1234 طريق الملك فهد', houseNumber: "25", mobile: '0501234567', age: 35, avatar: 'https://placehold.co/100x100.png', bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`, permissions: { canComment: true, canUseVoice: true, canCreateContent: false, canNominateToPersonality: false }, analysisContent: [], posts: [], media: { photos: [], videos: [] }, personalityPhotos: [], comments: [] },
    { id: 'organizer-2', handle: '@organizer2', name: 'منظم دوري النجوم', email: 'organizer2@test.com', passwordHash: 'password123', role: 'organizer', status: 'active', visibleId: 'ORG-1002', country: 'المملكة العربية السعودية', region: 'منطقة مكة المكرمة', city: 'جدة', street: '5678 طريق الأمير محمد', houseNumber: "10", mobile: '0502345678', age: 42, avatar: 'https://placehold.co/100x100.png', bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`, permissions: { canComment: true, canUseVoice: true, canCreateContent: false, canNominateToPersonality: false }, analysisContent: [], posts: [], media: { photos: [], videos: [] }, personalityPhotos: [], comments: [] },
    { id: 'organizer-3', handle: '@organizer3', name: 'منظم كأس التحدي', email: 'organizer3@test.com', passwordHash: 'password123', role: 'organizer', status: 'warned', visibleId: 'ORG-1003', country: 'المملكة العربية السعودية', region: 'المنطقة الشرقية', city: 'الدمام', street: '9101 شارع العليا', houseNumber: "7", mobile: '0503456789', age: 29, avatar: 'https://placehold.co/100x100.png', bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`, permissions: { canComment: true, canUseVoice: true, canCreateContent: false, canNominateToPersonality: false }, analysisContent: [], posts: [], media: { photos: [], videos: [] }, personalityPhotos: [], comments: [] },
    { id: 'organizer-4', handle: '@organizer4', name: 'منظم بطولة المستقبل', email: 'organizer4@test.com', passwordHash: 'password123', role: 'organizer', status: 'suspended', visibleId: 'ORG-1004', country: 'المملكة العربية السعودية', region: 'منطقة عسير', city: 'أبها', street: '1122 طريق المطار', houseNumber: "15", mobile: '0504567890', age: 38, avatar: 'https://placehold.co/100x100.png', bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`, permissions: { canComment: false, canUseVoice: false, canCreateContent: false, canNominateToPersonality: false }, analysisContent: [], posts: [], media: { photos: [], videos: [] }, personalityPhotos: [], comments: [] },
    { 
        id: 'follower-1', 
        name: 'متابع شغوف', 
        email: 'follower@test.com', 
        passwordHash: 'password123', 
        role: 'follower', 
        status: 'active', 
        handle: '@follower',
        visibleId: 'FOL-1001',
        avatar: 'https://placehold.co/100x100.png', 
        country: 'مصر', 
        region: 'القاهرة', 
        city: 'القاهرة', 
        mobile: '01001234567', 
        bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`, 
        permissions: { canComment: true, canUseVoice: true, canCreateContent: false, canNominateToPersonality: false },
        posts: [],
        media: { photos: [], videos: [] },
        personalityPhotos: [],
        comments: [],
        analysisContent: [
            {
                id: 'analysis-1',
                matchId: 'match-1',
                title: 'تحليل تكتيكي لمباراة النسور والصقور',
                content: 'كانت مباراة مثيرة ومليئة بالتحولات التكتيكية. اعتمد فريق النسور على الضغط العالي في الشوط الأول مما أربك فريق الصقور وأثمر عن هدفين.\n\nفي الشوط الثاني، غير فريق الصقور من استراتيجيته بالاعتماد على الهجمات المرتدة السريعة، ونجح في تقليص الفارق لكن الوقت لم يسعفه لإدراك التعادل. نقطة التحول كانت تبديل المدرب في الدقيقة 60 الذي أعاد الحيوية لخط الوسط.',
                timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                likes: ['organizer-1', 'freelancer-1'],
                videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                posterUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
                comments: []
            },
            {
                id: 'analysis-2',
                matchId: 'match-3',
                title: 'أخطاء دفاعية قاتلة في دوري النجوم',
                content: 'شهدت المباراة أخطاء دفاعية بالجملة من كلا الفريقين، وهو ما يفسر النتيجة الكبيرة. يجب على المدربين مراجعة تمركز اللاعبين أثناء الكرات الثابتة.',
                timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                likes: ['organizer-2'],
                comments: []
            },
            {
                id: 'analysis-3',
                title: 'مراجعة مرئية لأداء خط الوسط',
                content: 'فيديو تحليلي يوضح تحركات لاعبي الوسط أثناء الانتقال من الدفاع إلى الهجوم، مع ملاحظات حول المسافات بين الخطوط.',
                timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
                likes: ['follower-2'],
                videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                posterUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
                comments: []
            }
        ] 
    },
    {
        id: 'follower-2',
        name: 'سارة المشجع',
        email: 'follower2@test.com',
        passwordHash: 'password123',
        role: 'follower',
        status: 'active',
        handle: '@follower2',
        visibleId: 'FOL-1002',
        avatar: 'https://placehold.co/100x100/22c55e/ffffff.png?text=س',
        country: 'المملكة العربية السعودية',
        region: 'منطقة الرياض',
        city: 'الرياض',
        mobile: '0502000002',
        bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`,
        permissions: { canComment: true, canUseVoice: true, canCreateContent: false, canNominateToPersonality: true },
        posts: [],
        media: { photos: [], videos: [] },
        personalityPhotos: [],
        comments: [],
        analysisContent: [],
    },
    {
        id: 'follower-3',
        name: 'أحمد المتابع',
        email: 'follower3@test.com',
        passwordHash: 'password123',
        role: 'follower',
        status: 'active',
        handle: '@follower3',
        visibleId: 'FOL-1003',
        avatar: 'https://placehold.co/100x100/3b82f6/ffffff.png?text=أ',
        country: 'الكويت',
        region: 'العاصمة',
        city: 'الكويت',
        mobile: '0503000003',
        bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`,
        permissions: { canComment: true, canUseVoice: true, canCreateContent: false, canNominateToPersonality: false },
        posts: [],
        media: { photos: [], videos: [] },
        personalityPhotos: [],
        comments: [],
        analysisContent: [],
    },
    {
        id: 'follower-4',
        name: 'نورة الرياضية',
        email: 'follower4@test.com',
        passwordHash: 'password123',
        role: 'follower',
        status: 'active',
        handle: '@follower4',
        visibleId: 'FOL-1004',
        avatar: 'https://placehold.co/100x100/f59e0b/ffffff.png?text=ن',
        country: 'المملكة العربية السعودية',
        region: 'منطقة مكة المكرمة',
        city: 'جدة',
        mobile: '0504000004',
        bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`,
        permissions: { canComment: true, canUseVoice: true, canCreateContent: false, canNominateToPersonality: true },
        posts: [],
        media: { photos: [], videos: [] },
        personalityPhotos: [],
        comments: [],
        analysisContent: [],
    },
    {
        id: 'follower-5',
        name: 'خالد المشجع',
        email: 'follower5@test.com',
        passwordHash: 'password123',
        role: 'follower',
        status: 'active',
        handle: '@follower5',
        visibleId: 'FOL-1005',
        avatar: 'https://placehold.co/100x100/ef4444/ffffff.png?text=خ',
        country: 'البحرين',
        region: 'المحرق',
        city: 'المحرق',
        mobile: '0505000005',
        bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`,
        permissions: { canComment: true, canUseVoice: false, canCreateContent: false, canNominateToPersonality: false },
        posts: [],
        media: { photos: [], videos: [] },
        personalityPhotos: [],
        comments: [],
        analysisContent: [],
    },
    { id: 'freelancer-1', name: 'لاعب حر موهوب', email: 'freelancer@test.com', passwordHash: 'password123', role: 'freelancer', status: 'active', handle: '@freelancer', visibleId: 'FLR-1001', avatar: 'https://placehold.co/100x100.png', country: 'الإمارات العربية المتحدة', region: 'دبي', city: 'دبي', mobile: '0509876543', bankAccountNumber: `SA${Math.floor(1000000000000000000000 + Math.random() * 9000000000000000000000)}`, bio: 'لاعب وسط مهاجم، أبحث عن فرصة لإثبات مهاراتي. أتميز بالتسديد القوي والرؤية الممتازة للملعب.', posts: [{ id: 'post-1', text: 'جاهز للتحدي القادم!', timestamp: new Date(), likes: [] }], media: { photos: [{id: 'freelancer-1-photo-1', url: 'https://placehold.co/400x300.png', likes: [], comments: []}], videos: [{id: 'freelancer-1-video-1', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', likes: ['user-1', 'user-2'], comments: []}] }, personalityPhotos: ['https://placehold.co/400x300.png'], participationHistoryText: ' - لعب في دوري الهواة بالرياض 2023\n - شارك في بطولة الشركات لكرة القدم 2022', permissions: { canComment: true, canUseVoice: true, canNominateToPersonality: true, canCreateContent: false }, analysisContent: [], comments: [] },
];

export const initialReferees: Referee[] = [
    { id: 'ref-1', name: 'خليل جلال', rating: 5, status: 'active', role: 'حكم ساحة', mobile: '0501112233', city: 'الرياض', address: 'حي النخيل', avatar: 'https://placehold.co/100x100.png' },
    { id: 'ref-2', name: 'فهد المرداسي', rating: 4, status: 'active', role: 'حكم ساحة', mobile: '0504445566', city: 'جدة', address: 'حي السلامة', avatar: 'https://placehold.co/100x100.png' },
    { id: 'ref-3', name: 'مرعي العواجي', rating: 4, status: 'warned', role: 'رجل خط', mobile: '0507778899', city: 'الدمام', address: 'حي الشاطئ', avatar: 'https://placehold.co/100x100.png' },
    { id: 'ref-4', name: 'صالح الهذلول', rating: 3, status: 'suspended', role: 'مراقب', mobile: '0501234567', city: 'الرياض', address: 'حي الملقا', avatar: 'https://placehold.co/100x100.png' },
    { id: 'ref-5', name: 'عبدالرحمن العمري', rating: 5, status: 'active', role: 'رجل خط', mobile: '0509876543', city: 'أبها', address: 'حي السودة', avatar: 'https://placehold.co/100x100.png' },
];

const competitionData = [
  {
    id: 'comp-1',
    name: 'بطولة الأبطال',
    organizerId: 'organizer-1',
    logo: 'https://placehold.co/200x200.png',
    status: 'active' as const,
    venue: {
      name: 'ملعب الملك فهد الدولي',
      country: 'المملكة العربية السعودية',
      region: 'منطقة الرياض',
      city: 'الرياض',
      street: 'طريق الملك خالد',
      buildingNumber: '1',
      fullAddress: 'ملعب الملك فهد الدولي، طريق الملك خالد، الرياض، منطقة الرياض، المملكة العربية السعودية',
    },
    staff: [
      { id: 'staff-1-1', name: 'سعود العتيبي', role: 'مدير إداري', mobile: '0501110001' },
      { id: 'staff-1-2', name: 'نورة الشمري', role: 'منسقة البطولة', mobile: '0501110002' },
      { id: 'staff-1-3', name: 'فهد الدوسري', role: 'مسؤول تشغيل الملعب', mobile: '0501110003' },
    ],
  },
  {
    id: 'comp-2',
    name: 'دوري النجوم',
    organizerId: 'organizer-2',
    logo: 'https://placehold.co/200x200.png',
    status: 'active' as const,
    venue: {
      name: 'مدينة الملك عبدالله الرياضية',
      country: 'المملكة العربية السعودية',
      region: 'منطقة مكة المكرمة',
      city: 'جدة',
      street: 'طريق الأمير سلطان',
      buildingNumber: '12',
      fullAddress: 'مدينة الملك عبدالله الرياضية، جدة، منطقة مكة المكرمة، المملكة العربية السعودية',
    },
    staff: [
      { id: 'staff-2-1', name: 'ماجد الغامدي', role: 'مدير إداري', mobile: '0502220001' },
    ],
  },
  {
    id: 'comp-3',
    name: 'كأس القاهرة',
    organizerId: 'organizer-1',
    logo: 'https://placehold.co/200x200.png',
    status: 'active' as const,
    venue: {
      name: 'استاد القاهرة الدولي',
      country: 'مصر',
      region: 'القاهرة',
      city: 'القاهرة',
      street: 'طريق النصر',
      buildingNumber: '1',
      fullAddress: 'استاد القاهرة الدولي، القاهرة، مصر',
    },
    staff: [
      { id: 'staff-3-1', name: 'أحمد حسن', role: 'منسق البطولة', mobile: '0100000001' },
    ],
  },
];

const generateTeamsForCompetition = (competitionId: string, compIndex: number): Team[] => {
  return Array.from({ length: 4 }, (_, i) => {
    const teamId = `${competitionId}-t${i}`;
    return {
      id: teamId,
      name: ['النسور', 'الصقور', 'الأبطال', 'العمالقة'][i],
      competitionId: competitionId,
      logo: `https://placehold.co/150x150.png?text=T${compIndex * 4 + i + 1}`,
      status: 'active',
      comments: [],
      players: Array.from({ length: 5 }, (_, pIndex) => ({
        id: `${teamId}-p${pIndex}`,
        visibleId: `P${1000 + compIndex * 40 + i * 5 + pIndex}`,
        name: `لاعب ${pIndex + 1}`,
        jerseyNumber: pIndex + 1,
        position: ['حارس مرمى', 'دفاع', 'وسط', 'هجوم'][pIndex % 4] as any,
        teamId: teamId,
        status: 'active',
        avatar: `https://placehold.co/100x100.png`,
        media: {
          photos: [
            {
              id: `${teamId}-p${pIndex}-photo`,
              url: 'https://placehold.co/400x300.png',
              likes: [],
              comments: [],
            },
          ],
          videos: [
            {
              id: `${teamId}-p${pIndex}-video`,
              url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
              likes: [],
              comments: [],
            },
          ],
        },
        bio: 'لاعب طموح يسعى للاحتراف',
        participationHistoryText: '',
        comments: [],
      })),
      officials: [
        {
          id: `${teamId}-off1`,
          name: `مدرب فريق ${i}`,
          role: 'مدرب',
          status: 'active',
        },
      ],
      bankAccountNumber: `SA${String(1000000000000000000000 + compIndex * 1000 + i).padStart(22, '0')}`,
    };
  });
};

/** زمن ثابت — نفس النتائج والتواريخ على الآيفون وأندرويد */
const SEED_NOW_MS = Date.UTC(2026, 7, 1, 15, 0, 0);

const generateMatchesForCompetition = (
  competitionId: string,
  teams: Team[]
): Match[] => {
  const matches: Match[] = [];
  if (teams.length < 2) return [];

  let order = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      // نصف المباريات ماضية (نتائج) والنصف قادمة — بنفس الترتيب دائماً
      const isPast = order < 3;
      const dayShift = isPast ? -(order + 1) : order - 2;
      matches.push({
        id: `match-${competitionId}-${teams[i].id}-${teams[j].id}`,
        competitionId: competitionId,
        team1Id: teams[i].id,
        team2Id: teams[j].id,
        team1Score: isPast ? (i + j) % 5 : 0,
        team2Score: isPast ? (i * 2 + j) % 4 : 0,
        date: new Date(SEED_NOW_MS + dayShift * 24 * 60 * 60 * 1000),
        media: { photos: [], videos: [] },
        comments: [],
        analysisContent: [],
      });
      order += 1;
    }
  }
  return matches;
};

export const initialCompetitions: Competition[] = competitionData.map((comp, index) => {
  const teams = generateTeamsForCompetition(comp.id, index);
  const matches = generateMatchesForCompetition(comp.id, teams);
  return {
    ...comp,
    id: comp.id,
    visibleId: `C${1001 + index}`,
    teams,
    matches,
    media: { photos: [], videos: [] },
    refereeIds: ['ref-1', 'ref-2', 'ref-5'],
  };
});

// مباريات ثابتة للاختبار — نفس القيم على كل الأجهزة
initialCompetitions[0].matches.push({
  id: 'match-1',
  competitionId: 'comp-1',
  team1Id: 'comp-1-t0',
  team2Id: 'comp-1-t1',
  team1Score: 2,
  team2Score: 1,
  date: new Date(SEED_NOW_MS - 2 * 24 * 60 * 60 * 1000),
  media: {
    photos: [
      {
        id: 'photo-1',
        url: 'https://placehold.co/400x300.png',
        likes: [],
        comments: [],
      },
    ],
    videos: [
      {
        id: 'video-1',
        url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        likes: [],
        comments: [],
      },
    ],
  },
  comments: [],
  analysisContent: [],
});
initialCompetitions[0].matches.push({
  id: 'match-2',
  competitionId: 'comp-1',
  team1Id: 'comp-1-t2',
  team2Id: 'comp-1-t3',
  team1Score: 0,
  team2Score: 0,
  date: new Date(SEED_NOW_MS + 3 * 24 * 60 * 60 * 1000),
  media: { photos: [], videos: [] },
  comments: [],
  analysisContent: [],
});


export const initialComments: Comment[] = [
    {
        id: 'comment-1',
        authorId: 'follower-1',
        authorName: 'متابع شغوف',
        authorAvatar: 'https://placehold.co/100x100.png',
        text: 'مباراة رائعة! أداء الفريقين كان مذهلاً. من برأيكم كان نجم المباراة؟',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        replies: [
            {
                id: 'reply-1-1',
                authorId: 'freelancer-1',
                authorName: 'لاعب حر موهوب',
                authorAvatar: 'https://placehold.co/100x100.png',
                text: 'أتفق معك، كانت مباراة حماسية. أعتقد أن حارس مرمى فريق النسور كان له الدور الأكبر في الفوز.',
                timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
                replies: [],
                likes: [],
            }
        ],
        likes: [],
    },
    {
        id: 'comment-2',
        authorId: 'organizer-1',
        authorName: 'منظم بطولة الأبطال',
        authorAvatar: 'https://placehold.co/100x100.png',
        text: 'نشكر الجميع على المشاركة في بطولة الأبطال، ونأمل أن تكونوا قد استمتعتم بالمنافسة. نراكم في الموسم القادم!',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        replies: [],
        likes: [],
    },
    {
        id: 'comment-3',
        authorId: 'freelancer-1',
        authorName: 'لاعب حر موهوب',
        authorAvatar: 'https://placehold.co/100x100.png',
        text: 'نقاش صوتي حول أفضل تكتيك دفاعي.',
        audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        replies: [],
        likes: ['organizer-1', 'follower-1'],
    },
    {
        id: 'comment-video-1',
        authorId: 'follower-1',
        authorName: 'متابع شغوف',
        authorAvatar: 'https://placehold.co/100x100.png',
        text: 'مقطع قصير من تدريبي اليوم — أقل من 30 ثانية.',
        videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        videoDurationSec: 15,
        timestamp: new Date(Date.now() - 90 * 60 * 1000),
        replies: [],
        likes: ['follower-2'],
    },
];
export const initialQuickComments: Comment[] = [
  {
    id: 'qc-1',
    authorId: 'follower-2',
    authorName: 'سارة المشجع',
    authorAvatar: 'https://placehold.co/100x100/22c55e/ffffff.png?text=س',
    text: 'مرحباً بالجميع في مجموعة متابعي Seellie 👋 من يتابع مباراة اليوم؟',
    timestamp: new Date(Date.now() - 90 * 60 * 1000),
    replies: [],
    likes: ['follower-1', 'follower-3'],
  },
  {
    id: 'qc-2',
    authorId: 'follower-3',
    authorName: 'أحمد المتابع',
    authorAvatar: 'https://placehold.co/100x100/3b82f6/ffffff.png?text=أ',
    text: 'أهلاً سارة! أنا متحمس لمباراة النسور والصقور الليلة.',
    timestamp: new Date(Date.now() - 75 * 60 * 1000),
    replies: [],
    likes: ['follower-2'],
  },
  {
    id: 'qc-3',
    authorId: 'follower-4',
    authorName: 'نورة الرياضية',
    authorAvatar: 'https://placehold.co/100x100/f59e0b/ffffff.png?text=ن',
    text: 'من برأيكم أفضل لاعب في البطولة حتى الآن؟',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    replies: [],
    likes: ['follower-1', 'follower-5'],
  },
  {
    id: 'qc-4',
    authorId: 'follower-5',
    authorName: 'خالد المشجع',
    authorAvatar: 'https://placehold.co/100x100/ef4444/ffffff.png?text=خ',
    text: 'أعتقد حارس النسور يستحق الإشادة. تصدياته كانت رائعة.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    replies: [],
    likes: ['follower-4', 'follower-3'],
  },
  {
    id: 'qc-5',
    authorId: 'follower-1',
    authorName: 'متابع شغوف',
    authorAvatar: 'https://placehold.co/100x100.png',
    text: 'اتفق مع خالد. ومن يتابع التحليلات الجديدة في قسم عام؟',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    replies: [],
    likes: ['follower-2'],
  },
  {
    id: 'qc-6',
    authorId: 'follower-2',
    authorName: 'سارة المشجع',
    authorAvatar: 'https://placehold.co/100x100/22c55e/ffffff.png?text=س',
    text: '@أحمد المتابع هل ستكتب تقييماً بعد المباراة؟',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    replies: [],
    likes: [],
  },
  {
    id: 'qc-7',
    authorId: 'follower-3',
    authorName: 'أحمد المتابع',
    authorAvatar: 'https://placehold.co/100x100/3b82f6/ffffff.png?text=أ',
    text: 'أكيد سارة! سأنشر رأيي هنا مباشرة بعد الصافرة النهائية.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    replies: [],
    likes: ['follower-2', 'follower-4'],
  },
];
export const initialMessages: Message[] = [];
export const initialSupporters: Supporter[] = [];
export const initialSupportLevels: SupportLevel[] = buildInitialSupportLevels();

export const initialOffers: Offer[] = [
    {
        id: 'offer-1',
        freelancerId: 'freelancer-1',
        organizerId: 'organizer-1',
        organizerName: 'منظم بطولة الأبطال',
        organizerAvatar: 'https://placehold.co/100x100.png',
        competitionId: 'comp-1',
        competitionName: 'بطولة الأبطال',
        teamId: initialCompetitions.find(c => c.id === 'comp-1')?.teams[0].id || 'team-1',
        teamName: initialCompetitions.find(c => c.id === 'comp-1')?.teams[0].name || 'النسور 1',
        message: 'لقد أعجبنا بملفك الشخصي ونود أن تنضم إلى فريق النسور في بطولة الأبطال. نتطلع إلى ردك.',
        status: 'pending',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    }
];
export const initialGiftTransactions: GiftTransaction[] = [];
export const initialCompetitionRequests: CompetitionRequest[] = [];


    