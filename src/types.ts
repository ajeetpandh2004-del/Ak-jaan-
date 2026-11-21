import type { Timestamp } from 'firebase/firestore';

export type LanguageCode = 'en' | 'hi';
export type ThemeMode = 'light' | 'dark';
export type NavTab = 'home' | 'reels' | 'create' | 'notifications' | 'profile' | 'chat' | 'admin';

export const BLUEPRINT_LIMITS = {
  DISPLAY_NAME_MAX: 60,
  USERNAME_MAX: 32,
  BIO_MAX: 240,
  CAPTION_MAX: 1000,
  REEL_CAPTION_MAX: 600,
  STORY_CAPTION_MAX: 240,
  COMMENT_MAX: 500,
  LOCATION_MAX: 100,
  HASHTAGS_MAX: 10,
  MEDIA_ITEMS_MAX: 5,
  MEDIA_URL_MAX: 200000,
  MESSAGE_TEXT_MAX: 1000,
  REASON_MAX: 100,
  DETAILS_MAX: 500,
  SUBJECT_MAX: 120,
  TICKET_MESSAGE_MAX: 1000,
} as const;

export const GENERATED_ASSETS = {
  avatarAarav: '/src/assets/images/avatar_aarav_1795249689443.jpg',
  avatarPriya: '/src/assets/images/avatar_priya_1795249689645.jpg',
  postJaipur: '/src/assets/images/post_jaipur_courtyard_1795249688008.jpg',
  postCoffee: '/src/assets/images/post_artisan_coffee_1795249689393.jpg',
  reelHimalaya: '/src/assets/images/reel_himalaya_dawn_1795249687952.jpg',
  reelStreet: '/src/assets/images/reel_street_motion_1795249688619.jpg',
} as const;

export interface MusicPreset {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  notes: number[];
}

export const REEL_MUSIC_PRESETS: MusicPreset[] = [
  { id: 'sunrise_raga', title: 'Morning Mist (Lo-Fi Sitar)', artist: 'Connectify Studio', bpm: 92, notes: [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66] },
  { id: 'urban_pulse', title: 'Delhi Midnight Beat', artist: 'Aarav Beats', bpm: 118, notes: [220.0, 261.63, 329.63, 329.63, 293.66, 261.63, 246.94, 220.0] },
  { id: 'monsoon_keys', title: 'Monsoon Cafe Piano', artist: 'Priya Acoustic', bpm: 84, notes: [349.23, 392.0, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63] },
  { id: 'mountain_wind', title: 'Himalayan Horizon', artist: 'Alpine Echoes', bpm: 78, notes: [196.0, 246.94, 293.66, 392.0, 329.63, 293.66, 246.94, 196.0] },
  { id: 'original_audio', title: 'Original Audio', artist: 'Creator Sound', bpm: 96, notes: [261.63, 329.63, 392.0, 523.25] },
];

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  photoUrl: string;
  bio: string;
  isPrivate: boolean;
  allowReelDownloads: boolean;
  isVerified: boolean;
  isBanned: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface UserPrivate {
  uid: string;
  email: string;
  blockedUserIds: string[];
  savedPostIds: string[];
  language: LanguageCode;
  theme: ThemeMode;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhoto: string;
  mediaType: 'photo' | 'carousel' | 'video';
  mediaUrls: string[];
  caption: string;
  hashtags: string[];
  location: string;
  visibility: 'public' | 'followers';
  status: 'active' | 'removed';
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CommentItem {
  id: string;
  targetId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  status: 'active' | 'removed';
  createdAt?: Timestamp | null;
}

export interface ReelItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhoto: string;
  posterUrl: string;
  videoUrl: string;
  durationSec: number;
  caption: string;
  hashtags: string[];
  musicTitle: string;
  musicPresetId: string;
  allowDownload: boolean;
  status: 'active' | 'removed';
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhoto: string;
  mediaType: 'photo' | 'video';
  mediaUrl: string;
  caption: string;
  status: 'active' | 'removed';
  viewsCount: number;
  expiresAtMs: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StoryViewItem {
  storyId: string;
  storyAuthorId: string;
  viewerId: string;
  viewerName: string;
  viewerPhoto: string;
  viewedAt?: Timestamp | null;
}

export interface FollowEdge {
  followerId: string;
  followingId: string;
  createdAt?: Timestamp | null;
}

export interface ChatThread {
  id: string;
  participantIds: string[];
  userAId: string;
  userAName: string;
  userAPhoto: string;
  userBId: string;
  userBName: string;
  userBPhoto: string;
  lastMessage: string;
  lastSenderId: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  participantIds: string[];
  senderId: string;
  senderName: string;
  type: 'text' | 'photo' | 'video' | 'voice' | 'story_reply';
  text: string;
  mediaUrl: string;
  voiceDurationSec: number;
  createdAt?: Timestamp | null;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhoto: string;
  type: 'like' | 'comment' | 'follow' | 'reel_share' | 'story_reply';
  targetId: string;
  message: string;
  isRead: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'user' | 'post' | 'reel';
  targetId: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SupportTicketItem {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
