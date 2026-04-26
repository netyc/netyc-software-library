import { useState, useEffect } from "react";
import { TrendingUp, Star, Award, Search, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

interface Repo {
  id: string;
  name: string;
  owner: string;
  description: string;
  stars: number;
  language: string;
}

export function Insights() {
  const [topRepos, setTopRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const q = query(collection(db, "repositories"), orderBy("stars", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const repos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Repo[];
      const uniqueRepos = Array.from(new Map(repos.map(r => [r.id, r])).values()).filter(r => !(r as any).isFork);
      setTopRepos(uniqueRepos.slice(0, 10));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRepos = topRepos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto w-full bg-[#0C0C0C]">
      <div className="mb-10 md:mb-[60px]">
        <h1 className="text-[48px] md:text-[80px] font-[800] leading-[0.8] tracking-[-4px] uppercase break-words text-text">
          Insights
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-10">
            <span className="text-muted font-serif italic text-sm border-l-2 border-accent pl-4 max-w-md">
               Global ranking of archived digital structures based on star validation and structural integrity.
            </span>
            <div className="relative group w-full sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
              <input 
                type="text" 
                placeholder="Search archive ranking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#151515] border border-line p-3 pl-10 text-xs font-mono text-text outline-none focus:border-accent transition-all"
              />
            </div>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto space-y-10 pb-32">
         {loading ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-30">
               <Loader2 className="w-12 h-12 animate-spin text-muted mb-4" />
               <p className="font-serif italic tracking-widest uppercase text-xs">Calibrating Ranks...</p>
            </div>
         ) : filteredRepos.length === 0 ? (
            <div className="p-20 border border-dashed border-line text-center">
               <TrendingUp className="w-16 h-16 text-muted mb-6 opacity-20 mx-auto" />
               <p className="text-muted font-serif italic">No significant vectors found in this quadrant.</p>
            </div>
         ) : (
            <div className="space-y-[1px] bg-line border border-line">
               {filteredRepos.map((repo, idx) => (
                  <Link 
                    key={repo.id}
                    to={`/repo/${repo.id}`}
                    className="flex flex-col md:flex-row md:items-center justify-between p-6 md:p-8 bg-bg group hover:bg-[#151515] transition-all relative overflow-hidden"
                  >
                     {/* Rank Number Background */}
                     <div className="absolute top-0 right-0 text-[120px] font-black text-line/5 leading-none select-none -mr-4 -mt-6">
                        {idx + 1}
                     </div>

                     <div className="flex items-center gap-6 md:gap-10 relative z-1">
                        <div className="w-12 h-12 flex items-center justify-center border border-line bg-[#151515] shrink-0 text-xl font-black italic text-muted group-hover:text-accent group-hover:border-accent transition-all">
                           #{idx + 1}
                        </div>
                        <div>
                           <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-text group-hover:text-accent transition-colors">
                                 {repo.name}
                              </h3>
                              {idx === 0 && <Award className="w-5 h-5 text-yellow-500" />}
                           </div>
                           <p className="text-muted text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                              By {repo.owner} • <span className="text-accent/50">{repo.language}</span>
                           </p>
                        </div>
                     </div>

                     <div className="mt-6 md:mt-0 flex items-center gap-8 relative z-1">
                        <div className="text-right">
                           <div className="flex items-center justify-end gap-2 text-text font-black text-2xl md:text-3xl">
                              <Star className="w-5 h-5 text-accent" />
                              {repo.stars.toLocaleString()}
                           </div>
                           <p className="text-[10px] text-muted uppercase tracking-[2px] font-bold mt-1">Star Validation</p>
                        </div>
                        <TrendingUp className={`w-8 h-8 ${idx < 3 ? 'text-accent' : 'text-line opacity-30'}`} />
                     </div>
                  </Link>
               ))}
            </div>
         )}
      </div>
    </div>
  );
}
