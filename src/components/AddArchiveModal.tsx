import { useState, useEffect } from "react";
import { Plus, X, Github, Cloud, Code } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { setDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";

interface AddArchiveModalProps {
  onClose: () => void;
}

export function AddArchiveModal({ onClose }: AddArchiveModalProps) {
  const { user, userData } = useAuth();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Secure identity required to add data. Please authenticate.");
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      // Basic github url parse
      // e.g., https://github.com/facebook/react
      const cleanUrl = url.replace(/\/$/, "");
      const urlObj = new URL(cleanUrl);
      if (urlObj.hostname !== "github.com") {
        throw new Error("Currently only GitHub.com URLs are supported in the terminal.");
      }

      const parts = urlObj.pathname.split("/").filter(Boolean);
      if (parts.length < 2) {
        throw new Error("Invalid GitHub repository URL.");
      }

      const owner = parts[0];
      const repoName = parts[1];

      // Fetch repo details
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`);
      if (!repoRes.ok) {
        let errMessage = "Failed to fetch repository from GitHub. It might be private or not exist.";
        try {
          const errData = await repoRes.json();
          if (errData.message) errMessage = `GitHub API Error: ${errData.message}`;
        } catch (e) {}
        throw new Error(errMessage);
      }
      const repoData = await repoRes.json();

      // Fetch the recursive tree
      const defaultBranch = repoData.default_branch || "main";
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees/${defaultBranch}?recursive=1`);
      
      let files: any[] = [];
      if (treeRes.ok) {
         const treeData = await treeRes.json();
         // Filter paths to avoid massive repos, max 300 files
         const validItems = treeData.tree
            .filter((t: any) => !t.path.includes('.git/') && !t.path.includes('node_modules/'))
            .slice(0, 300);

         const rootFiles: any[] = [];
         const directoryMap: Record<string, any[]> = { "": rootFiles };

         // Prepare mapping
         validItems.forEach((item: any) => {
            if (item.type === "tree") {
               const node: any = {
                  id: item.sha || `dir-${Math.random()}`,
                  name: item.path.split("/").pop()!,
                  type: "folder",
                  children: [],
                  updatedAt: new Date().toISOString(),
                  commitMessage: "Imported structure"
               };
               const parentPath = item.path.includes("/") ? item.path.substring(0, item.path.lastIndexOf("/")) : "";
               if (!directoryMap[parentPath]) directoryMap[parentPath] = [];
               directoryMap[parentPath].push(node);
               directoryMap[item.path] = node.children;
            }
         });

         // Populate blobs
         validItems.forEach((item: any) => {
            if (item.type === "blob") {
               const node: any = {
                  id: item.sha || `file-${Math.random()}`,
                  name: item.path.split("/").pop()!,
                  type: "file",
                  rawUrl: `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/${item.path}`,
                  updatedAt: new Date().toISOString(),
                  commitMessage: "Imported file"
               };
               const parentPath = item.path.includes("/") ? item.path.substring(0, item.path.lastIndexOf("/")) : "";
               if (!directoryMap[parentPath]) directoryMap[parentPath] = [];
               directoryMap[parentPath].push(node);
            }
         });

         // Pre-fetch README in root
         const readmeNode = rootFiles.find(f => f.name.toLowerCase() === "readme.md" && f.type === "file");
         if (readmeNode && readmeNode.rawUrl) {
             try {
                const rawRes = await fetch(readmeNode.rawUrl);
                if (rawRes.ok) {
                   readmeNode.content = await rawRes.text();
                   readmeNode.history = [{
                      id: "init", message: "Imported", author: owner, timestamp: readmeNode.updatedAt, content: readmeNode.content
                   }];
                }
             } catch(e) {}
         }

         // Sort folders first
         const sortFiles = (arr: any[]) => {
             arr.sort((a, b) => {
                 if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                 return a.name.localeCompare(b.name);
             });
             arr.forEach(f => {
                 if (f.type === "folder" && f.children) sortFiles(f.children);
             });
         };
         sortFiles(rootFiles);
         files = rootFiles;
      }

      // Add to Firestore
      const archiveRef = doc(db, "repositories", `${owner}-${repoName}`);
      const archiveSnap = await getDoc(archiveRef);
      if (archiveSnap.exists()) {
         throw new Error(`Archive ${owner}/${repoName} already exists in the void.`);
      }

      await setDoc(archiveRef, {
        id: `${owner}-${repoName}`,
        name: repoData.name,
        owner: repoData.owner.login,
        ownerId: user.uid,
        addedBy: user.displayName || user.email,
        addedByPhoto: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        description: repoData.description || "No description provided.",
        language: repoData.language || "Unknown",
        stars: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        isPrivate: userData?.privacyDefault ?? true, 
        files: files,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to catalog archive. Aborted.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-bg/80 backdrop-blur-sm">
      <div className="bg-bg border border-accent w-full max-w-xl flex flex-col shadow-2xl relative">
        <div className="flex justify-between items-center bg-[#151515] px-6 py-4 border-b border-line shrink-0">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-accent" />
              <span className="font-bold text-text uppercase tracking-widest text-sm">Add Archive</span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 -mr-2 bg-transparent hover:bg-bg transition text-muted hover:text-accent border border-transparent hover:border-line"
            >
              <X className="w-5 h-5" />
            </button>
        </div>

        <form onSubmit={handleImport} className="p-6 md:p-8">
           <p className="text-muted text-sm mb-6 font-serif italic border-l-2 border-accent pl-4">
              Import a digital structure directly from the GitHub network. The system will index public repositories and extract structural topology.
           </p>

           <div className="mb-6">
              <label className="text-[10px] uppercase tracking-widest text-muted block mb-3 font-bold">Target Vector URL</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Github className="w-4 h-4" />
                </div>
                <input 
                  type="url"
                  required
                  placeholder="https://github.com/owner/repository"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full bg-[#151515] border border-line focus:border-accent text-sm text-text outline-none px-4 py-3 pl-10 transition font-mono"
                />
              </div>
           </div>

           {error && (
             <div className="mb-6 p-4 border border-[#00BFFF] bg-[#3f1816] text-[#F2F2F2] text-xs font-mono">
                [ERROR]: {error}
             </div>
           )}

           <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-line">
              <button 
                type="button" 
                onClick={onClose}
                className="text-[10px] uppercase font-bold tracking-widest text-muted hover:text-text transition px-4 py-2"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isLoading}
                className="text-[10px] uppercase font-black tracking-[2px] bg-accent text-black hover:opacity-80 transition px-6 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Code className="w-4 h-4 animate-spin" /> Indexing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Initialise
                  </>
                )}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
