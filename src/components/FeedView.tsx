import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  addPostComment,
  deletePost,
  sharePost,
  togglePostLike,
} from '../services/firestoreService';
import type {
  CommentItem,
  LanguageCode,
  PostItem,
  StoryItem,
  UserProfile,
} from '../types';
import { t } from '../utils/i18n';
import { formatRelativeTime } from '../utils/media';
import { SafeImage } from './SafeImage';
import { StoriesBar } from './StoriesBar';

interface FeedViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  posts: PostItem[];
  stories: StoryItem[];
  viewedStoryIds: Set<string>;
  followingIds: Set<string>;
  savedPostIds: string[];
  blockedUserIds: string[];
  language: LanguageCode;
  onAddStory: () => void;
  onOpenStory: (idx: number) => void;
  onToggleFollow: (target: UserProfile) => void;
  onToggleSavePost: (postId: string) => void;
  onOpenProfile: (uid: string) => void;
  onReport: (targetType: 'post' | 'user', targetId: string, label: string) => void;
  onBlockUser: (uid: string) => void;
  onToast: (msg: string) => void;
}

interface PostCardProps {
  post: PostItem;
  currentUser: UserProfile;
  authorProfile?: UserProfile;
  isFollowing: boolean;
  isSaved: boolean;
  language: LanguageCode;
  onToggleFollow: (target: UserProfile) => void;
  onToggleSave: (postId: string) => void;
  onOpenProfile: (uid: string) => void;
  onReport: (targetType: 'post' | 'user', targetId: string, label: string) => void;
  onBlockUser: (uid: string) => void;
  onHashtagClick: (tag: string) => void;
  onToast: (msg: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  authorProfile,
  isFollowing,
  isSaved,
  language,
  onToggleFollow,
  onToggleSave,
  onOpenProfile,
  onReport,
  onBlockUser,
  onHashtagClick,
  onToast,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwnPost = post.authorId === currentUser.uid;
  const mediaCount = post.mediaUrls.length;
  const activeMedia = post.mediaUrls[slideIndex] || post.mediaUrls[0] || '';

  useEffect(() => {
    let active = true;
    const likeRef = doc(db, 'posts', post.id, 'likes', currentUser.uid);
    getDoc(likeRef)
      .then((snap) => {
        if (active) setLiked(snap.exists());
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [post.id, currentUser.uid]);

  useEffect(() => {
    if (!showComments) return;
    const path = `posts/${post.id}/comments`;
    const q = query(collection(db, 'posts', post.id, 'comments'), where('status', '==', 'active'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as CommentItem)
          .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        setComments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [post.id, showComments]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const prev = liked;
    setLiked(!prev);
    try {
      await togglePostLike(post, currentUser, prev);
    } catch {
      setLiked(prev);
      onToast('Could not update like right now.');
    } finally {
      setLiking(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentDraft.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await addPostComment(post, currentUser, commentDraft);
      setCommentDraft('');
    } finally {
      setSendingComment(false);
    }
  };

  const handleShare = async () => {
    await sharePost(post);
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${window.location.origin}/?post=${post.id}`).catch(() => undefined);
    }
    onToast('Post link copied to clipboard');
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    await deletePost(post);
    onToast('Post deleted');
  };

  return (
    <article className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onOpenProfile(post.authorId)}
            className="shrink-0 cursor-pointer"
          >
            <SafeImage
              src={post.authorPhoto}
              alt={post.authorName}
              className="w-10 h-10 rounded-full object-cover"
            />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenProfile(post.authorId)}
                className="font-display font-semibold text-sm text-zinc-950 dark:text-white hover:underline truncate cursor-pointer"
              >
                {post.authorName}
              </button>
              {authorProfile?.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-label="Verified" />
              )}
              {!isOwnPost && authorProfile && (
                <>
                  <span className="text-zinc-400 text-xs" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => onToggleFollow(authorProfile)}
                    className={`text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                      isFollowing
                        ? 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                        : 'text-rose-600 hover:text-rose-700'
                    }`}
                  >
                    {isFollowing ? t(language, 'following') : t(language, 'follow')}
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
              <span>@{post.authorUsername}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{post.location}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Overflow Menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Post options"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-[#1A1A1F] border border-zinc-200 dark:border-zinc-800 shadow-lg py-1.5 z-20">
              {isOwnPost ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t(language, 'deletePost')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onReport('post', post.id, `${post.authorName}'s post`);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {t(language, 'report')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onBlockUser(post.authorId);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                  >
                    {t(language, 'blockUser')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Viewport (Photo, Multi-Photo Carousel, or Video) */}
      <div className="relative bg-zinc-100 dark:bg-zinc-900 aspect-[4/3] w-full overflow-hidden">
        {post.mediaType === 'video' && activeMedia.startsWith('blob:') ? (
          <video src={activeMedia} controls playsInline className="w-full h-full object-cover" />
        ) : (
          <SafeImage
            src={activeMedia}
            alt={post.caption || `Post by ${post.authorName}`}
            className="w-full h-full object-cover"
          />
        )}

        {mediaCount > 1 && (
          <>
            {slideIndex > 0 && (
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {slideIndex < mediaCount - 1 && (
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => setSlideIndex((i) => Math.min(mediaCount - 1, i + 1))}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5">
              {post.mediaUrls.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Slide ${idx + 1}`}
                  onClick={() => setSlideIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === slideIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/55'
                  }`}
                />
              ))}
            </div>
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-mono tabular-nums">
              {slideIndex + 1}/{mediaCount}
            </div>
          </>
        )}
      </div>

      {/* Action Bar */}
      <div className="px-4 pt-3 pb-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleLike}
              className={`min-h-[44px] px-2.5 rounded-xl inline-flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer ${
                liked
                  ? 'text-rose-600'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Heart className={`w-5 h-5 ${liked ? 'fill-rose-600 text-rose-600' : ''}`} />
              <span className="tabular-nums">{post.likesCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComments((s) => !s)}
              className="min-h-[44px] px-2.5 rounded-xl inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="tabular-nums">{post.commentsCount}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="min-h-[44px] px-2.5 rounded-xl inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Share2 className="w-5 h-5" />
              <span className="tabular-nums">{post.sharesCount}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onToggleSave(post.id)}
            aria-label={isSaved ? 'Remove bookmark' : 'Save post'}
            className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isSaved
                ? 'text-rose-600'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-rose-600 text-rose-600' : ''}`} />
          </button>
        </div>

        {/* Caption & Hashtags (Clean Unboxed Typography) */}
        {post.caption && (
          <p className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
            <span className="font-semibold text-zinc-950 dark:text-white mr-1.5">
              {post.authorUsername}
            </span>
            {post.caption}
          </p>
        )}

        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            {post.hashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onHashtagClick(tag)}
                className="hover:underline cursor-pointer"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Expandable Comments */}
        {showComments && (
          <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No comments yet. Start the conversation.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <SafeImage
                      src={c.authorPhoto}
                      alt={c.authorName}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold text-zinc-950 dark:text-white mr-1.5">
                        {c.authorName}
                      </span>
                      <span className="text-zinc-700 dark:text-zinc-300">{c.text}</span>
                      <span className="ml-2 text-[11px] text-zinc-400">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={500}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder={t(language, 'writeComment')}
                className="flex-1 min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600/35"
              />
              <button
                type="submit"
                disabled={!commentDraft.trim() || sendingComment}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {t(language, 'send')}
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
};

export const FeedView: React.FC<FeedViewProps> = ({
  currentUser,
  users,
  posts,
  stories,
  viewedStoryIds,
  followingIds,
  savedPostIds,
  blockedUserIds,
  language,
  onAddStory,
  onOpenStory,
  onToggleFollow,
  onToggleSavePost,
  onOpenProfile,
  onReport,
  onBlockUser,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('all');

  const usersMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  const blockedSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);

  const trendingTags = useMemo(() => {
    const freq: Record<string, number> = {};
    posts.forEach((p) => {
      if (blockedSet.has(p.authorId)) return;
      p.hashtags.forEach((tag) => {
        freq[tag] = (freq[tag] || 0) + 1;
      });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }, [posts, blockedSet]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((p) => {
      if (blockedSet.has(p.authorId)) return false;
      if (activeTag !== 'all' && !p.hashtags.some((h) => h.toLowerCase() === activeTag.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return (
        p.caption.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        p.authorUsername.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.hashtags.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [posts, blockedSet, activeTag, searchQuery]);

  const suggestedCreators = useMemo(
    () =>
      users
        .filter((u) => u.uid !== currentUser.uid && !u.isBanned && !blockedSet.has(u.uid))
        .slice(0, 5),
    [users, currentUser.uid, blockedSet]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      {/* Main Feed Column */}
      <div className="xl:col-span-8 space-y-5">
        {/* Search & Interactive Tag Filter Strip */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(language, 'searchPlaceholder')}
              className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600/30"
            />
          </div>

          {trendingTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveTag('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTag === 'all'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {t(language, 'all')}
              </button>
              {trendingTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeTag === tag
                      ? 'bg-rose-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 24-Hour Stories Bar */}
        <StoriesBar
          currentUser={currentUser}
          stories={stories.filter((s) => !blockedSet.has(s.authorId))}
          viewedStoryIds={viewedStoryIds}
          language={language}
          onAddStory={onAddStory}
          onOpenStory={onOpenStory}
        />

        {/* Posts Stream */}
        {filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-10 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t(language, 'emptyFeed')}
            </p>
            {activeTag !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveTag('all')}
                className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Clear #{activeTag} filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                authorProfile={usersMap[post.authorId]}
                isFollowing={followingIds.has(post.authorId)}
                isSaved={savedPostIds.includes(post.id)}
                language={language}
                onToggleFollow={onToggleFollow}
                onToggleSave={onToggleSavePost}
                onOpenProfile={onOpenProfile}
                onReport={onReport}
                onBlockUser={onBlockUser}
                onHashtagClick={(tag) => setActiveTag(tag)}
                onToast={onToast}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Discovery Column (Desktop 1280px+) */}
      <aside className="hidden xl:block xl:col-span-4 space-y-6 sticky top-6">
        {/* Mini Profile Summary */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenProfile(currentUser.uid)}
            className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
          >
            <SafeImage
              src={currentUser.photoUrl}
              alt={currentUser.displayName}
              className="w-11 h-11 rounded-full object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-display font-bold text-zinc-950 dark:text-white truncate">
                {currentUser.displayName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                @{currentUser.username} · <span className="tabular-nums">{currentUser.followersCount}</span> {t(language, 'followers').toLowerCase()}
              </p>
            </div>
          </button>
        </div>

        {/* Suggested Creators */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-5 space-y-4">
          <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
            {t(language, 'suggestedCreators')}
          </h3>
          {suggestedCreators.length === 0 ? (
            <p className="text-xs text-zinc-500">Invite friends to join Connectify.</p>
          ) : (
            <div className="space-y-3.5">
              {suggestedCreators.map((creator) => {
                const isFollowing = followingIds.has(creator.uid);
                return (
                  <div key={creator.uid} className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(creator.uid)}
                      className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                    >
                      <SafeImage
                        src={creator.photoUrl}
                        alt={creator.displayName}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {creator.displayName}
                          </p>
                          {creator.isVerified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">@{creator.username}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFollow(creator)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        isFollowing
                          ? 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          : 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90'
                      }`}
                    >
                      {isFollowing ? t(language, 'following') : t(language, 'follow')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trending Hashtags */}
        {trendingTags.length > 0 && (
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-5 space-y-3">
            <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
              {t(language, 'trendingTags')}
            </h3>
            <div className="space-y-2">
              {trendingTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(tag)}
                  className="w-full flex items-center justify-between text-left py-1 text-sm text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <span className="font-medium">#{tag}</span>
                  <span className="text-xs text-zinc-400">Filter</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
