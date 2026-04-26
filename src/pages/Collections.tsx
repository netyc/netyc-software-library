import { useState, useEffect, useMemo } from "react";
import { FolderGit2, Star, Link as LinkIcon, Loader2, Search, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

interface Repo {
  id: string;
  name: string;
  owner: string;
  description: string;
  stars: number;
  language: string;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tech", label: "Technology" },
  { id: "health", label: "Health" },
  { id: "hacking", label: "Hacking Tools" },
  { id: "ai", label: "AI" },
];

export function Collections() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const q = query(collection(db, "repositories"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRepos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Repo[];
      const uniqueRepos = Array.from(new Map(fetchedRepos.map(r => [r.id, r])).values()).filter(r => !(r as any).isFork);
      setRepos(uniqueRepos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRepos = useMemo(() => {
    return repos.filter(repo => {
      const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            repo.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesCategory = true;
      const lowerDesc = (repo.description || "").toLowerCase();
      const lowerName = repo.name.toLowerCase();
      const textToSearch = lowerName + " " + lowerDesc;

      if (activeCategory === "tech") {
        matchesCategory = ["tech", "web", "software", "api", "framework"].some(t => textToSearch.includes(t));
      } else if (activeCategory === "health") {
        matchesCategory = ["health", "medical", "care", "doctor", "medicine"].some(t => textToSearch.includes(t));
      } else if (activeCategory === "hacking") {
        matchesCategory = ["hack", "security", "exploit", "tool", "cyber", "pentest"].some(t => textToSearch.includes(t));
      } else if (activeCategory === "ai") {
        matchesCategory = ["ai", "machine learning", "ml", "gpt", "model", "llm"].some(t => textToSearch.includes(t));
      }

      return matchesSearch && matchesCategory;
    });
  }, [repos, searchQuery, activeCategory]);

  // Group by first letter
  const groupedRepos = filteredRepos.reduce((acc, repo) => {
    const firstLetter = repo.name.charAt(0).toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(repo);
    return acc;
  }, {} as Record<string, Repo[]>);

  const sortedLetters = Object.keys(groupedRepos).sort();

  return (
    <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto w-full bg-[#0C0C0C] relative">
      <div className="mb-10 md:mb-[60px]">
        <h1 className="text-[48px] md:text-[80px] font-[800] leading-[0.8] tracking-[-4px] uppercase break-words text-text">
          Collections
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-6">
            <span className="text-muted font-serif italic text-sm border-l-2 border-accent pl-4">
               Comprehensive index of all recorded structures, categorized alphabetically.
            </span>
        </div>
      </div>

      <div className="mb-12 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input 
              type="text"
              placeholder="Search technology, health, hacking tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#151515] border border-line focus:border-accent outline-none text-text pl-12 pr-4 py-4 uppercase tracking-widest text-xs transition"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
            <Filter className="w-4 h-4 text-muted shrink-0 mr-2" />
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-4 py-2 border text-[10px] uppercase tracking-widest font-bold transition-all ${
                  activeCategory === cat.id 
                    ? 'border-accent bg-accent/10 text-accent' 
                    : 'border-line text-muted hover:border-muted hover:text-text bg-[#151515]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {sortedLetters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-4 border-t border-line">
            {sortedLetters.map(letter => (
              <a 
                key={`nav-${letter}`} 
                href={`#letter-${letter}`}
                className="w-8 h-8 flex items-center justify-center border border-line bg-[#151515] text-xs font-black hover:border-accent hover:text-accent transition-colors"
              >
                {letter}
              </a>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30">
           <Loader2 className="w-12 h-12 animate-spin text-muted mb-4" />
           <p className="font-serif italic tracking-widest uppercase text-xs">Cataloging Vault...</p>
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="p-20 border border-dashed border-line text-center">
           <FolderGit2 className="w-16 h-16 text-muted mb-6 opacity-20 mx-auto" />
           <p className="text-muted font-serif italic">No matching archives found.</p>
        </div>
      ) : (
        <div className="w-full space-y-16 pb-32">
           {sortedLetters.map(letter => (
             <div key={letter} id={`letter-${letter}`} className="relative scroll-mt-24">
                <div className="sticky top-0 bg-[#0C0C0C]/90 backdrop-blur-sm py-4 mb-6 z-10 border-b flex items-baseline gap-4 border-line">
                   <h2 className="text-4xl md:text-5xl font-black text-accent">{letter}</h2>
                   <span className="text-xs text-muted font-mono uppercase tracking-widest">{groupedRepos[letter].length} items</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                   {groupedRepos[letter].map(repo => (
                      <div key={repo.id} className="bg-[#111111] border border-line hover:border-accent/40 p-6 transition-all group flex flex-col min-h-[160px] relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <Link 
                           to={`/repo/${repo.id}`}
                           className="text-xl font-bold tracking-tight text-text group-hover:text-accent transition-colors truncate mb-2 block relative z-10"
                         >
                           {repo.name}
                         </Link>
                         <div className="text-xs text-muted font-mono mb-4 flex items-center gap-2 relative z-10">
                            <span className="uppercase text-[9px] border border-line px-1.5 py-0.5 bg-[#151515]">{repo.owner}</span>
                         </div>
                         <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-4 flex-1 relative z-10">
                            {repo.description || "No description provided."}
                         </p>
                         <div className="flex items-center justify-between mt-auto pt-4 border-t border-line text-xs font-mono text-muted uppercase tracking-widest relative z-10">
                            <span>{repo.language}</span>
                            <div className="flex items-center gap-1 group-hover:text-text transition-colors">
                               <Star className="w-3.5 h-3.5" /> {repo.stars}
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
