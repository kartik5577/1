import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, BookOpen, Video, Radio, FileText, X, Atom, GraduationCap, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface SearchItem {
  id: string;
  title: string;
  type: 'course' | 'subject' | 'lecture' | 'note' | 'live';
  courseId?: string;
  subjectId?: string;
  category?: string;
}

export default function AdvancedSearch({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [allSearchableItems, setAllSearchableItems] = useState<SearchItem[]>([]);
  
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [selectedContentType, setSelectedContentType] = useState<string>('All');

  const [courseSearch, setCourseSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [isContentTypeDropdownOpen, setIsContentTypeDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const contentTypes = [
    { id: 'All', name: 'All Content', icon: Atom },
    { id: 'PDF', name: 'PDF Notes', icon: FileText },
    { id: 'Lecture', name: 'Video Lectures', icon: Video },
    { id: 'Live', name: 'Live Classes', icon: Radio },
  ];

  const itemsMap = useRef<Record<string, SearchItem[]>>({});

  useEffect(() => {
    const unsubourses = onSnapshot(collection(db, 'courses'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setCourses(data.sort((a: any, b: any) => a.title.localeCompare(b.title)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'courses'));

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setSubjects(data.sort((a: any, b: any) => a.title.localeCompare(b.title)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'));

    const updateAllItems = (key: string, items: SearchItem[]) => {
        itemsMap.current[key] = items;
        const allItems = Object.values(itemsMap.current).flat();
        setAllSearchableItems(allItems.sort((a, b) => a.title.localeCompare(b.title)));
    };

    // Combined search items for autocomplete
    const fetchAll = () => {
        const unsubourses = onSnapshot(collection(db, 'courses'), (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'course' as const }));
            updateAllItems('courses', items);
        });

        const unsubLectures = onSnapshot(collection(db, 'lectures'), (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'lecture' as const, courseId: d.data().courseId, subjectId: d.data().subjectId }));
            updateAllItems('lectures', items);
        });

        const unsubNotes = onSnapshot(collection(db, 'notes'), (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'note' as const, courseId: d.data().courseId, subjectId: d.data().subjectId }));
            updateAllItems('notes', items);
        });

        const unsubLive = onSnapshot(collection(db, 'liveClasses'), (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, title: d.data().title, type: 'live' as const, courseId: d.data().courseId, subjectId: d.data().subjectId }));
            updateAllItems('live', items);
        });

        return () => { unsubourses(); unsubLectures(); unsubNotes(); unsubLive(); };
    };

    const unsubAll = fetchAll();

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsCourseDropdownOpen(false);
        setIsSubjectDropdownOpen(false);
        setIsContentTypeDropdownOpen(false);
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        unsubourses();
        unsubSubjects();
        unsubAll();
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const filteredSubjects = subjects.filter(s => 
    (!selectedCourse || s.courseId === selectedCourse.id) &&
    s.title.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const autocompleteResults = searchTerm.length > 0 ? allSearchableItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = !selectedCourse || item.courseId === selectedCourse.id || item.id === selectedCourse.id;
    const matchesSubject = !selectedSubject || item.subjectId === selectedSubject.id || item.id === selectedSubject.id;
    const matchesContentType = selectedContentType === 'All' || 
      (selectedContentType === 'PDF' && item.type === 'note') ||
      (selectedContentType === 'Lecture' && item.type === 'lecture') ||
      (selectedContentType === 'Live' && item.type === 'live');

    return matchesSearch && matchesCourse && matchesSubject && matchesContentType;
  }).slice(0, 10) : [];

  const handleResultClick = (item: SearchItem) => {
    if (item.type === 'course') {
        navigate(`/course/${item.id}`);
    } else {
        navigate(`/course/${item.courseId}?item=${item.id}&type=${item.type === 'live' ? 'live' : item.type === 'note' ? 'note' : 'lecture'}`);
    }
    setIsOpen(false);
    setSearchTerm('');
    if (onClose) onClose();
  };

  const executeSearch = () => {
    let url = '/courses?';
    if (searchTerm) url += `search=${encodeURIComponent(searchTerm)}&`;
    if (selectedCourse) url += `course=${selectedCourse.id}&`;
    if (selectedSubject) url += `subject=${selectedSubject.id}&`;
    navigate(url);
    if (onClose) onClose();
  };

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto px-1 sm:px-6 relative z-[60]">
      <div className="bg-white dark:bg-zinc-900 shadow-2xl shadow-blue-500/10 rounded-[2.5rem] border border-zinc-100 dark:border-white/5 p-3 lg:p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 relative z-10">
        
        {/* Search Input Box */}
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-14 pr-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-sm font-bold placeholder:text-zinc-400 outline-none border border-transparent focus:border-blue-500/30 dark:text-white transition-all"
          />

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {isOpen && autocompleteResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-50 p-2"
              >
                <div className="p-4 border-b border-zinc-50 dark:border-white/5 mx-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Suggestions</span>
                </div>
                <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {autocompleteResults.map((item) => (
                        <div 
                            key={item.id}
                            onClick={() => handleResultClick(item)}
                            className="flex items-center justify-between p-4 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-2xl cursor-pointer group/item transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover/item:scale-110",
                                    item.type === 'course' ? "bg-blue-500/10 text-blue-500" :
                                    item.type === 'lecture' ? "bg-purple-500/10 text-purple-500" :
                                    item.type === 'note' ? "bg-amber-500/10 text-amber-500" :
                                    "bg-rose-500/10 text-rose-500"
                                )}>
                                    {item.type === 'course' ? <GraduationCap className="w-5 h-5" /> :
                                     item.type === 'lecture' ? <Video className="w-5 h-5" /> :
                                     item.type === 'note' ? <FileText className="w-5 h-5" /> :
                                     <Radio className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-black dark:text-white group-hover/item:text-blue-500 transition-colors uppercase tracking-tight truncate">{item.title}</h4>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{item.type}</p>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-300 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all shrink-0" />
                        </div>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden lg:block h-10 w-px bg-zinc-100 dark:bg-white/5 mx-2" />

        {/* Dropdowns Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-3">
            {/* Course Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => {
                        setIsCourseDropdownOpen(!isCourseDropdownOpen);
                        setIsSubjectDropdownOpen(false);
                        setIsContentTypeDropdownOpen(false);
                    }}
                    className="w-full lg:w-56 flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">
                            {selectedCourse ? selectedCourse.title : 'All Courses'}
                        </span>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", isCourseDropdownOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isCourseDropdownOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 right-0 lg:w-80 mt-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-[2rem] shadow-2xl z-50 overflow-hidden p-2"
                        >
                            <div className="p-3">
                                <input 
                                    type="text" 
                                    placeholder="Search Courses..."
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-500 transition-all dark:text-white"
                                />
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 space-y-1">
                                <button 
                                    onClick={() => {
                                        setSelectedCourse(null);
                                        setSelectedSubject(null);
                                        setIsCourseDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between group"
                                >
                                    All Courses
                                    {!selectedCourse && <Check className="w-3 h-3 text-blue-500" />}
                                </button>
                                {filteredCourses.map(course => (
                                    <button 
                                        key={course.id}
                                        onClick={() => {
                                            setSelectedCourse(course);
                                            setSelectedSubject(null);
                                            setIsCourseDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-5 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-500/10 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-blue-500 transition-all flex items-center justify-between group"
                                    >
                                        <span className="truncate">{course.title}</span>
                                        {selectedCourse?.id === course.id && <Check className="w-3 h-3 text-blue-500" />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Subject Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => {
                        setIsSubjectDropdownOpen(!isSubjectDropdownOpen);
                        setIsCourseDropdownOpen(false);
                        setIsContentTypeDropdownOpen(false);
                    }}
                    className="w-full lg:w-56 flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent"
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">
                            {selectedSubject ? selectedSubject.title : 'All Subjects'}
                        </span>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", isSubjectDropdownOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                    {isSubjectDropdownOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 right-0 lg:w-80 mt-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-[2rem] shadow-2xl z-50 overflow-hidden p-2"
                        >
                            <div className="p-3">
                                <input 
                                    type="text" 
                                    placeholder="Search Subjects..."
                                    value={subjectSearch}
                                    onChange={(e) => setSubjectSearch(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-500 transition-all dark:text-white"
                                />
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 space-y-1">
                                <button 
                                    onClick={() => {
                                        setSelectedSubject(null);
                                        setIsSubjectDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between"
                                >
                                    All Subjects
                                    {!selectedSubject && <Check className="w-3 h-3 text-blue-500" />}
                                </button>
                                {filteredSubjects.map(sub => (
                                    <button 
                                        key={sub.id}
                                        onClick={() => {
                                            setSelectedSubject(sub);
                                            setIsSubjectDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-5 py-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 transition-all flex items-center justify-between group"
                                    >
                                        <span className="truncate">{sub.title}</span>
                                        {selectedSubject?.id === sub.id && <Check className="w-3 h-3 text-emerald-500" />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>

        <div className="flex items-center gap-3 mt-2 lg:mt-0">
            <button 
                onClick={() => {
                    setSearchTerm('');
                    setSelectedCourse(null);
                    setSelectedSubject(null);
                    setSelectedContentType('All');
                }}
                className="flex-1 lg:flex-none py-4 px-6 lg:w-14 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 group shrink-0"
                title="Reset All Filters"
            >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                <span className="lg:hidden text-[10px] font-black uppercase tracking-widest">Reset All</span>
            </button>

            <button 
                onClick={executeSearch}
                className="flex-[2] lg:flex-none py-4 px-8 lg:w-16 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center gap-3 lg:gap-0 transition-all shadow-xl shadow-blue-500/20 active:scale-95 group shrink-0"
            >
                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="lg:hidden text-[10px] font-black uppercase tracking-widest">Search Catalog</span>
            </button>
        </div>

      </div>
    </div>
  );
}
