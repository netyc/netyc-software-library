import { useState, useEffect } from "react";
import { Book, Star, LogOut, ArrowLeft, Loader2, FolderGit2, Trash2, Edit2, X, Check, Maximize2, Download, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { CyberText } from "../components/CyberText";

interface Repo {
  id: string;
  name: string;
  owner: string;
  description: string;
  language: string;
  stars: number;
}

export function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [userRepos, setUserRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [bio, setBio] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [lastUsernameChange, setLastUsernameChange] = useState<any>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [starredRepos, setStarredRepos] = useState<Repo[]>([]);
  const [activeTab, setActiveTab] = useState<"archives" | "starred" | "forked" | "notes">("archives");
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [focusedNote, setFocusedNote] = useState<any>(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<any>(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  // Derived Stats
  const originalReposCount = userRepos.filter((r: any) => !r.isFork).length;
  const forksCount = userRepos.filter((r: any) => r.isFork).length;
  const totalStarsReceived = userRepos.filter((r: any) => !r.isFork).reduce((acc, curr) => acc + (curr.stars || 0), 0);
  
  let roleName = "User";
  let roleAbbr = "USR";
  if (originalReposCount >= 50) { roleName = "Dewa (All Access)"; roleAbbr = "DWA"; }
  else if (originalReposCount >= 20) { roleName = "Admin"; roleAbbr = "ADM"; }
  else if (originalReposCount >= 10) { roleName = "Contributor"; roleAbbr = "CTR"; }
  else if (originalReposCount >= 5) { roleName = "Pengalaman"; roleAbbr = "PGM"; }
  else if (originalReposCount >= 1) { roleName = "Pemula"; roleAbbr = "PML"; }

  const hoursActive = Math.max(1, Math.round(originalReposCount * 2.5 + forksCount * 0.5 + totalStarsReceived * 1.2));
  const isHealthy = originalReposCount >= 0;

  useEffect(() => {
    if (!user) return;
    
    setDisplayName(user.displayName || "");
    setPhotoURL(user.photoURL || "");

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
           const data = userDoc.data();
           setDisplayName(data.displayName || user.displayName || "");
           setUsername(data.username || "");
           setOriginalUsername(data.username || "");
           setLastUsernameChange(data.lastUsernameChange || null);
           setPhotoURL(data.photoURL || user.photoURL || "");
           setBio(data.bio || "Digital architecture enthusiast mapping the void structure.");
        } else {
           setBio("Digital architecture enthusiast mapping the void structure.");
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchProfile();

    const q = query(collection(db, "repositories"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const repos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Repo[];
      const uniqueRepos = Array.from(new Map(repos.map(r => [r.id, r])).values());
      setUserRepos(uniqueRepos);
      setLoading(false);
    });

    const qStarred = query(collection(db, "repositories"), where("starredBy", "array-contains", user.uid));
    const unsubscribeStarred = onSnapshot(qStarred, (snapshot) => {
      const repos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Repo[];
      setStarredRepos(repos);
    });

    const qNotes = query(collection(db, "user_notes"), where("userId", "==", user.uid));
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      const n = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotes(n.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    });

    return () => {
       unsubscribe();
       if (unsubscribeStarred) unsubscribeStarred();
       if (unsubscribeNotes) unsubscribeNotes();
    };
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setUsernameError("");
    
    let isUsernameChanged = false;
    let finalUsername = username.trim().toLowerCase();
    
    if (finalUsername !== originalUsername) {
       if (!/^[a-z0-9]+$/.test(finalUsername)) {
          setUsernameError("Username can only contain lowercase letters and numbers.");
          return;
       }
       if (lastUsernameChange && (Date.now() - lastUsernameChange.toMillis() < 31536000000)) {
          setUsernameError("You can only change your username once a year.");
          return;
       }
       
       // Check if taken
       const { getDoc, doc: fsDoc } = await import("firebase/firestore");
       const nameRef = fsDoc(db, "usernames", finalUsername);
       const nameSnap = await getDoc(nameRef);
       if (nameSnap.exists()) {
          setUsernameError("Username is already taken.");
          return;
       }
       isUsernameChanged = true;
    }

    setSavingProfile(true);
    try {
      const { updateProfile } = await import("firebase/auth");
      await updateProfile(user, { displayName, photoURL });
      
      const { writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db);
      const userRef = doc(db, "users", user.uid);
      
      if (isUsernameChanged) {
         batch.set(doc(db, "usernames", finalUsername), { uid: user.uid });
         if (originalUsername) {
            batch.delete(doc(db, "usernames", originalUsername));
         }
      }

      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const updateData: any = {
          displayName,
          photoURL,
          bio,
          updatedAt: serverTimestamp()
        };
        if (isUsernameChanged) {
           updateData.username = finalUsername;
           updateData.lastUsernameChange = serverTimestamp();
        }
        batch.update(userRef, updateData);
      } else {
        const createData: any = {
          uid: user.uid,
          email: user.email,
          displayName,
          photoURL,
          bio,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (isUsernameChanged) {
           createData.username = finalUsername;
           createData.lastUsernameChange = serverTimestamp();
        }
        batch.set(userRef, createData);
      }
      
      await batch.commit();
      
      setIsEditing(false);
      setOriginalUsername(finalUsername);
      if (isUsernameChanged) {
         const { Timestamp } = await import("firebase/firestore");
         setLastUsernameChange(Timestamp.now());
      }
    } catch (e) {
      console.error(e);
      setUsernameError("Failed to update profile.");
    }
    setSavingProfile(false);
  };

  const handleAddNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim() || !user) return;
    setAddingNote(true);
    try {
      const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
      await addDoc(collection(db, "user_notes"), {
        userId: user.uid,
        title: newNoteTitle,
        content: newNoteContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewNoteTitle("");
      setNewNoteContent("");
    } catch (e) {
      console.error(e);
    }
    setAddingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    setIsDeletingNote(true);
    try {
      const { deleteDoc, doc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "user_notes", noteId));
      setNoteToDelete(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingNote(false);
    }
  };

  const openFocusNote = (note: any) => {
    setFocusedNote(note);
    setEditNoteTitle(note.title);
    setEditNoteContent(note.content);
  };

  const handleUpdateNote = async () => {
    if (!focusedNote || !user) return;
    setSavingEdit(true);
    try {
      const { updateDoc, doc, serverTimestamp } = await import("firebase/firestore");
      await updateDoc(doc(db, "user_notes", focusedNote.id), {
        title: editNoteTitle,
        content: editNoteContent,
        updatedAt: serverTimestamp()
      });
      setFocusedNote(null);
    } catch (e) {
      console.error("Failed to update note", e);
    }
    setSavingEdit(false);
  };

  const handleDownloadNote = () => {
    if (!focusedNote) return;
    const blob = new Blob([`${editNoteTitle}\n\n${editNoteContent}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editNoteTitle.replace(/[^a-zA-Z0-9-]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center h-full relative overflow-hidden">
        <div className="text-center font-serif text-muted relative z-10">
          <p className="italic text-xl mb-4">You are not authenticated.</p>
          <Link to="/" className="text-accent underline hover:opacity-80 transition">Return to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row h-full w-full overflow-y-auto xl:overflow-hidden">
      
      {/* Profile Info Sidebar */}
      <aside className="w-full xl:w-[350px] border-b xl:border-b-0 xl:border-r border-line p-6 md:p-10 flex flex-col gap-[40px] shrink-0 bg-bg overflow-y-auto relative">
        
        <div className="mb-4 relative z-10 flex items-center justify-between w-full">
          <Link to="/" className="text-muted flex items-center gap-2 hover:text-accent transition uppercase tracking-widest text-[10px] font-bold px-2 py-1 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Back to System
          </Link>
          <button 
            onClick={signOut}
            className="flex items-center gap-2 text-red-500 border border-red-500 uppercase tracking-widest text-[10px] font-bold px-3 py-1.5 hover:bg-red-500 hover:text-black transition"
            title="Logout"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        <div className="flex flex-col gap-6 relative z-10">
          <div className="relative self-center xl:self-start group group-hover:scale-105 transition-transform duration-500">
             {/* Animated black/white glow effect */}
             <div className="absolute inset-0 rounded-full animate-pulse blur-[15px] opacity-70 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-[#888] to-black z-0"></div>
             
             <img 
               src={photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
               alt="Profile Avatar" 
               className="w-32 h-32 rounded-full border border-[#555] bg-[#111] object-cover grayscale transition-all duration-700 hover:grayscale-0 relative z-10"
             />
          </div>
          
          {isEditing ? (
             <div className="flex flex-col gap-4 w-full">
                {usernameError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">{usernameError}</p>}
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  placeholder="Display Name"
                  className="bg-[#151515] border border-line p-2 text-sm text-text outline-none focus:border-accent w-full"
                />
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Username (a-z, 0-9)"
                  className="bg-[#151515] border border-line p-2 text-sm text-text outline-none focus:border-accent w-full"
                />
                <input 
                  type="text" 
                  value={photoURL} 
                  onChange={(e) => setPhotoURL(e.target.value)} 
                  placeholder="Photo URL"
                  className="bg-[#151515] border border-line p-2 text-sm text-text outline-none focus:border-accent w-full"
                />
                <textarea 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  placeholder="Bio"
                  rows={3}
                  className="bg-[#151515] border border-line p-2 text-sm text-text outline-none focus:border-accent w-full resize-none"
                />
                <div className="flex gap-2">
                   <button onClick={handleSaveProfile} disabled={savingProfile} className="flex-1 flex justify-center items-center gap-2 bg-accent text-black font-bold uppercase tracking-widest text-[10px] p-2 hover:opacity-80 transition">{savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save</button>
                   <button onClick={() => setIsEditing(false)} className="flex-1 flex justify-center items-center gap-2 border border-line text-muted font-bold uppercase tracking-widest text-[10px] p-2 hover:text-text transition"><X className="w-3 h-3" /> Cancel</button>
                </div>
             </div>
          ) : (
             <div className="group/edit relative w-full overflow-hidden">
                <button onClick={() => setIsEditing(true)} className="absolute -top-2 right-0 opacity-0 group-hover/edit:opacity-100 p-1 text-muted hover:text-accent transition">
                   <Edit2 className="w-4 h-4" />
                </button>
                <h1 className="text-2xl font-[800] tracking-[-1px] text-text break-words mb-1 pr-6">
                  {displayName || "Unknown Identity"}
                </h1>
                {originalUsername && <p className="font-mono text-accent text-xs mb-1">@{originalUsername}</p>}
                <p className="font-serif italic text-lg text-muted truncate w-full">{user.email}</p>
                <p className="text-[13px] leading-relaxed border-l-2 border-accent pl-4 text-accent mt-4 whitespace-pre-wrap">
                  <CyberText text={bio || "Digital architecture enthusiast mapping the void structure."} />
                </p>
             </div>
          )}
        </div>

        <div className="relative z-10 space-y-8">
          {/* Access Level / Role */}
          <div>
            <h2 className="text-[11px] uppercase text-muted tracking-[2px] mb-4 border-b border-line pb-2">Access Level</h2>
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-3xl font-light font-serif text-accent text-shadow-sm" title={roleName}>{roleAbbr}</span>
              <span className="text-[10px] text-muted uppercase font-bold tracking-widest">{roleName}</span>
            </div>
            <div className="flex justify-between items-baseline mb-1">
               <span className="text-[10px] font-mono text-muted truncate max-w-[200px]" title={user.uid}>{user.uid}</span>
               <span className="text-[10px] text-muted uppercase tracking-widest">ID</span>
            </div>
          </div>

          {/* Activity Graphs */}
          <div>
             <h2 className="text-[11px] uppercase text-muted tracking-[2px] mb-4 border-b border-line pb-2">Activity Vectors</h2>
             <div className="space-y-4">
                <div>
                   <div className="flex justify-between text-[10px] uppercase font-bold text-muted mb-1">
                      <span>Archives Uploaded</span>
                      <span className="text-text">{originalReposCount}</span>
                   </div>
                   <div className="w-full bg-[#151515] h-1">
                      <div className="bg-accent h-full" style={{width: `${Math.min(originalReposCount * 2, 100)}%`}}></div>
                   </div>
                </div>
                <div>
                   <div className="flex justify-between text-[10px] uppercase font-bold text-muted mb-1">
                      <span>Forks Generated</span>
                      <span className="text-text">{forksCount}</span>
                   </div>
                   <div className="w-full bg-[#151515] h-1">
                      <div className="bg-[#00BFFF] h-full" style={{width: `${Math.min(forksCount * 5, 100)}%`}}></div>
                   </div>
                </div>
                <div>
                   <div className="flex justify-between text-[10px] uppercase font-bold text-muted mb-1">
                      <span>Hours Active</span>
                      <span className="text-text">{hoursActive}h</span>
                   </div>
                   <div className="w-full bg-[#151515] h-1 shadow-[0_0_5px_currentColor]">
                      <div className="bg-[#FF00FF] h-full" style={{width: `${Math.min(hoursActive, 100)}%`}}></div>
                   </div>
                </div>
             </div>
          </div>

          {/* Achievements */}
          <div>
             <h2 className="text-[11px] uppercase text-muted tracking-[2px] mb-4 border-b border-line pb-2">Achievements</h2>
             <div className="flex flex-wrap gap-4">
                {originalReposCount >= 1 ? (
                   <div className="w-12 h-12 rounded-full border border-accent flex flex-col items-center justify-center bg-accent/10 shadow-[0_0_15px_rgba(57,255,20,0.2)] group relative" title="First Archive">
                      <span className="text-accent text-[12px] font-black tracking-widest mb-0.5">A1</span>
                      <span className="text-[6px] text-accent font-mono uppercase opacity-50 group-hover:opacity-100 uppercase">First</span>
                   </div>
                ) : (
                   <div className="w-12 h-12 rounded-full border border-line flex items-center justify-center bg-[#151515] opacity-50">
                      <span className="text-muted text-[10px] font-black tracking-widest">?</span>
                   </div>
                )}
                {originalReposCount >= 10 ? (
                   <div className="w-12 h-12 rounded-full border border-[#00BFFF] flex flex-col items-center justify-center bg-[#00BFFF]/10 shadow-[0_0_15px_rgba(0,191,255,0.2)] group relative" title="Contributor">
                      <span className="text-[#00BFFF] text-[12px] font-black tracking-widest mb-0.5">CTR</span>
                      <span className="text-[6px] text-[#00BFFF] font-mono uppercase opacity-50 group-hover:opacity-100 uppercase">Pro</span>
                   </div>
                ) : (
                   <div className="w-12 h-12 rounded-full border border-line flex items-center justify-center bg-[#151515] opacity-50">
                      <span className="text-muted text-[10px] font-black tracking-widest">?</span>
                   </div>
                )}
                {totalStarsReceived >= 10 ? (
                   <div className="w-12 h-12 rounded-full border border-yellow-500 flex flex-col items-center justify-center bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)] group relative" title="Star Maker">
                      <span className="text-yellow-500 text-[12px] font-black tracking-widest mb-0.5">★</span>
                      <span className="text-[6px] text-yellow-500 font-mono uppercase opacity-50 group-hover:opacity-100 uppercase">Fame</span>
                   </div>
                ) : (
                   <div className="w-12 h-12 rounded-full border border-line flex items-center justify-center bg-[#151515] opacity-50">
                      <span className="text-muted text-[10px] font-black tracking-widest">?</span>
                   </div>
                )}
             </div>
          </div>

          {/* System Status Health Bar */}
          <div>
             <h2 className="text-[11px] uppercase text-muted tracking-[2px] mb-4 border-b border-line pb-2">System Health</h2>
             <div className="flex items-center gap-3">
                <div className="flex-1 bg-[#151515] h-1.5 border border-line">
                   <div className={`h-full transition-all duration-1000 ${isHealthy ? 'bg-accent w-[98%]' : 'bg-red-500 w-[50%]'} shadow-[0_0_5px_currentColor]`}></div>
                </div>
                <span className={`text-[10px] font-bold tracking-widest uppercase ${isHealthy ? 'text-accent' : 'text-red-500'}`}>
                   {isHealthy ? 'Nominal' : 'Warning'}
                </span>
             </div>
          </div>
        </div>

      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-10 xl:overflow-y-auto w-full bg-[#111111] relative border-t xl:border-t-0 border-line">
        <div className="mb-10 relative z-10 w-full overflow-x-auto hide-scrollbar">
          <div className="flex flex-nowrap items-center gap-4 sm:gap-6 border-b border-line pb-[10px] w-max xl:w-full min-w-full">
            <button 
               onClick={() => setActiveTab("archives")}
               className={`uppercase tracking-widest text-xs font-bold pb-[10px] border-b-2 hover:text-text transition-colors whitespace-nowrap px-2 ${activeTab === 'archives' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}
            >
               My Archives
            </button>
            <button 
               onClick={() => setActiveTab("starred")}
               className={`uppercase tracking-widest text-xs font-bold pb-[10px] border-b-2 hover:text-text transition-colors whitespace-nowrap px-2 ${activeTab === 'starred' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}
            >
               Starred
            </button>
            <button 
               onClick={() => setActiveTab("forked")}
               className={`uppercase tracking-widest text-xs font-bold pb-[10px] border-b-2 hover:text-text transition-colors whitespace-nowrap px-2 ${activeTab === 'forked' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}
            >
               Forked
            </button>
            <button 
               onClick={() => setActiveTab("notes")}
               className={`uppercase tracking-widest text-xs font-bold pb-[10px] border-b-2 hover:text-text transition-colors whitespace-nowrap px-2 ${activeTab === 'notes' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}
            >
               Private Notes
            </button>
          </div>
        </div>

        {activeTab === "archives" && (() => {
           const originalRepos = userRepos.filter((r: any) => !r.isFork);
           return (
           <>
              <p className="text-muted text-xs mb-6 font-mono tracking-widest uppercase flex items-center gap-2">
                 <FolderGit2 className="w-4 h-4" /> {originalRepos.length} Objects Indexed
              </p>
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30 relative z-10">
                   <Loader2 className="w-10 h-10 animate-spin text-muted mb-4" />
                   <p className="font-serif italic font-xl">Compiling data stream...</p>
                </div>
              ) : originalRepos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-line p-10 lg:p-20 text-center relative z-10">
                   <FolderGit2 className="w-16 h-16 text-muted mb-6 opacity-20" />
                   <p className="text-muted font-serif italic text-lg mb-6">Your personal matrix is currently void.</p>
                   <Link to="/" className="bg-accent text-black px-8 py-3 text-xs font-black uppercase tracking-widest hover:opacity-80 transition hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]">
                      Initialise First Archive
                   </Link>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[1px] bg-line border border-line h-fit content-start relative z-10">
                  {originalRepos.map((repo, idx) => (
                    <li 
                      key={repo.id} 
                      onClick={() => navigate(`/repo/${repo.id}`)}
                      className="bg-bg hover:bg-[#181818] p-[30px] flex flex-col justify-between transition-colors cursor-pointer group min-h-[200px]"
                    >
                       <div className="text-[10px] uppercase text-muted tracking-[1px] flex items-center justify-between mb-6">
                         <div className="flex items-center gap-2">
                            <span className="font-mono text-accent/50 group-hover:text-accent">SY-{String(idx + 1).padStart(3, '0')}</span>
                            {(repo as any).isFork && <span className="bg-[#151515] px-2 py-0.5 border border-line text-[9px] flex items-center gap-1"><FolderGit2 className="w-3 h-3" /> Fork</span>}
                         </div>
                       </div>
                       
                       <div>
                          <h2 className="text-[24px] font-[600] tracking-[-1px] mb-[15px] group-hover:text-accent transition-colors truncate">
                            {repo.name}
                          </h2>
                          <p className="text-xs text-muted mb-8 leading-relaxed line-clamp-3">
                             {repo.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted mt-auto pt-4 border-t border-line">
                              <div className="flex items-center gap-1 font-mono uppercase">
                                <span className="w-1.5 h-1.5 bg-muted group-hover:bg-accent transition"></span>
                                <span className="text-[10px] tracking-wider">{repo.language}</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRepoToDelete(repo);
                                  }}
                                  className="flex items-center gap-1 text-muted hover:text-[#00BFFF] transition"
                                  title="Delete Archive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex items-center gap-1 font-mono group-hover:text-text transition-colors">
                                  <Star className="w-3.5 h-3.5" />
                                  <span className="text-[11px]">{repo.stars}</span>
                                </div>
                              </div>
                          </div>
                       </div>
                    </li>
                  ))}
                </ul>
              )}
           </>
           );
        })()}

        {activeTab === "starred" && (
           <>
              <p className="text-muted text-xs mb-6 font-mono tracking-widest uppercase flex items-center gap-2">
                 <Star className="w-4 h-4" /> {starredRepos.length} Starred Archives
              </p>
              {starredRepos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-line p-10 lg:p-20 text-center relative z-10">
                   <Star className="w-16 h-16 text-muted mb-6 opacity-20" />
                   <p className="text-muted font-serif italic text-lg mb-6">You haven't starred any archives yet.</p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[1px] bg-line border border-line h-fit content-start relative z-10">
                  {starredRepos.map((repo, idx) => (
                    <li 
                      key={repo.id} 
                      onClick={() => navigate(`/repo/${repo.id}`)}
                      className="bg-bg hover:bg-[#181818] p-[30px] flex flex-col justify-between transition-colors cursor-pointer group min-h-[200px]"
                    >
                       <div className="text-[10px] uppercase text-muted tracking-[1px] flex items-center justify-between mb-6">
                         <div className="flex items-center gap-2">
                            <span className="font-mono text-accent/50 group-hover:text-accent">STR-{String(idx + 1).padStart(3, '0')}</span>
                            {(repo as any).isFork && <span className="bg-[#151515] px-2 py-0.5 border border-line text-[9px] flex items-center gap-1"><FolderGit2 className="w-3 h-3" /> Fork</span>}
                         </div>
                       </div>
                       
                       <div>
                          <h2 className="text-[24px] font-[600] tracking-[-1px] mb-[15px] group-hover:text-accent transition-colors truncate">
                            {repo.name}
                          </h2>
                          <p className="text-xs text-muted mb-8 leading-relaxed line-clamp-3">
                             {repo.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted mt-auto pt-4 border-t border-line">
                              <div className="flex items-center gap-1 font-mono uppercase">
                                <span className="w-1.5 h-1.5 bg-muted group-hover:bg-accent transition"></span>
                                <span className="text-[10px] tracking-wider">{repo.language}</span>
                              </div>
                              <div className="flex items-center gap-1 font-mono group-hover:text-text transition-colors">
                                <Star className="w-3.5 h-3.5 text-accent" />
                                <span className="text-[11px]">{repo.stars}</span>
                              </div>
                          </div>
                       </div>
                    </li>
                  ))}
                </ul>
              )}
           </>
        )}

        {activeTab === "forked" && (() => {
           const forkedRepos = userRepos.filter((r: any) => r.isFork);
           return (
           <>
              <p className="text-muted text-xs mb-6 font-mono tracking-widest uppercase flex items-center gap-2">
                 <FolderGit2 className="w-4 h-4" /> {forkedRepos.length} Forked Archives
              </p>
              {forkedRepos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-line p-10 lg:p-20 text-center relative z-10">
                   <FolderGit2 className="w-16 h-16 text-muted mb-6 opacity-20" />
                   <p className="text-muted font-serif italic text-lg mb-6">You haven't forked any archives yet.</p>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[1px] bg-line border border-line h-fit content-start relative z-10">
                  {forkedRepos.map((repo, idx) => (
                    <li 
                      key={repo.id} 
                      onClick={() => navigate(`/repo/${repo.id}`)}
                      className="bg-bg hover:bg-[#181818] p-[30px] flex flex-col justify-between transition-colors cursor-pointer group min-h-[200px]"
                    >
                       <div className="text-[10px] uppercase text-muted tracking-[1px] flex items-center justify-between mb-6">
                         <div className="flex items-center gap-2">
                            <span className="font-mono text-accent/50 group-hover:text-accent">FRK-{String(idx + 1).padStart(3, '0')}</span>
                            <span className="bg-[#151515] px-2 py-0.5 border border-line text-[9px] flex items-center gap-1"><FolderGit2 className="w-3 h-3" /> Fork</span>
                         </div>
                       </div>
                       
                       <div>
                          <h2 className="text-[24px] font-[600] tracking-[-1px] mb-[15px] group-hover:text-accent transition-colors truncate">
                            {repo.name}
                          </h2>
                          <p className="text-xs text-muted mb-8 leading-relaxed line-clamp-3">
                             {repo.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted mt-auto pt-4 border-t border-line">
                              <div className="flex items-center gap-1 font-mono uppercase">
                                <span className="w-1.5 h-1.5 bg-muted group-hover:bg-accent transition"></span>
                                <span className="text-[10px] tracking-wider">{repo.language}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRepoToDelete(repo);
                                  }}
                                  className="flex items-center gap-1 text-muted hover:text-[#00BFFF] transition"
                                  title="Delete Archive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex items-center gap-1 font-mono group-hover:text-text transition-colors">
                                  <Star className="w-3.5 h-3.5 text-accent" />
                                  <span className="text-[11px]">{repo.stars}</span>
                                </div>
                              </div>
                          </div>
                       </div>
                    </li>
                  ))}
                </ul>
              )}
           </>
           );
        })()}

         {activeTab === "notes" && (
           <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="mb-6 flex flex-col gap-4 border border-line p-4 bg-[#151515]">
                 <input 
                   type="text" 
                   value={newNoteTitle} 
                   onChange={(e) => setNewNoteTitle(e.target.value)} 
                   placeholder="Note Title"
                   className="bg-bg border border-line p-3 text-sm text-text outline-none focus:border-accent w-full font-bold"
                 />
                 <textarea 
                   value={newNoteContent} 
                   onChange={(e) => setNewNoteContent(e.target.value)} 
                   placeholder="Write your private note here..."
                   rows={3}
                   className="bg-bg border border-line p-3 text-sm text-text outline-none focus:border-accent w-full resize-none font-mono"
                 />
                 <button onClick={handleAddNote} disabled={addingNote || !newNoteTitle.trim() || !newNoteContent.trim()} className="self-end px-6 py-2 bg-accent text-black font-bold uppercase tracking-widest text-[10px] hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    {addingNote ? "Saving..." : "Save Note"}
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto hide-scrollbar border-t border-line pt-6">
                {notes.length === 0 ? (
                  <div className="p-10 text-center text-muted font-serif italic border border-dashed border-line">
                     No private notes saved.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                     {notes.map(note => (
                        <div key={note.id} className="p-6 border border-line bg-bg relative group">
                           <div className="flex justify-between items-start mb-4">
                              <h3 className="text-lg font-bold text-text truncate max-w-[80%]">{note.title}</h3>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => openFocusNote(note)}
                                  className="text-muted hover:text-accent p-2 -my-2 transition-colors"
                                  title="Expand & Edit Note"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setNoteToDelete(note)}
                                  className="text-muted hover:text-red-500 p-2 -my-2 -mr-2 transition-colors"
                                  title="Delete Note"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                           </div>
                           <p className="text-sm text-muted font-mono whitespace-pre-wrap leading-relaxed line-clamp-4">{note.content}</p>
                           <div className="mt-6 pt-4 border-t border-line text-[10px] text-muted uppercase tracking-widest font-bold">
                              {note.createdAt?.toDate().toLocaleDateString()}
                           </div>
                        </div>
                     ))}
                  </div>
                )}
              </div>
           </div>
        )}
      </div>

      {focusedNote && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-10 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0C0C0C] border border-accent w-full max-w-4xl h-full max-h-[85vh] flex flex-col shadow-[0_0_40px_rgba(57,255,20,0.1)] relative">
            <div className="flex justify-between items-center bg-[#151515] px-6 py-4 border-b border-line shrink-0">
               <div className="flex w-full mr-4">
                 <input 
                   type="text" 
                   value={editNoteTitle} 
                   onChange={(e) => setEditNoteTitle(e.target.value)} 
                   className="bg-transparent text-lg font-bold text-text outline-none w-full placeholder:text-muted"
                   placeholder="Note Title"
                 />
               </div>
               <div className="flex items-center gap-3 shrink-0">
                 <button 
                    onClick={handleDownloadNote}
                    className="p-2 border border-line text-muted hover:text-accent hover:border-accent transition flex items-center gap-2 text-xs uppercase tracking-widest font-bold bg-bg"
                 >
                    <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
                 </button>
                 <button 
                   onClick={() => setFocusedNote(null)}
                   className="p-2 border border-line text-muted hover:text-red-500 hover:border-red-500 transition bg-bg"
                 >
                   <X className="w-4 h-4" />
                 </button>
               </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden relative">
               <textarea 
                 value={editNoteContent} 
                 onChange={(e) => setEditNoteContent(e.target.value)} 
                 className="flex-1 w-full bg-transparent text-sm text-text outline-none p-6 md:p-10 resize-none font-mono leading-relaxed"
                 placeholder="Write your private note here..."
               />
            </div>
            
            <div className="p-4 border-t border-line bg-[#151515] flex justify-end shrink-0">
               <button 
                 onClick={handleUpdateNote} 
                 disabled={savingEdit || editNoteTitle === focusedNote.title && editNoteContent === focusedNote.content || !editNoteTitle.trim()} 
                 className="px-6 py-2 bg-accent text-black font-bold uppercase tracking-widest text-[10px] hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 
                 {savingEdit ? "Updating..." : "Update Note"}
               </button>
            </div>
          </div>
        </div>
      )}

      {repoToDelete && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm z-[200]">
          <div className="bg-[#0C0C0C] border border-[#00BFFF]/20 w-full max-w-md p-6 shadow-[0_0_30px_rgba(0,191,255,0.1)]">
            <h2 className="text-xl font-bold uppercase tracking-widest text-[#00BFFF] mb-2 flex items-center gap-3">
              <Trash2 className="w-5 h-5" /> Confirm Purge
            </h2>
            <p className="text-muted text-sm my-6 leading-relaxed">
              Are you sure you want to permanently delete the archive <strong className="text-text">{repoToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-4 justifying-end mt-4">
              <button 
                onClick={() => setRepoToDelete(null)}
                disabled={isDeleting}
                className="flex-1 border border-line text-muted py-2 text-xs uppercase tracking-widest font-bold hover:bg-[#151515] hover:text-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const { deleteDoc } = await import("firebase/firestore");
                    await deleteDoc(doc(db, "repositories", repoToDelete.id || ""));
                    setRepoToDelete(null);
                  } catch (err) {
                    console.error("Failed to delete", err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 bg-[#00BFFF]/10 border border-[#00BFFF] text-[#00BFFF] py-2 text-xs uppercase tracking-widest font-bold hover:bg-[#00BFFF] hover:text-black shadow-[0_0_10px_rgba(0,191,255,0.2)] transition disabled:opacity-50"
              >
                {isDeleting ? "Purging..." : "Confirm Purge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {noteToDelete && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm z-[200]">
          <div className="bg-[#0C0C0C] border border-[#00BFFF]/20 w-full max-w-md p-6 shadow-[0_0_30px_rgba(0,191,255,0.1)]">
            <h2 className="text-xl font-bold uppercase tracking-widest text-[#00BFFF] mb-2 flex items-center gap-3">
              <Trash2 className="w-5 h-5" /> Confirm Note Deletion
            </h2>
            <p className="text-muted text-sm my-6 leading-relaxed">
              Are you sure you want to permanently delete the note <strong className="text-text">{noteToDelete.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-4 justifying-end mt-4">
              <button 
                onClick={() => setNoteToDelete(null)}
                disabled={isDeletingNote}
                className="flex-1 border border-line text-muted py-2 text-xs uppercase tracking-widest font-bold hover:bg-[#151515] hover:text-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteNote(noteToDelete.id)}
                disabled={isDeletingNote}
                className="flex-1 bg-[#00BFFF]/10 border border-[#00BFFF] text-[#00BFFF] py-2 text-xs uppercase tracking-widest font-bold hover:bg-[#00BFFF] hover:text-black shadow-[0_0_10px_rgba(0,191,255,0.2)] transition disabled:opacity-50"
              >
                {isDeletingNote ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
