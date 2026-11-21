import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Eye, Send, Trash2, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { recordStoryView, sendDirectMessage } from '../services/firestoreService';
import type { LanguageCode, StoryItem, StoryViewItem, UserProfile } from '../types';
import { t } from '../utils/i18n';
import { formatRelativeTime } from '../utils/media';
import { SafeImage } from './SafeImage';
import { deleteDoc, doc } from 'firebase/firestore';

interface StoryViewerModalProps {
  stories: StoryItem[];
  initialIndex: number;
  currentUser: UserProfile;
  usersMap: Record<string, UserProfile>;
  language: LanguageCode;
  onClose: () => void;
  onViewed: (storyId: string) => void;
  onToast: (msg: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialIndex,
  currentUser,
  usersMap,
  language,
  onClose,
  onViewed,
  onToast,
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewItem[]>([]);
  const [progress, setProgress] = useState(0);

  const story = stories[activeIndex];
  const isOwner = story?.authorId === currentUser.uid;

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    setShowViewers(false);
    onViewed(story.id);
    void recordStoryView(story, currentUser).catch(() => undefined);
  }, [story?.id]);

  // Auto-advance timer (paused while inspecting viewers or typing)
  useEffect(() => {
    if (!story || showViewers || replyText.length > 0) return;
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (activeIndex < stories.length - 1) {
            setActiveIndex((idx) => idx + 1);
            return 0;
          }
          onClose();
          return 100;
        }
        return prev + 2;
      });
    }, 140);
    return () => window.clearInterval(interval);
  }, [activeIndex, stories.length, showViewers, replyText, story, onClose]);

  // Load viewers list for story owner
  useEffect(() => {
    if (!story || !isOwner) {
      setViewers([]);
      return;
    }
    const path = `stories/${story.id}/views`;
    const q = query(collection(db, 'stories', story.id, 'views'), where('storyAuthorId', '==', currentUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setViewers(snap.docs.map((d) => d.data() as StoryViewItem));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [story?.id, isOwner, currentUser.uid]);

  if (!story) return null;

  const remainingHours = Math.max(1, Math.ceil((story.expiresAtMs - Date.now()) / (1000 * 60 * 60)));

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sendingReply) return;
    const recipient = usersMap[story.authorId] || {
      uid: story.authorId,
      displayName: story.authorName,
      username: story.authorUsername,
      photoUrl: story.authorPhoto,
      bio: '',
      isPrivate: false,
      allowReelDownloads: true,
      isVerified: false,
      isBanned: false,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
    };
    setSendingReply(true);
    try {
      await sendDirectMessage({
        sender: currentUser,
        recipient,
        type: 'story_reply',
        text: `Replied to story: ${replyText.trim()}`,
      });
      setReplyText('');
      onToast(`Reply sent to ${story.authorName}`);
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteStory = async () => {
    const path = `stories/${story.id}`;
    try {
      await deleteDoc(doc(db, 'stories', story.id));
      onToast('Story deleted');
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 sm:p-6">
      {/* Previous Story Button */}
      {activeIndex > 0 && (
        <button
          type="button"
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          aria-label="Previous story"
          className="hidden sm:flex absolute left-6 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Story Canvas */}
      <div className="relative w-full h-full sm:max-w-[420px] sm:max-h-[820px] sm:rounded-3xl overflow-hidden bg-zinc-950 flex flex-col">
        {/* Progress Bars */}
        <div className="absolute top-3 inset-x-3 z-20 flex gap-1.5">
          {stories.map((item, idx) => (
            <div key={item.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width: idx < activeIndex ? '100%' : idx === activeIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 inset-x-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <SafeImage
              src={story.authorPhoto}
              alt={story.authorName}
              className="w-9 h-9 rounded-full object-cover border border-white/30 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{story.authorName}</p>
              <p className="text-[11px] text-white/75">
                {formatRelativeTime(story.createdAt)} · expires in {remainingHours}h
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isOwner && (
              <button
                type="button"
                onClick={handleDeleteStory}
                aria-label="Delete story"
                className="min-w-[40px] min-h-[40px] rounded-full text-white/80 hover:text-rose-400 hover:bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close story viewer"
              className="min-w-[40px] min-h-[40px] rounded-full text-white hover:bg-white/15 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="relative flex-1 bg-black flex items-center justify-center">
          {story.mediaType === 'video' && story.mediaUrl.startsWith('blob:') ? (
            <video
              src={story.mediaUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <SafeImage
              src={story.mediaUrl}
              alt={story.caption || `${story.authorName}'s story`}
              className="w-full h-full object-cover"
            />
          )}

          {/* Top & Bottom Scrims */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/75 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

          {/* Tap Left/Right zones on mobile */}
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            className="absolute inset-y-24 left-0 w-1/3 z-10 cursor-pointer"
          />
          <button
            type="button"
            aria-label="Next"
            onClick={() =>
              activeIndex < stories.length - 1 ? setActiveIndex((i) => i + 1) : onClose()
            }
            className="absolute inset-y-24 right-0 w-1/3 z-10 cursor-pointer"
          />
        </div>

        {/* Caption + Reply or Viewers Footer */}
        <div className="absolute bottom-0 inset-x-0 z-20 p-4 space-y-3">
          {story.caption && (
            <p className="text-sm text-white leading-relaxed drop-shadow">{story.caption}</p>
          )}

          {isOwner ? (
            <button
              type="button"
              onClick={() => setShowViewers((v) => !v)}
              className="w-full min-h-[44px] rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span className="tabular-nums">
                {Math.max(story.viewsCount, viewers.length)} {t(language, 'viewers')}
              </span>
            </button>
          ) : (
            <form onSubmit={handleReply} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={240}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={t(language, 'replyToStory')}
                className="flex-1 min-h-[44px] rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-4 text-sm text-white placeholder:text-white/65 focus:outline-none focus:border-white"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sendingReply}
                aria-label="Send story reply"
                className="min-w-[44px] min-h-[44px] rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Viewers Bottom Sheet */}
        {showViewers && isOwner && (
          <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-white dark:bg-[#141417] text-zinc-950 dark:text-zinc-50 p-5 max-h-[55%] flex flex-col">
            <div className="w-10 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mb-3" />
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-display font-bold text-sm">
                {t(language, 'viewers')} ({viewers.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowViewers(false)}
                className="text-xs font-medium text-rose-600 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto space-y-2.5">
              {viewers.length === 0 ? (
                <p className="text-sm text-zinc-500 py-6 text-center">{t(language, 'noViewers')}</p>
              ) : (
                viewers.map((v) => (
                  <div key={v.viewerId} className="flex items-center gap-3 py-1">
                    <SafeImage
                      src={v.viewerPhoto}
                      alt={v.viewerName}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{v.viewerName}</p>
                      <p className="text-xs text-zinc-500">{formatRelativeTime(v.viewedAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Next Story Button */}
      {activeIndex < stories.length - 1 && (
        <button
          type="button"
          onClick={() => setActiveIndex((i) => Math.min(stories.length - 1, i + 1))}
          aria-label="Next story"
          className="hidden sm:flex absolute right-6 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
