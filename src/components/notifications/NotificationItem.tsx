import React from 'react';
import type { ClientNotification } from '../../types/notifications';

function getTimeAgo(timestamp: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Hace un momento';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Ayer';
  return `Hace ${diffInDays}d`;
}

interface Props {
  notification: ClientNotification;
  onMarkAsRead: (eventId: string) => void;
}

export const NotificationItem: React.FC<Props> = ({ notification, onMarkAsRead }) => {
  const isUnread = !notification.isRead;
  const timeAgo = notification.createdAt 
    ? getTimeAgo(notification.createdAt.toDate())
    : '';

  return (
    <div 
      className={`p-4 border-b flex flex-col gap-1 cursor-pointer transition-colors ${isUnread ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'}`}
      onClick={() => {
        if (isUnread) {
          onMarkAsRead(notification.eventId);
        }
      }}
    >
      <div className="flex justify-between items-start">
        <h4 className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
          {notification.title}
        </h4>
        {isUnread && (
          <span className="h-2 w-2 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
        )}
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">
        {notification.body}
      </p>
      <span className="text-xs text-gray-400 mt-1">
        {timeAgo}
      </span>
    </div>
  );
};
