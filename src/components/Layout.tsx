import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { useEffect, useState } from "react";
import { AddArchiveModal } from "./AddArchiveModal";
import { AppLockModal } from "./AppLockModal";
import { GlobalChat } from "./GlobalChat";
import { useNotifications } from "../contexts/NotificationContext";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

export function Layout() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [unlockCallback, setUnlockCallback] = useState<(() => void) | null>(null);
  const [isSystemLocked, setIsSystemLocked] = useState(() => localStorage.getItem("appLockEnabled") === "true");
  const { addNotification } = useNotifications();
  const location = useLocation();

  useEffect(() => {
    // If local storage says it's locked, lock it. This ensures instant lock on refresh.
    if (localStorage.getItem("appLockEnabled") === "true") {
       setIsSystemLocked(true);
    }
    
    const handleLockStateChange = () => {
       setIsSystemLocked(localStorage.getItem("appLockEnabled") === "true");
    };
    
    window.addEventListener("systemLockStateChanged", handleLockStateChange);
    return () => window.removeEventListener("systemLockStateChanged", handleLockStateChange);
  }, []);

  useEffect(() => {
    const handleOpen = () => setIsAddModalOpen(true);
    window.addEventListener('openAddArchiveModal', handleOpen);
    return () => window.removeEventListener('openAddArchiveModal', handleOpen);
  }, []);

  // Intercepting system unlock events
  useEffect(() => {
    const handleUnlockEvent = (e: any) => {
      const isLocked = localStorage.getItem("appLockEnabled") === "true";
      if (isLocked) {
         setUnlockCallback(() => e.detail.onSuccess);
      } else {
         if (e.detail && typeof e.detail.onSuccess === 'function') {
           e.detail.onSuccess();
         }
      }
    };
    window.addEventListener('requestAppUnlock', handleUnlockEvent);
    return () => window.removeEventListener('requestAppUnlock', handleUnlockEvent);
  }, []);

  // Real-time listener for new archives to show notifications
  useEffect(() => {
     let isFirstRun = true;
     const q = query(collection(db, "repositories"), orderBy("createdAt", "desc"), limit(1));
     const unsubscribe = onSnapshot(q, (snapshot) => {
       if (isFirstRun) {
         isFirstRun = false;
         return;
       }
       snapshot.docChanges().forEach((change) => {
         if (change.type === "added") {
           const data = change.doc.data();
           addNotification(`NEW ARCHIVE DETECTED: ${data.name} BY ${data.owner}`, "success");
         }
       });
     });

     return () => {
       unsubscribe();
     };
  }, [addNotification]);

  const handleUnlockSuccess = () => {
     if (unlockCallback) unlockCallback();
     setUnlockCallback(null);
  };

  const handleSystemUnlockSuccess = () => {
     setIsSystemLocked(false);
  };

  if (isSystemLocked) {
     return (
       <div className="h-screen w-full bg-black text-text font-display flex items-center justify-center selection:bg-accent selection:text-black relative z-[9999]">
          <AppLockModal 
            mode="verify" 
            expectedPin={localStorage.getItem("appLockPin")} 
            onSuccess={handleSystemUnlockSuccess} 
            onCancel={() => {}} // Cannot cancel system lock
            title="SYSTEM LOCKED"
          />
       </div>
     );
  }

  return (
    <div className="min-h-screen w-full bg-bg text-text font-display flex flex-col md:flex-row selection:bg-accent selection:text-black">
      <Header />
      <div className="flex-1 flex flex-col relative w-full overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col w-full min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      {isAddModalOpen && <AddArchiveModal onClose={() => setIsAddModalOpen(false)} />}

      {unlockCallback && (
        <AppLockModal 
          mode="verify" 
          expectedPin={localStorage.getItem("appLockPin")} 
          onSuccess={handleUnlockSuccess} 
          onCancel={() => setUnlockCallback(null)} 
          title="Action Locked"
        />
      )}
      <GlobalChat />
    </div>
  );
}
