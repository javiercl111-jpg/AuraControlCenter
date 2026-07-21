import React, { useEffect, useRef } from 'react';
import { X, BellOff, AlertCircle } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const { notifications, loading, error, markAsRead } = useNotifications();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div 
        ref={drawerRef}
        role="dialog"
        aria-label="Notificaciones"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col sm:max-w-md animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Notificaciones</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar panel de notificaciones"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 flex flex-col items-center justify-center text-red-500 h-32">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm text-center">No se pudieron cargar las notificaciones</p>
            </div>
          )}

          {!error && loading && (
            <div className="p-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col gap-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          )}

          {!error && !loading && notifications.length === 0 && (
            <div className="p-8 flex flex-col items-center justify-center text-gray-500 h-full">
              <BellOff className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-base font-medium">Sin notificaciones</p>
              <p className="text-sm text-center mt-1">Cuando tengas novedades, aparecerán aquí.</p>
            </div>
          )}

          {!error && !loading && notifications.length > 0 && (
            <div className="divide-y divide-gray-100">
              {notifications.map(notif => (
                <NotificationItem 
                  key={notif.eventId} 
                  notification={notif} 
                  onMarkAsRead={markAsRead} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
