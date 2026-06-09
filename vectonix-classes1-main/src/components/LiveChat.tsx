import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Send, User as UserIcon, ShieldCheck, Paperclip, FileText, Image as ImageIcon, Music, Film, Loader2, Download, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  userId: string;
  userName: string;
  message?: string;
  fileUrl?: string;
  fileType?: 'image' | 'pdf' | 'audio' | 'video';
  timestamp: any;
  role: 'student' | 'admin';
}

interface LiveChatProps {
  classId: string;
  user: any;
  profile: any;
}

export const LiveChat: React.FC<LiveChatProps> = ({ classId, user, profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!classId) return;

    const q = query(
      collection(db, 'liveClasses', classId, 'chat'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `liveClasses/${classId}/chat`));

    return () => unsubscribe();
  }, [classId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      await addDoc(collection(db, 'liveClasses', classId, 'chat'), {
        userId: user?.uid || 'anonymous',
        userName: profile?.name || profile?.displayName || user?.email?.split('@')[0] || 'User',
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        role: isAdminUser ? 'admin' : 'student'
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `liveClasses/${classId}/chat`);
    } finally {
      setSending(false);
    }
  };

  const isAdminUser = profile?.role === 'admin' || profile?.isAdmin;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    // Check size limit (e.g., 20MB)
    if (file.size > 20 * 1024 * 1024) {
      alert('File is too large. Max 20MB allowed.');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      let type: 'image' | 'pdf' | 'audio' | 'video' = 'image';
      
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt || '')) type = 'image';
      else if (fileExt === 'pdf') type = 'pdf';
      else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExt || '')) type = 'audio';
      else if (['mp4', 'webm', 'mov'].includes(fileExt || '')) type = 'video';
      else {
        alert('Unsupported file type. Use images, PDF, audio, or video.');
        return;
      }

      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `live_chats/${classId}/${fileName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'liveClasses', classId, 'chat'), {
        userId: user?.uid || 'anonymous',
        userName: profile?.name || profile?.displayName || user?.email?.split('@')[0] || 'User',
        fileUrl: url,
        fileType: type,
        timestamp: serverTimestamp(),
        role: isAdminUser ? 'admin' : 'student'
      });

    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderFilePreview = (msg: Message) => {
    if (!msg.fileUrl) return null;

    switch (msg.fileType) {
      case 'image':
        return (
          <div className="relative group max-w-[200px]">
            <img 
              src={msg.fileUrl} 
              alt="Shared image" 
              className="rounded-xl border border-white/10 w-full hover:opacity-90 transition-all cursor-pointer" 
              onClick={() => window.open(msg.fileUrl, '_blank')}
            />
            <a 
              href={msg.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-white"
            >
              <Eye className="w-4 h-4" />
            </a>
          </div>
        );
      case 'pdf':
        return (
          <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-zinc-300 truncate">Document Session Share</p>
              <p className="text-[10px] text-zinc-500">Portable Document Format</p>
            </div>
            <a 
              href={msg.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        );
      case 'audio':
        return (
          <div className="flex flex-col gap-2 p-3 bg-white/5 border border-white/10 rounded-xl max-w-[240px]">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Voice / Audio Clip</span>
            </div>
            <audio controls src={msg.fileUrl} className="w-full h-8 brightness-90 contrast-125" />
          </div>
        );
      case 'video':
        return (
          <div className="flex flex-col gap-2 p-3 bg-white/5 border border-white/10 rounded-xl max-w-[240px]">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Video Snippet</span>
            </div>
            <video controls src={msg.fileUrl} className="w-full rounded-lg border border-white/10 aspect-video bg-black" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-white/10">
      {/* Chat header */}
      <div className="p-4 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Live Interaction
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active</span>
        </div>
      </div>

      {/* Messages area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex flex-col gap-1.5",
                msg.userId === user?.uid ? "items-end" : "items-start"
              )}
            >
              <div className={cn(
                "flex items-center gap-2",
                msg.userId === user?.uid ? "flex-row-reverse" : "flex-row"
              )}>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider",
                  msg.role === 'admin' ? "text-amber-400" : "text-zinc-500"
                )}>
                  {msg.userName}
                </span>
                {msg.role === 'admin' && (
                  <span className="px-1.5 py-0.5 bg-amber-400/10 text-amber-500 rounded text-[8px] font-black uppercase border border-amber-400/20">
                    Faculty
                  </span>
                )}
              </div>
              
              <div className={cn(
                "max-w-[85%] flex flex-col gap-2",
                msg.userId === user.uid ? "items-end" : "items-start"
              )}>
                {msg.message && (
                  <p className={cn(
                    "text-sm p-3 rounded-2xl leading-relaxed whitespace-pre-wrap break-words",
                    msg.userId === user?.uid 
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-500/10" 
                      : "bg-white/5 text-zinc-300 rounded-tl-none border border-white/5"
                  )}>
                    {msg.message}
                  </p>
                )}
                
                {renderFilePreview(msg)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-6">
             <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="w-8 h-8 text-zinc-600" />
             </div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Questions can be asked here</p>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Chat is monitored for safety</p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-white/10 bg-zinc-950">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
          <div className="relative group">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Post a doubt or share a resource..."
              rows={1}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none min-h-[48px] max-h-32 shadow-inner"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="absolute right-2 bottom-2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-20 disabled:grayscale transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*,application/pdf,audio/*,video/*"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 rounded-lg text-[10px] text-emerald-500 hover:text-white font-black uppercase tracking-widest transition-all border border-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                Share File
              </button>
              
              {uploading && (
                <span className="text-[10px] font-bold text-indigo-400 animate-pulse uppercase tracking-widest">
                  Uploading...
                </span>
              )}
            </div>
            
            <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-widest">
              Shift + Enter for new line
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

