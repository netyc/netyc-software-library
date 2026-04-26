import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const isSigningInRef = useRef(false);

  useEffect(() => {
    let unsubscribeUserDoc: () => void;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const { onSnapshot } = await import("firebase/firestore");
        const userRef = doc(db, "users", currentUser.uid);
        
        unsubscribeUserDoc = onSnapshot(userRef, async (docSnap) => {
           if (!docSnap.exists()) {
             try {
               await setDoc(userRef, {
                 uid: currentUser.uid,
                 email: currentUser.email,
                 displayName: currentUser.displayName,
                 photoURL: currentUser.photoURL,
                 privacyDefault: true,
                 appLockEnabled: false,
                 createdAt: serverTimestamp(),
                 updatedAt: serverTimestamp(),
               });
             } catch(err) {
               console.error("Failed to create user doc:", err);
             }
           } else {
             const data = docSnap.data();
             setUserData(data);
             // If this device just loaded, sync local storage lock pin if active on user doc but not locally
             if (data.appLockEnabled && data.appLockPin) {
                if (localStorage.getItem("appLockEnabled") !== "true") {
                   localStorage.setItem("appLockEnabled", "true");
                   localStorage.setItem("appLockPin", data.appLockPin);
                   window.dispatchEvent(new Event("systemLockStateChanged"));
                }
             } else {
                if (localStorage.getItem("appLockEnabled") === "true") {
                   localStorage.setItem("appLockEnabled", "false");
                   localStorage.removeItem("appLockPin");
                   window.dispatchEvent(new Event("systemLockStateChanged"));
                }
             }
           }
           setLoading(false);
        }, (error) => {
           console.error("User doc snapshot error:", error);
        });
      } else {
         setUserData(null);
         setLoading(false);
         if (unsubscribeUserDoc) unsubscribeUserDoc();
      }
    });

    return () => {
       unsubscribe();
       if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (isSigningInRef.current) return;
    isSigningInRef.current = true;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google Sign In Error:", error);
      if (error.code === 'auth/popup-blocked') {
         alert("Popup blocked by browser. Please allow popups for this site to sign in.");
      }
    } finally {
      isSigningInRef.current = false;
    }
  };

  const signOut = async () => {
    localStorage.removeItem("appLockEnabled");
    localStorage.removeItem("appLockPin");
    window.dispatchEvent(new Event("systemLockStateChanged"));
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
