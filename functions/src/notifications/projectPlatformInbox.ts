import * as admin from 'firebase-admin';

export type NotificationProjectionInput = {
  eventId: string;
  recipientUid: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  sourceModule: string;
  priority?: "LOW" | "NORMAL" | "HIGH";
  createdAt: string | number;
  context?: {
    prospectId?: string;
    dossierId?: string;
  };
};

export async function projectPlatformInbox(input: NotificationProjectionInput): Promise<void> {
  const db = admin.firestore();

  if (!input.eventId || !input.recipientUid) {
    console.error("PROJECTION_FAILED: Missing eventId or recipientUid");
    return;
  }

  try {
    await db.runTransaction(async (t) => {
      const inboxRef = db.doc(`platform_inbox/${input.recipientUid}`);
      const notifRef = inboxRef.collection('notifications').doc(input.eventId);

      const docSnap = await t.get(notifRef);

      if (docSnap.exists) {
        console.log("PROJECTION_IDEMPOTENT_REPLAY", input.eventId);
        return; // Exists, do nothing
      }

      // Convert createdAt to Timestamp
      const createdAtMillis = typeof input.createdAt === 'string' ? parseInt(input.createdAt, 10) : input.createdAt;
      const createdAtTimestamp = admin.firestore.Timestamp.fromMillis(createdAtMillis);

      const data: any = {
        eventId: input.eventId,
        recipientUid: input.recipientUid,
        type: input.type,
        title: input.title,
        body: input.body,
        sourceModule: input.sourceModule,
        isRead: false,
        readAt: null,
        createdAt: createdAtTimestamp,
        replicatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (input.entityType) data.entityType = input.entityType;
      if (input.entityId) data.entityId = input.entityId;
      if (input.priority) data.priority = input.priority;
      if (input.context) data.context = input.context;

      t.set(notifRef, data);

      t.set(inboxRef, {
        unreadCount: admin.firestore.FieldValue.increment(1),
        lastNotificationAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    console.log("PROJECTION_CREATED", input.eventId);
  } catch (error) {
    console.error("PROJECTION_FAILED", input.eventId, error);
    // Silent fail so we don't throw up to Cloud Tasks
  }
}
