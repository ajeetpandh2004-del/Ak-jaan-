import React, { useMemo, useState } from 'react';
import { CheckCheck, Heart, MessageCircle, Share2, Sparkles, UserPlus } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '../services/firestoreService';
import type { LanguageCode, NotificationItem } from '../types';
import { t } from '../utils/i18n';
import { formatRelativeTime } from '../utils/media';
import { SafeImage } from './SafeImage';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  language: LanguageCode;
  onOpenProfile: (uid: string) => void;
}

type FilterType = 'all' | 'like' | 'comment' | 'follow' | 'reel_share';

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  language,
  onOpenProfile,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');

  const unreadIds = useMemo(
    () => notifications.filter((n) => !n.isRead).map((n) => n.id),
    [notifications]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const iconForType = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-sky-600" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-emerald-600" />;
      case 'reel_share':
        return <Share2 className="w-4 h-4 text-amber-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-rose-600" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl text-zinc-950 dark:text-white">
            {t(language, 'notifications')}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
            {unreadIds.length} unread · {notifications.length} total
          </p>
        </div>

        {unreadIds.length > 0 && (
          <button
            type="button"
            onClick={() => void markAllNotificationsRead(unreadIds)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            {t(language, 'markAllRead')}
          </button>
        )}
      </div>

      {/* Interactive Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {(
          [
            ['all', t(language, 'all')],
            ['like', t(language, 'likes')],
            ['comment', t(language, 'comments')],
            ['follow', t(language, 'follows')],
            ['reel_share', t(language, 'shares')],
          ] as [FilterType, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              filter === key
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t(language, 'emptyNotifications')}
          </div>
        ) : (
          filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.isRead) void markNotificationRead(n.id);
                onOpenProfile(n.actorId);
              }}
              className={`w-full px-4 py-3.5 flex items-center gap-3.5 text-left transition-colors cursor-pointer ${
                !n.isRead
                  ? 'bg-rose-50/45 dark:bg-rose-950/20 hover:bg-rose-50/75 dark:hover:bg-rose-950/35'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
              }`}
            >
              <div className="relative shrink-0">
                <SafeImage
                  src={n.actorPhoto}
                  alt={n.actorName}
                  className="w-11 h-11 rounded-full object-cover"
                />
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                  {iconForType(n.type)}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-snug">{n.message}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{formatRelativeTime(n.createdAt)}</p>
              </div>

              {!n.isRead && (
                <span className="text-[11px] font-semibold text-rose-600 shrink-0">New</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
