import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Flag,
  Heart,
  Lock,
  MessageCircle,
  Music2,
  Plus,
  Send,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { addReelComment, shareReel, toggleReelLike } from '../services/firestoreService';
import type { CommentItem, LanguageCode, ReelItem, UserProfile } from '../types';
import { t } from '../utils/i18n';
import { formatDuration, formatRelativeTime, reelMusicPlayer } from '../utils/media';
import { SafeImage } from './SafeImage';

interface ReelsViewProps {
  currentUser: UserProfile;
  reels: ReelItem[];
  usersMap: Record<string, UserProfile>;
  followingIds: Set<string>;
  language: LanguageCode;
  onToggleFollow: (target: UserProfile) => void;
  onOpenCreateReel: () => void;
  onOpenProfile: (uid: string) => void;
  onReport: (targetType: 'reel', targetId: string, label: string) => void;
  onToast: (msg: string) => void;
}

export const ReelsView: React.FC<ReelsViewProps> = ({
  currentUser,
  reels,
  usersMap,
  followingIds,
  language,
  onToggleFollow,
  onOpenCreateReel,
  onOpenProfile,
  onReport,
  onToast,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const safeIdx = Math.min(activeIdx, Math.max(0, reels.length - 1));
  const activeReel = reels[safeIdx];

  // Music synthesis playback synced to mute toggle & active reel
  useEffect(() => {
    if (!activeReel || muted) {
      reelMusicPlayer.stop();
      return;
    }
    reelMusicPlayer.start(activeReel.musicPresetId || 'sunrise_raga');
    return () => reelMusicPlayer.stop();
  }, [activeReel?.id, activeReel?.musicPresetId, muted]);

  // Cleanup audio on unmount
  useEffect(() => () => reelMusicPlayer.stop(), []);

  // Playback progress indicator (15s to 180s)
  useEffect(() => {
    if (!activeReel) return;
    setElapsed(0);
    const timer = window.setInterval(() => {
      setElapsed((prev) => (prev + 1 >= activeReel.durationSec ? 0 : prev + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeReel?.id, activeReel?.durationSec]);

  // Check if current user liked active reel
  useEffect(() => {
    if (!activeReel) return;
    let mounted = true;
    getDoc(doc(db, 'reels', activeReel.id, 'likes', currentUser.uid))
      .then((snap) => {
        if (mounted) setLiked(snap.exists());
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [activeReel?.id, currentUser.uid]);

  // Subscribe to comments when drawer opens
  useEffect(() => {
    if (!activeReel || !showComments) return;
    const path = `reels/${activeReel.id}/comments`;
    const q = query(collection(db, 'reels', activeReel.id, 'comments'), where('status', '==', 'active'));
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
  }, [activeReel?.id, showComments]);

  if (!activeReel) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-12 text-center space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(language, 'emptyReels')}</p>
        <button
          type="button"
          onClick={onOpenCreateReel}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t(language, 'createReel')}
        </button>
      </div>
    );
  }

  const author = usersMap[activeReel.authorId];
  const isOwnReel = activeReel.authorId === currentUser.uid;
  const isFollowing = followingIds.has(activeReel.authorId);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const prev = liked;
    setLiked(!prev);
    try {
      await toggleReelLike(activeReel, currentUser, prev);
    } catch {
      setLiked(prev);
      onToast('Could not update reel like.');
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    await shareReel(activeReel, currentUser);
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${window.location.origin}/?reel=${activeReel.id}`).catch(() => undefined);
    }
    onToast('Reel link shared & copied!');
  };

  const handleDownload = () => {
    if (!activeReel.allowDownload) {
      onToast(t(language, 'downloadDisabled'));
      return;
    }
    const link = document.createElement('a');
    link.href = activeReel.videoUrl || activeReel.posterUrl;
    link.download = `connectify_reel_${activeReel.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('Downloading reel media...');
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await addReelComment(activeReel, currentUser, commentText);
      setCommentText('');
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
      {/* Vertical 9:16 Reel Stage */}
      <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-[calc(100vh-148px)] rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {/* Reel Visual / Video */}
        {activeReel.videoUrl && activeReel.videoUrl.startsWith('blob:') ? (
          <video
            key={activeReel.id}
            src={activeReel.videoUrl}
            poster={activeReel.posterUrl}
            autoPlay
            loop
            muted={muted}
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <SafeImage
            src={activeReel.posterUrl}
            alt={activeReel.caption || 'Connectify Reel'}
            className={`w-full h-full object-cover transition-transform duration-[8000ms] ease-linear ${
              muted ? 'scale-100' : 'scale-105'
            }`}
          />
        )}

        {/* Measured Contrast Scrims */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

        {/* Top Bar inside Reel */}
        <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
          <div className="text-white text-xs font-mono tabular-nums bg-black/45 backdrop-blur-md px-2.5 py-1 rounded-lg">
            {formatDuration(elapsed)} / {formatDuration(activeReel.durationSec)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute reel audio' : 'Mute reel audio'}
              className="min-w-[40px] min-h-[40px] rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenCreateReel}
              aria-label="Upload new reel"
              className="min-h-[40px] px-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
        </div>

        {/* Right Vertical Action Rail */}
        <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-3.5 text-white">
          <button
            type="button"
            onClick={handleLike}
            className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
          >
            <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center hover:bg-black/65 transition-colors">
              <Heart className={`w-5 h-5 ${liked ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
            </span>
            <span className="text-xs font-medium tabular-nums">{activeReel.likesCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowComments((s) => !s)}
            className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
          >
            <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center hover:bg-black/65 transition-colors">
              <MessageCircle className="w-5 h-5" />
            </span>
            <span className="text-xs font-medium tabular-nums">{activeReel.commentsCount}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
          >
            <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center hover:bg-black/65 transition-colors">
              <Share2 className="w-5 h-5" />
            </span>
            <span className="text-xs font-medium tabular-nums">{activeReel.sharesCount}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title={activeReel.allowDownload ? t(language, 'download') : t(language, 'downloadDisabled')}
            className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
          >
            <span
              className={`w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center transition-colors ${
                activeReel.allowDownload ? 'hover:bg-black/65 text-white' : 'text-white/45'
              }`}
            >
              {activeReel.allowDownload ? <Download className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
            </span>
            <span className="text-[10px] font-medium">
              {activeReel.allowDownload ? 'Save' : 'Locked'}
            </span>
          </button>

          {!isOwnReel && (
            <button
              type="button"
              onClick={() => onReport('reel', activeReel.id, `${activeReel.authorName}'s reel`)}
              aria-label="Report reel"
              className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-rose-400 cursor-pointer"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bottom Creator Metadata & Music Track */}
        <div className="absolute left-4 right-16 bottom-5 z-10 text-white space-y-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenProfile(activeReel.authorId)}
              className="flex items-center gap-2 min-w-0 cursor-pointer"
            >
              <SafeImage
                src={activeReel.authorPhoto}
                alt={activeReel.authorName}
                className="w-9 h-9 rounded-full object-cover border border-white/40 shrink-0"
              />
              <span className="text-sm font-display font-bold truncate">
                @{activeReel.authorUsername}
              </span>
            </button>
            {!isOwnReel && author && (
              <button
                type="button"
                onClick={() => onToggleFollow(author)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 cursor-pointer ${
                  isFollowing
                    ? 'border-white/40 bg-black/40 text-white'
                    : 'border-white bg-white text-zinc-950'
                }`}
              >
                {isFollowing ? t(language, 'following') : t(language, 'follow')}
              </button>
            )}
          </div>

          <p className="text-sm leading-snug text-white/95 line-clamp-3">{activeReel.caption}</p>

          <div className="flex items-center gap-2 text-xs text-white/85">
            <Music2 className={`w-3.5 h-3.5 shrink-0 ${!muted ? 'text-rose-400' : ''}`} />
            <span className="truncate">{activeReel.musicTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{muted ? 'Tap speaker for music' : 'Playing'}</span>
          </div>
        </div>

        {/* Progress Bar at Bottom Edge */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-20">
          <div
            className="h-full bg-rose-500 transition-all duration-1000 linear"
            style={{ width: `${Math.min(100, (elapsed / Math.max(1, activeReel.durationSec)) * 100)}%` }}
          />
        </div>

        {/* Comments Overlay Sheet inside Reel */}
        {showComments && (
          <div className="absolute inset-x-0 bottom-0 z-30 h-[62%] rounded-t-3xl bg-white dark:bg-[#141417] text-zinc-950 dark:text-zinc-50 p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h4 className="font-display font-bold text-sm">
                {t(language, 'comments')} ({comments.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowComments(false)}
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-8">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <SafeImage
                      src={c.authorPhoto}
                      alt={c.authorName}
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                    <div className="text-sm min-w-0">
                      <span className="font-semibold mr-1.5">{c.authorName}</span>
                      <span className="text-zinc-700 dark:text-zinc-300">{c.text}</span>
                      <span className="ml-2 text-[11px] text-zinc-400">{formatRelativeTime(c.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleCommentSubmit} className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
              <input
                type="text"
                maxLength={500}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t(language, 'writeComment')}
                className="flex-1 min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || sendingComment}
                className="min-h-[40px] px-3.5 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Reel Queue / Navigation Controls */}
      <div className="flex lg:flex-col items-center gap-3 w-full max-w-[420px] lg:w-64">
        <div className="flex lg:flex-col items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={safeIdx === 0}
            onClick={() => {
              setShowComments(false);
              setActiveIdx((i) => Math.max(0, i - 1));
            }}
            aria-label="Previous reel"
            className="min-w-[44px] min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] flex items-center justify-center text-zinc-700 dark:text-zinc-200 disabled:opacity-35 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono tabular-nums text-zinc-500">
            {safeIdx + 1} / {reels.length}
          </span>
          <button
            type="button"
            disabled={safeIdx >= reels.length - 1}
            onClick={() => {
              setShowComments(false);
              setActiveIdx((i) => Math.min(reels.length - 1, i + 1));
            }}
            aria-label="Next reel"
            className="min-w-[44px] min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] flex items-center justify-center text-zinc-700 dark:text-zinc-200 disabled:opacity-35 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Up Next Thumbnails on Desktop */}
        <div className="hidden lg:block w-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-4 space-y-3">
          <h3 className="font-display font-bold text-xs text-zinc-500 dark:text-zinc-400">
            Reels Queue
          </h3>
          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {reels.map((r, idx) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setShowComments(false);
                  setActiveIdx(idx);
                }}
                className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer ${
                  idx === safeIdx
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <SafeImage
                  src={r.posterUrl}
                  alt={r.authorName}
                  className="w-10 h-14 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">@{r.authorUsername}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{r.musicTitle}</p>
                  <p className="text-[11px] text-zinc-400 font-mono tabular-nums">
                    {formatDuration(r.durationSec)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
