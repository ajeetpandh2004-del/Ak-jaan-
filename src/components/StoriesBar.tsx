import React from 'react';
import { Plus } from 'lucide-react';
import type { LanguageCode, StoryItem, UserProfile } from '../types';
import { t } from '../utils/i18n';
import { SafeImage } from './SafeImage';

interface StoriesBarProps {
  currentUser: UserProfile;
  stories: StoryItem[];
  viewedStoryIds: Set<string>;
  language: LanguageCode;
  onAddStory: () => void;
  onOpenStory: (storyIndex: number) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  currentUser,
  stories,
  viewedStoryIds,
  language,
  onAddStory,
  onOpenStory,
}) => {
  return (
    <section
      aria-label="24-hour stories"
      className="bg-white dark:bg-[#141417] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {t(language, 'storiesTitle')}
        </h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
          {stories.length} active
        </span>
      </div>

      <div className="flex items-start gap-4 overflow-x-auto no-scrollbar pb-1">
        {/* Add Story Button */}
        <button
          type="button"
          onClick={onAddStory}
          className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group cursor-pointer"
        >
          <div className="relative w-16 h-16 rounded-full p-[2px] border border-dashed border-zinc-300 dark:border-zinc-700 group-hover:border-rose-500 transition-colors">
            <SafeImage
              src={currentUser.photoUrl}
              alt={currentUser.displayName}
              className="w-full h-full rounded-full object-cover"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-rose-600 text-white border-2 border-white dark:border-[#141417] flex items-center justify-center">
              <Plus className="w-3.5 h-3.5" />
            </span>
          </div>
          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate w-full text-center">
            {t(language, 'addStory')}
          </span>
        </button>

        {/* Active 24h Stories */}
        {stories.map((story, index) => {
          const isViewed = viewedStoryIds.has(story.id) || story.authorId === currentUser.uid;
          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpenStory(index)}
              className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group cursor-pointer"
            >
              <div
                className={`w-16 h-16 rounded-full p-[2.5px] transition-transform group-active:scale-95 ${
                  isViewed
                    ? 'bg-zinc-200 dark:bg-zinc-700'
                    : 'bg-gradient-to-tr from-rose-600 via-amber-500 to-rose-400'
                }`}
              >
                <div className="w-full h-full rounded-full p-[2px] bg-white dark:bg-[#141417]">
                  <SafeImage
                    src={story.authorPhoto}
                    alt={story.authorName}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate w-full text-center">
                {story.authorId === currentUser.uid ? 'You' : story.authorName.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
