import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BLUEPRINT_LIMITS,
  GENERATED_ASSETS,
  type ChatMessage,
  type LanguageCode,
  type PostItem,
  type ReelItem,
  type StoryItem,
  type ThemeMode,
  type UserPrivate,
  type UserProfile,
} from '../types';
import { generateSafeId, getChatId, sanitizeUsername } from '../utils/media';

function clip(str: string, max: number): string {
  return (str || '').trim().slice(0, max);
}

/**
 * Ensures the signed-in Google user has both a public `/users/{uid}` profile
 * and an isolated `/user_private/{uid}` document.
 */
export async function ensureUserProfiles(authUser: User): Promise<{
  profile: UserProfile;
  privateData: UserPrivate;
}> {
  const uid = authUser.uid;
  const userRef = doc(db, 'users', uid);
  const privRef = doc(db, 'user_private', uid);

  try {
    const [userSnap, privSnap] = await Promise.all([getDoc(userRef), getDoc(privRef)]);
    let profile: UserProfile;
    let privateData: UserPrivate;

    if (!userSnap.exists()) {
      const baseName = clip(authUser.displayName || authUser.email?.split('@')[0] || 'Connectify User', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
      const handleBase = (authUser.email?.split('@')[0] || baseName).replace(/\s+/g, '_');
      const newProfile = {
        uid,
        displayName: baseName,
        username: sanitizeUsername(handleBase, uid.slice(0, 6)),
        photoUrl: clip(authUser.photoURL || GENERATED_ASSETS.avatarAarav, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
        bio: 'Sharing everyday stories, reels, and photos on Connectify.',
        isPrivate: false,
        allowReelDownloads: true,
        isVerified: false,
        isBanned: false,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile);
      profile = { ...newProfile, createdAt: null, updatedAt: null };
    } else {
      profile = userSnap.data() as UserProfile;
    }

    if (!privSnap.exists()) {
      const newPriv = {
        uid,
        email: clip(authUser.email || '', 160),
        blockedUserIds: [] as string[],
        savedPostIds: [] as string[],
        language: 'en' as LanguageCode,
        theme: 'light' as ThemeMode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(privRef, newPriv);
      privateData = { ...newPriv, createdAt: null, updatedAt: null };
    } else {
      privateData = privSnap.data() as UserPrivate;
    }

    return { profile, privateData };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

/**
 * Seeds authentic initial creators, posts, reels, and 24-hour stories when the
 * database has no posts yet (executed by verified admin so every interaction is 100% live in Firestore).
 */
export async function seedStarterCommunityIfEmpty(isAdminUser: boolean): Promise<void> {
  if (!isAdminUser) return;
  try {
    const existingPosts = await getDocs(query(collection(db, 'posts'), where('status', '==', 'active')));
    if (!existingPosts.empty) return;

    const batch = writeBatch(db);
    const nowMs = Date.now();
    const expiry24h = nowMs + 24 * 60 * 60 * 1000;

    // Seed two starter creators
    const aaravRef = doc(db, 'users', 'creator_aarav');
    batch.set(aaravRef, {
      uid: 'creator_aarav',
      displayName: 'Aarav Sharma',
      username: 'aarav.frames',
      photoUrl: GENERATED_ASSETS.avatarAarav,
      bio: 'Documentary photographer & visual storyteller exploring Jaipur, Delhi, and the Himalayas.',
      isPrivate: false,
      allowReelDownloads: true,
      isVerified: true,
      isBanned: false,
      followersCount: 1420,
      followingCount: 184,
      postsCount: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const priyaRef = doc(db, 'users', 'creator_priya');
    batch.set(priyaRef, {
      uid: 'creator_priya',
      displayName: 'Priya Nair',
      username: 'priya.travels',
      photoUrl: GENERATED_ASSETS.avatarPriya,
      bio: 'Filmmaker, specialty coffee lover, and street dance curator across Mumbai & Kochi.',
      isPrivate: false,
      allowReelDownloads: true,
      isVerified: true,
      isBanned: false,
      followersCount: 2890,
      followingCount: 312,
      postsCount: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Seed two starter posts (including multi-photo carousel)
    batch.set(doc(db, 'posts', 'post_seed_jaipur'), {
      id: 'post_seed_jaipur',
      authorId: 'creator_aarav',
      authorName: 'Aarav Sharma',
      authorUsername: 'aarav.frames',
      authorPhoto: GENERATED_ASSETS.avatarAarav,
      mediaType: 'carousel',
      mediaUrls: [GENERATED_ASSETS.postJaipur, GENERATED_ASSETS.postCoffee],
      caption: 'First light hitting the pink sandstone courtyards of old Jaipur before the city wakes up. Swipe for our morning filter coffee stop.',
      hashtags: ['Jaipur', 'Architecture', 'GoldenHour', 'IndiaTravel'],
      location: 'Jaipur, Rajasthan',
      visibility: 'public',
      status: 'active',
      likesCount: 48,
      commentsCount: 0,
      sharesCount: 6,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'posts', 'post_seed_coffee'), {
      id: 'post_seed_coffee',
      authorId: 'creator_priya',
      authorName: 'Priya Nair',
      authorUsername: 'priya.travels',
      authorPhoto: GENERATED_ASSETS.avatarPriya,
      mediaType: 'photo',
      mediaUrls: [GENERATED_ASSETS.postCoffee],
      caption: 'Slow Sunday notes and single-estate Chikmagalur pour-over under dappled monsoon light.',
      hashtags: ['CoffeeTime', 'Bandra', 'MinimalLiving'],
      location: 'Bandra West, Mumbai',
      visibility: 'public',
      status: 'active',
      likesCount: 73,
      commentsCount: 0,
      sharesCount: 11,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Seed two vertical Reels (15s - 3m)
    batch.set(doc(db, 'reels', 'reel_seed_himalaya'), {
      id: 'reel_seed_himalaya',
      authorId: 'creator_aarav',
      authorName: 'Aarav Sharma',
      authorUsername: 'aarav.frames',
      authorPhoto: GENERATED_ASSETS.avatarAarav,
      posterUrl: GENERATED_ASSETS.reelHimalaya,
      videoUrl: '',
      durationSec: 42,
      caption: 'Walking through silent deodar pine ridges at 6:00 AM above Manali. Turn on sound for the lo-fi morning sitar loop.',
      hashtags: ['Himalayas', 'ReelsIndia', 'MountainDawn'],
      musicTitle: 'Morning Mist (Lo-Fi Sitar)',
      musicPresetId: 'sunrise_raga',
      allowDownload: true,
      status: 'active',
      likesCount: 134,
      commentsCount: 0,
      sharesCount: 19,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'reels', 'reel_seed_street'), {
      id: 'reel_seed_street',
      authorId: 'creator_priya',
      authorName: 'Priya Nair',
      authorUsername: 'priya.travels',
      authorPhoto: GENERATED_ASSETS.avatarPriya,
      posterUrl: GENERATED_ASSETS.reelStreet,
      videoUrl: '',
      durationSec: 28,
      caption: 'Twilight urban choreography session under warm stone alley lanterns. Shot handheld at 60fps.',
      hashtags: ['StreetDance', 'Choreography', 'ConnectifyReels'],
      musicTitle: 'Delhi Midnight Beat',
      musicPresetId: 'urban_pulse',
      allowDownload: false,
      status: 'active',
      likesCount: 218,
      commentsCount: 0,
      sharesCount: 31,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Seed two 24-hour expiring Stories
    batch.set(doc(db, 'stories', 'story_seed_aarav'), {
      id: 'story_seed_aarav',
      authorId: 'creator_aarav',
      authorName: 'Aarav Sharma',
      authorUsername: 'aarav.frames',
      authorPhoto: GENERATED_ASSETS.avatarAarav,
      mediaType: 'photo',
      mediaUrl: GENERATED_ASSETS.postJaipur,
      caption: 'Sunrise walk in Pink City — reply if you want the exact courtyard spot!',
      status: 'active',
      viewsCount: 12,
      expiresAtMs: expiry24h,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'stories', 'story_seed_priya'), {
      id: 'story_seed_priya',
      authorId: 'creator_priya',
      authorName: 'Priya Nair',
      authorUsername: 'priya.travels',
      authorPhoto: GENERATED_ASSETS.avatarPriya,
      mediaType: 'photo',
      mediaUrl: GENERATED_ASSETS.reelStreet,
      caption: 'Rehearsing tonight’s dance reel — full cut drops shortly.',
      status: 'active',
      viewsCount: 29,
      expiresAtMs: expiry24h,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    console.warn('Starter seed skipped or failed:', error);
  }
}

export async function createNotification(params: {
  recipientId: string;
  actor: UserProfile;
  type: 'like' | 'comment' | 'follow' | 'reel_share' | 'story_reply';
  targetId: string;
  message: string;
}): Promise<void> {
  if (params.recipientId === params.actor.uid) return;
  const id = generateSafeId('notif');
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      recipientId: params.recipientId,
      actorId: params.actor.uid,
      actorName: clip(params.actor.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      actorPhoto: clip(params.actor.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      type: params.type,
      targetId: clip(params.targetId, 128),
      message: clip(params.message, 240),
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    notificationIds.slice(0, 100).forEach((id) => {
      batch.update(doc(db, 'notifications', id), {
        isRead: true,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function createPost(params: {
  author: UserProfile;
  mediaType: 'photo' | 'carousel' | 'video';
  mediaUrls: string[];
  caption: string;
  hashtags: string[];
  location: string;
  visibility: 'public' | 'followers';
}): Promise<string> {
  const id = generateSafeId('post');
  const path = `posts/${id}`;
  const cleanMedia = params.mediaUrls
    .filter(Boolean)
    .slice(0, BLUEPRINT_LIMITS.MEDIA_ITEMS_MAX)
    .map((u) => clip(u, BLUEPRINT_LIMITS.MEDIA_URL_MAX));

  if (cleanMedia.length === 0) {
    throw new Error('At least one photo or video is required.');
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'posts', id), {
      id,
      authorId: params.author.uid,
      authorName: clip(params.author.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      authorUsername: clip(params.author.username, BLUEPRINT_LIMITS.USERNAME_MAX),
      authorPhoto: clip(params.author.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      mediaType: cleanMedia.length > 1 ? 'carousel' : params.mediaType,
      mediaUrls: cleanMedia,
      caption: clip(params.caption, BLUEPRINT_LIMITS.CAPTION_MAX),
      hashtags: params.hashtags.slice(0, BLUEPRINT_LIMITS.HASHTAGS_MAX),
      location: clip(params.location, BLUEPRINT_LIMITS.LOCATION_MAX),
      visibility: params.visibility,
      status: 'active',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', params.author.uid), {
      postsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePost(post: PostItem): Promise<void> {
  const path = `posts/${post.id}`;
  try {
    await deleteDoc(doc(db, 'posts', post.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function togglePostLike(post: PostItem, actor: UserProfile, currentlyLiked: boolean): Promise<boolean> {
  const likeRef = doc(db, 'posts', post.id, 'likes', actor.uid);
  const postRef = doc(db, 'posts', post.id);
  const path = `posts/${post.id}/likes/${actor.uid}`;

  try {
    const batch = writeBatch(db);
    if (currentlyLiked) {
      batch.delete(likeRef);
      batch.update(postRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return false;
    } else {
      batch.set(likeRef, {
        userId: actor.uid,
        targetId: post.id,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await createNotification({
        recipientId: post.authorId,
        actor,
        type: 'like',
        targetId: post.id,
        message: `${actor.displayName} liked your post.`,
      });
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addPostComment(post: PostItem, actor: UserProfile, text: string): Promise<void> {
  const cleanText = clip(text, BLUEPRINT_LIMITS.COMMENT_MAX);
  if (!cleanText) return;
  const commentId = generateSafeId('cmt');
  const path = `posts/${post.id}/comments/${commentId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'posts', post.id, 'comments', commentId), {
      id: commentId,
      targetId: post.id,
      authorId: actor.uid,
      authorName: clip(actor.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      authorPhoto: clip(actor.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      text: cleanText,
      status: 'active',
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'posts', post.id), {
      commentsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    await createNotification({
      recipientId: post.authorId,
      actor,
      type: 'comment',
      targetId: post.id,
      message: `${actor.displayName} commented: "${cleanText.slice(0, 80)}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function sharePost(post: PostItem): Promise<void> {
  const path = `posts/${post.id}`;
  try {
    await updateDoc(doc(db, 'posts', post.id), {
      sharesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createReel(params: {
  author: UserProfile;
  posterUrl: string;
  videoUrl: string;
  durationSec: number;
  caption: string;
  hashtags: string[];
  musicTitle: string;
  musicPresetId: string;
  allowDownload: boolean;
}): Promise<string> {
  const id = generateSafeId('reel');
  const path = `reels/${id}`;
  const clampedDuration = Math.min(180, Math.max(15, Math.round(params.durationSec)));
  try {
    await setDoc(doc(db, 'reels', id), {
      id,
      authorId: params.author.uid,
      authorName: clip(params.author.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      authorUsername: clip(params.author.username, BLUEPRINT_LIMITS.USERNAME_MAX),
      authorPhoto: clip(params.author.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      posterUrl: clip(params.posterUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      videoUrl: clip(params.videoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      durationSec: clampedDuration,
      caption: clip(params.caption, BLUEPRINT_LIMITS.REEL_CAPTION_MAX),
      hashtags: params.hashtags.slice(0, BLUEPRINT_LIMITS.HASHTAGS_MAX),
      musicTitle: clip(params.musicTitle, 100),
      musicPresetId: clip(params.musicPresetId, 40),
      allowDownload: params.allowDownload,
      status: 'active',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleReelLike(reel: ReelItem, actor: UserProfile, currentlyLiked: boolean): Promise<boolean> {
  const likeRef = doc(db, 'reels', reel.id, 'likes', actor.uid);
  const reelRef = doc(db, 'reels', reel.id);
  const path = `reels/${reel.id}/likes/${actor.uid}`;

  try {
    const batch = writeBatch(db);
    if (currentlyLiked) {
      batch.delete(likeRef);
      batch.update(reelRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return false;
    } else {
      batch.set(likeRef, {
        userId: actor.uid,
        targetId: reel.id,
        createdAt: serverTimestamp(),
      });
      batch.update(reelRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await createNotification({
        recipientId: reel.authorId,
        actor,
        type: 'like',
        targetId: reel.id,
        message: `${actor.displayName} liked your reel.`,
      });
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function addReelComment(reel: ReelItem, actor: UserProfile, text: string): Promise<void> {
  const cleanText = clip(text, BLUEPRINT_LIMITS.COMMENT_MAX);
  if (!cleanText) return;
  const commentId = generateSafeId('rcmt');
  const path = `reels/${reel.id}/comments/${commentId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'reels', reel.id, 'comments', commentId), {
      id: commentId,
      targetId: reel.id,
      authorId: actor.uid,
      authorName: clip(actor.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      authorPhoto: clip(actor.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      text: cleanText,
      status: 'active',
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'reels', reel.id), {
      commentsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    await createNotification({
      recipientId: reel.authorId,
      actor,
      type: 'comment',
      targetId: reel.id,
      message: `${actor.displayName} commented on your reel: "${cleanText.slice(0, 80)}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function shareReel(reel: ReelItem, actor: UserProfile): Promise<void> {
  const path = `reels/${reel.id}`;
  try {
    await updateDoc(doc(db, 'reels', reel.id), {
      sharesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      recipientId: reel.authorId,
      actor,
      type: 'reel_share',
      targetId: reel.id,
      message: `${actor.displayName} shared your reel.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createStory(params: {
  author: UserProfile;
  mediaType: 'photo' | 'video';
  mediaUrl: string;
  caption: string;
}): Promise<string> {
  const id = generateSafeId('story');
  const path = `stories/${id}`;
  const expiresAtMs = Date.now() + 24 * 60 * 60 * 1000;
  try {
    await setDoc(doc(db, 'stories', id), {
      id,
      authorId: params.author.uid,
      authorName: clip(params.author.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      authorUsername: clip(params.author.username, BLUEPRINT_LIMITS.USERNAME_MAX),
      authorPhoto: clip(params.author.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      mediaType: params.mediaType,
      mediaUrl: clip(params.mediaUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      caption: clip(params.caption, BLUEPRINT_LIMITS.STORY_CAPTION_MAX),
      status: 'active',
      viewsCount: 0,
      expiresAtMs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function recordStoryView(story: StoryItem, viewer: UserProfile): Promise<void> {
  if (story.authorId === viewer.uid) return;
  const viewRef = doc(db, 'stories', story.id, 'views', viewer.uid);
  const path = `stories/${story.id}/views/${viewer.uid}`;
  try {
    const existingView = await getDoc(viewRef);
    if (existingView.exists()) return;

    const batch = writeBatch(db);
    batch.set(viewRef, {
      storyId: story.id,
      storyAuthorId: story.authorId,
      viewerId: viewer.uid,
      viewerName: clip(viewer.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      viewerPhoto: clip(viewer.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      viewedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'stories', story.id), {
      viewsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleFollowUser(
  currentUser: UserProfile,
  targetUser: UserProfile,
  currentlyFollowing: boolean
): Promise<boolean> {
  if (currentUser.uid === targetUser.uid) return false;
  const followId = `${currentUser.uid}_${targetUser.uid}`;
  const followRef = doc(db, 'follows', followId);
  const currentRef = doc(db, 'users', currentUser.uid);
  const targetRef = doc(db, 'users', targetUser.uid);
  const path = `follows/${followId}`;

  try {
    const batch = writeBatch(db);
    if (currentlyFollowing) {
      batch.delete(followRef);
      batch.update(currentRef, { followingCount: increment(-1), updatedAt: serverTimestamp() });
      batch.update(targetRef, { followersCount: increment(-1), updatedAt: serverTimestamp() });
      await batch.commit();
      return false;
    } else {
      batch.set(followRef, {
        followerId: currentUser.uid,
        followingId: targetUser.uid,
        createdAt: serverTimestamp(),
      });
      batch.update(currentRef, { followingCount: increment(1), updatedAt: serverTimestamp() });
      batch.update(targetRef, { followersCount: increment(1), updatedAt: serverTimestamp() });
      await batch.commit();
      await createNotification({
        recipientId: targetUser.uid,
        actor: currentUser,
        type: 'follow',
        targetId: currentUser.uid,
        message: `${currentUser.displayName} started following you.`,
      });
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function sendDirectMessage(params: {
  sender: UserProfile;
  recipient: UserProfile;
  type: ChatMessage['type'];
  text: string;
  mediaUrl?: string;
  voiceDurationSec?: number;
}): Promise<string> {
  const chatId = getChatId(params.sender.uid, params.recipient.uid);
  const sortedIds = [params.sender.uid, params.recipient.uid].sort();
  const chatRef = doc(db, 'chats', chatId);
  const messageId = generateSafeId('msg');
  const cleanText = clip(params.text, BLUEPRINT_LIMITS.MESSAGE_TEXT_MAX);
  const cleanMedia = clip(params.mediaUrl || '', BLUEPRINT_LIMITS.MEDIA_URL_MAX);
  const preview =
    params.type === 'voice'
      ? `Voice message (${params.voiceDurationSec || 5}s)`
      : params.type === 'photo'
      ? cleanText || 'Sent a photo'
      : params.type === 'video'
      ? cleanText || 'Sent a video'
      : cleanText.slice(0, 240);

  try {
    const chatSnap = await getDoc(chatRef);
    const isSenderA = sortedIds[0] === params.sender.uid;
    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        id: chatId,
        participantIds: sortedIds,
        userAId: isSenderA ? params.sender.uid : params.recipient.uid,
        userAName: clip(isSenderA ? params.sender.displayName : params.recipient.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
        userAPhoto: clip(isSenderA ? params.sender.photoUrl : params.recipient.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
        userBId: isSenderA ? params.recipient.uid : params.sender.uid,
        userBName: clip(isSenderA ? params.recipient.displayName : params.sender.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
        userBPhoto: clip(isSenderA ? params.recipient.photoUrl : params.sender.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
        lastMessage: clip(preview || 'New message', 240),
        lastSenderId: params.sender.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(chatRef, {
        lastMessage: clip(preview || 'New message', 240),
        lastSenderId: params.sender.uid,
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(doc(db, 'chats', chatId, 'messages', messageId), {
      id: messageId,
      chatId,
      participantIds: sortedIds,
      senderId: params.sender.uid,
      senderName: clip(params.sender.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      type: params.type,
      text: cleanText,
      mediaUrl: cleanMedia,
      voiceDurationSec: Math.min(120, Math.max(0, Math.round(params.voiceDurationSec || 0))),
      createdAt: serverTimestamp(),
    });

    if (params.type === 'story_reply') {
      await createNotification({
        recipientId: params.recipient.uid,
        actor: params.sender,
        type: 'story_reply',
        targetId: chatId,
        message: `${params.sender.displayName} replied to your story: "${cleanText.slice(0, 80)}"`,
      });
    }

    return chatId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages/${messageId}`);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Pick<UserProfile, 'displayName' | 'username' | 'photoUrl' | 'bio' | 'isPrivate' | 'allowReelDownloads'>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: clip(updates.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'Connectify User',
      username: sanitizeUsername(updates.username, uid.slice(0, 6)),
      photoUrl: clip(updates.photoUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      bio: clip(updates.bio, BLUEPRINT_LIMITS.BIO_MAX),
      isPrivate: updates.isPrivate,
      allowReelDownloads: updates.allowReelDownloads,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPrivateSettings(
  uid: string,
  updates: Partial<Pick<UserPrivate, 'blockedUserIds' | 'savedPostIds' | 'language' | 'theme'>>
): Promise<void> {
  const path = `user_private/${uid}`;
  try {
    await updateDoc(doc(db, 'user_private', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitReport(params: {
  reporter: UserProfile;
  targetType: 'user' | 'post' | 'reel';
  targetId: string;
  reason: string;
  details: string;
}): Promise<void> {
  const id = generateSafeId('rep');
  const path = `reports/${id}`;
  try {
    await setDoc(doc(db, 'reports', id), {
      id,
      reporterId: params.reporter.uid,
      reporterName: clip(params.reporter.displayName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
      targetType: params.targetType,
      targetId: clip(params.targetId, 128),
      reason: clip(params.reason, BLUEPRINT_LIMITS.REASON_MAX),
      details: clip(params.details, BLUEPRINT_LIMITS.DETAILS_MAX),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitSupportTicket(uid: string, subject: string, message: string): Promise<void> {
  const id = generateSafeId('tkt');
  const path = `support_tickets/${id}`;
  try {
    await setDoc(doc(db, 'support_tickets', id), {
      id,
      userId: uid,
      subject: clip(subject, BLUEPRINT_LIMITS.SUBJECT_MAX),
      message: clip(message, BLUEPRINT_LIMITS.TICKET_MESSAGE_MAX),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAccountData(uid: string): Promise<void> {
  try {
    await Promise.all([deleteDoc(doc(db, 'users', uid)), deleteDoc(doc(db, 'user_private', uid))]);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}

// Admin Moderation Actions
export async function adminSetUserStatus(
  targetUid: string,
  updates: { isBanned?: boolean; isVerified?: boolean }
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRemoveContent(targetType: 'post' | 'reel', targetId: string): Promise<void> {
  const colName = targetType === 'post' ? 'posts' : 'reels';
  const path = `${colName}/${targetId}`;
  try {
    await updateDoc(doc(db, colName, targetId), {
      status: 'removed',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminResolveReport(reportId: string, status: 'resolved' | 'dismissed'): Promise<void> {
  const path = `reports/${reportId}`;
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminCloseSupportTicket(ticketId: string): Promise<void> {
  const path = `support_tickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'support_tickets', ticketId), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
