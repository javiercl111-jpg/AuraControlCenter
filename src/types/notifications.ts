import { Timestamp } from 'firebase/firestore';

export type NotificationType = 'discovery.completed';

export type ClientNotification = {
  eventId: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  sourceModule: string;
  priority?: "LOW" | "NORMAL" | "HIGH";
  isRead: boolean;
  readAt: Timestamp | null;
  createdAt: Timestamp;
  replicatedAt: Timestamp;
  context?: {
    prospectId?: string;
    dossierId?: string;
  };
};

export type PlatformInboxAggregate = {
  unreadCount: number;
  lastNotificationAt?: Timestamp;
};
