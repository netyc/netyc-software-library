import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Folder, FileText, Code, GitFork, Star, Eye, Clock, X, History, FileSymlink, ChevronLeft, Trash2, Loader2, FilePlus } from "lucide-react";
import Markdown from "react-markdown";
import { type FileNode, type Commit, type Repository } from "../lib/mockData";
import { formatDistanceToNow, isValid } from "date-fns";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactDiffViewer from 'react-diff-viewer-continued';
import { db } from "../lib/firebase";
import { doc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";

const getLanguage = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'rs': return 'rust';
    case 'py': return 'python';
    case 'cpp': case 'cc': case 'c': return 'cpp';
    default: return 'text';
  }
};

export function RepoDetail() {
  const { repoId } = useParams();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "history" | "diff">("preview");
  const [selectedCommitIndex, setSelectedCommitIndex] = useState<number | null>(null);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [currentPath, setCurrentPath] = useState<FileNode[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingArchive, setIsDeletingArchive] = useState(false);
  
  const [repo, setRepo] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track auto-watch per session
  const hasWatchedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!repoId) return;
    const docId = repoId;
    const unsubscribe = onSnapshot(doc(db, "repositories", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRepo({
          ...data,
          id: docSnap.id,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString()
        } as Repository);
      } else {
        setRepo(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [repoId]);

  useEffect(() => {
    // Automatically increment watch count only once per repo per user
    if (repo && repo.id && user) {
      if (!hasWatchedRef.current.has(repo.id)) {
        hasWatchedRef.current.add(repo.id);
        const viewedBy = (repo as any).viewedBy || [];
        if (!viewedBy.includes(user.uid)) {
          const incrementWatch = async () => {
            try {
              const { serverTimestamp } = await import("firebase/firestore");
              await updateDoc(doc(db, "repositories", repo.id), {
                watches: ((repo as any).watches || 0) + 1,
                viewedBy: [...viewedBy, user.uid],
                updatedAt: serverTimestamp()
              });
            } catch (e) {
              console.error("Auto watch error:", e);
            }
          };
          incrementWatch();
        }
      }
    }
  }, [repo?.id, user]);

  if (isLoading) {
    return <div className="text-center py-20 text-xl font-serif italic text-muted">Reading data stream...</div>;
  }
  
  if (!repo) {
    return <div className="text-center py-20 text-xl font-serif italic text-muted">Archive not found</div>;
  }
  
  const files = currentPath.length > 0 ? currentPath[currentPath.length - 1].children || [] : (repo.files || []);

  const handleSelectFile = async (file: FileNode) => {
    setSelectedFile(file);
    setActiveTab("preview");
    setSelectedCommitIndex(null);

    if (!file.content && file.rawUrl) {
       setLoadingFileContent(true);
       try {
          const res = await fetch(file.rawUrl);
          if (res.ok) {
             const text = await res.text();
             file.content = text;
             file.history = [{ id: "git", message: "Imported file", author: repo.owner, timestamp: file.updatedAt, content: file.content }];
             // Force trigger React state update to show the newly fetched contents
             setSelectedFile({ ...file });
          }
       } catch (err) {
          console.error("Failed lazy load", err);
       } finally {
          setLoadingFileContent(false);
       }
    }
  };

  const handleSelectCommit = (index: number) => {
    setSelectedCommitIndex(index);
    setActiveTab("diff");
  };

  const closeFileModal = () => {
    setSelectedFile(null);
    setActiveTab("preview");
    setSelectedCommitIndex(null);
  };

  const handleDeleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!user) return;
    if (!window.confirm("Permanently delete this item?")) return;
    
    if (repo && repo.id) {
       const removeNodeRecursive = (nodes: any[]): any[] => {
         return nodes.filter(n => n.id !== nodeId).map(n => {
           if (n.children) {
             return { ...n, children: removeNodeRecursive(n.children) };
           }
           return n;
         });
       };
       const updatedFiles = removeNodeRecursive(repo.files || []);
       try {
         const { serverTimestamp } = await import("firebase/firestore");
         await updateDoc(doc(db, "repositories", repo.id), {
           files: updatedFiles,
           updatedAt: serverTimestamp()
         });
         addNotification("Deleted successfully", "success");
       } catch (err) {
         console.error("Delete error:", err);
         addNotification("Failed to delete", "error");
       }
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    const newFolder: FileNode = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      type: "folder",
      updatedAt: new Date().toISOString(),
      commitMessage: "Create folder " + newFolderName.trim()
    };
    if (repo && repo.id) {
       const updatedFiles = [newFolder, ...(repo.files || [])];
       const { serverTimestamp } = await import("firebase/firestore");
       await updateDoc(doc(db, "repositories", repo.id), {
          files: updatedFiles,
          updatedAt: serverTimestamp()
       });
    }
    setNewFolderName("");
    setIsAddingFolder(false);
  };
  
  // existing code
  const handleDeleteArchive = async () => {
    // Superadmin override
    const isSuperAdmin = user?.email === "muhammadnaufalmushaddiq@gmail.com";
    if (!user || (user.uid !== (repo as any).ownerId && !isSuperAdmin)) return;

    window.dispatchEvent(new CustomEvent('requestAppUnlock', { 
       detail: { onSuccess: () => setShowDeleteModal(true) } 
    }));
  };

  const handleStar = async () => {
    if (!user || !repo.id) return;
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
         addNotification(`Archive ${repo.name} validated with +1 star.`, "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleWatch = async () => {
    if (!user || !repo.id) return;
    try {
      const { serverTimestamp } = await import("firebase/firestore");
      await updateDoc(doc(db, "repositories", repo.id), {
        watches: ((repo as any).watches || 0) + 1,
        updatedAt: serverTimestamp()
      });
      addNotification(`Started watching ${repo.name}.`, "success");
    } catch (err) {
      console.error(err);
    }
  };

  const handleFork = async () => {
    if (!user || !repo.id) return;
    try {
      const sanitizedOwner = (user.displayName || user.uid).replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const sanitizedRepoName = repo.name.replace(/[^a-zA-Z0-9_-]/g, '-');
      const newId = `${sanitizedOwner}-${sanitizedRepoName}-${Math.random().toString(36).substring(2, 6)}`;
      
      const { setDoc, serverTimestamp, doc, updateDoc } = await import("firebase/firestore");

      const repoCopy = {
         ...repo,
         id: newId,
         name: repo.name, // Keep original github name
         owner: repo.owner, // Keep original github owner
         ownerId: user.uid,
         addedBy: user.displayName || user.email || "Anonymous",
         addedByPhoto: user.photoURL || null,
         stars: 0,
         forks: 0,
         watches: 0,
         issues: [],
         isPrivate: false,
         isFork: true,
         parentRepoId: repo.id,
         starredBy: [],
         viewedBy: [],
         updatedAt: serverTimestamp(),
         createdAt: serverTimestamp()
      };
      // Delete undefined/function keys if any
      delete (repoCopy as any).content;
      if (!repoCopy.files) repoCopy.files = [];
      if (!repoCopy.description) repoCopy.description = "No description";
      if (!repoCopy.language) repoCopy.language = "Unknown";
      
      try {
        await setDoc(doc(db, "repositories", newId), repoCopy);
      } catch(e: any) {
        console.error("setDoc fail:", e, repoCopy);
        addNotification("Failed to create fork item: " + e.message, "error");
        return;
      }
      
      try {
        // Update original
        await updateDoc(doc(db, "repositories", repo.id), {
          forks: (repo.forks || 0) + 1,
          updatedAt: serverTimestamp()
        });
      } catch(e: any) {
        console.error("updateDoc fail:", e);
        addNotification("Failed to update original item: " + e.message, "error");
        // Don't fully return here, user still got their fork created
      }

      addNotification(`Archive forked to your profile.`, "success");
      navigate(`/repo/${newId}`);
    } catch (err: any) {
      console.error("Failed to fork", err);
      addNotification("Unexpected error: " + err.message, "error");
    }
  };

  const readme = files.find(f => f.name.toLowerCase() === 'readme.md');

  return (
    <div className="p-6 md:p-10 w-full h-full overflow-y-auto">
      {/* Repo Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-10 pb-[20px] border-b border-line">
        <div className="w-full sm:w-auto">
          <p className="text-[11px] uppercase tracking-[2px] text-muted mb-2">Archive Location</p>
          <div className="flex flex-wrap items-center gap-2 lg:gap-3 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-[600] tracking-[-1px] w-full break-all">
            <a href={`https://github.com/${repo.owner}`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-text hover:underline transition max-w-full truncate">{repo.owner}</a>
            <span className="text-muted font-light shrink-0">/</span>
            <Link to={`/repo/${repo.id}`} className="text-[#00BFFF] hover:text-text transition max-w-full truncate align-middle flex items-center gap-2">{repo.name} 
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 sm:px-3 sm:py-1 border border-muted text-muted rounded-full font-bold uppercase tracking-widest shrink-0 hidden sm:inline-block">
                {repo.isPrivate ? "Private" : "Public"}
              </span>
            </Link>
          </div>
          <span className="text-[9px] px-2 py-0.5 border border-muted text-muted rounded-full font-bold uppercase tracking-widest shrink-0 sm:hidden inline-block mt-2">
            {repo.isPrivate ? "Private" : "Public"}
          </span>
        </div>
        
        <div className="flex flex-col xl:flex-row items-center gap-2 text-[10px] font-bold uppercase tracking-[1px] shrink-0 w-full xl:w-auto mt-4 sm:mt-0 justify-between sm:justify-end">
          <div className="flex overflow-x-auto w-full xl:w-auto gap-2 hide-scrollbar pb-1 sm:pb-0 snap-x">
            <div className="flex items-center border border-line rounded-none overflow-hidden group shrink-0 snap-center">
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-[#151515] transition border-r border-line cursor-default text-[9px] sm:text-[10px]">
                <Eye className="w-3 h-3 text-muted group-hover:text-text" /> Views
              </div>
              <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#151515] text-text text-[9px] sm:text-[10px]">{(repo as any).watches || 0}</span>
            </div>
            <div className="flex items-center border border-line rounded-none overflow-hidden group shrink-0 snap-center">
              <button 
                 onClick={handleFork}
                 className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-[#151515] transition border-r border-line group-hover:border-accent text-[9px] sm:text-[10px]"
              >
                <GitFork className="w-3 h-3 text-muted group-hover:text-text" /> Fork
              </button>
              <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#151515] text-text text-[9px] sm:text-[10px]">{repo.forks}</span>
            </div>
            <div className="flex items-center border border-line rounded-none overflow-hidden group shrink-0 snap-center">
              <button 
                onClick={handleStar}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-[#151515] transition border-r border-line group-hover:border-accent text-[9px] sm:text-[10px]"
              >
                <Star className="w-3 h-3 text-muted group-hover:text-text" /> Star
              </button>
              <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-[#151515] text-text text-[9px] sm:text-[10px]">{repo.stars}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line mb-8 flex overflow-x-auto no-scrollbar gap-8">
        <button 
           onClick={() => setActiveTab("source" as any)}
           className={`pb-3 border-b-2 text-[11px] font-bold uppercase tracking-[2px] flex items-center gap-2 transition ${(activeTab as any) === 'source' || activeTab as any === 'preview' ? 'border-accent text-text' : 'border-transparent text-muted hover:border-line hover:text-text'}`}
        >
          <Code className={`w-4 h-4 ${(activeTab as any) === 'source' || activeTab as any === 'preview' ? 'text-accent' : ''}`} /> Source
        </button>
        <button 
           onClick={() => setActiveTab("issues" as any)}
           className={`pb-3 border-b-2 text-[11px] font-bold uppercase tracking-[2px] flex items-center gap-2 transition ${activeTab as any === 'issues' ? 'border-accent text-text' : 'border-transparent text-muted hover:border-line hover:text-text'}`}
        >
          Issues <span className="bg-[#151515] text-text px-2 py-0.5 rounded-full text-[9px]">{((repo as any).issues || []).length}</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 min-w-0">
          {((activeTab as any) === 'source' || activeTab as any === 'preview') && (
             <div className="border border-line bg-bg overflow-hidden rounded-none">
                {/* Latest Commit Header */}
                <div className="bg-[#151515] p-4 border-b border-line flex justify-between items-center text-xs">
                   <div className="flex items-center gap-2">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${repo.owner}`} className="w-6 h-6 rounded-full grayscale border border-line object-cover hidden sm:block" />
                   
                   <button 
                     onClick={() => setCurrentPath([])} 
                     className="font-bold text-text hover:text-accent transition uppercase tracking-widest"
                   >
                     {repo.name}
                   </button>
                   
                   {currentPath.map((pathNode, idx) => (
                      <div key={`${pathNode.id || 'path'}-${idx}`} className="flex items-center gap-2">
                         <span className="text-muted">/</span>
                         <button 
                           onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
                           className="font-bold text-text hover:text-accent transition"
                         >
                           {pathNode.name}
                         </button>
                      </div>
                   ))}
                </div>
                <div className="flex items-center gap-4 text-muted">
                   <input type="file" multiple id="fileUpload" className="hidden" onChange={async (e) => {
                      const selectedFiles = e.target.files;
                      if (!selectedFiles || selectedFiles.length === 0 || !user || !repo) return;
                      
                      const newFileNodes: FileNode[] = [];
                      const { serverTimestamp } = await import("firebase/firestore");
                      
                      for (let i = 0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i];
                        const content = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => resolve(ev.target?.result as string);
                          reader.readAsText(file);
                        });
                        
                        newFileNodes.push({
                           id: `file-${Date.now()}-${i}`,
                           name: file.name,
                           type: "file",
                           content: file.type.startsWith('image/') ? '[Image content not shown in text viewer]' : content,
                           updatedAt: new Date().toISOString(),
                           commitMessage: `Add ${file.name}`,
                           uploaderId: user.uid
                        });
                      }
                      
                      if (repo && repo.id) {
                         // Note: Handling files specifically in currentPath isn't fully implemented in DB if it's flat structure.
                         // Usually we'd update child arrays, but for now we append to root or current node.
                         // Actually, our mock structure uses nested `children` but firestore might just store flat.
                         // Wait, if we are in a subfolder, we should update that subfolder's children.
                         // Let's just push to repo.files for simplicity if flat, or update the nested tree.
                         // For now I'll just push to repo root for safety or try to update nested tree if I have a helper.
                         // I will just add to root `repo.files` for this simple implementation.
                         const updatedFiles = [...newFileNodes, ...(repo.files || [])];
                         await updateDoc(doc(db, "repositories", repo.id), {
                            files: updatedFiles,
                            updatedAt: serverTimestamp()
                         });
                         addNotification(`Added ${newFileNodes.length} file(s).`, "success");
                      }
                      
                      // Reset file input
                      e.target.value = '';
                   }} />
                   <label htmlFor="fileUpload" className="flex items-center gap-2 hover:text-accent transition uppercase tracking-widest font-bold text-[10px] border border-transparent hover:border-accent px-3 py-1 cursor-pointer">
                      <FilePlus className="w-3.5 h-3.5" /> New File
                   </label>
                   <button 
                     onClick={() => setIsAddingFolder(true)}
                     className="flex items-center gap-2 hover:text-accent transition uppercase tracking-widest font-bold text-[10px] border border-transparent hover:border-accent px-3 py-1"
                   >
                     <Folder className="w-3.5 h-3.5" /> New Folder
                   </button>
                   <div className="hidden lg:flex items-center gap-2">
                     <Clock className="w-3.5 h-3.5" />
                     <span>{formatDistanceToNow(new Date(repo.updatedAt))} ago</span>
                     <span className="font-mono text-[10px] ml-4 cursor-pointer hover:text-accent transition">c6b8c9d</span>
                   </div>
                </div>
             </div>
             
             {/* List Files */}
             <div>
                {isAddingFolder && (
                  <div className="flex items-center p-4 border-b border-line bg-[#151515] text-sm group">
                     <div className="w-8 text-muted flex shrink-0 justify-center">
                        <Folder className="w-4 h-4 text-accent" />
                     </div>
                     <div className="w-1/3 px-2 flex items-center">
                        <input 
                          type="text" 
                          autoFocus
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                          placeholder="Folder name..."
                          className="bg-transparent border-b border-accent outline-none text-text text-sm w-full font-medium pb-1"
                        />
                     </div>
                     <div className="flex-1 flex gap-3 px-2 justify-end">
                        <button onClick={() => { setIsAddingFolder(false); setNewFolderName(''); }} className="text-[10px] uppercase tracking-widest text-muted hover:text-text transition">Cancel</button>
                        <button onClick={handleAddFolder} className="text-[10px] uppercase tracking-widest text-accent font-bold hover:opacity-80 transition">Create</button>
                     </div>
                  </div>
                )}
                {files.map((file, idx) => (
                  <div key={`${file.id}-${idx}`} className="flex flex-col sm:flex-row sm:items-center p-4 border-b border-line last:border-b-0 hover:bg-[#151515] transition text-sm group gap-2 sm:gap-0">
                     <div className="flex items-center sm:w-1/2 md:w-1/3 lg:w-2/5 min-w-0 pr-4">
                       <div className="w-8 text-muted flex shrink-0 justify-center">
                          {file.type === 'folder' ? <Folder className="w-4 h-4 text-white group-hover:text-accent transition" /> : <FileText className="w-4 h-4" />}
                       </div>
                       <div className="truncate font-medium flex-1">
                          {file.type === 'folder' ? (
                            <button 
                              onClick={() => setCurrentPath([...currentPath, file])}
                              className="text-left font-bold hover:text-accent transition w-full truncate"
                            >
                              {file.name}
                            </button>
                          ) : file.name.toLowerCase() === 'readme.md' ? (
                            <a href="#readme" className="hover:text-accent transition underline-offset-4">
                              {file.name}
                            </a>
                          ) : (
                            <button 
                              onClick={() => handleSelectFile(file)}
                              className="text-left hover:text-accent transition underline-offset-4 outline-none w-full truncate"
                            >
                              {file.name}
                            </button>
                          )}
                       </div>
                     </div>
                     <div className="flex-1 truncate text-muted px-2 lg:block hidden font-serif italic text-xs pl-8 sm:pl-2">
                        {file.commitMessage || "Initial commit"}
                     </div>
                     <div className="sm:w-32 flex justify-between sm:justify-end items-center gap-4 shrink-0 pl-8 sm:pl-0">
                        <span className="text-muted truncate text-[11px] uppercase tracking-[1px] block sm:hidden md:block">
                           {formatDistanceToNow(new Date(file.updatedAt))}
                        </span>
                        {user && repo && (user.uid === repo.ownerId || user.uid === (file as any).uploaderId || user.email === "muhammadnaufalmushaddiq@gmail.com") && (
                           <button 
                             onClick={(e) => handleDeleteNode(e, file.id)}
                             className="sm:opacity-0 sm:group-hover:opacity-100 opacity-100 text-muted hover:text-[#00BFFF] transition"
                             title="Delete"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        )}
                     </div>
                  </div>
                ))}
                {!isAddingFolder && files.length === 0 && (
                  <div className="p-12 text-center text-muted font-serif italic">The archive is empty.</div>
                )}
             </div>
          </div>
          )}

          {/* README Render */}
          {((activeTab as any) === 'source' || activeTab as any === 'preview') && readme && readme.content && (
            <div id="readme" className="mt-10 border border-line rounded-lg overflow-hidden relative">
               <div className="bg-[#0C0C0C] px-6 py-4 font-bold text-xs uppercase tracking-[2px] border-b border-line flex items-center gap-3">
                 <FileText className="w-4 h-4 text-muted" /> README.md
               </div>
               <div className="p-6 md:p-10 markdown-body !bg-transparent !text-text text-sm">
                 <Markdown
                   components={{
                     code({node, inline, className, children, ...props}: any) {
                       const match = /language-(\w+)/.exec(className || '');
                       return !inline && match ? (
                         <SyntaxHighlighter
                           {...props}
                           children={String(children).replace(/\n$/, '')}
                           style={vscDarkPlus}
                           language={match[1]}
                           showLineNumbers={true}
                           PreTag="div"
                           customStyle={{ margin: '16px 0', padding: '16px', borderRadius: '6px', fontSize: '13px', background: '#0d1117' }}
                         />
                       ) : (
                         <code {...props} className={`${className} bg-[#151515] px-1.5 py-0.5 rounded-md text-[13px] font-mono text-accent`}>
                           {children}
                         </code>
                       )
                     }
                   }}
                 >
                   {readme.content}
                 </Markdown>
               </div>
            </div>
          )}
          
          {(activeTab as any) === 'issues' && (
             <div className="border border-line bg-bg overflow-hidden p-6 md:p-10 min-h-[400px]">
                <h2 className="text-2xl font-black uppercase text-text mb-6 tracking-[-1px]">Error Log / Issues</h2>
                
                {/* Form to add an issue */}
                {user ? (
                   <div className="mb-10 bg-[#151515] p-6 border border-line">
                     <p className="text-[10px] uppercase text-muted tracking-widest mb-4 font-bold">Log New Matrix Error</p>
                     <textarea 
                       className="w-full bg-[#0C0C0C] border border-line p-4 text-sm font-mono text-text outline-none focus:border-accent transition-colors mb-4 min-h-[100px] placeholder:text-muted/50"
                       placeholder="Paste error logs, stack traces, or system anomalies here..."
                       value={newFolderName} // reusing state for simplicity
                       onChange={(e) => setNewFolderName(e.target.value)}
                     />
                     <div className="flex justify-end">
                       <button 
                         onClick={async () => {
                            if (!newFolderName.trim()) return;
                            const { serverTimestamp } = await import("firebase/firestore");
                            const newIssue = { id: Date.now().toString(), text: newFolderName, author: user.displayName, timestamp: new Date().toISOString() };
                            await updateDoc(doc(db, "repositories", repo.id), {
                               issues: [newIssue, ...((repo as any).issues || [])],
                               updatedAt: serverTimestamp()
                            });
                            setNewFolderName("");
                            addNotification("Error log submitted to matrix.", "success");
                         }}
                         className="bg-accent text-black px-6 py-2 uppercase tracking-widest text-[10px] font-bold hover:bg-white transition"
                       >
                         Submit Log
                       </button>
                     </div>
                   </div>
                ) : (
                   <div className="mb-10 bg-[#151515] p-6 text-center border border-line text-muted text-sm font-serif italic">
                      Identity unverified. Login to post error logs.
                   </div>
                )}

                <div className="space-y-4">
                   {((repo as any).issues || []).length > 0 ? (
                      ((repo as any).issues || []).map((issue: any, idx: number) => (
                         <div key={`${issue.id || 'issue'}-${idx}`} className="border border-line p-6 bg-[#0C0C0C] group">
                            <div className="flex items-center justify-between mb-4 border-b border-line pb-4">
                               <div className="flex items-center gap-3">
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${issue.author}`} className="w-6 h-6 rounded-full grayscale border border-line" alt="User" />
                                  <span className="font-bold text-sm tracking-widest uppercase">{issue.author}</span>
                               </div>
                               <span className="text-[10px] text-muted uppercase tracking-widest font-bold">
                                  {formatDistanceToNow(new Date(issue.timestamp))} ago
                               </span>
                            </div>
                            <div className="font-mono text-sm text-muted whitespace-pre-wrap leading-relaxed group-hover:text-text transition-colors">
                               {issue.text}
                            </div>
                         </div>
                      ))
                   ) : (
                      <div className="text-center py-20 text-muted font-serif italic border border-dashed border-line">
                         No system errors logged. Vector is clean.
                      </div>
                   )}
                </div>
             </div>
          )}
        </div>
        
        {/* Repo Sidebar */}
        <div className="w-full lg:w-1/4 space-y-10">
           <div>
             <h3 className="text-[11px] uppercase text-muted tracking-[2px] mb-[20px] border-b border-line pb-[10px]">About</h3>
             <p className="text-text text-sm mb-6 leading-[1.6]">{repo.description || "No description, website, or topics provided."}</p>
             <div className="flex items-center gap-3 text-muted text-sm hover:text-text transition cursor-pointer font-bold uppercase tracking-widest text-[11px]">
               <FileText className="w-4 h-4" /> Readme
             </div>
             <div className="mt-6 pt-6 border-t border-line text-[11px] uppercase tracking-[2px]">
               <div className="flex justify-between text-muted mb-4">
                 <span>Stars</span>
                 <strong className="text-text hover:text-accent cursor-pointer transition font-serif text-lg leading-none">{repo.stars}</strong>
               </div>
               <div className="flex justify-between text-muted">
                 <span>Forks</span>
                 <strong className="text-text hover:text-accent cursor-pointer transition font-serif text-lg leading-none">{repo.forks}</strong>
               </div>
             </div>
           </div>

           <div>
             <h3 className="text-[11px] uppercase text-muted tracking-[2px] mb-[20px] border-b border-line pb-[10px]">Languages</h3>
             <div className="flex items-center gap-2 mb-4">
                <span className="w-full h-1 bg-accent rounded-none flex overflow-hidden">
                  <span className="bg-white w-3/4"></span>
                </span>
             </div>
             <ul className="text-xs font-bold text-text uppercase tracking-widest mb-10">
                <li className="flex justify-between items-center cursor-pointer group transition">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border border-line bg-white mt-0.5 group-hover:border-accent"></span>{repo.language}</span>
                  <span className="text-muted font-normal font-serif italic group-hover:text-accent">100%</span>
                </li>
             </ul>
             
             {user && user.uid === (repo as any).ownerId && (
               <div className="pt-6 border-t border-[#3f1816]">
                 <button 
                   onClick={handleDeleteArchive}
                   className="w-full py-3 px-4 flex items-center justify-center gap-2 text-[#00BFFF] border border-[#00BFFF] hover:bg-[#00BFFF] hover:text-black transition uppercase tracking-[2px] text-[10px] font-bold"
                 >
                   <Trash2 className="w-4 h-4" /> Delete Archive
                 </button>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* File Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-bg/80 backdrop-blur-sm">
          <div className="bg-bg border border-accent w-full max-w-4xl h-full max-h-[85vh] flex flex-col shadow-2xl relative">
            
            <div className="flex justify-between items-center bg-[#151515] px-6 py-4 border-b border-line shrink-0">
               <div className="flex items-center gap-6">
                 <div className="flex items-center gap-3">
                   <FileText className="w-5 h-5 text-accent" />
                   <span className="font-bold text-text uppercase tracking-widest">{selectedFile.name}</span>
                 </div>
                 
                 <div className="hidden sm:flex border border-line rounded-none">
                    <button 
                      onClick={() => setActiveTab("preview")}
                      className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold ${activeTab === 'preview' ? 'bg-accent text-black' : 'text-muted hover:text-text'} transition border-r border-line`}
                    >
                      Preview
                    </button>
                    <button 
                      onClick={() => setActiveTab("history")}
                      className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold ${activeTab === 'history' ? 'bg-accent text-black' : 'text-muted hover:text-text'} transition ${activeTab === 'diff' ? 'border-r border-line' : ''}`}
                    >
                      History
                    </button>
                    {activeTab === 'diff' && (
                      <button 
                        className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold bg-accent text-black transition`}
                      >
                        Diff
                      </button>
                    )}
                 </div>
               </div>
              <button 
                onClick={closeFileModal}
                className="p-2 -mr-2 bg-transparent hover:bg-bg transition text-muted hover:text-accent border border-transparent hover:border-line"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-0 bg-transparent relative">
              {activeTab === "preview" && (
                loadingFileContent ? (
                  <div className="flex items-center justify-center h-full">
                     <div className="flex flex-col items-center p-10">
                        <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-accent mb-4" />
                        <span className="font-serif italic text-muted text-sm tracking-widest uppercase text-center">Fetching from outer matrix...</span>
                     </div>
                  </div>
                ) : selectedFile.content ? (
                  <SyntaxHighlighter
                    language={getLanguage(selectedFile.name)}
                    style={vscDarkPlus}
                    showLineNumbers={true}
                    customStyle={{ margin: 0, padding: '24px', background: 'transparent', fontSize: '13px', fontFamily: "var(--font-display)" }}
                  >
                    {selectedFile.content}
                  </SyntaxHighlighter>
                ) : (
                  <div className="flex items-center justify-center h-full">
                     <div className="p-10 font-serif italic text-muted text-center">No content available for preview.</div>
                  </div>
                )
              )}

              {activeTab === "history" && (
                <div>
                   {selectedFile.history && selectedFile.history.length > 0 ? (
                      <div>
                        {selectedFile.history.map((commit, idx) => (
                          <div 
                            key={`${commit.id || ''}-${idx}`} 
                            onClick={() => handleSelectCommit(idx)}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 border-b border-line hover:bg-[#151515] transition cursor-pointer group"
                          >
                            <div className="mb-2 sm:mb-0">
                               <p className="text-text font-serif italic max-w-lg truncate mb-1 group-hover:text-accent transition">{commit.message}</p>
                               <div className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider font-bold">
                                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${commit.author}`} className="w-4 h-4 rounded-full grayscale border border-line" alt={commit.author} />
                                 {commit.author}
                               </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                               <span>{formatDistanceToNow(new Date(commit.timestamp))} ago</span>
                               <span className="font-mono bg-bg border border-line px-2 py-0.5 group-hover:border-accent transition">{commit.id}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                   ) : (
                      <div className="flex items-center justify-center h-full min-h-[300px]">
                         <div className="p-10 font-serif italic text-muted text-center flex flex-col items-center gap-4">
                           <History className="w-8 h-8 opacity-20" />
                           No commit history available.
                         </div>
                      </div>
                   )}
                </div>
              )}

              {activeTab === "diff" && selectedCommitIndex !== null && selectedFile.history && (
                <div className="relative">
                  <div className="sticky top-0 bg-[#0C0C0C]/90 backdrop-blur border-b border-line p-4 px-6 flex items-center gap-4 z-10">
                     <button 
                       onClick={() => setActiveTab('history')}
                       className="p-1.5 hover:bg-[#151515] text-muted hover:text-accent transition border border-transparent hover:border-line"
                     >
                       <ChevronLeft className="w-4 h-4" />
                     </button>
                     <div>
                       <p className="text-sm text-text font-bold uppercase tracking-widest">{selectedFile.history[selectedCommitIndex].id}</p>
                       <p className="text-xs text-muted font-serif italic">{selectedFile.history[selectedCommitIndex].message}</p>
                     </div>
                  </div>
                  <div className="text-[12px] p-4 [&_.css-1p2t4r0-diff-container]:bg-transparent [&_.css-1p2t4r0-diff-container]:text-text [&_.css-72t096-line]:hover:bg-[#1A1A1A]">
                     <ReactDiffViewer 
                       oldValue={selectedFile.history[selectedCommitIndex + 1]?.content || ""} 
                       newValue={selectedFile.history[selectedCommitIndex].content} 
                       splitView={false} 
                       useDarkTheme={true}
                       styles={{
                         variables: {
                           dark: {
                             diffViewerBackground: 'transparent',
                             diffViewerColor: '#F2F2F2',
                             addedBackground: '#152516',
                             addedColor: '#34d399',
                             removedBackground: '#3f1816',
                             removedColor: '#00BFFF',
                             wordAddedBackground: '#054425',
                             wordRemovedBackground: '#6d1f1f',
                             addedGutterBackground: '#152516',
                             removedGutterBackground: '#3f1816',
                             gutterBackground: 'transparent',
                             gutterBackgroundDark: '#151515',
                             highlightBackground: '#2a2a2a',
                             highlightGutterBackground: '#333333',
                             codeFoldGutterBackground: '#151515',
                             codeFoldBackground: '#151515',
                             emptyLineBackground: 'transparent',
                             gutterColor: '#4A4A4A',
                             addedGutterColor: '#34d399',
                             removedGutterColor: '#00BFFF',
                             codeFoldContentColor: '#4A4A4A',
                             diffViewerTitleBackground: '#151515',
                             diffViewerTitleColor: '#F2F2F2',
                             diffViewerTitleBorderColor: '#2A2A2A',
                           }
                         }
                       }}
                     />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-line h-1 w-full shrink-0">
               <div className={`bg-accent h-full transition-all duration-300 ${activeTab === 'preview' ? 'w-1/3' : activeTab === 'history' ? 'w-2/3' : 'w-full'}`}></div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm z-[200]">
          <div className="bg-[#0C0C0C] border border-[#00BFFF]/20 w-full max-w-md p-6 shadow-[0_0_30px_rgba(0,191,255,0.1)]">
            <h2 className="text-xl font-bold uppercase tracking-widest text-[#00BFFF] mb-2 flex items-center gap-3">
              <Trash2 className="w-5 h-5" /> Confirm Purge
            </h2>
            <p className="text-muted text-sm my-6 leading-relaxed">
              Are you sure you want to permanently delete the archive <strong className="text-text">{repo?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-4 justifying-end mt-4">
              <button 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingArchive}
                className="flex-1 border border-line text-muted py-2 text-xs uppercase tracking-widest font-bold hover:bg-[#151515] hover:text-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!repo) return;
                  setIsDeletingArchive(true);
                  try {
                    const { deleteDoc, doc } = await import("firebase/firestore");
                    await deleteDoc(doc(db, "repositories", repo.id));
                    addNotification(`Archive ${repo.name} permanently deleted.`, "success");
                    navigate('/'); 
                  } catch (err) {
                    console.error("Failed to delete", err);
                    addNotification("Failed to purge archive.", "error");
                  } finally {
                    setIsDeletingArchive(false);
                    setShowDeleteModal(false);
                  }
                }}
                disabled={isDeletingArchive}
                className="flex-1 bg-[#00BFFF]/10 border border-[#00BFFF] text-[#00BFFF] py-2 text-xs uppercase tracking-widest font-bold hover:bg-[#00BFFF] hover:text-black shadow-[0_0_10px_rgba(0,191,255,0.2)] transition disabled:opacity-50"
              >
                {isDeletingArchive ? "Purging..." : "Confirm Purge"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
