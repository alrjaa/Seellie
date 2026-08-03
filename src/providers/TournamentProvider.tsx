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
import { generateAnalystAccessCode } from '@/utils/analyst';
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
  Supporter,
  SupportLevel,
  Team,
  User,
} from '@/data/initial-data';

import { DEFAULT_LOGO, APP_DISPLAY_NAME } from '@/theme/brand';

const USER_STORAGE_KEY = 'tajjd.secure.currentUser';
const APP_LOGO_KEY = 'seellie.appLogo';
const APP_NAME_KEY = 'seellie.appName';

export interface TournamentContextType {
  loading: boolean;
  appName: string;
  appLogo: string;
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
  supporters: Supporter[];
  supportLevels: SupportLevel[];
  giftTransactions: GiftTransaction[];
  currentUser: User | null;
  login: (
    email: string,
    password: string,
    options?: { portal?: 'app' | 'admin' }
  ) => boolean;
  logout: () => void;
  signUp: (
    userData: Pick<User, 'name' | 'email'>,
    password: string
  ) => boolean;
  /** تفعيل مسار ثانٍ واحد: منظم أو لاعب حر (مع المتابع) */
  enableSecondaryRole: (
    role: SecondaryRole,
    termsAccepted: boolean
  ) => boolean;
  /** التبديل بين المتابع والمسار الثانوي */
  switchActiveRole: (role: UserRole) => boolean;
  setAppName: (name: string) => void;
  setAppLogo: (logo: string) => void;
  updateUser: (user: User, successMessage?: string) => void;
  /** تثبيت/إلغاء تثبيت بطولة في الرئيسية الشخصية */
  togglePinnedCompetition: (competitionId: string) => void;
  deleteUser: (userId: string, successMessage?: string) => void;
  addReferee: (data: Omit<Referee, 'id'>, successMessage?: string) => void;
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
    certificateType: SupportLevel['name'];
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
  }) => boolean;
  approveCompetitionRequest: (requestId: string) => boolean;
  rejectCompetitionRequest: (requestId: string, reason?: string) => boolean;
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
  }) => boolean;
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
  ) => boolean;
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
    },
    successMessage?: string
  ) => void;
  addStaffToCompetition: (
    competitionId: string,
    staffData: { name: string; role: string; mobile?: string },
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
  }) => boolean;
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
  changePassword: (currentPassword: string, nextPassword: string) => boolean;
  addUserMedia: (
    type: 'photos' | 'videos',
    url: string,
    successMessage?: string
  ) => boolean;
  removeUserMedia: (
    type: 'photos' | 'videos',
    mediaId: string,
    successMessage?: string
  ) => boolean;
  setUserAvatar: (url: string, successMessage?: string) => boolean;
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
  const [personalitySectionBg] = useState(
    'https://storage.googleapis.com/stey-public/stey-studio-website/example-images/4bb4e045-b470-4f23-b78c-fd771b6c9c1e.jpg'
  );
  const [highlightsSectionBg] = useState(
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  );
  const [users, setUsers] = useState<User[]>(() =>
    withLocalizedSeed(initialUsers).map((u) => normalizeUserRoles(u))
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
  const [supporters] = useState<Supporter[]>(() =>
    withLocalizedSeed(initialSupporters)
  );
  const [supportLevels, setSupportLevels] = useState<SupportLevel[]>(() =>
    withLocalizedSeed(initialSupportLevels)
  );
  const [giftTransactions, setGiftTransactions] = useState<GiftTransaction[]>(
    () => withLocalizedSeed(initialGiftTransactions)
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const { toast } = useToast();

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
        ] = await Promise.all([
          getJson<User>(USER_STORAGE_KEY),
          getJson<string>(APP_LOGO_KEY),
          getJson<string>(APP_NAME_KEY),
          loadCompetitionRequests(),
          loadStoredCompetitions(),
        ]);
        if (!active) return;
        if (stored && stored.email && stored.role) {
          try {
            const match = initialUsers.find(
              (u) => normalizeEmail(u.email) === normalizeEmail(stored.email)
            );
            const base = match
              ? {
                  ...match,
                  ...stored,
                  // هوية الحساب من البذرة دائماً
                  id: match.id,
                  email: match.email,
                  passwordHash: match.passwordHash,
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
                }
              : stored;
            const mergedRaw = normalizeUserRoles(
              ensureAccountIdentity(base, initialUsers)
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
    const unsubRequests = subscribeCompetitionRequests((items) => {
      setCompetitionRequests(items);
    });
    const unsubCompetitions = subscribeCompetitions((items) => {
      setCompetitions((prev) => mergeCompetitionsById(prev, items));
    });
    return () => {
      unsubRequests?.();
      unsubCompetitions?.();
    };
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
  }, []);

  const setAppLogo = useCallback((logo: string) => {
    if (!logo.trim()) {
      setAppLogoState(DEFAULT_LOGO);
      void removeJson(APP_LOGO_KEY);
      return;
    }
    setAppLogoState(logo);
    void setJson(APP_LOGO_KEY, logo);
  }, []);

  const login = useCallback(
    (email: string, password: string, options?: { portal?: 'app' | 'admin' }) => {
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

      const user = users.find((u) => normalizeEmail(u.email) === normalized);
      if (user && user.passwordHash === password) {
        if (user.status === 'suspended') {
          toast({
            variant: 'destructive',
            title: t('toasts.t001_1a486b'),
            description: t('toasts.t074_7ca6a2'),
          });
          return false;
        }
        const normalizedUser = normalizeUserRoles(user);
        const isAdmin = normalizedUser.role === 'superadmin';

        if (portal === 'admin' && !isAdmin) {
          toast({
            variant: 'destructive',
            title: t('auth.adminPortalOnlyTitle'),
            description: t('auth.adminPortalOnlyDesc'),
          });
          return false;
        }

        if (portal === 'app' && isAdmin) {
          toast({
            variant: 'destructive',
            title: t('auth.useAdminLoginTitle'),
            description: t('auth.useAdminLoginDesc'),
          });
          return false;
        }

        setCurrentUser(normalizedUser);
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
        description: t('toasts.t075_ac9b07'),
      });
      return false;
    },
    [users, toast, router, routeForRole, t]
  );

  const signUp = useCallback(
    (userData: Pick<User, 'name' | 'email'>, password: string) => {
      const email = normalizeEmail(userData.email);
      if (!userData.name.trim() || !isValidEmail(email) || password.length < 6) {
        toast({
          variant: 'destructive',
          title: t('toasts.t004_8fdbe1'),
          description: t('toasts.t076_91bef0'),
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
        passwordHash: password,
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
    [users, toast, router, routeForRole]
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
    [currentUser, toast, router, routeForRole]
  );

  const enableSecondaryRole = useCallback(
    (role: SecondaryRole, termsAccepted: boolean) => {
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

  const logout = useCallback(() => {
    const wasAdmin = currentUser?.role === 'superadmin';
    setCurrentUser(null);
    void removeJson(USER_STORAGE_KEY);
    router.replace(wasAdmin ? '/admin' : '/(auth)/login');
    toast({ title: t('toasts.t012_fbdcd1') });
  }, [currentUser, router, toast, t]);

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
      if (successMessage) {
        toast({ variant: 'success', title: t('toasts.t013_5a42a9'), description: successMessage });
      }
    },
    [toast]
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
    (userId: string, successMessage?: string) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (successMessage) {
        toast({ title: t('toasts.t014_3569a8'), description: successMessage });
      }
    },
    [toast]
  );

  const addReferee = useCallback(
    (data: Omit<Referee, 'id'>, successMessage?: string) => {
      const referee: Referee = { ...data, id: createId() };
      setReferees((prev) => [...prev, referee]);
      if (successMessage) {
        toast({ variant: 'success', title: t('toasts.t015_937bdd'), description: successMessage });
      }
    },
    [toast]
  );

  const updateReferee = useCallback(
    (referee: Referee, successMessage?: string) => {
      setReferees((prev) =>
        prev.map((r) => (r.id === referee.id ? referee : r))
      );
      if (successMessage) {
        toast({ variant: 'success', title: t('toasts.t016_71326f'), description: successMessage });
      }
    },
    [toast]
  );

  const deleteReferee = useCallback(
    (refereeId: string, successMessage?: string) => {
      setReferees((prev) => prev.filter((r) => r.id !== refereeId));
      if (successMessage) {
        toast({ title: t('toasts.t014_3569a8'), description: successMessage });
      }
    },
    [toast]
  );

  const markMessageAsRead = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
    );
  }, []);

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

      if (target?.type === 'match') {
        setCompetitions((prev) =>
          prev.map((c) => {
            if (c.id !== target.competitionId) return c;
            return {
              ...c,
              matches: c.matches.map((m) =>
                m.id === target.matchId
                  ? { ...m, comments: [comment, ...m.comments] }
                  : m
              ),
            };
          })
        );
        toast({ title: t('toasts.t019_7b77aa') });
        return;
      }

      setComments((prev) => [comment, ...prev]);
      toast({
        title: videoUrl ? t('toasts.postedForumVideo') : t('toasts.postedForum'),
      });
    },
    [currentUser, toast]
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
      setCompetitions((prev) =>
        prev.map((comp) => ({
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
        }))
      );
    },
    [currentUser]
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
      } else {
        if (!payload.authorId) {
          toast({
            variant: 'destructive',
            title: t('toasts.t021_e06649'),
            description: t('toasts.t085_42b5e8'),
          });
          return;
        }
        setUsers((prev) =>
          prev.map((user) => {
            if (user.id !== payload.authorId) return user;
            return {
              ...user,
              analysisContent: user.analysisContent.map((a) =>
                a.id === payload.id
                  ? { ...a, status: payload.status, statusReason: reason }
                  : a
              ),
            };
          })
        );
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
    [toast]
  );

  const updateSupportLevels = useCallback((levels: SupportLevel[]) => {
    setSupportLevels(levels.filter((l) => (l.name as string) !== 'محلل'));
  }, []);

  const purchaseSupportGift = useCallback(
    (payload: {
      certificateType: SupportLevel['name'];
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
        status: 'paid',
      };

      setGiftTransactions((prev) => [gift, ...prev]);
      toast({
        title: t('toasts.t025_e9f0dd'),
        description: t('toasts.certificateLine', { number: certificateNumber, name: payload.recipientName }),
      });
      return gift;
    },
    [currentUser, supportLevels, toast]
  );

  const updateCompetition = useCallback(
    (competition: Competition, successMessage?: string) => {
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === competition.id ? competition : c
        );
        void saveCompetitions(next);
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
        if (found) void saveCompetitions(next);
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
    (competitionId: string, successMessage?: string) => {
      let found = false;
      setCompetitions((prev) => {
        const next = prev.filter((c) => {
          if (c.id === competitionId) {
            found = true;
            return false;
          }
          return true;
        });
        if (found) void saveCompetitions(next);
        return next;
      });
      if (!found) return false;
      toast({
        variant: 'success',
        title: t('toasts.t014_3569a8'),
        description: successMessage || t('toasts.competitionDeleted'),
      });
      return true;
    },
    [toast]
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
        void saveCompetitions(next);
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
    [toast]
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
        void saveCompetitions(next);
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

      const fixtures = buildRoundRobinFixtures(
        competitionId,
        competition.teams,
        new Date()
      );
      setCompetitions((prev) => {
        const next = prev.map((c) =>
          c.id === competitionId ? { ...c, matches: fixtures } : c
        );
        void saveCompetitions(next);
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
        void saveCompetitions(next);
        return next;
      });
    },
    []
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
        void saveCompetitions(next);
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
        void saveCompetitions(next);
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
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, status } : o))
      );
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
      setOffers((prev) => [offer, ...prev]);
      toast({ variant: 'success', title: t('toasts.t035_af963d') });
      return true;
    },
    [currentUser, competitions, toast]
  );

  const sendMessage = useCallback(
    (payload: { recipientId: string; subject: string; body: string }) => {
      if (!currentUser) return false;
      if (!payload.subject.trim() || !payload.body.trim()) {
        toast({
          variant: 'destructive',
          title: t('toasts.t036_3a814a'),
          description: t('toasts.t093_9edd72'),
        });
        return false;
      }
      const msg: Message = {
        id: createId(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar || '',
        recipientId: payload.recipientId,
        subject: payload.subject.trim(),
        body: payload.body.trim(),
        timestamp: new Date(),
        read: false,
      };
      setMessages((prev) => [msg, ...prev]);
      toast({ variant: 'success', title: t('toasts.t037_fc3f2d') });
      return true;
    },
    [currentUser, toast]
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
        void saveCompetitions(next);
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
        if (found) void saveCompetitions(next);
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
        if (found) void saveCompetitions(next);
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
                    media: { photos: [], videos: [] },
                    comments: [],
                  },
                ],
              };
            }),
          };
        });
        if (added) void saveCompetitions(next);
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
      staffData: { name: string; role: string; mobile?: string },
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
              },
            ],
          };
        });
        if (found) void saveCompetitions(next);
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
        if (found) void saveCompetitions(next);
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
    (data: {
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
          description:
            t('toasts.t094_fa723f'),
        });
        return false;
      }
      const title = data.title.trim();
      const content = data.content.trim();
      const videoUrl = data.videoUrl?.trim() || undefined;
      if (!title || (!content && !videoUrl)) {
        toast({
          variant: 'destructive',
          title: t('toasts.t036_3a814a'),
          description: t('toasts.t095_c00483'),
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
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.id
            ? { ...u, analysisContent: [analysis, ...u.analysisContent] }
            : u
        )
      );
      setCurrentUser((prev) =>
        prev
          ? { ...prev, analysisContent: [analysis, ...prev.analysisContent] }
          : prev
      );
      toast({ variant: 'success', title: t('toasts.t040_286629') });
      return true;
    },
    [currentUser, toast]
  );

  const persistUser = useCallback(
    (updated: User) => {
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setCurrentUser((prev) => (prev?.id === updated.id ? updated : prev));
      if (updated.id === currentUser?.id) {
        void setJson(USER_STORAGE_KEY, updated);
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
    (payload: {
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
        id: createId(),
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
      setCompetitionRequests((prev) => {
        const next = [request, ...prev];
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
    [currentUser, competitionRequests, toast]
  );

  const approveCompetitionRequest = useCallback(
    (requestId: string) => {
      const request = competitionRequests.find((r) => r.id === requestId);
      if (!request || request.status !== 'pending') {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }

      const competitionId = createId();
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

      setCompetitions((prev) => {
        const next = [competition, ...prev];
        void saveCompetitions(next);
        return next;
      });
      setCompetitionRequests((prev) => {
        const next = prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'approved' as const,
                reviewedAt: new Date(),
                competitionId,
              }
            : r
        );
        void saveCompetitionRequests(next);
        return next;
      });
      toast({
        variant: 'success',
        title: t('toasts.t050_d1ff71'),
        description: t('toasts.competitionCreatedForOrganizer', { name: request.name, count: MIN_COMPETITION_TEAMS }),
      });
      return true;
    },
    [competitionRequests, competitions, toast]
  );

  const rejectCompetitionRequest = useCallback(
    (requestId: string, reason?: string) => {
      const request = competitionRequests.find((r) => r.id === requestId);
      if (!request || request.status !== 'pending') {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }
      setCompetitionRequests((prev) => {
        const next = prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'rejected' as const,
                reviewedAt: new Date(),
                rejectionReason: reason?.trim() || t('toasts.requirementsNotMet'),
              }
            : r
        );
        void saveCompetitionRequests(next);
        return next;
      });
      toast({
        variant: 'success',
        title: t('toasts.t051_c3e138'),
        description: reason?.trim() || t('toasts.organizerRejected'),
      });
      return true;
    },
    [competitionRequests, toast]
  );

  const approveAnalystApplication = useCallback(
    (userId: string) => {
      const target = users.find((u) => u.id === userId);
      if (!target || target.analyst?.status !== 'pending') {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }
      const accessCode = generateAnalystAccessCode(10);
      const updated: User = {
        ...target,
        analyst: {
          ...target.analyst,
          status: 'approved',
          reviewedAt: new Date(),
          accessCode,
          accessCodeSentAt: new Date(),
        },
      };
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setCurrentUser((prev) => (prev?.id === userId ? updated : prev));
      if (currentUser?.id === userId) {
        void setJson(USER_STORAGE_KEY, updated);
      }
      toast({
        variant: 'success',
        title: t('toasts.t052_01e592'),
        description: t('toasts.codeEmailed', { email: target.email, code: accessCode }),
      });
      return true;
    },
    [users, currentUser?.id, toast]
  );

  const rejectAnalystApplication = useCallback(
    (userId: string, reason?: string) => {
      const target = users.find((u) => u.id === userId);
      if (!target || target.analyst?.status !== 'pending') {
        toast({
          variant: 'destructive',
          title: t('toasts.t049_edb446'),
        });
        return false;
      }
      const updated: User = {
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
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setCurrentUser((prev) => (prev?.id === userId ? updated : prev));
      toast({
        variant: 'success',
        title: t('toasts.t051_c3e138'),
        description: t('toasts.emailNotified', { email: target.email }),
      });
      return true;
    },
    [users, toast]
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
      return updated;
    },
    [users, currentUser?.id]
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
        return updated;
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
        return updated;
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
          return updated;
        });
        return;
      }

      setCompetitions((prev) =>
        prev.map((comp) => {
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
        })
      );
    },
    [currentUser]
  );

  const changePassword = useCallback(
    (currentPassword: string, nextPassword: string) => {
      if (!currentUser) return false;
      if (currentUser.passwordHash !== currentPassword) {
        toast({
          variant: 'destructive',
          title: t('toasts.t068_1ed93e'),
        });
        return false;
      }
      if (nextPassword.length < 6) {
        toast({
          variant: 'destructive',
          title: t('toasts.t069_c382f9'),
          description: t('toasts.t109_275ee0'),
        });
        return false;
      }
      const updated = { ...currentUser, passwordHash: nextPassword };
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      setCurrentUser(updated);
      void setJson(USER_STORAGE_KEY, updated);
      toast({ variant: 'success', title: t('toasts.t070_104895') });
      return true;
    },
    [currentUser, toast]
  );

  const persistCurrentUser = useCallback((updated: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setCurrentUser(updated);
    void setJson(USER_STORAGE_KEY, updated);
  }, []);

  const addUserMedia = useCallback(
    (
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
      const item = {
        id: createId(),
        url: trimmed,
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
      toast({
        variant: 'success',
        title: type === 'photos' ? t('common.photoAdded') : t('common.videoAdded'),
        description: successMessage,
      });
      return true;
    },
    [currentUser, persistCurrentUser, toast]
  );

  const removeUserMedia = useCallback(
    (
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
      if (successMessage) {
        toast({ title: t('toasts.t014_3569a8'), description: successMessage });
      }
      return true;
    },
    [currentUser, persistCurrentUser, toast]
  );

  const setUserAvatar = useCallback(
    (url: string, successMessage?: string) => {
      if (!currentUser) return false;
      const trimmed = url.trim();
      if (!trimmed) return false;
      const updated: User = { ...currentUser, avatar: trimmed };
      persistCurrentUser(updated);
      toast({
        variant: 'success',
        title: t('toasts.t072_2a81f2'),
        description: successMessage,
      });
      return true;
    },
    [currentUser, persistCurrentUser, toast]
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
      updateUser,
      togglePinnedCompetition,
      deleteUser,
      addReferee,
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
      addTeam,
      renameCompetition,
      deleteCompetition,
      renameTeam,
      deleteTeam,
      addPlayerToTeam,
      addStaffToCompetition,
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
      setUserAvatar,
      routeForRole,
    }),
    [
      loading,
      appName,
      appLogo,
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
      updateUser,
      togglePinnedCompetition,
      deleteUser,
      addReferee,
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
      addTeam,
      renameCompetition,
      deleteCompetition,
      renameTeam,
      deleteTeam,
      addPlayerToTeam,
      addStaffToCompetition,
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
      setUserAvatar,
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
