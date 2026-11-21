import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          compact
            ? 'min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer'
            : 'w-full min-h-[42px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer'
        }
        aria-label="Install Connectify App"
      >
        {isInstallable ? <Download className="w-4 h-4 text-rose-600" /> : <Smartphone className="w-4 h-4 text-rose-600" />}
        {!compact && <span>{isInstallable ? 'Install App' : 'Android App / APK'}</span>}
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-rose-600" />
                <h3 className="font-display font-bold text-base text-zinc-950 dark:text-white">
                  {isIOS ? 'Install Connectify on iOS' : 'Install Connectify on Android'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-sm text-zinc-600 dark:text-zinc-300 space-y-2 list-decimal pl-5">
                <li>Tap the <strong>Share</strong> button in Safari.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> to launch Connectify full-screen.</li>
              </ol>
            ) : (
              <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Option 1: Instant Android Install (No APK download needed)
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-xs">
                  <li>Open Connectify in Chrome on your Android phone.</li>
                  <li>Tap the <strong>⋮ menu</strong> (top-right) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                </ol>

                <p className="font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
                  Option 2: Build Play Store APK / AAB (Capacitor)
                </p>
                <pre className="rounded-xl bg-zinc-100 dark:bg-zinc-900 p-3 text-[11px] font-mono overflow-x-auto text-zinc-800 dark:text-zinc-200">
{`npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android`}
                </pre>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[42px] rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-6 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Cached content shown</span>
    </div>
  );
};
