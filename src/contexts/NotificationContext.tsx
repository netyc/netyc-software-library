import React, { createContext, useContext, useState, useEffect } from "react";

export interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type?: Notification["type"]) => void;
  removeNotification: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem("notifications_state");
    if (saved) {
       try {
          return JSON.parse(saved);
       } catch(e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("notifications_state", JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (message: string, type: Notification["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [
      { id, message, type, read: false, createdAt: Date.now() },
      ...prev
    ]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, markAllAsRead, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};
