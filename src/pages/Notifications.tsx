import { useNotifications, Notification } from "../contexts/NotificationContext";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, AlertTriangle, X, Info } from "lucide-react";
import { useEffect } from "react";

export function Notifications() {
  const { notifications, unreadCount, markAllAsRead, removeNotification } = useNotifications();

  useEffect(() => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  }, [unreadCount, markAllAsRead]);

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="w-5 h-5 text-accent" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error": return <X className="w-5 h-5 text-[#00BFFF]" />;
      default: return <Info className="w-5 h-5 text-muted" />;
    }
  };

  return (
    <div className="p-6 md:p-10 w-full h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-10 pb-[20px] border-b border-line">
          <div>
            <p className="text-[11px] uppercase tracking-[2px] text-muted mb-2">System Log</p>
            <h1 className="text-4xl md:text-5xl font-[600] tracking-[-2px] text-text">Notifications</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[1px] shrink-0 text-muted">
             {notifications.length} logged
          </div>
        </div>

        <div className="bg-bg border border-line flex flex-col">
          {notifications.length === 0 ? (
            <div className="p-16 text-center text-muted font-serif italic text-sm">
               No anomalies detected.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-line">
               {notifications.map((n) => (
                 <div key={n.id} className={`p-6 hover:bg-[#151515] transition-colors relative group ${!n.read ? 'bg-[#151515]/30' : ''}`}>
                    <div className="flex items-start gap-4">
                      <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                      <div className="flex-1">
                         <p className="text-sm font-mono leading-relaxed text-text pr-8">{n.message}</p>
                         <p className="text-[10px] text-muted mt-3 uppercase tracking-widest font-bold">
                           {formatDistanceToNow(n.createdAt)} ago
                         </p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                      className="absolute top-6 right-6 text-muted hover:text-[#00BFFF] opacity-0 group-hover:opacity-100 transition-opacity p-2"
                      title="Clear log"
                    >
                      <X className="w-4 h-4" />
                    </button>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
