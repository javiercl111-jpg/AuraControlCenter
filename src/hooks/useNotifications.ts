import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import type { ClientNotification, PlatformInboxAggregate } from '../types/notifications';
import { platformInboxService } from '../services/platformInboxService';
import { getAuth } from 'firebase/auth';

export function useNotifications() {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const uid = user.uid;
      
      const inboxRef = doc(db, 'platform_inbox', uid);
      const notificationsRef = collection(inboxRef, 'notifications');
      const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(20));

      let unsubscribeInbox: () => void;
      let unsubscribeNotifications: () => void;

      try {
        unsubscribeInbox = onSnapshot(inboxRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as PlatformInboxAggregate;
            setUnreadCount(data.unreadCount || 0);
          } else {
            setUnreadCount(0);
          }
        }, (err) => {
          console.error("Error subscribing to platform_inbox:", err);
          setError(err);
        });

        unsubscribeNotifications = onSnapshot(q, (snapshot) => {
          const notifs: ClientNotification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            notifs.push({
              ...data,
              eventId: docSnap.id, // Ensure eventId matches document ID
            } as ClientNotification);
          });
          setNotifications(notifs);
          setLoading(false);
          setError(null);
        }, (err) => {
          console.error("Error subscribing to notifications:", err);
          setError(err);
          setLoading(false);
        });

      } catch (err: any) {
        setError(err);
        setLoading(false);
      }

      return () => {
        if (unsubscribeInbox) unsubscribeInbox();
        if (unsubscribeNotifications) unsubscribeNotifications();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  const markAsRead = async (eventId: string) => {
    try {
      await platformInboxService.markNotificationAsRead(eventId);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead
  };
}
