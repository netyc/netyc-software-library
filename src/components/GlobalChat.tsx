import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Search, Users, Image as ImageIcon, Send, ArrowLeft, Plus, Globe, Megaphone, MoreVertical, Smile, Sticker as StickerIcon, Edit2, Trash2 } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, limit, getDocs, deleteDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import EmojiPicker from 'emoji-picker-react';

const EMOJIS = ["😀", "😂", "🥰", "😎", "😭", "😤", "👍", "🙏", "🔥", "✨", "❤️", "💀", "👀", "💯", "🎉", "🚀", "🤔", "🥺", "🙌", "😅", "😡", "😱", "😴", "🥶", "🥳"];

const STICKERS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzQ1MGUzNmViOGNhOGJhZGU2MDI5MDU2MjA4NTkzZTM4ODlkMmI3YyZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/3o7TKSjRrfIPjeiVy0/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNTUzMTA4NmNjMGFkZmRjNTRkNzgxNDg0ZjZhMjc2NTM1MjA3NjhhOCZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/MDJ9PkxxvJqSy/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZGViMDI1YzA0MjlmOWNkYmEyYWIwOGQ3ODQ5OWUxZGQ5ZmFjZDZlYiZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/ule4ptS5CEhF7/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYzNjNDZhYzZmZTRlODY4ZWMyMGZmYzNjYTRlNWRmMjhkZTQyOWMzZiZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/3oriO0OEd9QIDdllqo/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWNlNWRmZWViOGMyODhmY2ExNjg1MmZkMGM1YjE0MzFjYTNmMWUwYSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/l41lOvg4y6B2d3DkQ/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjUwYzYwMjM2YmZmZDI4OWQwMjI3ZjFhMjdlNjIzYTlkMWE0MWJlMSZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/JIX9t2j0ZTN9S/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWRhNjBkMWEyN2ZmMjIyZGZkZDE4OGYyYzZlYmNhOGRiOWExNzMyMCZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/xT0xezQGU5xCDJuCPe/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTE5OGM1ZDllNWZiNTFjMzE0ODBkOTE5NzNmYzczMDc1NGNlN2MwMyZlcD12MV9pbnRlcm5hbF9naWZzX2dpZklkJmN0PWc/l378tQacih8MHIxcQ/giphy.gif",
];

export function GlobalChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  
  // Views: 'list', 'search', 'chat', 'create_group'
  const [view, setView] = useState<'list'|'search'|'chat'|'create_group'>('list');
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Group state
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  // Keep lastActive updated
  useEffect(() => {
    if (!user) return;
    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          lastActive: serverTimestamp()
        });
      } catch (e) {
        // ignore initially if fails
      }
    };
    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Load chats
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("participantIds", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
       console.error("Chats snapshot error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Handle Search Users
  useEffect(() => {
    if (view !== 'search' || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const searchUsers = async () => {
      try {
        const queryText = searchQuery.toLowerCase().trim();
        const q = query(
          collection(db, "users"), 
          where("username", ">=", queryText),
          where("username", "<=", queryText + "\uf8ff"),
          limit(10)
        );
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any));
        setSearchResults(results);
      } catch (e) {
        console.error("Error searching users", e);
      }
    };
    searchUsers();
  }, [searchQuery, view, user]);

  const startDirectMessage = async (otherUser: any) => {
    if (!user) return;
    
    // Check if chat exists
    let existingChat;
    if (otherUser.uid === user.uid) {
       existingChat = chats.find(c => !c.isGroup && c.participantIds.length === 1 && c.participantIds[0] === user.uid);
    } else {
       existingChat = chats.find(c => !c.isGroup && c.participantIds.includes(otherUser.uid) && c.participantIds.includes(user.uid) && c.participantIds.length === 2 && c.participantIds[0] !== c.participantIds[1]);
    }

    if (existingChat) {
      setActiveChat(existingChat);
      setView('chat');
      return;
    }
    
    // Create new
    try {
      const isSelf = otherUser.uid === user.uid;
      const chatRef = await addDoc(collection(db, "chats"), {
        isGroup: false,
        participantIds: isSelf ? [user.uid] : [user.uid, otherUser.uid],
        participantDetails: isSelf ? 
          { [user.uid]: { displayName: user.displayName || "User", photoURL: user.photoURL || "" } } :
          {
           [user.uid]: { displayName: user.displayName || "User", photoURL: user.photoURL || "" },
           [otherUser.uid]: { displayName: otherUser.displayName || "User", photoURL: otherUser.photoURL || "" }
          },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveChat({ id: chatRef.id, isGroup: false });
      setView('chat');
    } catch (e) {
      console.error(e);
    }
  };

  const startGroupChat = async () => {
    if (!user || selectedUsers.length === 0 || !groupName.trim()) return;
    try {
      const pIds = [user.uid, ...selectedUsers.map(u => u.uid)];
      const pDetails = {
         [user.uid]: { displayName: user.displayName || "User", photoURL: user.photoURL || "" }
      };
      selectedUsers.forEach(u => {
         pDetails[u.uid] = { displayName: u.displayName || "User", photoURL: u.photoURL || "" };
      });
      
      const chatRef = await addDoc(collection(db, "chats"), {
        isGroup: true,
        name: groupName,
        participantIds: pIds,
        participantDetails: pDetails,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveChat({ id: chatRef.id, isGroup: true, name: groupName });
      setView('chat');
      setGroupName("");
      setSelectedUsers([]);
    } catch (e) {
      console.error(e);
    }
  };

  const getChatName = (chat: any) => {
     if (chat.isGlobal) return chat.name;
     if (chat.isGroup) return chat.name;
     if (!chat.participantDetails) return "Unknown Chat";
     if (chat.participantIds.length === 1 && chat.participantIds[0] === user?.uid) return user?.displayName || "Me";
     const otherId = chat.participantIds.find((id: string) => id !== user?.uid);
     if (!otherId) return user?.displayName || "Me"; // Fallback
     return chat.participantDetails[otherId]?.displayName || "Unknown User";
  };

  const [showChatMenu, setShowChatMenu] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const deleteChat = async () => {
    if (!activeChat || activeChat.isGlobal) return;
    const chatId = activeChat.id;
    setActiveChat(null);
    setView('list');
    setShowChatMenu(false);
    setConfirmDelete(false);
    try {
      await deleteDoc(doc(db, "chats", chatId));
    } catch (e) {
      console.error("Error deleting chat:", e);
    }
  };

  const leaveGroup = async () => {
    if (!activeChat || activeChat.isGlobal || !activeChat.isGroup) return;
    const chatId = activeChat.id;
    const filteredIds = activeChat.participantIds.filter((id: string) => id !== user.uid);
    setActiveChat(null);
    setView('list');
    setShowChatMenu(false);
    setConfirmLeave(false);
    try {
      await updateDoc(doc(db, "chats", chatId), {
        participantIds: filteredIds,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error leaving group:", e);
    }
  };

  const [otherUserStatus, setOtherUserStatus] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user || view !== 'chat' || !activeChat || activeChat.isGlobal || activeChat.isGroup) {
      setOtherUserStatus(null);
      return;
    }
    const otherId = activeChat.participantIds.find((id: string) => id !== user.uid);
    if (!otherId) {
      setOtherUserStatus(null);
      return;
    }

    let lastActiveMs: number | null = null;
    let interval: NodeJS.Timeout;

    const updateStatus = () => {
      if (!lastActiveMs) return;
      const diffMs = Date.now() - lastActiveMs;
      if (diffMs < 3 * 60 * 1000) {
        setOtherUserStatus("Online");
      } else {
        const mins = Math.floor(diffMs / 60000);
        if (mins < 60) setOtherUserStatus(`Last seen ${mins}m ago`);
        else if (mins < 1440) setOtherUserStatus(`Last seen ${Math.floor(mins/60)}h ago`);
        else setOtherUserStatus(`Last seen ${Math.floor(mins/1440)}d ago`);
      }
    };

    const unsub = onSnapshot(doc(db, "users", otherId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lastActive) {
          lastActiveMs = data.lastActive.toMillis();
          updateStatus();
        } else {
          setOtherUserStatus("Offline");
        }
      }
    }, (error) => console.error(error));

    interval = setInterval(updateStatus, 60000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [view, activeChat, user?.uid]);

  if (!user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[320px] md:w-[380px] h-[500px] max-h-[80vh] bg-[#111111] border border-line shadow-2xl mb-4 flex flex-col overflow-visible relative text-left"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-line bg-bg flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2">
                 {view !== 'list' && (
                   <button onClick={() => setView('list')} className="text-muted hover:text-text transition"><ArrowLeft className="w-4 h-4" /></button>
                 )}
                 <div>
                   <h3 className="text-sm font-bold uppercase tracking-widest text-[#00BFFF] max-w-[200px] truncate">
                     {view === 'list' && "Comms"}
                     {view === 'search' && "Find Users"}
                     {view === 'create_group' && "New Group"}
                     {view === 'chat' && activeChat && getChatName(activeChat)}
                   </h3>
                   {otherUserStatus && (
                     <p className={`text-[10px] uppercase tracking-widest ${otherUserStatus === 'Online' ? 'text-accent' : 'text-muted'}`}>
                       {otherUserStatus}
                     </p>
                   )}
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 {view === 'chat' && activeChat && !activeChat.isGlobal && (
                   <div className="relative" ref={menuRef}>
                     <button onClick={() => setShowChatMenu(!showChatMenu)} className="text-muted hover:text-text transition p-1 relative z-50">
                       <MoreVertical className="w-4 h-4" />
                     </button>
                     {showChatMenu && (
                       <div className="absolute right-0 top-full mt-2 w-[140px] bg-[#151515] border border-line shadow-xl py-1 z-50">
                         {activeChat.isGroup ? (
                            <>
                              <button onClick={leaveGroup} className="w-full text-left px-4 py-2 text-xs text-text hover:bg-accent hover:text-black transition uppercase tracking-widest break-words">Keluar Grup</button>
                              <button onClick={deleteChat} className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-500 hover:text-white transition uppercase tracking-widest break-words">Hapus Grup</button>
                            </>
                         ) : (
                            <button onClick={deleteChat} className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-500 hover:text-white transition uppercase tracking-widest break-words">Hapus Chat</button>
                         )}
                       </div>
                     )}
                   </div>
                 )}
                 <button onClick={() => setIsOpen(false)} className="text-muted hover:text-text transition p-1"><X className="w-4 h-4" /></button>
               </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-visible relative h-full flex flex-col min-h-0">
              {view === 'list' && (
                <div className="flex flex-col h-full bg-[#111111] min-h-0">
                  <div className="p-2 gap-2 flex shrink-0">
                    <button onClick={() => setView('search')} className="flex-1 flex items-center justify-center gap-2 bg-[#151515] hover:bg-[#222] p-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-text transition border border-line">
                       <Search className="w-3 h-3" /> Find
                    </button>
                    <button onClick={() => setView('create_group')} className="flex-1 flex items-center justify-center gap-2 bg-[#151515] hover:bg-[#222] p-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-text transition border border-line">
                       <Users className="w-3 h-3" /> Group
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto hide-scrollbar min-h-0">
                     <div 
                       onClick={() => { setActiveChat({ id: 'announcements', isGlobal: true, name: 'Announcements', isGroup: true }); setView('chat'); }}
                       className="p-4 border-b border-line hover:bg-[#151515] cursor-pointer transition flex items-center gap-3"
                     >
                       <div className="w-10 h-10 rounded-full bg-[#222] border border-accent shrink-0 flex items-center justify-center overflow-hidden">
                          <Megaphone className="w-5 h-5 text-accent" />
                       </div>
                       <div className="overflow-hidden">
                         <p className="text-sm font-bold tracking-tight text-accent truncate">Announcements</p>
                         <p className="text-[10px] text-muted truncate">Official Transmissions</p>
                       </div>
                     </div>
                     <div 
                       onClick={() => { setActiveChat({ id: 'public', isGlobal: true, name: 'Global Public Lounge', isGroup: true }); setView('chat'); }}
                       className="p-4 border-b border-line hover:bg-[#151515] cursor-pointer transition flex items-center gap-3"
                     >
                       <div className="w-10 h-10 rounded-full bg-[#222] border border-[#00BFFF] shrink-0 flex items-center justify-center overflow-hidden">
                          <Globe className="w-5 h-5 text-[#00BFFF]" />
                       </div>
                       <div className="overflow-hidden">
                         <p className="text-sm font-bold tracking-tight text-[#00BFFF] truncate">Global Public Lounge</p>
                         <p className="text-[10px] text-muted truncate">Chat with all connected users</p>
                       </div>
                     </div>
                     {chats.map(chat => (
                        <div 
                          key={chat.id} 
                          onClick={() => { setActiveChat(chat); setView('chat'); }}
                          className="p-4 border-b border-line hover:bg-[#151515] cursor-pointer transition flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#222] border border-line shrink-0 flex items-center justify-center overflow-hidden">
                             {chat.isGroup ? <Users className="w-5 h-5 text-muted" /> : (
                               <img src={
                                  chat.participantIds.length === 1 ? (chat.participantDetails?.[user.uid]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`) :
                                  (chat.participantDetails?.[chat.participantIds.find((id: string) => id !== user.uid)]?.photoURL ||
                                  "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback")
                               } className="w-full h-full object-cover" alt="" />
                             )}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold tracking-tight text-text truncate">{getChatName(chat)}</p>
                            <p className="text-[10px] text-muted truncate">{chat.lastMessage || "No messages yet"}</p>
                          </div>
                        </div>
                     ))}
                     {chats.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-muted opacity-50 p-6 text-center">
                           <MessageSquare className="w-8 h-8 mb-2" />
                           <p className="text-xs uppercase tracking-widest">No active comms</p>
                        </div>
                     )}
                  </div>
                </div>
              )}

              {view === 'search' && (
                <div className="flex flex-col h-full bg-[#111111]">
                   <div className="p-4 shrink-0">
                     <input 
                       autoFocus
                       type="text"
                       placeholder="Search by username..."
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       className="w-full bg-[#151515] border border-line p-3 text-sm focus:border-accent outline-none text-text"
                     />
                   </div>
                   <div className="flex-1 overflow-y-auto hide-scrollbar">
                      {searchResults.map(u => (
                         <div key={u.id} className="p-4 border-b border-line flex items-center justify-between hover:bg-[#151515] cursor-pointer transition" onClick={() => startDirectMessage(u)}>
                            <div className="flex items-center gap-3">
                              <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`} alt="" className="w-8 h-8 rounded-full border border-line" />
                              <div>
                                <p className="text-sm font-bold">{u.displayName}</p>
                                <p className="text-[10px] text-accent">@{u.username}</p>
                                <p className="text-[10px] text-muted">{
                                   (u.lastActive && (Date.now() - u.lastActive.toMillis()) < 5 * 60 * 1000) ? <span className="text-[#39FF14]">Online</span> : <span>Offline</span>
                                }</p>
                              </div>
                            </div>
                            <MessageSquare className="w-4 h-4 text-muted" />
                         </div>
                      ))}
                   </div>
                </div>
              )}

              {view === 'create_group' && (
                <div className="flex flex-col h-full bg-[#111111]">
                   <div className="p-4 shrink-0 border-b border-line">
                     <input 
                       autoFocus
                       type="text"
                       placeholder="Group Name..."
                       value={groupName}
                       onChange={e => setGroupName(e.target.value)}
                       className="w-full bg-[#151515] border border-line p-3 text-sm focus:border-accent outline-none text-text mb-4"
                     />
                     <p className="text-[10px] uppercase font-bold tracking-widest text-muted mb-2">Select Members from History:</p>
                     <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                        {selectedUsers.map(su => (
                           <div key={su.uid} className="bg-accent/20 border border-accent text-accent px-2 py-1 text-[10px] rounded-full flex items-center gap-1 shrink-0">
                             {su.displayName} <button onClick={() => setSelectedUsers(prev => prev.filter(u => u.uid !== su.uid))}><X className="w-3 h-3" /></button>
                           </div>
                        ))}
                     </div>
                   </div>
                   <div className="flex-1 overflow-y-auto hide-scrollbar">
                      {/* Extract unique users from past chats */}
                      {(() => {
                         const pastUsersMap = new Map();
                         chats.forEach(c => {
                           if (!c.isGroup && c.participantDetails) {
                              const otherId = c.participantIds.find((id: string) => id !== user.uid);
                              if (otherId && c.participantDetails[otherId]) {
                                pastUsersMap.set(otherId, { uid: otherId, ...c.participantDetails[otherId] });
                              }
                           }
                         });
                         const pastUsers = Array.from(pastUsersMap.values());
                         if (pastUsers.length === 0) return <p className="p-4 text-muted text-xs text-center">No past contacts found to add.</p>;
                         return pastUsers.map(u => (
                            <div key={u.uid} className="p-4 border-b border-line flex items-center justify-between" onClick={() => {
                               if (!selectedUsers.find(su => su.uid === u.uid)) setSelectedUsers(prev => [...prev, u]);
                            }}>
                               <div className="flex items-center gap-3">
                                 <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-line" />
                                 <p className="text-sm font-bold">{u.displayName}</p>
                               </div>
                               <button className="text-accent p-1"><Plus className="w-4 h-4" /></button>
                            </div>
                         ));
                      })()}
                   </div>
                   {groupName.trim() && selectedUsers.length > 0 && (
                      <div className="p-4 bg-bg border-t border-line shrink-0">
                        <button onClick={startGroupChat} className="w-full bg-accent text-black font-black uppercase tracking-widest text-xs p-3 hover:opacity-80 transition">Create Group</button>
                      </div>
                   )}
                </div>
              )}

              {view === 'chat' && activeChat && (
                <ChatRoom chat={activeChat} user={user} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-accent rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:scale-110 transition-transform z-10 relative overflow-hidden"
      >
         <MessageSquare className="w-6 h-6 z-10" />
      </button>
    </div>
  );
}

function ChatRoom({ chat, user }: { chat: any, user: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const path = chat.isGlobal ? collection(db, "globalChats", chat.id, "messages") : collection(db, "chats", chat.id, "messages");
    const q = query(
      path,
      orderBy("createdAt", "asc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }, (error) => {
       console.error("Messages snapshot error:", error);
    });
    return () => unsubscribe();
  }, [chat.id]);

  const sendMessage = async (content: string, type: 'text' | 'image' = 'text') => {
    if (!content.trim()) return;
    try {
      const pathCollection = chat.isGlobal ? collection(db, "globalChats", chat.id, "messages") : collection(db, "chats", chat.id, "messages");
      let senderName = user.displayName || "User";
      
      if (chat.isGlobal && chat.id === 'announcements') {
         senderName = "Admin";
      }

      if (editingMessage && type === 'text') {
         const msgRef = doc(pathCollection, editingMessage.id);
         await updateDoc(msgRef, {
            text: content,
            updatedAt: serverTimestamp()
         });
         setEditingMessage(null);
      } else {
         await addDoc(pathCollection, {
           chatId: chat.id,
           senderId: user.uid,
           senderName,
           senderPhotoUrl: user.photoURL || "",
           text: content,
           type: type,
           createdAt: serverTimestamp()
         });
      }
      
      if (!chat.isGlobal) {
        await updateDoc(doc(db, "chats", chat.id), {
          lastMessage: type === 'image' ? '[Image]' : content.substring(0, 50),
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setText("");
      setShowEmoji(false);
      setShowStickers(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMessage = async (msgId: string) => {
    try {
      const pathCollection = chat.isGlobal ? collection(db, "globalChats", chat.id, "messages") : collection(db, "chats", chat.id, "messages");
      await deleteDoc(doc(pathCollection, msgId));
    } catch (e) {
      console.error(e);
    }
  };

  const startEditMessage = (m: any) => {
     setEditingMessage(m);
     setText(m.text);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
       const base64 = reader.result as string;
       sendMessage(base64, 'image');
    };
    reader.readAsDataURL(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#111111] min-h-0 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar flex flex-col min-h-0 relative z-0" ref={scrollRef}>
        {messages.map((m, idx) => {
           const isMe = m.senderId === user.uid;
            return (
             <div key={`${m.id}-${idx}`} className={`flex max-w-[80%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'} gap-2`}>
                {(chat.isGroup && m.senderName !== "Admin") && (
                  <img 
                    src={m.senderPhotoUrl || (isMe ? user.photoURL : '') || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.senderId}`} 
                    className="w-6 h-6 rounded-full self-end border border-line object-cover shrink-0" 
                    alt="avatar"
                  />
                )}
                {m.senderName === "Admin" && (
                  <div className="w-6 h-6 rounded-full self-end border border-accent bg-[#222] shrink-0 flex items-center justify-center">
                    <Megaphone className="w-3 h-3 text-accent" />
                  </div>
                )}
                <div className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}>
                  {chat.isGroup && m.senderName !== "Admin" && <span className={`text-[9px] text-muted mb-1 block px-1`}>{isMe ? "You" : m.senderName}</span>}
                  {m.senderName === "Admin" && <span className="text-[9px] text-accent font-bold uppercase tracking-widest mb-1 block px-1">ADMIN</span>}
                  <div className={`relative p-3 text-sm shadow-sm ${isMe ? 'bg-accent text-black rounded-l-xl rounded-tr-xl' : (m.senderName === "Admin" ? 'bg-accent/10 border border-accent text-accent rounded-r-xl rounded-tl-xl' : 'bg-[#151515] text-text border border-line rounded-r-xl rounded-tl-xl')}`}>
                     {m.type === 'image' ? (
                       <img src={m.text} alt="Shared" className="max-w-[200px] rounded-lg" />
                     ) : (
                       <p className="break-words">{m.text}</p>
                     )}
                     
                     {/* Hover Actions */}
                     {isMe && m.type === 'text' && (
                        <div className="absolute top-0 right-full mr-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                           <button onClick={() => startEditMessage(m)} className="p-1 bg-[#151515] text-muted hover:text-accent rounded-full border border-line shadow-sm"><Edit2 className="w-3 h-3" /></button>
                           <button onClick={() => deleteMessage(m.id)} className="p-1 bg-[#151515] text-muted hover:text-red-500 rounded-full border border-line shadow-sm"><Trash2 className="w-3 h-3" /></button>
                        </div>
                     )}
                  </div>
                  <span className="text-[8px] text-muted mt-1 px-1 flex items-center gap-1">
                    {m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                    {m.updatedAt && <span className="text-accent">(edited)</span>}
                  </span>
                </div>
             </div>
           );
         })}
      </div>
      {(!chat.isGlobal || chat.id !== 'announcements' || user.email === 'muhammadnaufalmushaddiq@gmail.com') && (
         <div className="relative z-20 p-3 bg-bg border-t border-line shrink-0 flex items-center gap-2">
            {showEmoji && (
               <div className="absolute bottom-[60px] left-0 md:-left-[300px] z-[99999] shadow-2xl">
                  <EmojiPicker onEmojiClick={(c) => setText(text + c.emoji)} theme={'dark' as any} />
               </div>
            )}
            {showStickers && (
               <div className="absolute bottom-[60px] left-0 bg-[#151515] border border-line p-2 grid grid-cols-2 gap-2 w-[240px] shadow-xl z-[100] rounded max-h-64 overflow-y-auto hide-scrollbar">
                 {STICKERS.map((s, idx) => <img key={idx} src={s} onClick={() => sendMessage(s, 'image')} className="cursor-pointer hover:opacity-80 transition object-cover w-full h-24 rounded bg-bg" />)}
               </div>
            )}
            
            <button type="button" onClick={() => { setShowEmoji(!showEmoji); setShowStickers(false); }} className="text-muted hover:text-accent p-2 transition">
               <Smile className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => { setShowStickers(!showStickers); setShowEmoji(false); }} className="text-muted hover:text-accent p-2 transition">
               <StickerIcon className="w-5 h-5" />
            </button>

            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-muted hover:text-accent p-2 transition">
               <ImageIcon className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
               {editingMessage && (
                  <div className="absolute -top-[30px] left-0 text-[10px] text-accent flex items-center gap-2 bg-[#151515] px-2 py-1 rounded-t border border-b-0 border-line">
                     Editing message... <X className="w-3 h-3 cursor-pointer" onClick={() => { setEditingMessage(null); setText(""); }} />
                  </div>
               )}
               <input 
                  type="text" 
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage(text)}
                  placeholder="Type a message..."
                  className={`w-full bg-[#151515] border border-line ${editingMessage ? 'rounded-b-none rounded-t border-t-0' : 'rounded-full'} px-4 py-2 text-sm focus:border-accent outline-none text-text transition-all`}
               />
            </div>
            <button onClick={() => sendMessage(text)} disabled={!text.trim()} className="text-accent disabled:opacity-50 hover:scale-110 p-2 transition">
               <Send className="w-5 h-5" />
            </button>
         </div>
      )}
    </div>
  );
}
