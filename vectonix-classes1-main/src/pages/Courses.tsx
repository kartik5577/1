import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Eye, Search, Filter, LayoutGrid, List, Atom, GraduationCap, Clock, Star, ArrowRight, FileText, Video, Radio, X, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cn, formatCurrency, getItemImage } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import AdvancedSearch from '../components/AdvancedSearch';
import PriceDisplay from '../components/PriceDisplay';

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const searchTermParam = searchParams.get('search') || '';
  const courseParam = searchParams.get('course') || '';
  const subjectParam = searchParams.get('subject') || '';
  const contentTypeParam = searchParams.get('contentType') || 'All';
  
  const [searchTerm, setSearchTerm] = useState(searchTermParam);
  const [selectedSubject, setSelectedSubject] = useState(subjectParam || 'All');
  const [selectedCourseId, setSelectedCourseId] = useState(courseParam || 'All');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [allSearchableItems, setAllSearchableItems] = useState<any[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [selectedContentType, setSelectedContentType] = useState(contentTypeParam || 'All');

  useEffect(() => {
    setSearchTerm(searchTermParam);
    setSelectedSubject(subjectParam || 'All');
    setSelectedCourseId(courseParam || 'All');
    setSelectedContentType(contentTypeParam || 'All');
  }, [searchTermParam, subjectParam, courseParam, contentTypeParam]);

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'courses'));

    const subUnsub = onSnapshot(collection(db, 'subjects'), (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'));

    const lecUnsub = onSnapshot(collection(db, 'lectures'), (snap) => {
        setLectures(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'lecture' })));
    });

    const noteUnsub = onSnapshot(collection(db, 'notes'), (snap) => {
        setNotes(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'note' })));
    });

    const liveUnsub = onSnapshot(collection(db, 'liveClasses'), (snap) => {
        setLiveClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'live' })));
    });

    // Collect all items for autocomplete
    const unsubAll = () => {
      const unsubourses = onSnapshot(collection(db, 'courses'), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'course' as const }));
        setAllSearchableItems(prev => {
          const filtered = prev.filter(p => p.type !== 'course');
          return [...filtered, ...items];
        });
      });

      const unsubLectures = onSnapshot(collection(db, 'lectures'), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'lecture' as const, courseId: d.data().courseId, subjectId: d.data().subjectId }));
        setAllSearchableItems(prev => {
          const filtered = prev.filter(p => p.type !== 'lecture');
          return [...filtered, ...items];
        });
      });

      const unsubNotes = onSnapshot(collection(db, 'notes'), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'note' as const, courseId: d.data().courseId, subjectId: d.data().subjectId }));
        setAllSearchableItems(prev => {
          const filtered = prev.filter(p => p.type !== 'note');
          return [...filtered, ...items];
        });
      });

      const unsubLive = onSnapshot(collection(db, 'liveClasses'), (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'live' as const, courseId: d.data().courseId, subjectId: d.data().subjectId }));
        setAllSearchableItems(prev => {
          const filtered = prev.filter(p => p.type !== 'live');
          return [...filtered, ...items];
        });
      });

      return () => { unsubourses(); unsubLectures(); unsubNotes(); unsubLive(); };
    };

    const unsubAllItems = unsubAll();

    return () => { unsub(); subUnsub(); lecUnsub(); noteUnsub(); liveUnsub(); unsubAllItems(); };
  }, [user]);

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourseId === 'All' || c.id === selectedCourseId;
    const matchesSubject = selectedSubject === 'All' || c.subjectId === selectedSubject;
    return matchesSearch && matchesSubject && matchesCourse;
  });

  const getFilteredItems = (allItems: any[]) => {
    return allItems.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCourse = selectedCourseId === 'All' || item.courseId === selectedCourseId;
        const matchesSubject = selectedSubject === 'All' || item.subjectId === selectedSubject;
        return matchesSearch && matchesCourse && matchesSubject;
    });
  };

  const autocompleteResults = searchTerm.length >= 2 ? allSearchableItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourseId === 'All' || item.courseId === selectedCourseId || item.id === selectedCourseId;
    const matchesSubject = selectedSubject === 'All' || item.subjectId === selectedSubject || item.id === selectedSubject;
    return matchesSearch && matchesCourse && matchesSubject;
  }).slice(0, 8) : [];

  const handleAutocompleteClick = (item: any) => {
    if (item.type === 'course') {
      navigate(`/course/${item.id}`);
    } else {
      navigate(`/course/${item.courseId}?item=${item.id}&type=${item.type}`);
    }
    setIsSearchFocused(false);
  };

  const displayItems = (() => {
    let items: any[] = [];
    if (selectedContentType === 'All' || selectedContentType === 'Courses') {
      items = [...items, ...courses.map(c => ({ ...c, type: 'course' }))];
    }
    if (selectedContentType === 'All' || selectedContentType === 'Lectures') {
      items = [...items, ...lectures.map(l => ({ ...l, type: 'lecture' }))];
    }
    if (selectedContentType === 'All' || selectedContentType === 'Notes') {
      items = [...items, ...notes.map(n => ({ ...n, type: 'note' }))];
    }
    if (selectedContentType === 'All' || selectedContentType === 'Live') {
      items = [...items, ...liveClasses.map(lc => ({ ...lc, type: 'live' }))];
    }

    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCourse = selectedCourseId === 'All' || item.courseId === selectedCourseId || item.id === selectedCourseId;
      const matchesSubject = selectedSubject === 'All' || item.subjectId === selectedSubject;
      return matchesSearch && matchesSubject && matchesCourse;
    });
  })();

  const getBadgeText = (item: any) => {
    if (item.type === 'course') return 'COURSE';
    if (item.type === 'lecture') return 'VIDEO';
    if (item.type === 'note') return 'PDF NOTE';
    if (item.type === 'live') return 'LIVE';
    return 'CONTENT';
  };

  const getIcon = (item: any) => <ArrowRight className="w-5 h-5" />;

  const updateUrlFilters = (updates: any) => {
    const newParams = new URLSearchParams(searchParams);
    Object.keys(updates).forEach(key => {
      if (updates[key] === 'All' || !updates[key]) {
        newParams.delete(key);
      } else {
        newParams.set(key, updates[key]);
      }
    });
    navigate(`/courses?${newParams.toString()}`);
  };

  return (
    <div className="bg-white dark:bg-[#050505] min-h-screen text-zinc-900 dark:text-white transition-colors duration-300 pt-32 pb-24">
      <div className="container mx-auto px-6">
        <Breadcrumbs items={[{ label: 'Courses', active: true }]} className="mb-8" />
        {/* Header */}
        <div className="mb-16 space-y-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-500">
                Explore Our Catalog
              </div>
              <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none">
                All <span className="text-blue-500 italic">Courses</span>
              </h1>
              <p className="text-zinc-500 font-medium max-w-xl">
                Browse through our comprehensive library of courses designed by expert educators to help you master your subjects.
              </p>
            </div>
          </div>
          
          {/* Integrated Search & Filter Strip */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-[2.5rem] border border-zinc-100 dark:border-white/5 shadow-sm">
            <div className="relative flex-1" ref={searchRef}>
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search catalog..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-sm font-bold placeholder:text-zinc-400 outline-none border border-transparent focus:border-blue-500 transition-all dark:text-white"
              />
              
              <AnimatePresence>
                {isSearchFocused && autocompleteResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    {autocompleteResults.map((result) => (
                      <button 
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleAutocompleteClick(result)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left group"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                          result.type === 'course' ? "bg-blue-100 text-blue-600" :
                          result.type === 'lecture' ? "bg-purple-100 text-purple-600" :
                          result.type === 'note' ? "bg-amber-100 text-amber-600" :
                          "bg-rose-100 text-rose-600"
                        )}>
                          {result.type === 'course' ? <GraduationCap className="w-5 h-5" /> :
                           result.type === 'lecture' ? <Video className="w-5 h-5" /> :
                           result.type === 'note' ? <FileText className="w-5 h-5" /> :
                           <Radio className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight dark:text-white">{result.title}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{result.type}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
              <select 
                value={selectedContentType}
                onChange={(e) => updateUrlFilters({ contentType: e.target.value })}
                className="flex-1 lg:w-44 px-4 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none border border-transparent focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="All">All Content</option>
                <option value="Courses">Courses</option>
                <option value="Notes">PDF Notes</option>
                <option value="Lectures">Video Lectures</option>
                <option value="Live">Live Classes</option>
              </select>

              <select 
                value={selectedCourseId}
                onChange={(e) => updateUrlFilters({ course: e.target.value })}
                className="flex-1 lg:w-44 px-4 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none border border-transparent focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="All">All Courses</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>

              <select 
                value={selectedSubject}
                onChange={(e) => updateUrlFilters({ subject: e.target.value })}
                className="flex-1 lg:w-44 px-4 py-4 bg-white dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 outline-none border border-transparent focus:border-blue-500 transition-all appearance-none cursor-pointer"
              >
                <option value="All">All Subjects</option>
                {subjects.filter(s => selectedCourseId === 'All' || s.courseId === selectedCourseId).map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grid Container with Vertical Scroll */}
        <div className="bg-zinc-50 dark:bg-[#080808] h-[70vh] rounded-[2rem] border border-zinc-100 dark:border-white/5 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#0a0a0a]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Available Results</h3>
            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                <button className="p-1 px-2 text-[9px] font-black uppercase bg-white dark:bg-zinc-800 rounded shadow-sm text-zinc-900 dark:text-white">Grid</button>
                <button className="p-1 px-2 text-[9px] font-black uppercase text-zinc-400">List</button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
            {loading ? (
                 <div className="h-full flex items-center justify-center">
                    <Atom className="w-12 h-12 text-blue-600 animate-spin" />
                 </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4 pb-20">
                    {displayItems.length > 0 ? displayItems.map((item) => (
                        <motion.div 
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="group bg-white dark:bg-[#0f0f0f] border border-zinc-100 dark:border-white/5 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all cursor-pointer flex flex-col min-h-[340px] md:min-h-[400px] shadow-sm hover:shadow-xl hover:translate-y-[-4px]"
                            onClick={() => {
                                const isPurchased = profile?.purchasedItems?.includes(item.id) || 
                                                   (item.courseId && profile?.purchasedItems?.includes(item.courseId)) ||
                                                   isAdmin;
                                if (isPurchased) {
                                  if (item.type === 'course') {
                                    navigate('/dashboard');
                                  } else {
                                    navigate(`/course/${item.courseId}?item=${item.id}&type=${item.type}`);
                                  }
                                } else {
                                  if (item.type === 'course') {
                                    navigate(`/course/${item.id}`);
                                  } else {
                                    navigate(`/checkout/${item.id}?type=${item.type}`);
                                  }
                                }
                            }}
                        >
                            <div className="relative aspect-square overflow-hidden bg-zinc-50 dark:bg-zinc-900/40 p-8 flex items-center justify-center">
                                 <img 
                                    src={item.thumbnail || item.coverImage || item.imageUrl || item.imgUrl || getItemImage(item.title, item.subject)}
                                    alt={item.title}
                                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-700 opacity-95 group-hover:opacity-100"
                                    referrerPolicy="no-referrer"
                                 />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                 
                                 <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md",
                                        item.type === 'course' ? "bg-blue-600/80 text-white" :
                                        item.type === 'lecture' ? "bg-purple-600/80 text-white" :
                                        item.type === 'note' ? "bg-amber-600/80 text-white" :
                                        "bg-rose-600/80 text-white"
                                    )}>
                                        {getBadgeText(item)}
                                    </span>
                                    {(profile?.purchasedItems?.includes(item.id) || (item.courseId && profile?.purchasedItems?.includes(item.courseId)) || isAdmin) && (
                                      <span className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest shadow-lg bg-emerald-500 text-white flex items-center gap-1">
                                        <CheckCircle2 className="w-2 h-2" />
                                        Already Bought
                                      </span>
                                    )}
                                 </div>
                            </div>
                            <div className="p-3 flex flex-col flex-1 gap-2">
                                <h3 className="text-[11px] font-black uppercase tracking-tight line-clamp-2 leading-snug group-hover:text-blue-500 transition-colors">
                                    {item.title}
                                </h3>
                                
                                <div className="mt-auto flex items-center justify-between gap-2">
                                    <div className="flex flex-col font-sans">
                                        {item.isFree ? (
                                          <span className="text-[8px] font-black text-emerald-500 italic leading-none uppercase tracking-widest">Free Access</span>
                                        ) : (
                                          <PriceDisplay price={item.price} discountPrice={item.discountPrice} itemId={item.id} size="xs" />
                                        )}
                                    </div>
                                    <div className={cn(
                                       "p-1.5 rounded-lg transition-all",
                                       item.isFree 
                                         ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white"
                                         : "bg-zinc-50 dark:bg-white/5 text-zinc-400 group-hover:bg-blue-600 group-hover:text-white"
                                    )}>
                                        {getIcon(item)}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )) : (
                        <div className="col-span-full py-20 text-center space-y-4">
                            <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 flex items-center justify-center mx-auto">
                                <Search className="w-6 h-6 text-zinc-500" />
                            </div>
                            <div className="space-y-1">
                                 <h4 className="text-lg font-black uppercase tracking-tight">No items found</h4>
                                 <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Adjust filters to find items</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                onClick={() => setPreviewImage(null)}
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative max-w-5xl w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10"
                    onClick={e => e.stopPropagation()}
                >
                    <img 
                        src={previewImage} 
                        alt="Preview" 
                        className="w-full h-full object-contain bg-zinc-900" 
                    />
                    <button 
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
