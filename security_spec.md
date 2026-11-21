# Connectify Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **PII Isolation**: User email, blocked user IDs, and saved posts live strictly in `/user_private/{userId}` and are readable/writable only by `userId == request.auth.uid` or a verified Admin. Public `/users/{userId}` never stores PII.
2. **Role Integrity**: Regular users cannot create or update `isVerified: true`, `isBanned: true`, or write to `/admins/{userId}`. Only verified admins (`request.auth.token.email == 'aneetkum52dss@gmail.com' && request.auth.token.email_verified == true` or `/admins/{uid}`) hold elevated moderation permissions.
3. **Master Gate Relational Sync**: Likes and comments under `/posts/{postId}` and `/reels/{reelId}`, views under `/stories/{storyId}`, and messages under `/chats/{chatId}` must validate parent existence via `exists()`/`get()`, and chat messages strictly verify `request.auth.uid in parent.participantIds`.
4. **Atomicity Guarantee**: Creating/deleting a post or reel like must atomically adjust the parent document's `likesCount` by exactly `+1` or `-1` in the same batch (`getAfter()`).
5. **Terminal State Locking**: Once a `Report` reaches `resolved` or `dismissed`, or a `SupportTicket` reaches `closed`, non-admin updates are permanently rejected.
6. **Temporal & Volumetric Integrity**: Every `createdAt` equals `request.time` on creation and is immutable thereafter. Every `updatedAt` equals `request.time` on update. All string fields enforce explicit `.size()` ceilings and all document IDs enforce `isValidId()`.
7. **Secure List Queries**: Zero blanket `allow list: if isSignedIn();`. Every `allow list` validates `resource.data` directly without `get()`/`exists()` calls.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Assigned Admin / Verification Spoof**: Non-admin creating `/users/{uid}` with `isVerified: true` or `isBanned: true`.
2. **Ghost Shadow Field Injection**: Updating `/posts/{postId}` with an undeclared field `boostScore: 9999`.
3. **Author Identity Spoofing**: Creating a post with `authorId: "victim_uid"` while authenticated as `"attacker_uid"`.
4. **PII Snooping**: Authenticated user reading `/user_private/other_user_uid`.
5. **Email Spoofing Without Verification**: Authenticating with admin email but `email_verified: false` to access `/reports`.
6. **ID Poisoning**: Creating `/posts/<200-char-junk-id>` or special characters `../admin`.
7. **Value Poisoning on Allowed Key**: Updating `/posts/{postId}.caption` with a 5000-char string (exceeding 1000 maxLength) or boolean.
8. **Orphaned Subcollection Write**: Creating `/posts/nonexistent_post/comments/c1`.
9. **Non-Atomic Like Inflation**: Updating `/posts/{postId}.likesCount` by `+100` without creating `/posts/{postId}/likes/{uid}`.
10. **Chat Intrusion**: Reading or writing `/chats/userA_userB/messages/m1` as `userC`.
11. **Terminal Report Tampering**: Non-admin modifying a `resolved` report back to `open`.
12. **Client Timestamp Forgery**: Creating a post with a backdated client timestamp `createdAt != request.time`.
