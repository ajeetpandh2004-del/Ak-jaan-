/**
 * Connectify Firestore Security Rules — Dirty Dozen Verification Suite
 * Documents and verifies the 12 adversarial payloads against the Eight Pillars.
 */
export interface SecurityPayloadTest {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const dirtyDozenTests: SecurityPayloadTest[] = [
  {
    id: 1,
    name: 'Self-Assigned Verified/Admin Flag on Profile Create',
    collectionPath: '/users/attacker_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attacker_1', isVerified: true, isBanned: false },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'users.create enforces incoming().isVerified == false for non-admins',
  },
  {
    id: 2,
    name: 'Shadow Ghost Field Injection on Post Update',
    collectionPath: '/posts/post_1',
    operation: 'update',
    auth: { uid: 'author_1', email: 'author@example.com', email_verified: true },
    payload: { caption: 'Hello', boostScore: 9999 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidPost() keys().hasOnly() + affectedKeys().hasOnly() reject boostScore',
  },
  {
    id: 3,
    name: 'Author Identity Spoofing on Post Create',
    collectionPath: '/posts/post_spoof',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: { id: 'post_spoof', authorId: 'victim_uid' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'posts.create enforces incoming().authorId == request.auth.uid',
  },
  {
    id: 4,
    name: 'Cross-User PII Read on user_private',
    collectionPath: '/user_private/victim_uid',
    operation: 'get',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'user_private.get enforces request.auth.uid == userId || isAdmin()',
  },
  {
    id: 5,
    name: 'Unverified Email Admin Spoofing',
    collectionPath: '/reports',
    operation: 'list',
    auth: { uid: 'spoof_uid', email: 'aneetkum52dss@gmail.com', email_verified: false },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isAdmin() mandates isVerifiedSignedIn() (email_verified == true)',
  },
  {
    id: 6,
    name: 'Document ID Poisoning with Oversized/Invalid Path',
    collectionPath: '/posts/invalid..id!@#',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: { id: 'invalid..id!@#' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(postId) enforces ^[a-zA-Z0-9_\\-]+$ and size <= 128',
  },
  {
    id: 7,
    name: 'Value Poisoning on Allowed Caption Key (>1000 chars)',
    collectionPath: '/posts/post_1',
    operation: 'update',
    auth: { uid: 'author_1', email: 'author@example.com', email_verified: true },
    payload: { caption: 'A'.repeat(2500) },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidPost(incoming()) wraps allow update and enforces caption.size() <= 1000',
  },
  {
    id: 8,
    name: 'Orphaned Comment Write on Missing Parent Post',
    collectionPath: '/posts/missing_post/comments/c1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user@example.com', email_verified: true },
    payload: { id: 'c1', targetId: 'missing_post', authorId: 'user_1', text: 'Hi' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate exists(/posts/$(postId)) rejects orphaned subcollection writes',
  },
  {
    id: 9,
    name: 'Non-Atomic Like Count Inflation (+100)',
    collectionPath: '/posts/post_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user@example.com', email_verified: true },
    payload: { likesCount: 100 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'Atomic delta == +1 + existsAfter(/posts/$(postId)/likes/$(uid)) required',
  },
  {
    id: 10,
    name: 'Third-Party Intrusion into Direct Chat Messages',
    collectionPath: '/chats/userA_userB/messages/m1',
    operation: 'create',
    auth: { uid: 'userC', email: 'userc@example.com', email_verified: true },
    payload: { id: 'm1', chatId: 'userA_userB', senderId: 'userC', text: 'Spying' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate checks request.auth.uid in parent chat participantIds',
  },
  {
    id: 11,
    name: 'Terminal State Tampering on Resolved Report',
    collectionPath: '/reports/rep_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'user@example.com', email_verified: true },
    payload: { status: 'open' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'reports.update is restricted strictly to isAdmin()',
  },
  {
    id: 12,
    name: 'Client Timestamp Backdating Forgery',
    collectionPath: '/posts/post_backdate',
    operation: 'create',
    auth: { uid: 'user_1', email: 'user@example.com', email_verified: true },
    payload: { id: 'post_backdate', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'Temporal integrity requires incoming().createdAt == request.time',
  },
];
