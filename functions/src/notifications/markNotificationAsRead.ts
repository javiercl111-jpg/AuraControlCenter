import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const markNotificationAsRead = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { eventId } = request.data;
  if (!eventId || typeof eventId !== 'string') {
    throw new HttpsError('invalid-argument', 'eventId is required and must be a string.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  try {
    await db.runTransaction(async (t) => {
      const inboxRef = db.doc(`platform_inbox/${uid}`);
      const notifRef = inboxRef.collection('notifications').doc(eventId);

      const notifSnap = await t.get(notifRef);

      if (!notifSnap.exists) {
        throw new HttpsError('not-found', 'Notification not found.');
      }

      const data = notifSnap.data();
      if (data?.isRead === true) {
        return; // Idempotent success
      }

      const inboxSnap = await t.get(inboxRef);
      const currentUnread = inboxSnap.data()?.unreadCount || 0;

      t.update(notifRef, {
        isRead: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
      });

      t.update(inboxRef, {
        unreadCount: Math.max(0, currentUnread - 1)
      });
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("Error marking notification as read", error);
    throw new HttpsError('internal', 'An error occurred while marking notification as read.');
  }
});
