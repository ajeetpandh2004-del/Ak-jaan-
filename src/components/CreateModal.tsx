import React, { useState } from 'react';
import { Film, Hash, Image as ImageIcon, MapPin, Music2, Sparkles, Upload, X } from 'lucide-react';
import { createPost, createReel, createStory } from '../services/firestoreService';
import {
  GENERATED_ASSETS,
  REEL_MUSIC_PRESETS,
  type LanguageCode,
  type UserProfile,
} from '../types';
import { t } from '../utils/i18n';
import { compressImageFile, extractVideoPoster, parseHashtags } from '../utils/media';
import { SafeImage } from './SafeImage';

export type CreateMode = 'post' | 'reel' | 'story';

interface CreateModalProps {
  currentUser: UserProfile;
  initialMode?: CreateMode;
  language: LanguageCode;
  onClose: () => void;
  onPublished: (mode: CreateMode, msg: string) => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  currentUser,
  initialMode = 'post',
  language,
  onClose,
  onPublished,
}) => {
  const [mode, setMode] = useState<CreateMode>(initialMode);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Post fields
  const [postMediaUrls, setPostMediaUrls] = useState<string[]>([]);
  const [postMediaType, setPostMediaType] = useState<'photo' | 'carousel' | 'video'>('photo');
  const [postCaption, setPostCaption] = useState('');
  const [postHashtags, setPostHashtags] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postVisibility, setPostVisibility] = useState<'public' | 'followers'>('public');

  // Reel fields (15s to 180s)
  const [reelPosterUrl, setReelPosterUrl] = useState<string>(GENERATED_ASSETS.reelHimalaya);
  const [reelVideoUrl, setReelVideoUrl] = useState<string>('');
  const [reelDuration, setReelDuration] = useState<number>(30);
  const [reelMusicId, setReelMusicId] = useState<string>(REEL_MUSIC_PRESETS[0].id);
  const [reelAllowDownload, setReelAllowDownload] = useState<boolean>(currentUser.allowReelDownloads);
  const [reelCaption, setReelCaption] = useState('');
  const [reelHashtags, setReelHashtags] = useState('');

  // Story fields (24h auto-expiry)
  const [storyMediaUrl, setStoryMediaUrl] = useState<string>('');
  const [storyMediaType, setStoryMediaType] = useState<'photo' | 'video'>('photo');
  const [storyCaption, setStoryCaption] = useState('');

  const handlePostFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    setError(null);
    try {
      const first = files[0];
      if (first.type.startsWith('video/')) {
        const { posterUrl } = await extractVideoPoster(first);
        setPostMediaType('video');
        setPostMediaUrls([posterUrl]);
      } else {
        const compressed = await Promise.all(files.map((f) => compressImageFile(f, 880, 0.7)));
        setPostMediaType(compressed.length > 1 ? 'carousel' : 'photo');
        setPostMediaUrls((prev) => [...prev, ...compressed].slice(0, 4));
      }
    } catch {
      setError('Could not process selected media file.');
    }
  };

  const handleReelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      if (file.type.startsWith('video/')) {
        const { posterUrl, durationSec, objectUrl } = await extractVideoPoster(file);
        setReelPosterUrl(posterUrl);
        setReelVideoUrl(objectUrl);
        setReelDuration(durationSec);
      } else {
        const img = await compressImageFile(file, 900, 0.72);
        setReelPosterUrl(img);
        setReelVideoUrl('');
      }
    } catch {
      setError('Could not process reel media.');
    }
  };

  const handleStoryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      if (file.type.startsWith('video/')) {
        const { posterUrl } = await extractVideoPoster(file);
        setStoryMediaType('video');
        setStoryMediaUrl(posterUrl);
      } else {
        const img = await compressImageFile(file, 900, 0.72);
        setStoryMediaType('photo');
        setStoryMediaUrl(img);
      }
    } catch {
      setError('Could not process story file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPublishing(true);

    try {
      if (mode === 'post') {
        const media = postMediaUrls.length > 0 ? postMediaUrls : [GENERATED_ASSETS.postJaipur];
        await createPost({
          author: currentUser,
          mediaType: media.length > 1 ? 'carousel' : postMediaType,
          mediaUrls: media,
          caption: postCaption,
          hashtags: parseHashtags(postHashtags),
          location: postLocation,
          visibility: postVisibility,
        });
        onPublished('post', 'Post published to Connectify!');
        onClose();
      } else if (mode === 'reel') {
        const music = REEL_MUSIC_PRESETS.find((m) => m.id === reelMusicId) || REEL_MUSIC_PRESETS[0];
        await createReel({
          author: currentUser,
          posterUrl: reelPosterUrl,
          videoUrl: reelVideoUrl.startsWith('blob:') ? '' : reelVideoUrl,
          durationSec: reelDuration,
          caption: reelCaption || 'New Connectify Reel',
          hashtags: parseHashtags(reelHashtags),
          musicTitle: `${music.title} — ${music.artist}`,
          musicPresetId: music.id,
          allowDownload: reelAllowDownload,
        });
        onPublished('reel', 'Reel published!');
        onClose();
      } else {
        const media = storyMediaUrl || GENERATED_ASSETS.postCoffee;
        await createStory({
          author: currentUser,
          mediaType: storyMediaType,
          mediaUrl: media,
          caption: storyCaption,
        });
        onPublished('story', '24-hour story is live!');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-zinc-950 dark:text-white">
            {t(language, 'create')} on Connectify
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create studio"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Segmented Control */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setMode('post')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'post'
                  ? 'bg-white dark:bg-[#1F1F24] text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Post
            </button>
            <button
              type="button"
              onClick={() => setMode('reel')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'reel'
                  ? 'bg-white dark:bg-[#1F1F24] text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Reel
            </button>
            <button
              type="button"
              onClick={() => setMode('story')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'story'
                  ? 'bg-white dark:bg-[#1F1F24] text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              24h Story
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {mode === 'post' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Photos (up to 4 for Carousel) or Video
                </label>
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-rose-500 p-5 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Click to select 1–4 photos or a video clip
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handlePostFiles}
                    className="hidden"
                  />
                </label>

                {postMediaUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {postMediaUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                        <SafeImage src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPostMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Caption
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="Write a caption for your post..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <Hash className="w-3.5 h-3.5" /> Hashtags
                  </label>
                  <input
                    type="text"
                    value={postHashtags}
                    onChange={(e) => setPostHashtags(e.target.value)}
                    placeholder="Travel, Jaipur, Photography"
                    className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={postLocation}
                    onChange={(e) => setPostLocation(e.target.value)}
                    placeholder="Mumbai, India"
                    className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Visibility</span>
                <div className="flex gap-1.5">
                  {(['public', 'followers'] as const).map((vis) => (
                    <button
                      key={vis}
                      type="button"
                      onClick={() => setPostVisibility(vis)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                        postVisibility === vis
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {vis}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {mode === 'reel' && (
            <>
              <div className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-5 aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <SafeImage src={reelPosterUrl} alt="Reel preview" className="w-full h-full object-cover" />
                </div>
                <div className="col-span-7 space-y-3">
                  <label className="block w-full text-center px-3 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-rose-500 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Upload Video / Cover (15s – 3m)
                    <input type="file" accept="video/*,image/*" onChange={handleReelFile} className="hidden" />
                  </label>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">Duration</span>
                      <span className="font-mono tabular-nums text-rose-600 font-semibold">{reelDuration}s</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={180}
                      step={5}
                      value={reelDuration}
                      onChange={(e) => setReelDuration(Number(e.target.value))}
                      className="w-full accent-rose-600"
                    />
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>15s</span>
                      <span>3 min (180s)</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      <Music2 className="w-3.5 h-3.5" /> Add Music Track
                    </label>
                    <select
                      value={reelMusicId}
                      onChange={(e) => setReelMusicId(e.target.value)}
                      className="w-full min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 text-xs"
                    >
                      {REEL_MUSIC_PRESETS.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.title} · {track.artist}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Allow viewers to download
                    </span>
                    <input
                      type="checkbox"
                      checked={reelAllowDownload}
                      onChange={(e) => setReelAllowDownload(e.target.checked)}
                      className="w-4 h-4 accent-rose-600"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Reel Caption
                </label>
                <textarea
                  rows={2}
                  maxLength={600}
                  value={reelCaption}
                  onChange={(e) => setReelCaption(e.target.value)}
                  placeholder="Describe your reel..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Hashtags
                </label>
                <input
                  type="text"
                  value={reelHashtags}
                  onChange={(e) => setReelHashtags(e.target.value)}
                  placeholder="Reels, Connectify, Music"
                  className="w-full min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 text-sm"
                />
              </div>
            </>
          )}

          {mode === 'story' && (
            <>
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-rose-500 p-6 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Upload Photo or Video Story (auto-expires after 24 hours)
                  </span>
                  <input type="file" accept="image/*,video/*" onChange={handleStoryFile} className="hidden" />
                </label>

                {storyMediaUrl && (
                  <div className="w-40 aspect-[9/16] mx-auto rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    <SafeImage src={storyMediaUrl} alt="Story preview" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Story Overlay Caption
                  </label>
                  <input
                    type="text"
                    maxLength={240}
                    value={storyCaption}
                    onChange={(e) => setStoryCaption(e.target.value)}
                    placeholder="What's happening right now?"
                    className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {t(language, 'cancel')}
            </button>
            <button
              type="submit"
              disabled={publishing}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              {publishing ? 'Publishing...' : t(language, 'publish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
