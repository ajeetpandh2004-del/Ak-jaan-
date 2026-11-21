import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  Bell,
  Film,
  Home,
  MessageCircle,
  PlusSquare,
  Settings,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { AdminPanelView } from './components/AdminPanelView';
import { AuthGate } from './components/AuthGate';
import { ChatView } from './components/ChatView';
import { CreateModal, type CreateMode } from './components/CreateModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedView } from './components/FeedView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ReelsView } from './components/ReelsView';
import { ReportModal } from './components/ReportModal';
import { SafeImage } from './components/SafeImage';
import { SettingsModal } from './components/SettingsModal';
import { StoryViewerModal } from './components/StoryViewerModal';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  ensureUserProfiles,
  seedStarterCommunityIfEmpty,
  toggleFollowUser,
  updateUserPrivateSettings,
} from './services/firestoreService';
import type {
  ChatThread,
  FollowEdge,
  LanguageCode,
  NavTab,
  NotificationItem,
  PostItem,
  ReelItem,
  StoryItem,
  ThemeMode,
  UserPrivate,
  UserProfile,
} from './types';
import { t } from './utils/i18n';

function ConnectifyApp() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);

  const [language, setLanguage] = useState<LanguageCode>('en');
  const [theme, setTheme] = useState<ThemeMode>('light');

  // Navigation & Modal states
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [viewedProfileUid, setViewedProfileUid] = useState<string | null>(null);
  const [chatRecipientId, setChatRecipientId] = useState<string | null>(null);
  const [createModalMode, setCreateModalMode] = useState<CreateMode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{
    type: 'user' | 'post' | 'reel';
    id: string;
    label: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Live Firestore collections
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [follows, setFollows] = useState<FollowEdge[]>([]);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Sync Tailwind v4 `.dark` class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const isAdmin = Boolean(
    authUser &&
      authUser.emailVerified &&
      (authUser.email === BOOTSTRAPPED_ADMIN_EMAIL || isAdminDoc)
  );

  // 1. Auth Lifecycle
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) {
        setCurrentUser(null);
        setUserPrivate(null);
        setIsAdminDoc(false);
        setAuthReady(true);
        return;
      }

      try {
        const { profile, privateData } = await ensureUserProfiles(user);
        setCurrentUser(profile);
        setUserPrivate(privateData);
        setLanguage(privateData.language || 'en');
        setTheme(privateData.theme || 'light');

        const adminBootstrapped =
          user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL;
        await seedStarterCommunityIfEmpty(adminBootstrapped);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // 2. Real-Time Firestore Listeners (attached strictly after auth is ready & user signed in)
  useEffect(() => {
    if (!authReady || !authUser) return;
    const uid = authUser.uid;

    const unsubOwnProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) setCurrentUser(snap.data() as UserProfile);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const unsubOwnPrivate = onSnapshot(
      doc(db, 'user_private', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserPrivate;
          setUserPrivate(data);
          setLanguage(data.language || 'en');
          setTheme(data.theme || 'light');
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `user_private/${uid}`)
    );

    const unsubAdmin = onSnapshot(
      doc(db, 'admins', uid),
      (snap) => setIsAdminDoc(snap.exists()),
      () => setIsAdminDoc(false)
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('isBanned', '==', false)),
      (snap) => setUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('status', '==', 'active')),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as PostItem)
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setPosts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
    );

    const unsubReels = onSnapshot(
      query(collection(db, 'reels'), where('status', '==', 'active')),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ReelItem)
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setReels(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reels')
    );

    const unsubStories = onSnapshot(
      query(collection(db, 'stories'), where('status', '==', 'active')),
      (snap) => {
        const now = Date.now();
        const list = snap.docs
          .map((d) => d.data() as StoryItem)
          .filter((s) => s.expiresAtMs > now)
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setStories(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'stories')
    );

    const unsubFollows = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', uid)),
      (snap) => setFollows(snap.docs.map((d) => d.data() as FollowEdge)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );

    const unsubChats = onSnapshot(
      query(collection(db, 'chats'), where('participantIds', 'array-contains', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatThread)
          .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
        setChats(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'notifications'), where('recipientId', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as NotificationItem)
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubOwnProfile();
      unsubOwnPrivate();
      unsubAdmin();
      unsubUsers();
      unsubPosts();
      unsubReels();
      unsubStories();
      unsubFollows();
      unsubChats();
      unsubNotifications();
    };
  }, [authReady, authUser]);

  const usersMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    if (currentUser) map[currentUser.uid] = currentUser;
    return map;
  }, [users, currentUser]);

  const followingIds = useMemo(() => new Set(follows.map((f) => f.followingId)), [follows]);
  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // Loading state
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#09090B]">
        <div className="text-center space-y-2">
          <p className="font-display font-extrabold text-xl tracking-tight text-zinc-950 dark:text-white">
            Connectify
          </p>
          <p className="text-xs text-zinc-500">Connecting to Firebase...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated Welcome Gate
  if (!authUser || !currentUser || !userPrivate) {
    return (
      <AuthGate
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'hi' : 'en'))}
      />
    );
  }

  // Banned Account Notice
  if (currentUser.isBanned) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAFAFA] dark:bg-[#09090B]">
        <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-6 text-center space-y-4">
          <h2 className="font-display font-bold text-lg text-rose-600">Account Suspended</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your Connectify account has been restricted by an administrator due to community policy violations.
          </p>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="px-5 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-sm font-semibold cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const handleToggleFollow = async (target: UserProfile) => {
    const currently = followingIds.has(target.uid);
    await toggleFollowUser(currentUser, target, currently);
    showToast(currently ? `Unfollowed @${target.username}` : `Following @${target.username}`);
  };

  const handleToggleSavePost = async (postId: string) => {
    const exists = userPrivate.savedPostIds.includes(postId);
    const nextSaved = exists
      ? userPrivate.savedPostIds.filter((id) => id !== postId)
      : [postId, ...userPrivate.savedPostIds].slice(0, 200);
    await updateUserPrivateSettings(currentUser.uid, { savedPostIds: nextSaved });
    showToast(exists ? 'Removed from saved' : 'Saved post');
  };

  const handleBlockUser = async (targetUid: string) => {
    if (targetUid === currentUser.uid) return;
    if (userPrivate.blockedUserIds.includes(targetUid)) return;
    const nextBlocked = [...userPrivate.blockedUserIds, targetUid].slice(0, 100);
    await updateUserPrivateSettings(currentUser.uid, { blockedUserIds: nextBlocked });
    showToast('User blocked. Their posts and messages are hidden.');
    if (viewedProfileUid === targetUid) {
      setViewedProfileUid(null);
      setActiveTab('home');
    }
  };

  const handleUnblockUser = async (targetUid: string) => {
    const nextBlocked = userPrivate.blockedUserIds.filter((id) => id !== targetUid);
    await updateUserPrivateSettings(currentUser.uid, { blockedUserIds: nextBlocked });
    showToast('User unblocked');
  };

  const openProfile = (uid: string) => {
    setViewedProfileUid(uid === currentUser.uid ? null : uid);
    setActiveTab('profile');
  };

  const openChatWith = (uid: string) => {
    setChatRecipientId(uid);
    setActiveTab('chat');
  };

  const viewedProfile = (viewedProfileUid && usersMap[viewedProfileUid]) || currentUser;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] text-[#09090B] dark:text-[#FAFAFA]">
      {/* Mobile Compact Top App Bar (52px — strictly within 15% sticky budget with bottom bar) */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] px-4 bg-white/90 dark:bg-[#141417]/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setViewedProfileUid(null);
            setActiveTab('home');
          }}
          className="font-display font-extrabold text-lg tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          Connectify
        </button>

        <div className="flex items-center gap-1">
          <PWAInstallButton compact />
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              aria-label="Admin Panel"
              className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center cursor-pointer ${
                activeTab === 'admin'
                  ? 'text-rose-600'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Shield className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            aria-label={t(language, 'chat')}
            className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center cursor-pointer ${
              activeTab === 'chat'
                ? 'text-rose-600'
                : 'text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Responsive Shell (Desktop 1440px Left Rail + Fluid Workspace) */}
      <div className="max-w-[1380px] mx-auto flex">
        {/* Desktop Left Navigation Rail */}
        <aside className="hidden lg:flex flex-col w-[248px] shrink-0 sticky top-0 h-screen px-4 py-6 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#101013]">
          <button
            type="button"
            onClick={() => {
              setViewedProfileUid(null);
              setActiveTab('home');
            }}
            className="px-3 mb-7 text-left font-display font-extrabold text-2xl tracking-tight text-zinc-950 dark:text-white whitespace-nowrap cursor-pointer"
          >
            Connectify
          </button>

          <nav className="flex-1 space-y-1">
            {[
              { id: 'home' as NavTab, label: t(language, 'home'), icon: Home },
              { id: 'reels' as NavTab, label: t(language, 'reels'), icon: Film },
              { id: 'chat' as NavTab, label: t(language, 'chat'), icon: MessageCircle },
              {
                id: 'notifications' as NavTab,
                label: t(language, 'notifications'),
                icon: Bell,
                badge: unreadNotifCount,
              },
              { id: 'profile' as NavTab, label: t(language, 'profile'), icon: UserIcon },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'profile') setViewedProfileUid(null);
                    setActiveTab(item.id);
                  }}
                  className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="text-xs font-mono tabular-nums text-rose-500 font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`w-full min-h-[46px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <Shield className="w-5 h-5" />
                <span>{t(language, 'admin')}</span>
              </button>
            )}

            {/* Primary Create CTA & Install App */}
            <div className="pt-4 space-y-2">
              <button
                type="button"
                onClick={() => setCreateModalMode('post')}
                className="w-full min-h-[46px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <PlusSquare className="w-4 h-4" />
                <span>{t(language, 'create')}</span>
              </button>
              <PWAInstallButton />
            </div>
          </nav>

          {/* Bottom User & Settings Anchor */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => openProfile(currentUser.uid)}
              className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
            >
              <SafeImage
                src={currentUser.photoUrl}
                alt={currentUser.displayName}
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                  {currentUser.displayName}
                </p>
                <p className="text-[11px] text-zinc-500 truncate">@{currentUser.username}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t(language, 'settings')}
              className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 pb-24 lg:pb-10">
          {activeTab === 'home' && (
            <FeedView
              currentUser={currentUser}
              users={users}
              posts={posts}
              stories={stories}
              viewedStoryIds={viewedStoryIds}
              followingIds={followingIds}
              savedPostIds={userPrivate.savedPostIds}
              blockedUserIds={userPrivate.blockedUserIds}
              language={language}
              onAddStory={() => setCreateModalMode('story')}
              onOpenStory={(idx) => setActiveStoryIndex(idx)}
              onToggleFollow={handleToggleFollow}
              onToggleSavePost={handleToggleSavePost}
              onOpenProfile={openProfile}
              onReport={(type, id, label) => setReportTarget({ type, id, label })}
              onBlockUser={handleBlockUser}
              onToast={showToast}
            />
          )}

          {activeTab === 'reels' && (
            <ReelsView
              currentUser={currentUser}
              reels={reels.filter((r) => !userPrivate.blockedUserIds.includes(r.authorId))}
              usersMap={usersMap}
              followingIds={followingIds}
              language={language}
              onToggleFollow={handleToggleFollow}
              onOpenCreateReel={() => setCreateModalMode('reel')}
              onOpenProfile={openProfile}
              onReport={(type, id, label) => setReportTarget({ type, id, label })}
              onToast={showToast}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              currentUser={currentUser}
              users={users}
              chats={chats}
              blockedUserIds={userPrivate.blockedUserIds}
              initialRecipientId={chatRecipientId}
              language={language}
              onToast={showToast}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              language={language}
              onOpenProfile={openProfile}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              currentUser={currentUser}
              viewedUser={viewedProfile}
              posts={posts}
              reels={reels}
              savedPostIds={userPrivate.savedPostIds}
              isFollowing={followingIds.has(viewedProfile.uid)}
              isAdmin={isAdmin}
              language={language}
              onToggleFollow={handleToggleFollow}
              onMessageUser={openChatWith}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenAdmin={() => setActiveTab('admin')}
              onOpenReels={() => setActiveTab('reels')}
              onReportUser={(id, label) => setReportTarget({ type: 'user', id, label })}
              onBlockUser={handleBlockUser}
              onBackToOwnProfile={() => setViewedProfileUid(null)}
              onToast={showToast}
            />
          )}

          {activeTab === 'admin' && isAdmin && (
            <AdminPanelView currentUser={currentUser} onToast={showToast} />
          )}
        </main>
      </div>

      {/* Mobile Fixed 5-Button Bottom Tab Bar: Home | Reels | Create (+) | Notification | Profile */}
      <nav
        aria-label="Primary navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#141417]/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-16">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'home' ? 'text-rose-600' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Home className="w-[22px] h-[22px]" />
            <span className="text-[10px] font-medium tracking-tight">{t(language, 'home')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reels')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'reels' ? 'text-rose-600' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <Film className="w-[22px] h-[22px]" />
            <span className="text-[10px] font-medium tracking-tight">{t(language, 'reels')}</span>
          </button>

          <button
            type="button"
            onClick={() => setCreateModalMode('post')}
            aria-label={t(language, 'create')}
            className="min-h-[44px] flex flex-col items-center justify-center cursor-pointer"
          >
            <span className="w-11 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
              <PlusSquare className="w-5 h-5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'notifications' ? 'text-rose-600' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <div className="relative">
              <Bell className="w-[22px] h-[22px]" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono flex items-center justify-center">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium tracking-tight truncate max-w-[64px]">
              {t(language, 'notifications')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewedProfileUid(null);
              setActiveTab('profile');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'profile' ? 'text-rose-600' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            <UserIcon className="w-[22px] h-[22px]" />
            <span className="text-[10px] font-medium tracking-tight">{t(language, 'profile')}</span>
          </button>
        </div>
      </nav>

      {/* Create Post / Reel / Story Modal */}
      {createModalMode && (
        <CreateModal
          currentUser={currentUser}
          initialMode={createModalMode}
          language={language}
          onClose={() => setCreateModalMode(null)}
          onPublished={(mode, msg) => {
            showToast(msg);
            if (mode === 'reel') setActiveTab('reels');
            if (mode === 'post') setActiveTab('home');
          }}
        />
      )}

      {/* 24-Hour Story Viewer Overlay */}
      {activeStoryIndex !== null && stories.length > 0 && (
        <StoryViewerModal
          stories={stories.filter((s) => !userPrivate.blockedUserIds.includes(s.authorId))}
          initialIndex={activeStoryIndex}
          currentUser={currentUser}
          usersMap={usersMap}
          language={language}
          onClose={() => setActiveStoryIndex(null)}
          onViewed={(id) => setViewedStoryIds((prev) => new Set(prev).add(id))}
          onToast={showToast}
        />
      )}

      {/* Settings Drawer */}
      {settingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          userPrivate={userPrivate}
          usersMap={usersMap}
          onClose={() => setSettingsOpen(false)}
          onLanguageChange={(l) => setLanguage(l)}
          onThemeChange={(mode) => setTheme(mode)}
          onUnblockUser={handleUnblockUser}
          onToast={showToast}
        />
      )}

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          reporter={currentUser}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetLabel={reportTarget.label}
          onClose={() => setReportTarget(null)}
          onSubmitted={showToast}
        />
      )}

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Quiet Toast Feedback */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-lg whitespace-nowrap"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ConnectifyApp />
    </ErrorBoundary>
  );
}
