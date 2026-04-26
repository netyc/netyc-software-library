import { Book, Search, Plus, Bell, Menu, LogIn, CheckCircle, AlertTriangle, X, Info } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { useNotifications, Notification } from "../contexts/NotificationContext";
import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { collection, query, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export function Header() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAllAsRead, removeNotification } = useNotifications();
  const notificationRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const q = query(collection(db, "repositories"), limit(10));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const repos = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter((repo: any) => 
           repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           repo.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const uniqueRepos = Array.from(new Map(repos.map(r => [r.id, r])).values()).filter(r => !(r as any).isFork);
        setSearchResults(uniqueRepos);
      });
      return () => unsubscribe();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleToggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success": return <CheckCircle className="w-4 h-4 text-accent" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "error": return <X className="w-4 h-4 text-[#00BFFF]" />;
      default: return <Info className="w-4 h-4 text-muted" />;
    }
  };

  return (
    <header className={`md:w-24 w-full shrink-0 border-b md:border-b-0 md:border-r border-line bg-bg flex ${isMobileMenuOpen ? 'flex-col fixed inset-0 z-[150] h-screen bg-bg' : 'items-center justify-between'} md:flex-col md:static md:h-auto p-4 md:py-10 md:px-0 z-50`}>
      {/* Top / Left Section */}
      <div className={`flex md:flex-col items-center gap-6 justify-between w-full md:w-auto relative ${isMobileMenuOpen ? 'mb-10 shrink-0' : ''}`}>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-muted hover:text-text transition"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        
        <Link 
          to="/" 
          onClick={() => setIsMobileMenuOpen(false)}
          className="text-accent font-[900] text-[24px] tracking-[-2px] hover:opacity-80 transition select-none flex items-center justify-center mb-0 md:mb-6"
        >
           <motion.span 
             initial={{ rotate: -180, scale: 0 }} 
             animate={{ rotate: 0, scale: 1 }} 
             transition={{ type: "spring", stiffness: 260, damping: 20 }}
           >
             N.
           </motion.span>
        </Link>
      </div>

      {/* Vertical Nav (Desktop only & Mobile Fullscreen) */}
      <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} w-full md:flex flex-col items-center gap-10 opacity-50 md:mt-10 md:mb-auto md:pt-10`}>
        {["Repositories", "Collections", "Insights", "Settings"].map(item => (
          <Link 
            to={item === "Repositories" ? "/" : `/${item.toLowerCase()}`}
            key={item} 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-[16px] md:text-[10px] uppercase md:[writing-mode:vertical-rl] md:rotate-180 tracking-[4px] md:tracking-[2px] cursor-pointer transition-opacity hover:opacity-100 hover:text-accent font-bold md:font-normal"
          >
            {item}
          </Link>
        ))}
      </div>

      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block opacity-30 text-[10px] mt-auto md:mt-auto pb-6 font-serif italic text-center`}>
        ©{new Date().getFullYear()}<br/>VX
      </div>

      {/* Right / Bottom Section */}
      <div className={`${isMobileMenuOpen ? 'flex' : 'hidden md:flex flex-col'} items-center justify-center gap-10 md:gap-6 relative pb-10 md:pb-0`}>
        <button 
          onClick={() => { window.dispatchEvent(new Event('openAddArchiveModal')); setIsMobileMenuOpen(false); }}
          className="text-muted hover:text-text transition flex items-center justify-center p-2"
        >
          <Plus className="h-5 w-5" />
        </button>
        
        <div className="relative">
          <Link 
            to="/notifications"
            onClick={() => {
              setIsMobileMenuOpen(false);
              if (unreadCount > 0) markAllAsRead();
            }}
            className="text-muted hover:text-text transition relative p-2 block cursor-pointer"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-accent text-black text-[7px] font-bold flex items-center justify-center rounded-full border border-bg shadow-sm">
                 {unreadCount}
              </span>
            )}
          </Link>
        </div>

        {user ? (
          <button 
            onClick={() => { setIsMobileMenuOpen(false); navigate('/profile'); }}
            className="focus:outline-none transition group grayscale hover:grayscale-0"
          >
            <img 
              src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
              alt={user.displayName || "User"} 
              className="h-8 w-8 md:h-10 md:w-10 rounded-full border border-line group-hover:border-accent transition object-cover bg-[#151515]"
            />
          </button>
        ) : (
          <button 
            onClick={() => { setIsMobileMenuOpen(false); signInWithGoogle(); }}
            title="Secure Login"
            className="text-muted hover:text-accent transition flex items-center justify-center p-2 mt-2"
          >
            <LogIn className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}
