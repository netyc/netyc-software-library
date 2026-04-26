import { useState, useEffect } from "react";
import { Moon, Sun, Lock, Shield, EyeOff, Globe, Save, Trash2, Mail, Send } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AppLockModal } from "../components/AppLockModal";
import { useNotifications } from "../contexts/NotificationContext";
import { AdminStatistics } from "../components/AdminStatistics";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

export function Settings() {
  const { user, userData } = useAuth();
  const { addNotification } = useNotifications();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
     return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });
  
  // Use userData values if available, otherwise fallback
  const isPrivateDefault = userData?.privacyDefault ?? true;
  const appLockEnabled = userData?.appLockEnabled ?? false;
  
  const [saved, setSaved] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");

  const [showLockModal, setShowLockModal] = useState<"setup" | "verify" | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetAccount = async () => {
     if (!user) return;
     if (!window.confirm("CRITICAL WARNING: This will delete ALL your uploaded files and archives. This action CANNOT be undone. Are you absolutely sure?")) {
        return;
     }

     setIsResetting(true);
     try {
        const q = query(collection(db, "repositories"), where("ownerId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        const deletePromises = querySnapshot.docs.map(document => deleteDoc(doc(db, "repositories", document.id)));
        await Promise.all(deletePromises);
        
        addNotification(`Success: ${deletePromises.length} archives have been permanently deleted.`, "success");
     } catch (error) {
        console.error("Error resetting account:", error);
        addNotification("Failed to reset account data.", "error");
     } finally {
        setIsResetting(false);
     }
  };

  const toggleAppLock = () => {
     if (appLockEnabled) {
        setShowLockModal("verify"); // Verify to disable
     } else {
        setShowLockModal("setup");  // Set PIN to enable
     }
  };

  const handleLockModalSuccess = async (pin?: string) => {
     if (showLockModal === "setup" && pin && user) {
        localStorage.setItem("appLockEnabled", "true");
        localStorage.setItem("appLockPin", pin);
        
        // Save to DB
        const { updateDoc, serverTimestamp } = await import("firebase/firestore");
        await updateDoc(doc(db, "users", user.uid), {
           appLockEnabled: true,
           appLockPin: pin,
           updatedAt: serverTimestamp()
        });

        addNotification("Security: Master PIN established across all devices.", "success");
     } else if (showLockModal === "verify" && user) {
        localStorage.setItem("appLockEnabled", "false");
        localStorage.removeItem("appLockPin");
        
        // Remove from DB
        const { updateDoc, serverTimestamp } = await import("firebase/firestore");
        await updateDoc(doc(db, "users", user.uid), {
           appLockEnabled: false,
           appLockPin: null,
           updatedAt: serverTimestamp()
        });

        addNotification("Security: App Lock disabled across all devices.", "warning");
     }
     setShowLockModal(null);
  };

  const handleTogglePrivacy = () => {
     window.dispatchEvent(new CustomEvent('requestAppUnlock', { 
       detail: { onSuccess: async () => {
          const newPrivacyVal = !isPrivateDefault;
          setSaved(true);
          
          if (user) {
             try {
               const { updateDoc, serverTimestamp } = await import("firebase/firestore");
               
               // Save default to Profile
               await updateDoc(doc(db, "users", user.uid), {
                 privacyDefault: newPrivacyVal,
                 updatedAt: serverTimestamp()
               });

               const q = query(collection(db, "repositories"), where("ownerId", "==", user.uid));
               const snap = await getDocs(q);
               const updatePromises = snap.docs.map(document => 
                   updateDoc(doc(db, "repositories", document.id), { 
                     isPrivate: newPrivacyVal,
                     updatedAt: serverTimestamp()
                   })
               );
               await Promise.all(updatePromises);
               addNotification(`Privacy: Default setting updated and all your archives are now ${newPrivacyVal ? 'Private' : 'Public'}`, "info");
             } catch (err: any) {
               console.error("Failed to update privacy:", err);
               addNotification("Failed to update privacy.", "error");
             }
          }
          
          setTimeout(() => setSaved(false), 2000);
       } } 
     }));
  };

  const handleThemeChange = (newTheme: "dark" | "light") => {
    if (newTheme === "light") {
       addNotification("Stability Alert: Solar interface is experimental.", "warning");
    }
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "light") {
       document.documentElement.setAttribute('data-theme', 'light');
    } else {
       document.documentElement.removeAttribute('data-theme');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col p-6 md:p-10 justify-center items-center h-full w-full bg-[#0C0C0C]">
        <Lock className="w-16 h-16 text-muted mb-4 opacity-20" />
        <p className="text-muted font-serif italic">Secure session required to compile configurations.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto w-full bg-[#0C0C0C] relative">
      <div className="mb-10 md:mb-[60px]">
        <div className="flex justify-between items-start">
          <h1 className="text-[48px] md:text-[80px] font-[800] leading-[0.8] tracking-[-4px] uppercase break-words text-text">
            Settings
          </h1>
          {saved && (
            <div className="flex items-center gap-2 text-accent text-[10px] font-bold uppercase tracking-widest bg-accent/10 px-3 py-1 border border-accent/20">
               <Save className="w-3 h-3" /> Syncing...
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
            <span className="text-muted font-serif italic text-sm border-l-2 border-accent pl-4">
               System configurations and user parameters for
            </span>
            <span className="text-xs uppercase tracking-widest bg-[#151515] px-3 py-1.5 text-accent border border-line">
                {user.email}
            </span>
        </div>
      </div>

      <div className="max-w-4xl space-y-12 pb-32">
         {/* Appearance Section */}
         <section className="space-y-6">
            <h2 className="text-[11px] uppercase text-muted tracking-[2px] border-b border-line pb-[10px] flex items-center gap-3">
              <Moon className="w-4 h-4" /> Interface
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-[#151515] border border-line group hover:border-accent transition-colors">
              <div className="mb-6 sm:mb-0 pr-4">
                 <h3 className="text-text font-bold uppercase tracking-widest text-sm">Theme Modality</h3>
                 <p className="text-muted font-serif italic text-xs mt-2 leading-relaxed max-w-md">Toggle between deep void (dark) and solar (light) visual environments.</p>
              </div>
              <div className="flex items-center bg-bg border border-line p-1 shrink-0">
                 <button 
                   onClick={() => handleThemeChange("dark")}
                   className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${theme === "dark" ? "bg-accent text-black" : "text-muted hover:text-text"}`}
                 >
                   <Moon className="w-3.5 h-3.5" /> Dark
                 </button>
                 <button 
                   onClick={() => handleThemeChange("light")}
                   className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${theme === "light" ? "bg-accent text-black" : "text-muted hover:text-text"}`}
                 >
                   <Sun className="w-3.5 h-3.5" /> Light
                 </button>
              </div>
            </div>
         </section>

         {/* Privacy Section */}
         <section className="space-y-6">
            <h2 className="text-[11px] uppercase text-muted tracking-[2px] border-b border-line pb-[10px] flex items-center gap-3">
              <EyeOff className="w-4 h-4" /> Privacy
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-[#151515] border border-line group hover:border-accent transition-colors">
              <div className="mb-6 sm:mb-0 pr-4">
                 <h3 className="text-text font-bold uppercase tracking-widest text-sm">Default Archive State</h3>
                 <p className="text-muted font-serif italic text-xs mt-2 leading-relaxed max-w-md">Determine default visibility of newly minted repositories.</p>
              </div>
              <button 
                onClick={handleTogglePrivacy}
                className={`shrink-0 flex items-center justify-center gap-3 px-6 py-3 border transition-colors text-xs font-bold uppercase tracking-widest w-full sm:w-auto ${isPrivateDefault ? 'bg-[#3f1816] border-[#00BFFF] text-text' : 'bg-bg border-line text-muted hover:border-accent'}`}
              >
                {isPrivateDefault ? <><Lock className="w-4 h-4 text-[#00BFFF]" /> Private</> : <><Globe className="w-4 h-4 text-accent" /> Public</>}
              </button>
            </div>
         </section>

         {/* Security Section */}
         <section className="space-y-6">
            <h2 className="text-[11px] uppercase text-muted tracking-[2px] border-b border-line pb-[10px] flex items-center gap-3">
              <Shield className="w-4 h-4" /> Security
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-[#151515] border border-line group hover:border-accent transition-colors">
              <div className="mb-6 sm:mb-0 pr-4">
                 <h3 className="text-text font-bold uppercase tracking-widest text-sm">App Lock Constraint</h3>
                 <p className="text-muted font-serif italic text-xs mt-2 leading-relaxed max-w-md">Require re-authentication or master password to modify configurations.</p>
              </div>
              <div className="shrink-0 relative cursor-pointer" onClick={toggleAppLock}>
                 <div className={`w-16 h-8 border transition-all flex items-center px-1 ${appLockEnabled ? 'bg-accent border-accent' : 'bg-bg border-line'}`}>
                    <div className={`w-5 h-5 transition-transform duration-300 ${appLockEnabled ? 'translate-x-8 bg-black' : 'translate-x-0 bg-muted'}`} />
                 </div>
              </div>
            </div>
         </section>

         {/* Contact Section */}
         <section className="space-y-6">
            <h2 className="text-[11px] uppercase text-muted tracking-[2px] border-b border-line pb-[10px] flex items-center gap-3">
              <Mail className="w-4 h-4" /> Contact
            </h2>
            <div className="flex flex-col p-6 bg-[#151515] border border-line group hover:border-accent transition-colors gap-6">
               <div>
                 <h3 className="text-text font-bold uppercase tracking-widest text-sm">Send a Transmission</h3>
                 <p className="text-muted font-serif italic text-xs mt-2 leading-relaxed max-w-md">Contact the root administrator via email: netycsoftwarelib@gmail.com</p>
               </div>
               <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <input type="text" value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} placeholder="Enter your message..." className="flex-1 bg-bg border border-line p-3 text-xs font-mono outline-none focus:border-accent transition-colors text-text" />
                  <button onClick={() => window.location.href = `mailto:netycsoftwarelib@gmail.com?subject=Support Request&body=${encodeURIComponent(supportMessage)}`} className="shrink-0 bg-bg border border-line px-6 py-3 text-xs uppercase font-bold tracking-widest text-muted hover:text-accent hover:border-accent transition-colors flex items-center gap-2">
                     <Send className="w-4 h-4" /> Transmit
                  </button>
               </div>
            </div>
         </section>

         {/* Account Section */}
         <section className="space-y-6">
            <h2 className="text-[11px] uppercase text-red-500/50 tracking-[2px] border-b border-red-500/20 pb-[10px] flex items-center gap-3">
              <Trash2 className="w-4 h-4" /> Danger Zone
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-[#3f1816]/20 border border-red-500/20 group hover:border-red-500/50 transition-colors">
              <div className="mb-6 sm:mb-0 pr-4">
                 <h3 className="text-red-500 font-bold uppercase tracking-widest text-sm">Data Purge</h3>
                 <p className="text-red-500/70 font-serif italic text-xs mt-2 leading-relaxed max-w-md">Wipe all your uploaded archives and files. This action cannot be canceled or reversed.</p>
              </div>
              <button 
                onClick={handleResetAccount}
                disabled={isResetting}
                className="shrink-0 flex items-center justify-center gap-3 px-6 py-3 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-black focus:outline-none transition-colors text-xs font-bold uppercase tracking-widest w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" /> 
                {isResetting ? "Purging..." : "Purge Data"}
              </button>
            </div>
         </section>

         {/* SuperAdmin specific elements */}
         {user?.email === "muhammadnaufalmushaddiq@gmail.com" && (
            <AdminStatistics />
         )}
      </div>

      {showLockModal && (
        <AppLockModal 
           mode={showLockModal} 
           expectedPin={localStorage.getItem("appLockPin")} 
           onSuccess={handleLockModalSuccess} 
           onCancel={() => setShowLockModal(null)} 
           title={showLockModal === "setup" ? "Enable App Lock" : "Disable App Lock"}
        />
      )}
    </div>
  );
}
