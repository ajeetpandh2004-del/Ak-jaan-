import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Edit3,
  Film,
  Flag,
  Grid3X3,
  Heart,
  Lock,
  MessageCircle,
  Settings,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { updateUserProfile } from '../services/firestoreService';
import type { LanguageCode, PostItem, ReelItem, UserProfile } from '../types';
import { t } from '../utils/i18n';
import { compressImageFile, formatDuration } from '../utils/media';
import { SafeImage } from './SafeImage';

interface ProfileViewProps {
  currentUser: UserProfile;
  viewedUser: UserProfile;
  posts: PostItem[];
  reels: ReelItem[];
  savedPostIds: string[];
  isFollowing: boolean;
  isAdmin: boolean;
  language: LanguageCode;
  onToggleFollow: (target: UserProfile) => void;
  onMessageUser: (uid: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenReels: () => void;
  onReportUser: (targetId: string, label: string) => void;
  onBlockUser: (uid: string) => void;
  onBackToOwnProfile: () => void;
  onToast: (msg: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  viewedUser,
  posts,
  reels,
  savedPostIds,
  isFollowing,
  isAdmin,
  language,
  onToggleFollow,
  onMessageUser,
  onOpenSettings,
  onOpenAdmin,
  onOpenReels,
  onReportUser,
  onBlockUser,
  onBackToOwnProfile,
  onToast,
}) => {
  const isOwnProfile = viewedUser.uid === currentUser.uid;
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [editOpen, setEditOpen] = useState(false);

  // Edit form state
  const [displayName, setDisplayName] = useState(viewedUser.displayName);
  const [username, setUsername] = useState(viewedUser.username);
  const [bio, setBio] = useState(viewedUser.bio);
  const [photoUrl, setPhotoUrl] = useState(viewedUser.photoUrl);
  const [isPrivate, setIsPrivate] = useState(viewedUser.isPrivate);
  const [allowReelDownloads, setAllowReelDownloads] = useState(viewedUser.allowReelDownloads);
  const [saving, setSaving] = useState(false);

  const userPosts = useMemo(
    () => posts.filter((p) => p.authorId === viewedUser.uid),
    [posts, viewedUser.uid]
  );

  const userReels = useMemo(
    () => reels.filter((r) => r.authorId === viewedUser.uid),
    [reels, viewedUser.uid]
  );

  const savedPosts = useMemo(
    () => posts.filter((p) => savedPostIds.includes(p.id)),
    [posts, savedPostIds]
  );

  const openEditModal = () => {
    setDisplayName(currentUser.displayName);
    setUsername(currentUser.username);
    setBio(currentUser.bio);
    setPhotoUrl(currentUser.photoUrl);
    setIsPrivate(currentUser.isPrivate);
    setAllowReelDownloads(currentUser.allowReelDownloads);
    setEditOpen(true);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 400, 0.78);
      setPhotoUrl(compressed);
    } catch {
      onToast('Could not process profile photo.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile(currentUser.uid, {
        displayName,
        username,
        photoUrl,
        bio,
        isPrivate,
        allowReelDownloads,
      });
      setEditOpen(false);
      onToast('Profile updated');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {!isOwnProfile && (
        <button
          type="button"
          onClick={onBackToOwnProfile}
          className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
        >
          ← Back to my profile
        </button>
      )}

      {/* Profile Header Card */}
      <section className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <SafeImage
            src={viewedUser.photoUrl}
            alt={viewedUser.displayName}
            className="w-24 h-24 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
          />

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-display font-bold text-xl text-zinc-950 dark:text-white truncate">
                    {viewedUser.displayName}
                  </h1>
                  {viewedUser.isVerified && (
                    <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" aria-label="Verified" />
                  )}
                  {viewedUser.isPrivate && (
                    <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-label="Private account" />
                  )}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">@{viewedUser.username}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {isOwnProfile ? (
                  <>
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="min-h-[40px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t(language, 'editProfile')}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      aria-label={t(language, 'settings')}
                      className="min-w-[40px] min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={onOpenAdmin}
                        className="min-h-[40px] px-3.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {t(language, 'admin')}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggleFollow(viewedUser)}
                      className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer ${
                        isFollowing
                          ? 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {isFollowing ? t(language, 'following') : t(language, 'follow')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onMessageUser(viewedUser.uid)}
                      className="min-h-[40px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-100 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {t(language, 'chat')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReportUser(viewedUser.uid, viewedUser.displayName)}
                      aria-label="Report user"
                      className="min-w-[40px] min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onBlockUser(viewedUser.uid)}
                      className="min-h-[40px] px-3 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      {t(language, 'blockUser')}
                    </button>
                  </>
                )}
              </div>
            </div>

            {viewedUser.bio && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-xl">
                {viewedUser.bio}
              </p>
            )}

            {/* Clean Tabular Stats Strip */}
            <div className="flex items-center gap-6 pt-1 text-sm">
              <div>
                <span className="font-display font-bold text-zinc-950 dark:text-white tabular-nums">
                  {userPosts.length + userReels.length}
                </span>{' '}
                <span className="text-zinc-500 dark:text-zinc-400">{t(language, 'posts')}</span>
              </div>
              <div>
                <span className="font-display font-bold text-zinc-950 dark:text-white tabular-nums">
                  {viewedUser.followersCount}
                </span>{' '}
                <span className="text-zinc-500 dark:text-zinc-400">{t(language, 'followers')}</span>
              </div>
              <div>
                <span className="font-display font-bold text-zinc-950 dark:text-white tabular-nums">
                  {viewedUser.followingCount}
                </span>{' '}
                <span className="text-zinc-500 dark:text-zinc-400">{t(language, 'following')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs: Posts / Reels / Saved */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'posts'
              ? 'bg-white dark:bg-[#1C1C21] text-zinc-950 dark:text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          {t(language, 'posts')} ({userPosts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'reels'
              ? 'bg-white dark:bg-[#1C1C21] text-zinc-950 dark:text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          {t(language, 'reels')} ({userReels.length})
        </button>
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-white dark:bg-[#1C1C21] text-zinc-950 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            {t(language, 'saved')} ({savedPosts.length})
          </button>
        )}
      </div>

      {/* Grid Content */}
      {activeTab === 'posts' && (
        userPosts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-10 text-center text-sm text-zinc-500">
            No posts published yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {userPosts.map((post) => (
              <div
                key={post.id}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800"
              >
                <SafeImage
                  src={post.mediaUrls[0] || ''}
                  alt={post.caption || 'Post'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div className="flex items-center gap-3 text-white text-xs font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-white" /> {post.likesCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> {post.commentsCount}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'reels' && (
        userReels.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-10 text-center text-sm text-zinc-500">
            No reels uploaded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {userReels.map((reel) => (
              <button
                key={reel.id}
                type="button"
                onClick={onOpenReels}
                className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-left cursor-pointer"
              >
                <SafeImage
                  src={reel.posterUrl}
                  alt={reel.caption || 'Reel'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 fill-white" /> {reel.likesCount}
                  </span>
                  <span>{formatDuration(reel.durationSec)}</span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {activeTab === 'saved' && isOwnProfile && (
        savedPosts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-10 text-center text-sm text-zinc-500">
            Bookmark posts from your Home feed to revisit them here.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {savedPosts.map((post) => (
              <div
                key={post.id}
                className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800"
              >
                <SafeImage
                  src={post.mediaUrls[0] || ''}
                  alt={post.caption || 'Saved post'}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )
      )}

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-zinc-950 dark:text-white">
                {t(language, 'editProfile')}
              </h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <SafeImage
                  src={photoUrl}
                  alt={displayName}
                  className="w-16 h-16 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                />
                <label className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Change Photo
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Username
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Bio
                </label>
                <textarea
                  rows={3}
                  maxLength={240}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
