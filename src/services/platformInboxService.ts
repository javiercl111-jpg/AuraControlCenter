import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';

export const platformInboxService = {
  async markNotificationAsRead(eventId: string): Promise<void> {
    const markAsRead = httpsCallable<{ eventId: string }, { success: boolean }>(functions, 'markNotificationAsRead');
    await markAsRead({ eventId });
  }
};
