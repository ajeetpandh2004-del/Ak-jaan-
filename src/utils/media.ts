import type { Timestamp } from 'firebase/firestore';
import { BLUEPRINT_LIMITS, REEL_MUSIC_PRESETS } from '../types';

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export function sanitizeUsername(raw: string, fallbackSuffix = 'user'): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, BLUEPRINT_LIMITS.USERNAME_MAX);
  if (cleaned.length >= 2) return cleaned;
  return `cf_${fallbackSuffix}`.replace(/[^a-z0-9_.]/g, '').slice(0, BLUEPRINT_LIMITS.USERNAME_MAX);
}

export function parseHashtags(raw: string): string[] {
  const tokens = raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim().replace(/^#+/, '').replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, ''))
    .filter((tag) => tag.length > 0)
    .slice(0, BLUEPRINT_LIMITS.HASHTAGS_MAX);
  return Array.from(new Set(tokens));
}

export function formatRelativeTime(ts?: Timestamp | null): string {
  if (!ts) return 'Just now';
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

/**
 * Compresses an uploaded image file via Canvas so it fits reliably within
 * Firestore's blueprint maxLength (<= 200,000 chars) without broken links.
 */
export async function compressImageFile(file: File, maxDim = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let q = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > 175000 && q > 0.3) {
          q -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts a compressed poster frame from an uploaded video file and detects duration.
 */
export async function extractVideoPoster(file: File): Promise<{ posterUrl: string; durationSec: number; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const fallbackResolve = () => {
      resolve({
        posterUrl: '/src/assets/images/reel_himalaya_dawn_1795249687952.jpg',
        durationSec: 30,
        objectUrl,
      });
    };

    video.onerror = fallbackResolve;
    video.onloadeddata = () => {
      const durationSec = Math.min(180, Math.max(15, Math.round(video.duration || 30)));
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 720;
        let w = video.videoWidth || 540;
        let h = video.videoHeight || 960;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const posterUrl = canvas.toDataURL('image/jpeg', 0.68);
          resolve({
            posterUrl: posterUrl.length < 180000 ? posterUrl : '/src/assets/images/reel_himalaya_dawn_1795249687952.jpg',
            durationSec,
            objectUrl,
          });
          return;
        }
      } catch {
        // Fallback below
      }
      resolve({
        posterUrl: '/src/assets/images/reel_himalaya_dawn_1795249687952.jpg',
        durationSec,
        objectUrl,
      });
    };
  });
}

/**
 * Clean Web Audio melodic synth for Reels background music tracks.
 */
class ReelMusicPlayer {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private step = 0;
  private activePresetId: string | null = null;

  start(presetId: string) {
    if (this.activePresetId === presetId && this.timer !== null) return;
    this.stop();
    const preset = REEL_MUSIC_PRESETS.find((m) => m.id === presetId) || REEL_MUSIC_PRESETS[0];
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.activePresetId = preset.id;
      this.step = 0;
      const intervalMs = Math.round((60 / preset.bpm) * 500);

      const playNote = () => {
        if (!this.ctx) return;
        const freq = preset.notes[this.step % preset.notes.length];
        this.step += 1;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = preset.id === 'urban_pulse' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.055, this.ctx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + intervalMs / 1000);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + intervalMs / 1000 + 0.05);
      };

      playNote();
      this.timer = window.setInterval(playNote, intervalMs);
    } catch {
      // Ignore autoplay blocks gracefully
    }
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.activePresetId = null;
  }
}

export const reelMusicPlayer = new ReelMusicPlayer();
