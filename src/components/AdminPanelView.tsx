import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Ban,
  CheckCircle2,
  Film,
  Flag,
  HelpCircle,
  Image as ImageIcon,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  adminCloseSupportTicket,
  adminRemoveContent,
  adminResolveReport,
  adminSetUserStatus,
} from '../services/firestoreService';
import type { PostItem, ReelItem, ReportItem, SupportTicketItem, UserProfile } from '../types';
import { formatRelativeTime } from '../utils/media';
import { SafeImage } from './SafeImage';

interface AdminPanelViewProps {
  currentUser: UserProfile;
  onToast: (msg: string) => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({ currentUser, onToast }) => {
  const [tab, setTab] = useState<'reports' | 'users' | 'content' | 'support'>('reports');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allPosts, setAllPosts] = useState<PostItem[]>([]);
  const [allReels, setAllReels] = useState<ReelItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => setAllUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    const unsubPosts = onSnapshot(
      collection(db, 'posts'),
      (snap) => setAllPosts(snap.docs.map((d) => d.data() as PostItem)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'posts')
    );
    const unsubReels = onSnapshot(
      collection(db, 'reels'),
      (snap) => setAllReels(snap.docs.map((d) => d.data() as ReelItem)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'reels')
    );
    const unsubReports = onSnapshot(
      collection(db, 'reports'),
      (snap) =>
        setReports(
          snap.docs
            .map((d) => d.data() as ReportItem)
            .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
    );
    const unsubTickets = onSnapshot(
      collection(db, 'support_tickets'),
      (snap) =>
        setTickets(
          snap.docs
            .map((d) => d.data() as SupportTicketItem)
            .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'support_tickets')
    );

    return () => {
      unsubUsers();
      unsubPosts();
      unsubReels();
      unsubReports();
      unsubTickets();
    };
  }, []);

  const openReportsCount = reports.filter((r) => r.status === 'open').length;
  const activePosts = allPosts.filter((p) => p.status === 'active');
  const activeReels = allReels.filter((r) => r.status === 'active');

  const handleToggleBan = async (u: UserProfile) => {
    if (u.uid === currentUser.uid) return;
    await adminSetUserStatus(u.uid, { isBanned: !u.isBanned });
    onToast(u.isBanned ? `Unblocked @${u.username}` : `Blocked account @${u.username}`);
  };

  const handleToggleVerify = async (u: UserProfile) => {
    await adminSetUserStatus(u.uid, { isVerified: !u.isVerified });
    onToast(u.isVerified ? `Removed badge from @${u.username}` : `Verified @${u.username}`);
  };

  const handleRemovePost = async (id: string) => {
    await adminRemoveContent('post', id);
    onToast('Post removed from Connectify');
  };

  const handleRemoveReel = async (id: string) => {
    await adminRemoveContent('reel', id);
    onToast('Reel removed from Connectify');
  };

  const handleReportAction = async (report: ReportItem, action: 'dismiss' | 'enforce') => {
    if (action === 'enforce') {
      if (report.targetType === 'user') {
        await adminSetUserStatus(report.targetId, { isBanned: true });
      } else {
        await adminRemoveContent(report.targetType, report.targetId);
      }
      await adminResolveReport(report.id, 'resolved');
      onToast('Enforcement applied & report resolved');
    } else {
      await adminResolveReport(report.id, 'dismissed');
      onToast('Report dismissed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-zinc-950 dark:text-white">
              Connectify Admin Panel
            </h1>
            <p className="text-xs text-zinc-500">
              Manage users, remove inappropriate posts/reels, handle fake accounts & complaints
            </p>
          </div>
        </div>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Registered Users', value: allUsers.length, sub: `${allUsers.filter((u) => u.isBanned).length} blocked` },
          { label: 'Active Posts & Reels', value: activePosts.length + activeReels.length, sub: `${activePosts.length} posts · ${activeReels.length} reels` },
          { label: 'Open Complaints', value: openReportsCount, sub: `${reports.length} total reports` },
          { label: 'Open Support Tickets', value: tickets.filter((t) => t.status === 'open').length, sub: `${tickets.length} total tickets` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-4 space-y-1"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
            <p className="text-2xl font-display font-bold text-zinc-950 dark:text-white tabular-nums">
              {kpi.value}
            </p>
            <p className="text-xs text-zinc-400 tabular-nums">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Interactive Section Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'reports', label: `Complaints (${openReportsCount})`, icon: Flag },
          { id: 'users', label: `Users (${allUsers.length})`, icon: Users },
          { id: 'content', label: `Posts & Reels (${activePosts.length + activeReels.length})`, icon: ImageIcon },
          { id: 'support', label: `Help Desk (${tickets.length})`, icon: HelpCircle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                tab === item.id
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-white dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Complaints / Reports Queue */}
      {tab === 'reports' && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] divide-y divide-zinc-100 dark:divide-zinc-800">
          {reports.length === 0 ? (
            <p className="p-10 text-center text-sm text-zinc-500">No complaints submitted yet.</p>
          ) : (
            reports.map((rep) => (
              <div key={rep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-semibold uppercase text-zinc-800 dark:text-zinc-200">
                      {rep.targetType}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Reported by {rep.reporterName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(rep.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className={rep.status === 'open' ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                      {rep.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">{rep.reason}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{rep.details}</p>
                  <p className="text-[11px] font-mono text-zinc-400">Target ID: {rep.targetId}</p>
                </div>

                {rep.status === 'open' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleReportAction(rep, 'dismiss')}
                      className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReportAction(rep, 'enforce')}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      {rep.targetType === 'user' ? 'Block User & Resolve' : 'Remove Item & Resolve'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Users Directory & Fake Account Enforcement */}
      {tab === 'users' && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] divide-y divide-zinc-100 dark:divide-zinc-800">
          {allUsers.map((u) => (
            <div key={u.uid} className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <SafeImage
                  src={u.photoUrl}
                  alt={u.displayName}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">
                      {u.displayName}
                    </p>
                    {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
                  </div>
                  <p className="text-xs text-zinc-500 tabular-nums">
                    @{u.username} · {u.followersCount} followers ·{' '}
                    <span className={u.isBanned ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                      {u.isBanned ? 'Blocked' : 'Active'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleVerify(u)}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {u.isVerified ? 'Unverify' : 'Verify'}
                </button>
                {u.uid !== currentUser.uid && (
                  <button
                    type="button"
                    onClick={() => void handleToggleBan(u)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      u.isBanned
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white hover:bg-rose-700'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {u.isBanned ? 'Restore' : 'Block Account'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Moderation (Posts & Reels) */}
      {tab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-4 space-y-3">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-rose-600" /> Active Posts ({activePosts.length})
            </h3>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {activePosts.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <SafeImage
                      src={p.mediaUrls[0] || ''}
                      alt={p.caption || 'Post'}
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">@{p.authorUsername}</p>
                      <p className="text-xs text-zinc-500 truncate">{p.caption || 'No caption'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemovePost(p.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] p-4 space-y-3">
            <h3 className="font-display font-bold text-sm flex items-center gap-2">
              <Film className="w-4 h-4 text-rose-600" /> Active Reels ({activeReels.length})
            </h3>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {activeReels.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <SafeImage
                      src={r.posterUrl}
                      alt={r.caption || 'Reel'}
                      className="w-10 h-14 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">@{r.authorUsername}</p>
                      <p className="text-xs text-zinc-500 truncate">{r.caption}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveReel(r.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help & Support Tickets */}
      {tab === 'support' && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#141417] divide-y divide-zinc-100 dark:divide-zinc-800">
          {tickets.length === 0 ? (
            <p className="p-10 text-center text-sm text-zinc-500">No support tickets yet.</p>
          ) : (
            tickets.map((tkt) => (
              <div key={tkt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono">{tkt.userId.slice(0, 10)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(tkt.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className={tkt.status === 'open' ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                      {tkt.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">{tkt.subject}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{tkt.message}</p>
                </div>
                {tkt.status === 'open' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await adminCloseSupportTicket(tkt.id);
                      onToast('Ticket marked closed');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Close Ticket
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
