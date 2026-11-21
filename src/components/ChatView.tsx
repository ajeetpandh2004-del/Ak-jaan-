import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Image as ImageIcon,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Play,
  Send,
  Square,
  Video,
  VideoOff,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { sendDirectMessage } from '../services/firestoreService';
import type { ChatMessage, ChatThread, LanguageCode, UserProfile } from '../types';
import { t } from '../utils/i18n';
import { compressImageFile, formatDuration, formatRelativeTime, getChatId } from '../utils/media';
import { SafeImage } from './SafeImage';

interface ChatViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  chats: ChatThread[];
  blockedUserIds: string[];
  initialRecipientId?: string | null;
  language: LanguageCode;
  onToast: (msg: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  currentUser,
  users,
  chats,
  blockedUserIds,
  initialRecipientId,
  language,
  onToast,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialRecipientId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Voice Note Recording State
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceSec, setVoiceSec] = useState(0);
  const voiceTimerRef = useRef<number | null>(null);

  // Call Preview Overlay State (Audio / Video Call)
  const [activeCall, setActiveCall] = useState<{ mode: 'audio' | 'video'; muted: boolean; camOff: boolean } | null>(null);

  const blockedSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);

  const availablePeers = useMemo(
    () => users.filter((u) => u.uid !== currentUser.uid && !u.isBanned && !blockedSet.has(u.uid)),
    [users, currentUser.uid, blockedSet]
  );

  useEffect(() => {
    if (initialRecipientId) {
      setSelectedUserId(initialRecipientId);
    }
  }, [initialRecipientId]);

  const selectedPeer = useMemo(
    () => availablePeers.find((u) => u.uid === selectedUserId) || null,
    [availablePeers, selectedUserId]
  );

  const activeChatId = selectedPeer ? getChatId(currentUser.uid, selectedPeer.uid) : null;

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    const path = `chats/${activeChatId}/messages`;
    const q = query(
      collection(db, 'chats', activeChatId, 'messages'),
      where('participantIds', 'array-contains', currentUser.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatMessage)
          .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        setMessages(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [activeChatId, currentUser.uid]);

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
    };
  }, []);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeer || !draft.trim() || sending) return;
    setSending(true);
    try {
      await sendDirectMessage({
        sender: currentUser,
        recipient: selectedPeer,
        type: 'text',
        text: draft.trim(),
      });
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const handleSendPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPeer) return;
    setSending(true);
    try {
      const compressed = await compressImageFile(file, 720, 0.68);
      await sendDirectMessage({
        sender: currentUser,
        recipient: selectedPeer,
        type: 'photo',
        text: 'Photo attachment',
        mediaUrl: compressed,
      });
      onToast('Photo sent');
    } catch {
      onToast('Could not send attachment.');
    } finally {
      setSending(false);
    }
  };

  const toggleVoiceRecording = async () => {
    if (!selectedPeer) return;
    if (!recordingVoice) {
      setRecordingVoice(true);
      setVoiceSec(1);
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceSec((s) => Math.min(120, s + 1));
      }, 1000);
    } else {
      if (voiceTimerRef.current !== null) {
        window.clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      const duration = Math.max(1, voiceSec);
      setRecordingVoice(false);
      setVoiceSec(0);
      setSending(true);
      try {
        await sendDirectMessage({
          sender: currentUser,
          recipient: selectedPeer,
          type: 'voice',
          text: `Voice note (${formatDuration(duration)})`,
          voiceDurationSec: duration,
        });
        onToast('Voice message sent');
      } finally {
        setSending(false);
      }
    }
  };

  const getThreadPreview = (peerUid: string): ChatThread | undefined => {
    const cid = getChatId(currentUser.uid, peerUid);
    return chats.find((c) => c.id === cid);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141417] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[560px] h-[calc(100vh-156px)]">
      {/* Conversations List */}
      <div
        className={`md:col-span-4 border-r border-zinc-200/80 dark:border-zinc-800 flex flex-col ${
          selectedPeer ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="font-display font-bold text-base text-zinc-950 dark:text-white">
            {t(language, 'chat')}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {availablePeers.length === 0 ? (
            <p className="p-6 text-xs text-zinc-500 text-center">No other users to message yet.</p>
          ) : (
            availablePeers.map((peer) => {
              const thread = getThreadPreview(peer.uid);
              const isSelected = selectedUserId === peer.uid;
              return (
                <button
                  key={peer.uid}
                  type="button"
                  onClick={() => setSelectedUserId(peer.uid)}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-rose-50/70 dark:bg-rose-950/30'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <SafeImage
                    src={peer.photoUrl}
                    alt={peer.displayName}
                    className="w-11 h-11 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate">
                        {peer.displayName}
                      </p>
                      {thread?.updatedAt && (
                        <span className="text-[11px] text-zinc-400 shrink-0">
                          {formatRelativeTime(thread.updatedAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {thread ? thread.lastMessage : `@${peer.username}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Active Conversation Panel */}
      <div
        className={`md:col-span-8 flex flex-col relative ${
          selectedPeer ? 'flex' : 'hidden md:flex'
        }`}
      >
        {!selectedPeer ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t(language, 'emptyChats')}</p>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  aria-label="Back to conversations"
                  className="md:hidden min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <SafeImage
                  src={selectedPeer.photoUrl}
                  alt={selectedPeer.displayName}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-display font-bold text-zinc-950 dark:text-white truncate">
                    {selectedPeer.displayName}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">@{selectedPeer.username}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveCall({ mode: 'audio', muted: false, camOff: true })}
                  aria-label={t(language, 'audioCall')}
                  className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCall({ mode: 'video', muted: false, camOff: false })}
                  aria-label={t(language, 'videoCall')}
                  className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFAFA]/60 dark:bg-[#0C0C0F]">
              {messages.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-12">
                  Say hello to {selectedPeer.displayName}. Messages are synced in real time.
                </p>
              ) : (
                messages.map((msg) => {
                  const mine = msg.senderId === currentUser.uid;
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm space-y-1.5 ${
                          mine
                            ? 'bg-rose-600 text-white'
                            : 'bg-white dark:bg-[#1A1A1F] text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-800'
                        }`}
                      >
                        {msg.type === 'photo' && msg.mediaUrl && (
                          <SafeImage
                            src={msg.mediaUrl}
                            alt="Chat photo"
                            className="rounded-xl max-h-60 object-cover w-full"
                          />
                        )}
                        {msg.type === 'voice' ? (
                          <div className="flex items-center gap-2.5 min-w-[160px]">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                mine ? 'bg-white/20' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </span>
                            <div className="flex-1">
                              <div className="h-1.5 rounded-full bg-current opacity-25 overflow-hidden">
                                <div className="h-full w-2/3 bg-current opacity-90" />
                              </div>
                              <p className="text-[11px] mt-1 font-mono tabular-nums opacity-85">
                                {formatDuration(msg.voiceDurationSec || 5)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          msg.text && <p className="leading-relaxed break-words">{msg.text}</p>
                        )}
                        <p className={`text-[10px] ${mine ? 'text-white/75 text-right' : 'text-zinc-400'}`}>
                          {formatRelativeTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSendText}
              className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-[#141417] flex items-center gap-2"
            >
              <label
                aria-label="Send photo"
                className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
              >
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={handleSendPhoto} className="hidden" />
              </label>

              <button
                type="button"
                onClick={toggleVoiceRecording}
                aria-label={t(language, 'voiceMessage')}
                className={`min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                  recordingVoice
                    ? 'bg-rose-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {recordingVoice ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-5 h-5" />}
              </button>

              {recordingVoice ? (
                <div className="flex-1 min-h-[42px] rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3.5 flex items-center justify-between text-xs font-medium text-rose-700 dark:text-rose-300">
                  <span>Recording voice note... tap stop to send</span>
                  <span className="font-mono tabular-nums">{formatDuration(voiceSec)}</span>
                </div>
              ) : (
                <input
                  type="text"
                  maxLength={1000}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message..."
                  className="flex-1 min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600/30"
                />
              )}

              {!recordingVoice && (
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                  className="min-w-[42px] min-h-[42px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Interactive Audio / Video Call Preview Overlay */}
            {activeCall && (
              <div className="absolute inset-0 z-30 bg-zinc-950/95 text-white flex flex-col items-center justify-between p-8">
                <div className="text-center space-y-1">
                  <p className="text-xs text-zinc-400">
                    {activeCall.mode === 'video' ? 'Connectify Video Call' : 'Connectify Audio Call'}
                  </p>
                  <h3 className="text-xl font-display font-bold">{selectedPeer.displayName}</h3>
                  <p className="text-xs text-zinc-400">Ringing...</p>
                </div>

                <SafeImage
                  src={selectedPeer.photoUrl}
                  alt={selectedPeer.displayName}
                  className="w-28 h-28 rounded-full object-cover border-2 border-white/20"
                />

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveCall((c) => (c ? { ...c, muted: !c.muted } : null))}
                    className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer ${
                      activeCall.muted ? 'bg-white text-zinc-950' : 'bg-white/15 text-white'
                    }`}
                  >
                    {activeCall.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  {activeCall.mode === 'video' && (
                    <button
                      type="button"
                      onClick={() => setActiveCall((c) => (c ? { ...c, camOff: !c.camOff } : null))}
                      className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer ${
                        activeCall.camOff ? 'bg-white text-zinc-950' : 'bg-white/15 text-white'
                      }`}
                    >
                      {activeCall.camOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveCall(null)}
                    aria-label="End call"
                    className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
