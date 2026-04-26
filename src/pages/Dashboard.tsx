import { useState, useEffect } from "react";
import { Book, Lock, Star, GitFork, Circle, LogIn, Bot, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow, isValid } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { type Repository } from "../lib/mockData";
import { AiAuditModal } from "../components/AiAuditModal";
import { useNotifications } from "../contexts/NotificationContext";
import { motion } from "motion/react";

export function Dashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { user, signInWithGoogle } = useAuth();
  const { addNotification } = useNotifications();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAuditRepo, setAiAuditRepo] = useState<Repository | null>(null);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "repositories"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reposData = snapshot.docs.map(document => {
        const data = document.data();
        return {
          ...data,
          id: document.id,
          // ensure updatedAt is a valid string, fallback to now if missing
          updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString()
        } as Repository;
      });
      const uniqueRepos = Array.from(new Map(reposData.map(r => [r.id, r])).values());
      const publicAndOwnRepos = uniqueRepos.filter(repo => {
         if ((repo as any).isFork) return false;
         if (!repo.isPrivate) return true;
         if (user && repo.ownerId === user.uid) return true;
         return false;
      });
      setRepositories(publicAndOwnRepos);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const handleVoteStar = async (e: React.MouseEvent, repo: Repository) => {
     e.preventDefault();
     e.stopPropagation();
     if (!user) {
        addNotification("Identity not recognized. Validation rejected.", "error");
        return;
     }
     try {
        const { serverTimestamp } = await import("firebase/firestore");
        const starredBy = (repo as any).starredBy || [];
        const hasStarred = starredBy.includes(user.uid);
        const newStarredBy = hasStarred 
          ? starredBy.filter((id: string) => id !== user.uid)
          : [...starredBy, user.uid];
        const newStars = hasStarred ? Math.max(0, (repo.stars || 0) - 1) : (repo.stars || 0) + 1;
        
        await updateDoc(doc(db, "repositories", repo.id), {
          stars: newStars,
          starredBy: newStarredBy,
          updatedAt: serverTimestamp()
        });
        if (hasStarred) {
           addNotification(`Vote removed for ${repo.name}.`, "success");
        } else {
           addNotification(`Signal validated. Vote registered for ${repo.name}.`, "success");
        }
     } catch (err) {
        console.error("Star vote failed", err);
     }
  };

  const filteredRepos = repositories.filter(repo => 
    repo.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col xl:flex-row h-full w-full overflow-y-auto xl:overflow-hidden">
      
      {/* Main Column: Repositories List */}
      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-10 xl:overflow-y-auto w-full">
        <div className="flex justify-between items-start mb-10 md:mb-[60px]">
          <h1 className="text-[40px] md:text-[80px] xl:text-[120px] font-[800] leading-[0.8] tracking-[-2px] md:tracking-[-6px] uppercase break-words">
            Digital<br/>Archive
          </h1>
          <div className="text-right shrink-0 mt-2">
             <p className="text-[10px] md:text-[12px] text-muted uppercase tracking-widest">System Map</p>
             <p className="font-serif italic text-accent text-xs md:text-sm mt-1">v4.0.2-alpha</p>
          </div>
        </div>

        <div className="w-full border-b-[2px] border-text pb-[10px] mb-[40px] flex justify-between items-center group">
          <input 
            type="text" 
            placeholder="Explore the library..."
            className="bg-transparent border-none text-text text-[18px] md:text-[24px] font-serif italic outline-none w-full placeholder-muted focus:ring-0 truncate"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-4 ml-4">
             <button className="text-muted hover:text-accent transition text-2xl font-serif hidden md:block">
               →
             </button>
             <button 
               onClick={() => window.dispatchEvent(new Event('openAddArchiveModal'))}
               className="bg-accent hover:opacity-80 text-black px-4 py-1.5 md:py-2 text-[10px] md:text-xs font-black uppercase transition shrink-0 flex items-center gap-2 border border-accent rounded-none tracking-[2px]"
             >
               <Book className="w-4 h-4 hidden sm:block" /> New
             </button>
          </div>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-line border border-line flex-grow h-fit content-start mb-8">
          {loading ? (
            <div className="col-span-full p-12 text-center text-muted font-serif italic text-2xl">
              Syncing with the void...
            </div>
          ) : filteredRepos.length > 0 ? (
            filteredRepos.map((repo, idx) => (
              <motion.li 
                key={repo.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                onClick={() => navigate(`/repo/${repo.id}`)}
                className="bg-bg hover:bg-[#151515] p-[20px] md:p-[30px] flex flex-col justify-between transition-colors cursor-pointer group min-h-[160px]"
              >
                 <div className="text-[10px] md:text-[11px] uppercase text-muted tracking-[1px] flex justify-between mb-4">
                   <span>{String(idx + 1).padStart(2, '0')}</span>
                   <span>Modified {formatDistanceToNow(new Date(repo.updatedAt))} ago</span>
                 </div>
                 
                 <div className="flex-1 flex flex-col">
                    <div className="flex items-start justify-between">
                      <a 
                        href={`https://github.com/${repo.owner}/${repo.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[20px] md:text-[28px] font-[600] tracking-[-1px] mb-[15px] group-hover:text-accent transition-colors block leading-tight"
                      >
                         <span className="text-muted text-[12px] md:text-[14px] tracking-normal mb-1 block">
                            {repo.owner} /
                         </span>
                         {repo.name}
                      </a>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted mt-auto pt-4">
                        <div className="flex gap-[8px] flex-wrap items-center">
                          {repo.addedBy && (
                             <div 
                               className="flex items-center gap-1.5 mr-2" 
                               onClick={(e) => e.stopPropagation()}
                               title={`Logged by ${repo.addedBy}`}
                             >
                                <a href={`https://github.com/${repo.addedBy}`} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={repo.addedByPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${repo.addedBy}`} 
                                    className="w-4 h-4 rounded-full grayscale object-cover cursor-pointer hover:grayscale-0 transition" 
                                    alt={repo.addedBy} 
                                  />
                                </a>
                                <a 
                                  href={`https://github.com/${repo.addedBy}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[9px] md:text-[10px] font-bold hover:underline hidden sm:block"
                                >
                                  {repo.addedBy}
                                </a>
                             </div>
                          )}
                          <span className="text-[9px] md:text-[10px] border border-muted px-[8px] py-[2px] rounded-full uppercase tracking-wider text-muted">
                            {repo.language}
                          </span>
                          <span className="text-[9px] md:text-[10px] border border-muted px-[8px] py-[2px] rounded-full uppercase tracking-wider text-muted">
                            {repo.isPrivate ? "Priv" : "Pub"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {user && (user.uid === repo.ownerId) && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setRepoToDelete(repo);
                              }}
                              className="flex items-center gap-1 border border-transparent hover:border-[#00BFFF] text-muted hover:text-[#00BFFF] px-2 py-0.5 transition"
                              title="Delete Archive"
                            >
                              <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAiAuditRepo(repo); }}
                            className="flex items-center gap-1 border border-transparent hover:border-[#00BFFF] text-muted hover:text-[#00BFFF] px-2 py-0.5 transition"
                            title="AI Intelligence Audit"
                          >
                             <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </button>
                          <div 
                            onClick={(e) => handleVoteStar(e, repo)}
                            className="flex items-center gap-1 hover:text-accent transition cursor-pointer"
                          >
                            <Star className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            <span className="text-[10px] md:text-xs">{repo.stars}</span>
                          </div>
                          <div className="flex items-center gap-1 hover:text-text transition">
                            <GitFork className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            <span className="text-[10px] md:text-xs">{repo.forks}</span>
                          </div>
                        </div>
                    </div>
                 </div>
              </motion.li>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-muted bg-bg">
              <span className="font-serif italic text-2xl">No archives found.</span>
            </div>
          )}
        </ul>
      </div>

      {aiAuditRepo && (
         <AiAuditModal 
            repo={aiAuditRepo} 
            onClose={() => setAiAuditRepo(null)} 
         />
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
                    addNotification(`Archive ${repoToDelete.name} has been purged.`, "success");
                    setRepoToDelete(null);
                  } catch (err) {
                    console.error("Failed to delete", err);
                    addNotification("Failed to purge archive.", "error");
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

      {/* Sidebar: Profile / Mini Repo List */}
      <aside className="w-full xl:w-[300px] border-t xl:border-t-0 xl:border-l border-line p-6 md:p-10 flex flex-col gap-[30px] md:gap-[40px] xl:overflow-y-auto shrink-0 bg-bg">
        <div className="flex flex-col gap-6 relative">
          <div className="flex items-center gap-4 xl:flex-col xl:items-start group">
            {user ? (
               <Link to="/profile">
                 <img 
                   src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
                   alt={user.displayName || "User"} 
                   className="w-16 h-16 xl:w-full xl:max-w-[120px] rounded-full border border-line bg-[#151515] object-cover grayscale group-hover:grayscale-0 transition-all duration-500 cursor-pointer"
                 />
               </Link>
            ) : (
               <img 
                 src="https://api.dicebear.com/7.x/avataaars/svg?seed=visitor" 
                 alt="Visitor" 
                 className="w-16 h-16 xl:w-full xl:max-w-[120px] rounded-full border border-line bg-[#151515] object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
               />
            )}
            <div>
              <h1 className="text-[11px] uppercase tracking-[2px] text-muted border-b border-line pb-[10px] mb-2">
                {user ? user.displayName : "Guest Viewer"}
              </h1>
              <p className="font-serif italic text-xl text-text truncate max-w-[180px]">
                {user ? user.email : "Unidentified"}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted leading-[1.6] border-l-2 border-accent pl-4">
             {user ? "Digital architecture enthusiast mapping the void structure." : "Connect securely to establish identity identity matrix."}
          </p>
          
          {!user && (
            <button 
              onClick={signInWithGoogle}
              className="mt-2 flex items-center justify-center gap-2 border border-accent p-3 hover:bg-accent hover:text-black uppercase text-accent tracking-[2px] text-xs font-bold transition"
            >
               <LogIn className="w-4 h-4" /> Secure Auth
            </button>
          )}

        </div>
        
        <div className={!user ? "opacity-30 pointer-events-none" : ""}>
          <h2 className="text-[11px] uppercase text-muted tracking-[2px] mb-[20px] border-b border-line pb-[10px]">Library Stats</h2>
          <div className="flex justify-between items-baseline mb-[15px]">
            <span className="text-[32px] font-[300] font-serif text-text">{repositories.length}</span>
            <span className="text-[12px] text-muted uppercase">Repos</span>
          </div>
          <div className="flex justify-between items-baseline mb-[15px]">
            <span className="text-[32px] font-[300] font-serif text-text">
              {repositories.reduce((acc, curr) => acc + (curr.stars || 0), 0)}
            </span>
            <span className="text-[12px] text-muted uppercase">Stars</span>
          </div>
        </div>

        <div>
          <h2 className="text-[11px] uppercase text-muted tracking-[2px] mb-[20px] border-b border-line pb-[10px]">Top Archives</h2>
          <div className="flex flex-col gap-[20px]">
             {repositories.slice(0, 3).map(repo => (
               <Link 
                 key={repo.id} 
                 to={`/repo/${repo.id}`}
                 className="flex flex-col group"
               >
                 <span className="text-[13px] leading-[1.4] border-l-2 border-line group-hover:border-accent pl-[15px] transition-colors">
                    {repo.name}
                    <span className="text-[11px] text-muted block mt-1">Modified {isValid(new Date(repo.updatedAt)) ? formatDistanceToNow(new Date(repo.updatedAt)) : 'unknown'} ago</span>
                 </span>
               </Link>
             ))}
             {loading && <div className="text-muted text-xs font-serif min-h-[50px]">Loading...</div>}
          </div>
        </div>

      </aside>

    </div>
  );
}
