import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Film, Globe, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { GENERATED_ASSETS, type LanguageCode } from '../types';
import { t } from '../utils/i18n';
import { SafeImage } from './SafeImage';

interface AuthGateProps {
  language: LanguageCode;
  onToggleLanguage: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ language, onToggleLanguage }) => {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled.';
      setError(msg.includes('popup-closed') ? 'Sign-in popup was closed. Please try again.' : msg);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] text-[#09090B] dark:text-[#FAFAFA] flex flex-col">
      {/* Clean Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-8">
        <span className="text-xl font-display font-extrabold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0">
          Connectify
        </span>
        <button
          type="button"
          onClick={onToggleLanguage}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          {language === 'en' ? 'हिन्दी' : 'English'}
        </button>
      </header>

      {/* Main 2-Column Editorial Split */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
        {/* Left: Visual Showcase Grid */}
        <div className="lg:col-span-7 grid grid-cols-12 gap-4 min-h-[340px]">
          <div className="col-span-7 relative rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-900">
            <SafeImage
              src={GENERATED_ASSETS.postJaipur}
              alt="Golden hour courtyard photography shared on Connectify"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5">
              <p className="text-white text-sm font-semibold">Aarav Sharma · Jaipur</p>
              <p className="text-white/80 text-xs mt-0.5">Multi-photo carousels & stories</p>
            </div>
          </div>
          <div className="col-span-5 relative rounded-2xl overflow-hidden bg-zinc-200 dark:bg-zinc-900">
            <SafeImage
              src={GENERATED_ASSETS.reelHimalaya}
              alt="Vertical Himalayan dawn reel on Connectify"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4">
              <p className="text-white text-xs font-semibold">Reels · 0:42</p>
              <p className="text-white/80 text-xs mt-0.5">Music & creator controls</p>
            </div>
          </div>
        </div>

        {/* Right: Sign-In Card */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] p-7 sm:p-9 space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight leading-tight text-zinc-950 dark:text-white [text-wrap:balance]">
                {language === 'hi'
                  ? 'अपनी कहानियाँ, रील्स और चैट एक ही जगह साझा करें।'
                  : 'Stories, vertical reels, and real-time chat in one place.'}
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {language === 'hi'
                  ? 'Connectify पर फोटो कैरोसेल, 15 सेकंड से 3 मिनट की रील्स, 24 घंटे की स्टोरी और सुरक्षित चैट का अनुभव करें।'
                  : 'Create multi-photo posts, watch 15s to 3-minute reels with music, publish 24-hour stories, and connect privately.'}
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-3">
                <Film className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{language === 'hi' ? 'म्यूजिक और डाउनलोड कंट्रोल के साथ रील्स' : 'Reels with custom soundtracks & download controls'}</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{language === 'hi' ? 'फोटो, वीडियो और वॉइस नोट्स के साथ लाइव चैट' : 'Direct chat with photos, voice messages & call preview'}</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{language === 'hi' ? 'प्राइवेसी सेटिंग और एडमिन मॉडरेशन सुरक्षा' : 'Verified Firebase Auth, privacy controls & moderation'}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={signingIn}
              onClick={handleGoogleSignIn}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{signingIn ? 'Signing in...' : t(language, 'signInGoogle')}</span>
            </button>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {language === 'hi'
                ? 'Firebase Authentication द्वारा सुरक्षित। साइन इन करके आप Connectify कम्युनिटी गाइडलाइंस से सहमत होते हैं।'
                : 'Secured with Firebase Authentication. Sign in with your Google account to access your personalized feed and profile.'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
