import React, { useState } from 'react';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import {
  Ban,
  Globe,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  deleteAccountData,
  submitSupportTicket,
  updateUserPrivateSettings,
  updateUserProfile,
} from '../services/firestoreService';
import type { LanguageCode, ThemeMode, UserPrivate, UserProfile } from '../types';
import { t } from '../utils/i18n';

interface SettingsModalProps {
  currentUser: UserProfile;
  userPrivate: UserPrivate;
  usersMap: Record<string, UserProfile>;
  onClose: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onUnblockUser: (uid: string) => void;
  onToast: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  userPrivate,
  usersMap,
  onClose,
  onLanguageChange,
  onThemeChange,
  onUnblockUser,
  onToast,
}) => {
  const [section, setSection] = useState<'privacy' | 'security' | 'blocked' | 'support' | 'delete'>('privacy');
  const [isPrivate, setIsPrivate] = useState(currentUser.isPrivate);
  const [allowReelDownloads, setAllowReelDownloads] = useState(currentUser.allowReelDownloads);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Support ticket state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Account delete confirmation
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const lang = userPrivate.language;

  const handleSavePrivacy = async (nextPrivate: boolean, nextDownloads: boolean) => {
    setIsPrivate(nextPrivate);
    setAllowReelDownloads(nextDownloads);
    setSavingPrivacy(true);
    try {
      await updateUserProfile(currentUser.uid, {
        displayName: currentUser.displayName,
        username: currentUser.username,
        photoUrl: currentUser.photoUrl,
        bio: currentUser.bio,
        isPrivate: nextPrivate,
        allowReelDownloads: nextDownloads,
      });
      onToast('Privacy preferences saved');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!userPrivate.email) {
      onToast('No email linked to this account.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, userPrivate.email);
      onToast(`Password reset instructions sent to ${userPrivate.email}`);
    } catch {
      onToast('Google-linked accounts manage passwords directly in Google Account Security.');
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 2 || message.trim().length < 5) return;
    setSubmittingTicket(true);
    try {
      await submitSupportTicket(currentUser.uid, subject.trim(), message.trim());
      setSubject('');
      setMessage('');
      onToast('Support request submitted to Connectify Help Desk.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmDeleteText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccountData(currentUser.uid);
      await signOut(auth);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleLanguage = async (nextLang: LanguageCode) => {
    onLanguageChange(nextLang);
    await updateUserPrivateSettings(currentUser.uid, { language: nextLang }).catch(() => undefined);
  };

  const handleTheme = async (nextTheme: ThemeMode) => {
    onThemeChange(nextTheme);
    await updateUserPrivateSettings(currentUser.uid, { theme: nextTheme }).catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-zinc-950 dark:text-white">
            Connectify {t(lang, 'settings')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-12">
          {/* Left Settings Navigation */}
          <nav className="sm:col-span-4 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-800 p-3 flex sm:flex-col gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'privacy', label: t(lang, 'privacySettings'), icon: Lock },
              { id: 'security', label: t(lang, 'passwordChange'), icon: KeyRound },
              { id: 'blocked', label: t(lang, 'blockedUsers'), icon: Ban },
              { id: 'support', label: t(lang, 'helpSupport'), icon: HelpCircle },
              { id: 'delete', label: t(lang, 'deleteAccount'), icon: Trash2 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id as typeof section)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    section === item.id
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}

            <div className="hidden sm:block pt-4 mt-auto border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 inline-flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                {t(lang, 'signOut')}
              </button>
            </div>
          </nav>

          {/* Right Settings Content */}
          <div className="sm:col-span-8 p-6 space-y-6">
            {section === 'privacy' && (
              <div className="space-y-5">
                <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                  {t(lang, 'privacySettings')} & Preferences
                </h3>

                <label className="flex items-start justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {t(lang, 'privateAccount')}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Limit new post visibility and show a privacy badge on your profile.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={savingPrivacy}
                    checked={isPrivate}
                    onChange={(e) => void handleSavePrivacy(e.target.checked, allowReelDownloads)}
                    className="w-5 h-5 mt-0.5 accent-rose-600"
                  />
                </label>

                <label className="flex items-start justify-between gap-4 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {t(lang, 'allowReelDownloads')}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      When enabled, viewers can save your uploaded Reels.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    disabled={savingPrivacy}
                    checked={allowReelDownloads}
                    onChange={(e) => void handleSavePrivacy(isPrivate, e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-rose-600"
                  />
                </label>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <Globe className="w-4 h-4 text-zinc-500" />
                      {t(lang, 'language')}
                    </span>
                    <div className="flex gap-1.5">
                      {(['en', 'hi'] as const).map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => void handleLanguage(code)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            lang === code
                              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {code === 'en' ? 'English' : 'हिन्दी'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      {userPrivate.theme === 'dark' ? (
                        <Moon className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <Sun className="w-4 h-4 text-zinc-500" />
                      )}
                      {t(lang, 'appearance')}
                    </span>
                    <div className="flex gap-1.5">
                      {(['light', 'dark'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => void handleTheme(mode)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                            userPrivate.theme === mode
                              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === 'security' && (
              <div className="space-y-4">
                <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                  {t(lang, 'passwordChange')}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Signed in as <span className="font-semibold text-zinc-900 dark:text-zinc-100">{userPrivate.email}</span> via Firebase Google Authentication.
                </p>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="px-4 py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                >
                  Send Password Reset Email
                </button>
              </div>
            )}

            {section === 'blocked' && (
              <div className="space-y-4">
                <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                  {t(lang, 'blockedUsers')} ({userPrivate.blockedUserIds.length})
                </h3>
                {userPrivate.blockedUserIds.length === 0 ? (
                  <p className="text-sm text-zinc-500">You have not blocked any users.</p>
                ) : (
                  <div className="space-y-2.5">
                    {userPrivate.blockedUserIds.map((uid) => {
                      const blockedProfile = usersMap[uid];
                      return (
                        <div
                          key={uid}
                          className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800"
                        >
                          <span className="text-sm font-medium">
                            {blockedProfile ? `${blockedProfile.displayName} (@${blockedProfile.username})` : uid}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUnblockUser(uid)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            {t(lang, 'unblock')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {section === 'support' && (
              <form onSubmit={handleSupportSubmit} className="space-y-4">
                <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                  {t(lang, 'helpSupport')}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Need help with your account, reports, or reels? Send a ticket directly to the Connectify Admin team.
                </p>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject (e.g. Account Verification or Bug Report)"
                  className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 text-sm"
                />
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question or issue..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {submittingTicket ? 'Submitting...' : 'Submit Support Request'}
                </button>
              </form>
            )}

            {section === 'delete' && (
              <div className="space-y-4">
                <h3 className="font-display font-bold text-sm text-rose-600">
                  {t(lang, 'deleteAccount')}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  This permanently removes your Connectify profile and private settings from Firestore and signs you out. Type <span className="font-mono font-bold text-zinc-900 dark:text-white">DELETE</span> to confirm.
                </p>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full min-h-[42px] rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 px-3.5 text-sm"
                />
                <button
                  type="button"
                  disabled={confirmDeleteText !== 'DELETE' || deleting}
                  onClick={handleDeleteAccount}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                </button>
              </div>
            )}

            {/* Mobile Sign Out */}
            <div className="sm:hidden pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                {t(lang, 'signOut')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
