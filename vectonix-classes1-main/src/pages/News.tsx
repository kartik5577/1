import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Search, Filter, Calendar, FileText, ArrowRight, X, ExternalLink, RefreshCw } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';

interface Notice {
  id: string;
  title: string;
  content: string;
  type: 'news' | 'update' | 'announcement' | string;
  visibility: 'public' | 'both' | 'students';
  createdAt: any;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
}

export default function News() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notice[];
      const publicNotices = docs.filter(notice => ['public', 'both'].includes(notice.visibility || 'public'));
      setNotices(publicNotices);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching public notices:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredNotices = notices.filter(notice => {
    const matchesSearch = 
      notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || notice.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'news':
        return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'update':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
      default:
        return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
    }
  };

  return (
    <div className="bg-white dark:bg-[#050505] min-h-screen text-zinc-900 dark:text-white transition-colors duration-300 pt-32 pb-24">
      <div className="container mx-auto px-6 mb-8">
        <Breadcrumbs items={[{ label: 'News & Bulletins', active: true }]} />
      </div>

      {/* Header */}
      <section className="container mx-auto px-6 mb-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 rounded-[2rem] bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto mb-4"
          >
            <Bell className="w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tighter"
          >
            News & <span className="text-blue-500 italic">Announcements</span>
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs md:text-sm"
          >
            Stay updated with the latest circulars, batches, academic updates and events.
          </motion.p>
        </div>
      </section>

      {/* Controls & Search */}
      <section className="container mx-auto px-6 mb-12">
        <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-white/5 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search news & updates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-[#050505] rounded-2xl border border-zinc-200/50 dark:border-white/5 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 text-sm font-semibold transition-all shadow-sm"
            />
          </div>

          {/* Tab Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Updates' },
              { id: 'news', label: 'News' },
              { id: 'update', label: 'Academic circulars' },
              { id: 'announcement', label: 'Announcements' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedType === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white dark:bg-[#050505] border border-zinc-200/50 dark:border-white/5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Cards List */}
      <section className="container mx-auto px-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : filteredNotices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredNotices.map((notice, idx) => (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedNotice(notice)}
                className="group relative bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden p-8 shadow-xl shadow-zinc-200/50 dark:shadow-none hover:border-blue-500/30 transition-all flex flex-col justify-between cursor-pointer h-80"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${getBadgeStyle(notice.type)}`}>
                      {notice.type || 'circular'}
                    </span>
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5" />
                      {notice.createdAt ? new Date(notice.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}
                    </div>
                  </div>

                  <h3 className="text-xl font-black dark:text-white uppercase tracking-tight mb-3 group-hover:text-blue-500 transition-colors line-clamp-2">
                    {notice.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed line-clamp-3 mb-6">
                    {notice.content}
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between mt-auto">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 group-hover:translate-x-1.5 transition-transform inline-flex items-center gap-2">
                    Read Notice <ArrowRight className="w-4 h-4" />
                  </span>
                  {notice.attachmentUrl && (
                    <span className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-zinc-500">
                      <FileText className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-32 text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-[3rem] bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-200 mb-8 shadow-inner">
              <Bell className="w-12 h-12 text-zinc-300" />
            </div>
            <h2 className="text-2xl font-black text-zinc-400 uppercase tracking-tight">No Bulletins Available</h2>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest max-w-xs mt-4 leading-relaxed">
              Check back later for recent news and notices.
            </p>
          </div>
        )}
      </section>

      {/* Notice Detail Modal */}
      <AnimatePresence>
        {selectedNotice && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNotice(null)}
              className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] shadow-[0_32px_64px_rgba(0,0,0,0.3)] z-[610] overflow-hidden border border-zinc-100 dark:border-zinc-800 p-8 md:p-12 flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <span className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${getBadgeStyle(selectedNotice.type)}`}>
                  {selectedNotice.type || 'circular'}
                </span>
                <button 
                  onClick={() => setSelectedNotice(null)}
                  className="p-3 bg-zinc-50 hover:bg-red-500 dark:bg-zinc-800/50 hover:text-white dark:hover:bg-red-500 rounded-2xl text-zinc-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h3 className="text-2xl md:text-3xl font-black dark:text-white uppercase tracking-tight leading-tight mb-4">
                  {selectedNotice.title}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6">
                  <Calendar className="w-4 h-4" />
                  Posted on: {selectedNotice.createdAt ? new Date(selectedNotice.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : ''}
                </div>
                
                <div className="h-px bg-zinc-100 dark:bg-zinc-850 w-full mb-6" />

                <p className="text-zinc-600 dark:text-zinc-300 text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap">
                  {selectedNotice.content}
                </p>
              </div>

              {selectedNotice.attachmentUrl && (
                <div className="mt-4 p-5 bg-zinc-50 dark:bg-zinc-850/50 border border-zinc-100 dark:border-zinc-800 rounded-3xl flex items-center justify-between gap-4 group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-black dark:text-white uppercase tracking-tight line-clamp-1">{selectedNotice.attachmentName || 'circular_attachment'}</p>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">{selectedNotice.attachmentType?.split('/')[1] || 'Document'}</p>
                    </div>
                  </div>
                  <a 
                    href={selectedNotice.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-shrink-0 inline-flex items-center gap-2.5 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
                  >
                    <span>Download</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
