import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { submitReport } from '../services/firestoreService';
import type { UserProfile } from '../types';

interface ReportModalProps {
  reporter: UserProfile;
  targetType: 'user' | 'post' | 'reel';
  targetId: string;
  targetLabel: string;
  onClose: () => void;
  onSubmitted: (msg: string) => void;
}

const REASONS = [
  'Spam or misleading content',
  'Fake account / impersonation',
  'Harassment or hate speech',
  'Inappropriate or explicit media',
  'Copyright or stolen content',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  reporter,
  targetType,
  targetId,
  targetLabel,
  onClose,
  onSubmitted,
}) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitReport({
        reporter,
        targetType,
        targetId,
        reason,
        details: details.trim() || `Reported ${targetType}: ${targetLabel}`,
      });
      onSubmitted('Report submitted for Admin review.');
      onClose();
    } catch (err) {
      console.error(err);
      onSubmitted('Could not submit report right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Flag className="w-4 h-4 text-rose-600" />
            <h3 className="font-display font-bold text-base text-zinc-950 dark:text-white">
              Report {targetType}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Target: <span className="font-medium text-zinc-800 dark:text-zinc-200">{targetLabel}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Select a reason
            </label>
            <div className="space-y-1.5">
              {REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReason(item)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm border transition-colors cursor-pointer ${
                    reason === item
                      ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Additional details (optional)
            </label>
            <textarea
              rows={3}
              maxLength={450}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Share any context for the Connectify moderation team..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600/40"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
