import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, BookOpen, ShieldCheck, Star, ArrowLeft, Loader2, PlayCircle, FileText, Video, Lock, Eye, AlertCircle, X, Radio, Calendar, Users, ChevronDown } from 'lucide-react';
import { cn, formatCurrency, getItemImage } from '../lib/utils';
import SecurePDFViewer from '../components/SecurePDFViewer';
import SecureVideoViewer from '../components/SecureVideoViewer';
import { VirtualClassroom } from '../components/VirtualClassroom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import PriceDisplay from '../components/PriceDisplay';

import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export default function CourseDetails() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('item');
  const itemType = searchParams.get('type');
  const isCourseView = (id && id !== 'individual') && (!itemType || itemType === 'course');
  
  const [course, setCourse] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [individualItem, setIndividualItem] = useState<any>(null);
  const [lectures, setLectures] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [viewerConfig, setViewerConfig] = useState<{ url: string, title: string, isOpen: boolean }>({
    url: '',
    title: '',
    isOpen: false
  });
  const [videoViewerConfig, setVideoViewerConfig] = useState<{ url: string, title: string, isOpen: boolean }>({
    url: '',
    title: '',
    isOpen: false
  });
  const [classroomConfig, setClassroomConfig] = useState({
    isOpen: false,
    roomName: '',
    userName: '',
    classId: '',
    isModerator: false,
    externalUrl: ''
  });
  const [fetchingSecure, setFetchingSecure] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<{ url: string, title: string } | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<{ [noteId: string]: boolean }>({});
  const [noteCurriculum, setNoteCurriculum] = useState<{ [noteId: string]: { units: any[], chapters: { [unitId: string]: any[] } } }>({});
  const [loadingNoteData, setLoadingNoteData] = useState<{ [noteId: string]: boolean }>({});
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [courseReviews, setCourseReviews] = useState<any[]>([]);
  
  const { user, profile, isAdmin } = useAuth();
  const { addToCart, isInCart } = useCart();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showDemoPayment, setShowDemoPayment] = useState<any | null>(null);

  const getNoteAdjustedPrice = (note: any) => {
    const curriculum = noteCurriculum[note.id];
    if (!curriculum || !curriculum.units) return {
      price: Number(note.price) || 0,
      discountPrice: Number(note.discountPrice || note.price) || 0,
      isFullyOwned: profile?.purchasedItems?.includes(note.id) || isAdmin
    };

    const unpurchasedUnits = curriculum.units.filter(u => 
      !profile?.purchasedItems?.includes(u.id) && !u.isFree && !isAdmin && !profile?.purchasedItems?.includes(note.id)
    );

    const price = unpurchasedUnits.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    const discountPrice = unpurchasedUnits.reduce((acc, curr) => acc + (Number(curr.discountPrice || curr.price) || 0), 0);

    return {
      price,
      discountPrice,
      isFullyOwned: (unpurchasedUnits.length === 0 && curriculum.units.length > 0) || profile?.purchasedItems?.includes(note.id) || isAdmin
    };
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchSecureUrl = async (itemId: string, type: 'lecture' | 'note' | 'live', fallbackUrl?: string) => {

    const collectionName = type === 'note' ? 'notes' : 
                         type === 'lecture' ? 'lectures' : 'liveClasses';
    const path = `${collectionName}/${itemId}/secure/content`;
    try {
      setFetchingSecure(itemId);
      
      const secureDocRef = doc(db, collectionName, itemId, 'secure', 'content');
      const secureSnap = await getDoc(secureDocRef);
      
      if (secureSnap.exists()) {
        const data = secureSnap.data();
        return type === 'note' ? data.pdfUrl : (data.videoUrl || data.meetingUrl);
      }
      return fallbackUrl;
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, path);
      }
      console.error('Error fetching secure URL:', error);
      return fallbackUrl;
    } finally {
      setFetchingSecure(null);
    }
  };


  const handleOpenViewer = async (item: any, type: 'lecture' | 'note' | 'live') => {
    // Check ownership/access
    const isOwned = profile?.purchasedItems?.includes(item.id) || 
                    (id && profile?.purchasedItems?.includes(id)) || 
                    (item.courseId && profile?.purchasedItems?.includes(item.courseId)) || 
                    item.isFree === true || 
                    Number(item.price || 0) <= 0 ||
                    isAdmin;

    if (!isOwned) {
      setNotification({ message: 'Please purchase this class to access it.', type: 'error' });
      return;
    }

    if (type === 'live') {
      const sanitizedRoom = (item.title || 'Class').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      if (item.isInternalRoom) {
        setClassroomConfig({
          isOpen: true,
          roomName: sanitizedRoom,
          userName: profile?.fullName || profile?.name || user?.email?.split('@')[0] || 'Student',
          classId: item.id,
          isModerator: !!isAdmin,
          externalUrl: ''
        });
      } else {
        const url = await fetchSecureUrl(item.id, type, item.meetingUrl);
        
        if (!url && !item.isFree && Number(item.price || 0) > 0 && !isAdmin) {
          setNotification({ message: 'Please purchase this class to join.', type: 'error' });
          return;
        }

        setClassroomConfig({
          isOpen: true,
          roomName: sanitizedRoom,
          userName: profile?.fullName || profile?.name || user?.email?.split('@')[0] || 'Student',
          classId: item.id,
          isModerator: !!isAdmin,
          externalUrl: url || item.meetingUrl || ''
        });
      }
      return;
    }

    try {
      const url = await fetchSecureUrl(item.id, type, type === 'note' ? item.pdfUrl : (item.videoUrl || item.meetingUrl));
      if (!url) {
        setNotification({ 
          message: 'Content URL not found in secure storage. Please refresh or contact support.', 
          type: 'error' 
        });
        return;
      }
      
      if (type === 'note') {
        setViewerConfig({ url, title: item.title, isOpen: true });
      } else {
        setVideoViewerConfig({ url, title: item.title, isOpen: true });
      }
    } catch (err) {
      console.error('Error in handleOpenViewer:', err);
      setNotification({ message: 'Failed to access secure content due to permission error.', type: 'error' });
    }
  };
  
  const toggleNoteCurriculum = async (noteId: string) => {
    if (expandedNotes[noteId]) {
      setExpandedNotes(prev => ({ ...prev, [noteId]: false }));
      return;
    }

    setExpandedNotes(prev => ({ ...prev, [noteId]: true }));

    // If already loaded, don't fetch again
    if (noteCurriculum[noteId]) return;

    setLoadingNoteData(prev => ({ ...prev, [noteId]: true }));
    try {
      // Fetch units without server-side orderBy
      const unitsQuery = query(
        collection(db, 'units'),
        where('noteId', '==', noteId)
      );
      const unitsSnap = await getDocs(unitsQuery);
      const fetchedUnits = unitsSnap.docs
        .map(doc => ({ id: doc.id, subType: 'unit', ...doc.data() }) as any)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      // Fetch chapters for each unit
      const chaptersMap: { [key: string]: any[] } = {};
      for (const unit of fetchedUnits) {
        const chaptersQuery = query(
          collection(db, 'chapters'),
          where('unitId', '==', unit.id)
        );
        const chaptersSnap = await getDocs(chaptersQuery);
        chaptersMap[unit.id] = chaptersSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }) as any)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
      }

      setNoteCurriculum(prev => ({
        ...prev,
        [noteId]: { units: fetchedUnits, chapters: chaptersMap }
      }));
    } catch (err) {
      console.error('Error fetching note curriculum:', err);
      setNotification({ message: 'Failed to load curriculum details.', type: 'error' });
    } finally {
      setLoadingNoteData(prev => ({ ...prev, [noteId]: false }));
    }
  };

  const handleOpenSecureContent = async (itemId: string, collectionName: string, title: string, type: 'pdf' | 'video') => {
    try {
      const secureDocRef = doc(db, collectionName, itemId, 'secure', 'content');
      const secureSnap = await getDoc(secureDocRef);
      let url = '';
      
      if (secureSnap.exists()) {
        const data = secureSnap.data();
        url = type === 'pdf' ? data.pdfUrl : data.videoUrl;
      }
      
      if (!url) {
        // Fallback to public url if secure doc doesn't exist (though it should)
        const publicDoc = await getDoc(doc(db, collectionName, itemId));
        const publicData = publicDoc.data();
        url = type === 'pdf' ? publicData?.pdfUrl : publicData?.videoUrl;
      }

      if (url) {
        if (type === 'pdf') {
          setViewerConfig({ url, title, isOpen: true });
        } else {
          setVideoViewerConfig({ url, title, isOpen: true });
        }
      } else {
        setNotification({ message: 'Content URL not found.', type: 'error' });
      }
    } catch (err) {
      console.error('Error opening content:', err);
      setNotification({ message: 'Error accessing content.', type: 'error' });
    }
  };

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const promises: Promise<void>[] = [];

        // Fetch Course Metadata if not on "individual only" view
        if (id !== 'individual') {
          const docRef = doc(db, 'courses', id);
          promises.push(getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
              setCourse({ id: docSnap.id, ...docSnap.data() });
            }
          }));
          
          promises.push(getDocs(query(collection(db, 'subjects'), where('courseId', '==', id))).then(subjectsSnap => {
            setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }));

          promises.push(getDocs(query(collection(db, 'lectures'), where('courseId', '==', id))).then(lecturesSnap => {
            setLectures(lecturesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }).catch(() => setLectures([])));

          promises.push(getDocs(query(collection(db, 'notes'), where('courseId', '==', id))).then(async (notesSnap) => {
            const fetchedNotes = notesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotes(fetchedNotes);
            
            // Pre-fetch units for these notes to calculate dynamic prices and show curriculum
            const noteIds = fetchedNotes.map(n => n.id);
            if (noteIds.length > 0) {
              const allUnits: any[] = [];
              for (let i = 0; i < noteIds.length; i += 30) {
                const chunk = noteIds.slice(i, i + 30);
                const q = query(collection(db, 'units'), where('noteId', 'in', chunk));
                const snap = await getDocs(q);
                allUnits.push(...snap.docs.map(d => ({ id: d.id, subType: 'unit', ...d.data() })));
              }
              // Sort units client-side
              allUnits.sort((a, b) => (a.order || 0) - (b.order || 0));
              
              // Fetch chapters for ALL these units
              const unitIds = allUnits.map(u => u.id);
              const allChaptersMap: { [unitId: string]: any[] } = {};
              
              if (unitIds.length > 0) {
                for (let i = 0; i < unitIds.length; i += 30) {
                  const chunk = unitIds.slice(i, i + 30);
                  const q = query(collection(db, 'chapters'), where('unitId', 'in', chunk));
                  const snap = await getDocs(q);
                  snap.docs.forEach(doc => {
                    const data = { id: doc.id, ...doc.data() } as any;
                    if (!allChaptersMap[data.unitId]) allChaptersMap[data.unitId] = [];
                    allChaptersMap[data.unitId].push(data);
                  });
                }
                
                // Sort chapters client-side
                Object.keys(allChaptersMap).forEach(key => {
                  allChaptersMap[key].sort((a, b) => (a.order || 0) - (b.order || 0));
                });
              }
              
              const newCurriculum: any = {};
              const initialExpanded: any = {};
              
              fetchedNotes.forEach(note => {
                const noteUnits = allUnits.filter(u => u.noteId === note.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                const noteChapters: any = {};
                noteUnits.forEach(u => {
                  noteChapters[u.id] = (allChaptersMap[u.id] || []).sort((a, b) => (a.order || 0) - (b.order || 0));
                });
                
                newCurriculum[note.id] = { 
                  units: noteUnits,
                  chapters: noteChapters
                };
                initialExpanded[note.id] = true;
              });
              
              setNoteCurriculum(prev => ({ ...prev, ...newCurriculum }));
              setExpandedNotes(prev => ({ ...prev, ...initialExpanded }));
            }
          }).catch(() => setNotes([])));

          promises.push(getDocs(query(collection(db, 'liveClasses'), where('courseId', '==', id))).then(liveSnap => {
            setLiveClasses(liveSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }).catch(() => setLiveClasses([])));

          promises.push(getDocs(query(
            collection(db, 'reviews'), 
            where('courseId', '==', id),
            where('status', '==', 'approved')
          )).then(snap => {
            setCourseReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }).catch(() => setCourseReviews([])));
        }

        // Fetch Individual Item if specified in URL
        if (itemId && itemType) {
          const collectionName = itemType === 'note' ? 'notes' : 
                               itemType === 'lecture' ? 'lectures' : 
                               itemType === 'live' ? 'liveClasses' : 'courses';
          const itemRef = doc(db, collectionName, itemId);
          promises.push(getDoc(itemRef).then(async (itemSnap) => {
            if (itemSnap.exists()) {
              const data = { id: itemSnap.id, ...itemSnap.data() } as any;
              setIndividualItem(data);
              
              // If it's a note, fetch its units and chapters too
              if (itemType === 'note') {
                const q = query(collection(db, 'units'), where('noteId', '==', itemId));
                const snap = await getDocs(q);
                const units = snap.docs
                  .map(d => ({ id: d.id, subType: 'unit', ...d.data() }) as any)
                  .sort((a, b) => (a.order || 0) - (b.order || 0));
                
                const unitIds = units.map(u => u.id);
                const chaptersMap: any = {};
                if (unitIds.length > 0) {
                  for (let i = 0; i < unitIds.length; i += 30) {
                    const chunk = unitIds.slice(i, i + 30);
                    const cq = query(collection(db, 'chapters'), where('unitId', 'in', chunk));
                    const cSnap = await getDocs(cq);
                    cSnap.docs.forEach(doc => {
                      const data = { id: doc.id, ...doc.data() } as any;
                      if (!chaptersMap[data.unitId]) chaptersMap[data.unitId] = [];
                      chaptersMap[data.unitId].push(data);
                    });
                  }
                  // Sort chapters client-side
                  Object.keys(chaptersMap).forEach(key => {
                    chaptersMap[key].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
                  });
                }

                setNoteCurriculum(prev => ({ 
                  ...prev, 
                  [itemId]: { units, chapters: chaptersMap } 
                }));
                setExpandedNotes(prev => ({ ...prev, [itemId]: true }));
              }
              
              // Auto-open if purchased or free
              const isPurchased = profile?.purchasedItems?.includes(itemId) || 
                                 (data.courseId && profile?.purchasedItems?.includes(data.courseId)) ||
                                 data.isFree || Number(data.price) <= 0 ||
                                 isAdmin;
              
              if (isPurchased) {
                if (itemType === 'note') {
                  const url = await fetchSecureUrl(itemId, 'note', data.pdfUrl);
                  if (url) setViewerConfig({ url, title: data.title, isOpen: true });
                } else if (itemType === 'lecture') {
                  const url = await fetchSecureUrl(itemId, 'lecture', data.videoUrl);
                  if (url) setVideoViewerConfig({ url, title: data.title, isOpen: true });
                } else if (itemType === 'live') {
                  const url = await fetchSecureUrl(itemId, 'live', data.meetingUrl);
                  setClassroomConfig({
                    isOpen: true,
                    roomName: data.title.toLowerCase().replace(/\s+/g, '-'),
                    userName: profile?.name || user?.email?.split('@')[0] || 'Student',
                    classId: itemId,
                    isModerator: !!isAdmin,
                    externalUrl: data.isInternalRoom ? '' : (url || data.meetingUrl || '')
                  });
                }
              }
            }
          }));
        }

        await Promise.all(promises);
      } catch (error) {
        console.error('Error fetching course data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [id, itemId, itemType, profile?.purchasedItems?.length, isAdmin]);

  // Synchronize selectedItemIds with all unpurchased course items under course view
  useEffect(() => {
    if (isCourseView) {
      const allPossibleItems: any[] = [...notes, ...lectures, ...liveClasses];
      Object.values(noteCurriculum).forEach((curric: any) => {
        if (curric.units) {
          allPossibleItems.push(...curric.units);
        }
      });

      const itemsToSelect = allPossibleItems
        .filter(item => !profile?.purchasedItems?.includes(item.id) && !item.isFree && (Number(item.discountPrice || item.price) > 0))
        .map(item => item.id);

      setSelectedItemIds(Array.from(new Set(itemsToSelect)));
    }
  }, [isCourseView, notes, lectures, liveClasses, noteCurriculum, profile?.purchasedItems]);

  const handlePurchase = async (specificItem?: any) => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }

    const itemToBuy = specificItem || displayItem;
    const purchaseIds = specificItem?.batchIds || [specificItem?.id || itemId || id];
    const purchaseId = purchaseIds[0]; // For receipt/logging
    const purchaseType = specificItem?.subType || specificItem?.type || itemType || (isCourseView ? 'course' : 'unknown');

    if (!itemToBuy) return;

    // Use current calculated price for course or individual item
    let amount = specificItem ? Number(specificItem.discountPrice || specificItem.price || 0) : purchasePrice;

    // Adjust amount for notes if they have units
    if (specificItem?.subType === 'note' || (itemType === 'note' && !specificItem)) {
      const noteToAdjust = specificItem || displayItem;
      const adjusted = getNoteAdjustedPrice(noteToAdjust);
      amount = adjusted.discountPrice;
    }

    if (isNaN(amount)) {
      setNotification({ message: 'Invalid price information for this item.', type: 'error' });
      return;
    }

    if (amount <= 0) {
      try {
        setPurchasing(true);
        await updateDoc(doc(db, 'users', user.uid), {
          purchasedItems: arrayUnion(...purchaseIds)
        });
        setNotification({ message: 'Enrolled successfully!', type: 'success' });
        setTimeout(() => navigate('/dashboard'), 1500);
      } catch (err) {
        console.error('Error enrolling:', err);
        setNotification({ message: 'Failed to enroll. Please try again.', type: 'error' });
      } finally {
        setPurchasing(false);
      }
      return;
    }

    setPurchasing(true);
    try {
      console.log('Initiating purchase for:', purchaseIds, 'Amount:', amount);
      const keyId = (import.meta as any).env.VITE_RAZORPAY_KEY_ID;

      // 1. Create order on server
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          receipt: `rcpt_${purchaseId?.substring(0, 10)}_${Date.now().toString().slice(-6)}`,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to create order';
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.details || errorData.error || errorMessage;
        } else {
          const textError = await response.text();
          console.error('Non-JSON error response:', textError);
          if (textError.includes('The page could not be found') || response.status === 404) {
            errorMessage = 'Payment API endpoint not found (404). Please contact support.';
          } else {
            errorMessage = `Server error (${response.status}). Please try again later.`;
          }
        }
        throw new Error(errorMessage);
      }

      const order = await response.json();
      console.log('Order created successfully:', order);

      if (order.isDemo) {
        setShowDemoPayment({
          orderId: order.id,
          amount: amount,
          onSuccess: async () => {
            try {
              // Update user profile with purchased item
              await updateDoc(doc(db, 'users', user.uid), {
                purchasedItems: arrayUnion(...purchaseIds)
              });

              // Record sale
              const itemOriginalPrice = specificItem?.subType === 'note' || (itemType === 'note' && !specificItem)
                ? getNoteAdjustedPrice(specificItem || displayItem).price
                : Number(itemToBuy.price || 0);
              const itemDiscountedPrice = specificItem?.subType === 'note' || (itemType === 'note' && !specificItem)
                ? getNoteAdjustedPrice(specificItem || displayItem).discountPrice
                : Number(itemToBuy.discountPrice || itemToBuy.price || 0);
              const itemProductDiscount = Math.max(0, itemOriginalPrice - itemDiscountedPrice);
              const finalGstPercent = 0;
              const itemGstAmount = 0;
              const itemPaidAmount = itemDiscountedPrice;

              await addDoc(collection(db, 'sales'), {
                userId: user.uid,
                itemId: purchaseIds.length === 1 ? purchaseIds[0] : 'batch_purchase',
                itemIds: purchaseIds,
                itemType: purchaseType,
                amount: itemDiscountedPrice, 
                originalPrice: itemOriginalPrice,
                productDiscount: itemProductDiscount,
                couponCode: null,
                couponDiscount: 0,
                gstAmount: itemGstAmount,
                paidAmount: itemPaidAmount,
                discountApplied: null,
                paymentId: 'pay_demo_' + Math.random().toString(36).substring(2, 11),
                orderId: order.id,
                gstPercent: finalGstPercent,
                timestamp: new Date().toISOString()
              });

              setNotification({ message: 'Purchase successful! You can now access the content.', type: 'success' });
              setTimeout(() => navigate('/dashboard'), 1500);
            } catch (err) {
              console.error('Error recording sale:', err);
              setNotification({ message: 'Payment successful but failed to update profile. Please contact support.', type: 'error' });
            } finally {
              setPurchasing(false);
              setShowDemoPayment(null);
            }
          },
          onCancel: () => {
            setPurchasing(false);
            setShowDemoPayment(null);
          }
        });
        return;
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: order.key_id || keyId || 'rzp_test_placeholder',
        amount: order.amount,
        currency: order.currency,
        name: 'Vectonix Classes',
        description: `Purchase ${itemToBuy.title}`,
        order_id: order.id,
        handler: async (response: any) => {
          console.log('Payment successful, handler called:', response);
          // 3. Handle success
          try {
            // Update user profile with purchased item
            await updateDoc(doc(db, 'users', user.uid), {
              purchasedItems: arrayUnion(...purchaseIds)
            });

            // Record sale
            const itemOriginalPrice = specificItem?.subType === 'note' || (itemType === 'note' && !specificItem)
              ? getNoteAdjustedPrice(specificItem || displayItem).price
              : Number(itemToBuy.price || 0);
            const itemDiscountedPrice = specificItem?.subType === 'note' || (itemType === 'note' && !specificItem)
              ? getNoteAdjustedPrice(specificItem || displayItem).discountPrice
              : Number(itemToBuy.discountPrice || itemToBuy.price || 0);
            const itemProductDiscount = Math.max(0, itemOriginalPrice - itemDiscountedPrice);
            const finalGstPercent = 0;
            const itemGstAmount = 0;
            const itemPaidAmount = itemDiscountedPrice;

            await addDoc(collection(db, 'sales'), {
              userId: user.uid,
              itemId: purchaseIds.length === 1 ? purchaseIds[0] : 'batch_purchase',
              itemIds: purchaseIds,
              itemType: purchaseType,
              amount: itemDiscountedPrice, // original field compatibility
              originalPrice: itemOriginalPrice,
              productDiscount: itemProductDiscount,
              couponCode: null,
              couponDiscount: 0,
              gstAmount: itemGstAmount,
              paidAmount: itemPaidAmount,
              discountApplied: null,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              gstPercent: finalGstPercent,
              timestamp: new Date().toISOString()
            });

            setNotification({ message: 'Purchase successful! You can now access the content.', type: 'success' });
            setTimeout(() => navigate('/dashboard'), 1500);
          } catch (err) {
            console.error('Error recording sale:', err);
            setNotification({ message: 'Payment successful but failed to update profile. Please contact support.', type: 'error' });
          }
        },
        prefill: {
          name: profile?.name || '',
          email: (profile?.email || '').toLowerCase(),
          contact: profile?.mobile || '',
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: function() {
            console.log('Checkout modal closed by user');
            setPurchasing(false);
          }
        }
      };

      console.log('Opening Razorpay checkout...');
      if (!(window as any).Razorpay) {
        throw new Error('Razorpay SDK not loaded. Please check your internet connection.');
      }
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Payment Failed:', response.error);
        setNotification({ message: `Payment failed: ${response.error.description}`, type: 'error' });
      });
      rzp.open();
    } catch (error: any) {
      console.error('Purchase Error:', error);
      setNotification({ message: `Failed to initiate purchase: ${error.message}`, type: 'error' });
    } finally {
      // We don't setPurchasing(false) here because rzp.open() is async 
      // and the modal might still be open. We handle it in ondismiss or success.
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center dark:bg-zinc-950">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    </div>
  );

  const displayItem = individualItem || course;
  
  const getProductImage = () => {
    // Check uploaded images on the parent course first (prioritizing the course database uploaded image)
    const courseImage = course?.thumbnail || course?.coverImage || course?.imageUrl || course?.imgUrl;
    if (courseImage) {
      return courseImage;
    }
    
    // Check individual display item for an uploaded image next
    const itemImage = displayItem?.coverImage || displayItem?.thumbnail || displayItem?.imageUrl || displayItem?.imgUrl;
    if (itemImage) {
      return itemImage;
    }
    
    // Fallback to stock image
    return getItemImage(
      displayItem?.title || course?.title || '', 
      displayItem?.subject || displayItem?.category || course?.category || ''
    );
  };

  const breadcrumbItems = [
    { label: 'Courses', path: '/courses' },
    { label: displayItem?.title || 'Course Details', active: true }
  ];
  const isPurchased = 
    profile?.purchasedItems?.includes(itemId || id) || 
    (displayItem?.courseId && profile?.purchasedItems?.includes(displayItem.courseId)) ||
    isAdmin || 
    false;

  const contentItems = [...notes, ...lectures, ...liveClasses];
  
  // Calculate dynamic price based on components
  const itemsSumOriginal = contentItems.reduce((acc, curr) => {
    if (curr.subType === 'note' || (!curr.subType && notes.some(n => n.id === curr.id))) {
      return acc + getNoteAdjustedPrice(curr).price;
    }
    return acc + (Number(curr.price) || 0);
  }, 0);

  const itemsSumDiscounted = contentItems.reduce((acc, curr) => {
    if (curr.subType === 'note' || (!curr.subType && notes.some(n => n.id === curr.id))) {
      return acc + getNoteAdjustedPrice(curr).discountPrice;
    }
    return acc + (Number(curr.discountPrice || curr.price) || 0);
  }, 0);

  if (!displayItem) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 dark:bg-zinc-950">
      <h1 className="text-2xl font-bold dark:text-white">Content not found</h1>
      <button onClick={() => navigate('/')} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold">Back to Home</button>
    </div>
  );

  // Determine final prices
  let purchasePrice = 0;
  let originalPrice = 0;

  if (isCourseView) {
    const coursePrice = Number(displayItem.price) || 0;
    const courseDiscountPrice = Number(displayItem.discountPrice) || 0;
    
    // Calculate sums for unpurchased items only
    const unpurchasedItems = contentItems.filter(item => 
      !profile?.purchasedItems?.includes(item.id) && !isAdmin
    );
    
    const unpurchasedSumDiscounted = unpurchasedItems.reduce((acc, curr) => {
      if (curr.subType === 'note' || (!curr.subType && notes.some(n => n.id === curr.id))) {
        return acc + getNoteAdjustedPrice(curr).discountPrice;
      }
      return acc + (Number(curr.discountPrice || curr.price) || 0);
    }, 0);

    const unpurchasedSumOriginal = unpurchasedItems.reduce((acc, curr) => {
      if (curr.subType === 'note' || (!curr.subType && notes.some(n => n.id === curr.id))) {
        return acc + getNoteAdjustedPrice(curr).price;
      }
      return acc + (Number(curr.price) || 0);
    }, 0);

    // Final price is 0 if whole course is purchased
    if (isPurchased) {
      purchasePrice = 0;
      originalPrice = 0;
    } else {
      // The price should be the lower of:
      // 1. The specific course package price
      // 2. The sum of remaining items
      const bundlePrice = courseDiscountPrice > 0 ? courseDiscountPrice : (coursePrice > 0 ? coursePrice : itemsSumDiscounted);
      
      // If user owns some items, the bundle price is adjusted downwards or we use the sum of unpurchased
      if (unpurchasedItems.length < contentItems.length && unpurchasedItems.length > 0) {
        if (unpurchasedSumDiscounted < bundlePrice) {
          purchasePrice = unpurchasedSumDiscounted;
          originalPrice = unpurchasedSumOriginal;
        } else {
          // If bundle is still cheaper than individual remaining items, use bundle
          purchasePrice = bundlePrice;
          originalPrice = coursePrice > 0 ? coursePrice : itemsSumOriginal;
        }
      } else if (unpurchasedItems.length === 0) {
        purchasePrice = 0;
        originalPrice = 0;
      } else {
        purchasePrice = bundlePrice;
        originalPrice = coursePrice > 0 ? coursePrice : itemsSumOriginal;
      }
    }
  } else {
    if (displayItem?.subType === 'note' || itemType === 'note') {
      const adjusted = getNoteAdjustedPrice(displayItem);
      purchasePrice = adjusted.isFullyOwned ? 0 : adjusted.discountPrice;
      originalPrice = adjusted.isFullyOwned ? 0 : adjusted.price;
    } else {
      purchasePrice = isPurchased ? 0 : Number(displayItem.discountPrice || displayItem.price || 0);
      originalPrice = isPurchased ? 0 : Number(displayItem.price || 0);
    }
  }

  const toggleItemSelection = (itemId: string) => {
    if (isCourseView) return; // Locked in course view
    setSelectedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const getVisiblePurchasableItems = () => {
    const items = [...contentItems];
    
    // Add revealed units
    Object.keys(noteCurriculum).forEach(noteId => {
      if (expandedNotes[noteId]) {
        items.push(...(noteCurriculum[noteId].units || []));
      }
    });

    return items.filter(item => 
      !profile?.purchasedItems?.includes(item.id) && !isAdmin && !item.isFree && (Number(item.discountPrice || item.price) > 0)
    );
  };

  const unpurchasedContent = getVisiblePurchasableItems();

  const handleSelectAll = () => {
    if (isCourseView) return; // Locked in course view
    if (selectedItemIds.length === unpurchasedContent.length && unpurchasedContent.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(unpurchasedContent.map(i => i.id));
    }
  };

  const getAllPurchasableData = () => {
    // We need a flat list of all potential items to find prices for selected IDs
    const flatList = [
      ...notes.map(n => ({ ...n, subType: 'note' })),
      ...lectures.map(l => ({ ...l, subType: 'lecture' })),
      ...liveClasses.map(lc => ({ ...lc, subType: 'live' }))
    ];
    Object.values(noteCurriculum).forEach(curric => {
      flatList.push(...(curric.units || []));
    });
    return flatList;
  };

  const selectedPrice = getAllPurchasableData()
    .filter(item => {
      if (!selectedItemIds.includes(item.id)) return false;
      // If it's a unit, only count its price if its parent note is NOT selected
      if (item.subType === 'unit' && item.noteId && selectedItemIds.includes(item.noteId)) {
        return false;
      }
      return true;
    })
    .reduce((acc, curr) => {
      if (curr.subType === 'note') {
        return acc + getNoteAdjustedPrice(curr).discountPrice;
      }
      return acc + (Number(curr.discountPrice || curr.price) || 0);
    }, 0);

  const selectedOriginalPrice = getAllPurchasableData()
    .filter(item => {
      if (!selectedItemIds.includes(item.id)) return false;
      if (item.subType === 'unit' && item.noteId && selectedItemIds.includes(item.noteId)) {
        return false;
      }
      return true;
    })
    .reduce((acc, curr) => {
      if (curr.subType === 'note') {
        return acc + getNoteAdjustedPrice(curr).price;
      }
      return acc + (Number(curr.price) || 0);
    }, 0);

  const handleAddSelectedToCart = () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    const allItems = getAllPurchasableData();
    const selected = allItems.filter(item => {
      if (!selectedItemIds.includes(item.id)) return false;
      // Avoid adding units if parent note is also selected
      if (item.subType === 'unit' && item.noteId && selectedItemIds.includes(item.noteId)) {
        return false;
      }
      return true;
    });
    
    selected.forEach(item => {
      let itemPrice = item.price;
      let itemDiscountPrice = item.discountPrice;

      // Adjust price for notes
      if (item.subType === 'note') {
        const adjusted = getNoteAdjustedPrice(item);
        itemPrice = adjusted.price;
        itemDiscountPrice = adjusted.discountPrice;
      }

      addToCart({
        id: item.id,
        title: item.title,
        price: itemPrice,
        discountPrice: itemDiscountPrice,
        type: (item.subType || 'unit') as any,
        coverImage: item.coverImage || item.thumbnail || item.imageUrl || item.imgUrl || course?.coverImage || course?.thumbnail || getItemImage(item.title, item.subject || displayItem?.subject),
        courseId: id || 'individual',
        gstPercent: 0
      });
    });
    setNotification({ message: `${selected.length} items added to cart! Redirecting...`, type: 'success' });
    setSelectedItemIds([]);
    setTimeout(() => navigate('/cart'), 1000);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    if (!reviewForm.content.trim()) {
      setNotification({ message: 'Please write some text for your review.', type: 'error' });
      return;
    }

    setSubmittingReview(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        courseId: id || 'individual',
        itemId: itemId || null,
        userId: user.uid,
        userName: profile?.name || profile?.fullName || user.email?.split('@')[0] || 'Student',
        userPhoto: profile?.photoUrl || null,
        rating: reviewForm.rating,
        content: reviewForm.content,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setNotification({ message: 'Review submitted for approval!', type: 'success' });
      setReviewForm({ rating: 5, content: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-20 md:pt-24 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <Breadcrumbs items={breadcrumbItems} className="mb-0 py-0" />
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-bold text-xs bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
      {/* Header Banner */}
      <div className="relative h-[25vh] md:h-[40vh] overflow-hidden rounded-[2.5rem] mx-4 md:mx-8 border border-zinc-200/50 dark:border-zinc-800/80 bg-zinc-950 shadow-sm flex items-end">
        {/* Soft blurred background to contextualize blank space context on sides */}
        <img 
          src={getProductImage()} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-110 pointer-events-none"
          referrerPolicy="no-referrer"
        />
        {/* Perfect landscape presentation displaying vertical form completely with blank padding around */}
        <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6 z-10">
          <img 
            src={getProductImage()} 
            alt={displayItem?.title} 
            className="h-full w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all duration-700 hover:scale-[1.02]"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent z-20 pointer-events-none" />

        <div className="container mx-auto px-6 relative z-30 pb-6 flex flex-col justify-end">
          {!user && (
            <motion.div 
              initial={{ opacity: 0, x: -25 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-indigo-600/95 backdrop-blur-md px-4 py-1.5 rounded-lg border border-indigo-500/30 flex items-center gap-2 text-white shadow-xl mb-3 w-fit"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em]">Preview Course: Free items unlocked</span>
            </motion.div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 mt-8 md:mt-12">
        <div className="grid lg:grid-cols-3 gap-12 relative z-20">
          {/* Main Content */}
          <div className="lg:col-span-2 flex flex-col gap-10">
            <div className="flex flex-col gap-6">
              <div 
                onClick={() => setSelectedImage({ url: getProductImage(), title: displayItem.title })}
                className="lg:hidden w-full aspect-[3/4] md:aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-900 mb-6 bg-zinc-950 cursor-zoom-in relative group/img animate-fade-in flex items-center justify-center p-4"
              >
                {/* Embedded background blur */}
                <img 
                  src={getProductImage()} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover opacity-10 blur-md scale-105 pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                <img src={getProductImage()} alt={displayItem.title} className="max-w-full max-h-full object-contain rounded-xl relative z-10" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center z-20">
                  <Eye className="w-10 h-10 text-white opacity-0 group-hover/img:opacity-100 transition-all scale-50 group-hover/img:scale-100" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 uppercase tracking-widest">
                {displayItem.subject || displayItem.category || displayItem.type || 'General'}
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold dark:text-white leading-tight uppercase tracking-tighter">{displayItem.title}</h1>
              <div className="flex flex-wrap items-center gap-6 text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {courseReviews.length > 0 
                      ? (courseReviews.reduce((acc, curr) => acc + curr.rating, 0) / courseReviews.length).toFixed(1)
                      : '5.0'}
                  </span>
                  <span className="uppercase text-[10px] font-black tracking-widest ml-1">
                    ({courseReviews.length} reviews)
                  </span>
                </div>
                {displayItem.type === 'course' && (
                  <>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <Clock className="w-4 h-4" />
                      {lectures.length > 0 ? `${lectures.length * 45} mins total` : 'Learning Path'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                      <BookOpen className="w-4 h-4" />
                      {notes.length + lectures.length + liveClasses.length} Items
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Overview</h2>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-lg font-medium">
                {displayItem.description || displayItem.subject || 'No description available for this study track.'}
              </p>
            </div>

            {id !== 'individual' && (
              <div className="flex flex-col gap-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-2 bg-indigo-600 rounded-full"></div>
                    <h2 className="text-3xl font-black dark:text-white uppercase tracking-tighter">Full Curriculum</h2>
                  </div>
                  
                    {!isPurchased && !isAdmin && unpurchasedContent.length > 0 && (
                      <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 px-6 py-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm animate-fade-in">
                        <label className={cn("flex items-center gap-3 group", isCourseView ? "cursor-not-allowed opacity-5 w-full md:w-auto" : "cursor-pointer")}>
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="checkbox"
                              className="peer sr-only"
                              checked={isCourseView ? true : (selectedItemIds.length === unpurchasedContent.length && unpurchasedContent.length > 0)}
                              onChange={isCourseView ? undefined : handleSelectAll}
                              disabled={isCourseView}
                            />
                            <div className={cn(
                              "w-6 h-6 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600",
                              isCourseView ? "bg-zinc-400 border-zinc-400 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 opacity-60" : "group-hover:border-indigo-500"
                            )}></div>
                            <CheckCircle2 className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-indigo-600 transition-colors">
                            {isCourseView ? `Complete Course Items Selected (${unpurchasedContent.length})` : `Select All Unpurchased (${unpurchasedContent.length})`}
                          </span>
                        </label>
                      </div>
                    )}
                    {(isPurchased || isAdmin) && (
                      <div className="flex items-center gap-4 bg-emerald-500/10 dark:bg-emerald-500/5 px-6 py-3 rounded-2xl border border-emerald-500/20 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                          Course Fully Owned
                        </span>
                      </div>
                    )}
                </div>
                
                {subjects.length > 0 ? (
                  <div className="flex flex-col gap-12">
                    {subjects.map((subject) => {
                      const subjectLectures = lectures.filter(l => l.subjectId === subject.id);
                      const subjectNotes = notes.filter(n => n.subjectId === subject.id);
                      const subjectLive = liveClasses.filter(l => l.subjectId === subject.id);

                      if (subjectLectures.length === 0 && subjectNotes.length === 0 && subjectLive.length === 0) return null;

                      return (
                        <div key={subject.id} className="flex flex-col gap-6">
                          <h3 className="text-xl font-black dark:text-white uppercase tracking-tight text-indigo-600/80">{subject.title}</h3>

                          <div className="grid gap-3">
                            {/* Combined Grid items for cleaner look */}
                                  {[...subjectLectures.map(l => ({...l, subType: 'lecture'})), 
                                    ...subjectNotes.map(n => ({...n, subType: 'note'})), 
                                    ...subjectLive.map(lc => ({...lc, subType: 'live'}))].map((content: any) => {
                                    const contentOwned = profile?.purchasedItems?.includes(content.id) || 
                                                       (content.courseId && profile?.purchasedItems?.includes(content.courseId)) || 
                                                       isPurchased || isAdmin;
                                    
                                    return (
                                    <div key={content.id} className="flex flex-col gap-2">
                                      <div className={cn(
                                        "flex flex-col md:flex-row md:items-center justify-between p-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group gap-4 relative",
                                        contentOwned && "opacity-80 grayscale-[0.5]"
                                      )}>
                                      {!contentOwned && !content.isFree && (Number(content.price) > 0) && (
                                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10">
                                          <label className={cn("flex items-center", isCourseView ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                                            <input 
                                              type="checkbox"
                                              className="peer sr-only"
                                              checked={isCourseView ? true : selectedItemIds.includes(content.id)}
                                              onChange={() => toggleItemSelection(content.id)}
                                              disabled={isCourseView}
                                            />
                                            <div className={cn(
                                              "w-6 h-6 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600",
                                              isCourseView ? "bg-zinc-400 border-zinc-400 peer-checked:bg-zinc-400 peer-checked:border-zinc-400" : "group-hover:border-indigo-500"
                                            )}></div>
                                            <CheckCircle2 className="absolute left-[3px] w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                          </label>
                                        </div>
                                      )}
                                      {contentOwned && !content.isFree && (
                                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 opacity-50 cursor-not-allowed">
                                          <div className="w-6 h-6 bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center">
                                            <div className="w-3 h-0.5 bg-zinc-400 dark:bg-zinc-500 rounded-full" />
                                          </div>
                                        </div>
                                      )}
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center font-bold",
                                    content.subType === 'lecture' ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20" :
                                    content.subType === 'note' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20" :
                                    "bg-red-50 text-red-600 dark:bg-red-900/20"
                                  )}>
                                    {content.subType === 'lecture' ? <Video className="w-6 h-6" /> :
                                     content.subType === 'note' ? <FileText className="w-6 h-6" /> :
                                     <Radio className="w-6 h-6 animate-pulse" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="font-bold dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{content.title}</div>
                                      {profile?.purchasedItems?.includes(content.id) && (
                                        <div className="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded shadow-sm italic">
                                          <CheckCircle2 className="w-2 h-2" />
                                          Already Bought
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 font-black uppercase tracking-widest flex items-center gap-2 mt-0.5">
                                      {content.subType === 'lecture' && <><Clock className="w-3 h-3" /> Lecture • {content.duration || '45m'}</>}
                                      {content.subType === 'note' && <><BookOpen className="w-3 h-3" /> Notebook • Secure PDF</>}
                                      {content.subType === 'live' && (
                                       <div className="flex items-center gap-1.5">
                                         <Calendar className="w-3 h-3" />
                                         <span>Live • {(() => {
                                           if (!content.scheduledAt) return 'TBD';
                                           try {
                                             const d = new Date(content.scheduledAt);
                                             if (isNaN(d.getTime())) return content.scheduledAt;
                                             return d.toLocaleString('en-IN', { 
                                               timeZone: 'Asia/Kolkata',
                                               day: '2-digit',
                                               month: '2-digit',
                                               year: 'numeric',
                                               hour: '2-digit',
                                               minute: '2-digit',
                                               hour12: true 
                                             }) + ' IST';
                                           } catch {
                                             return content.scheduledAt;
                                           }
                                         })()}</span>
                                       </div>
                                     )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0">
                                  <div className="flex flex-col items-end font-sans">
                                    {(() => {
                                      const isNote = content.subType === 'note';
                                      const notePriceInfo = isNote ? getNoteAdjustedPrice(content) : null;
                                      const isOwned = isAdmin || profile?.purchasedItems?.includes(content.id) || (notePriceInfo?.isFullyOwned);

                                      if (isOwned) {
                                        return (
                                          <span className="text-emerald-500 flex items-center gap-1 justify-end font-extrabold uppercase text-[10px] tracking-widest bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            OWNED
                                          </span>
                                        );
                                      }

                                      const oPrice = isNote && notePriceInfo ? notePriceInfo.price : content.price;
                                      const dPrice = isNote && notePriceInfo ? notePriceInfo.discountPrice : content.discountPrice;
                                      const isFree = isNote && notePriceInfo ? (notePriceInfo.discountPrice === 0) : (content.isFree || content.price === 0);

                                      return (
                                        <PriceDisplay
                                          price={oPrice}
                                          discountPrice={dPrice}
                                          itemId={content.id}
                                          isFree={isFree}
                                          size="xs"
                                          align="right"
                                        />
                                      );
                                    })()}
                                  </div>
                                  {(isPurchased || isAdmin || profile?.purchasedItems?.includes(content.id) || content.isFree === true || Number(content.price || 0) <= 0) ? (
                                    content.subType === 'note' ? null : (
                                      <button 
                                        onClick={() => {
                                          if (!user) {
                                            navigate('/login', { state: { from: location.pathname + location.search } });
                                            return;
                                          }
                                          handleOpenViewer(content, content.subType);
                                        }}
                                        disabled={fetchingSecure === content.id}
                                        className={cn(
                                          "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50",
                                          (content.isFree === true || Number(content.price || 0) <= 0) && !isPurchased && !isAdmin && !profile?.purchasedItems?.includes(content.id)
                                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                                            : "bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-indigo-600"
                                        )}
                                      >
                                        {fetchingSecure === content.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          content.subType === 'lecture' ? 'Watch' : (content.subType === 'live' ? 'Join' : 'Read')
                                        )}
                                      </button>
                                    )
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        let finalPrice = content.price;
                                        let finalDiscountPrice = content.discountPrice;

                                        if (content.subType === 'note') {
                                          const adjusted = getNoteAdjustedPrice(content);
                                          finalPrice = adjusted.price;
                                          finalDiscountPrice = adjusted.discountPrice;
                                        }

                                        if (!user) {
                                          navigate('/login', { state: { from: location.pathname + location.search } });
                                          return;
                                        }

                                        addToCart({
                                          id: content.id,
                                          title: content.title,
                                          price: finalPrice,
                                          discountPrice: finalDiscountPrice,
                                          type: content.subType as any,
                                          coverImage: content.coverImage || content.thumbnail || content.imageUrl || content.imgUrl || course?.coverImage || course?.thumbnail || getItemImage(content.title, content.subject || displayItem?.subject),
                                          courseId: id || 'individual',
                                          gstPercent: 0
                                        });
                                        setNotification({ message: 'Added to cart! Redirecting to checkout...', type: 'success' });
                                        setTimeout(() => navigate('/cart'), 800);
                                      }}
                                      disabled={isInCart(content.id)}
                                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50"
                                    >
                                      {isInCart(content.id) ? 'In Cart' : 'Buy'}
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Note Explore View */}
                              {content.subType === 'note' && expandedNotes[content.id] && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="mx-4 md:mx-12 overflow-hidden"
                                >
                                  <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-3xl border-x border-b border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
                                    {loadingNoteData[content.id] ? (
                                      <div className="py-10 flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Loading curriculum...</p>
                                      </div>
                                    ) : noteCurriculum[content.id]?.units.length > 0 ? (
                                      <div className="flex flex-col gap-4">
                                        {noteCurriculum[content.id].units.map((unit: any) => {
                                          const canRead = isPurchased || isAdmin || profile?.purchasedItems?.includes(content.id) || profile?.purchasedItems?.includes(unit.id) || unit.isFree;
                                          const unitChapters = noteCurriculum[content.id].chapters[unit.id] || [];

                                          return (
                                            <div key={unit.id} className="flex flex-col gap-3 group/unit">
                                              <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 shadow-sm relative">
                                                  {!isAdmin && !profile?.purchasedItems?.includes(unit.id) && !unit.isFree && (Number(unit.price) > 0) && !isPurchased && !profile?.purchasedItems?.includes(content.id) && (
                                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10">
                                                      <label className={cn("flex items-center", isCourseView ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
                                                        <input 
                                                          type="checkbox"
                                                          className="peer sr-only"
                                                          checked={isCourseView ? true : selectedItemIds.includes(unit.id)}
                                                          onChange={() => toggleItemSelection(unit.id)}
                                                          disabled={isCourseView}
                                                        />
                                                        <div className={cn(
                                                          "w-6 h-6 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-600",
                                                          isCourseView ? "bg-zinc-400 border-zinc-400 peer-checked:bg-zinc-400 peer-checked:border-zinc-400" : "group-hover/unit:border-indigo-500"
                                                        )}></div>
                                                        <CheckCircle2 className="absolute left-[3px] w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                                      </label>
                                                    </div>
                                                  )}
                                                  {canRead && !unit.isFree && (
                                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 opacity-50 cursor-not-allowed">
                                                       <div className="w-6 h-6 bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-700 rounded-lg flex items-center justify-center">
                                                         <div className="w-3 h-0.5 bg-zinc-400 dark:bg-zinc-500 rounded-full" />
                                                       </div>
                                                    </div>
                                                  )}
                                                <div className="flex items-center gap-4">
                                                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-400 group-hover/unit:bg-indigo-600 group-hover/unit:text-white transition-colors">
                                                    {unit.order || '#'}
                                                  </div>
                                                  <div>
                                                    <div className="font-bold dark:text-white text-sm uppercase">{unit.title}</div>
                                                    <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                                      {unitChapters.length} Chapters 
                                                      {unit.isFree ? (
                                                        <span className="text-emerald-500">• Free Unit</span>
                                                      ) : (isPurchased || profile?.purchasedItems?.includes(content.id) || profile?.purchasedItems?.includes(unit.id)) ? (
                                                        <span className="text-emerald-500">• Owned</span>
                                                      ) : (
                                                        <span className="flex items-center gap-1.5 ml-1 inline-block font-sans">
                                                          • 
                                                          <PriceDisplay
                                                            price={unit.price || 0}
                                                            discountPrice={unit.discountPrice}
                                                            itemId={unit.id}
                                                            size="xs"
                                                            align="left"
                                                          />
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  {canRead ? (
                                                    <button 
                                                      onClick={() => {
                                                        if (!user) {
                                                          navigate('/login', { state: { from: location.pathname + location.search } });
                                                          return;
                                                        }
                                                        handleOpenSecureContent(unit.id, 'units', unit.title, 'pdf');
                                                      }}
                                                      className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 dark:hover:bg-emerald-600 dark:hover:text-white transition-all flex items-center gap-2"
                                                    >
                                                      <Eye className="w-3.5 h-3.5" />
                                                      Read {unit.isFree && !isPurchased && !isAdmin && !profile?.purchasedItems?.includes(unit.id) ? 'Free' : ''}
                                                    </button>
                                                  ) : (
                                                    <div className="flex items-center gap-2">
                                                      <button 
                                                        onClick={() => {
                                                          if (!user) {
                                                            navigate('/login', { state: { from: location.pathname + location.search } });
                                                            return;
                                                          }
                                                          addToCart({
                                                            id: unit.id,
                                                            title: unit.title,
                                                            price: unit.price || 0,
                                                            discountPrice: unit.discountPrice || 0,
                                                            type: 'unit',
                                                            coverImage: unit.coverImage || unit.thumbnail || unit.imageUrl || unit.imgUrl || course?.coverImage || course?.thumbnail || getItemImage(unit.title, unit.subject || displayItem?.subject),
                                                            courseId: id || 'individual',
                                                            gstPercent: 0
                                                          });
                                                          setNotification({ message: 'Unit added to cart!', type: 'success' });
                                                        }}
                                                        disabled={isInCart(unit.id)}
                                                        className="px-3 py-2 bg-white dark:bg-zinc-800 text-indigo-600 border border-indigo-100 dark:border-zinc-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all disabled:opacity-50"
                                                      >
                                                        {isInCart(unit.id) ? 'In Cart' : 'Cart+'}
                                                      </button>
                                                      <button 
                                                        disabled
                                                        className="px-4 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-not-allowed flex items-center gap-2"
                                                      >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Already Bought
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {/* Chapters List for Unit */}
                                              {unitChapters.length > 0 && (
                                                <div className="ml-14 flex flex-col gap-2">
                                                  {unitChapters.map((chapter: any) => {
                                                    const chapterFree = unit.isFree || chapter.isFree;
                                                    const canReadChapter = canRead || chapterFree;
                                                    
                                                    return (
                                                      <div key={chapter.id} className="flex items-center justify-between p-3 bg-white/50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                                        <div className="flex items-center gap-3">
                                                          <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                                          <div className="text-[11px] font-bold dark:text-zinc-300 uppercase">{chapter.title}</div>
                                                          {chapterFree && !canRead && (
                                                            <span className="text-[8px] font-black text-emerald-500 uppercase px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded">Free</span>
                                                          )}
                                                        </div>
                                                        {canReadChapter && (
                                                          <button 
                                                            onClick={() => {
                                                              if (!user) {
                                                                navigate('/login', { state: { from: location.pathname + location.search } });
                                                                return;
                                                              }
                                                              handleOpenSecureContent(chapter.id, 'chapters', chapter.title, 'pdf');
                                                            }}
                                                            className="text-indigo-600 hover:text-indigo-700 transition-colors"
                                                          >
                                                            <Eye className="w-3.5 h-3.5" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="py-6 text-center text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                                        No curriculum units listed yet.
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )})}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center gap-4 bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800">
                    <AlertCircle className="w-12 h-12 text-zinc-200" />
                    <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">Curriculum update pending</p>
                  </div>
                )}
              </div>
            )}

            {/* Reviews Section */}
            <div className="flex flex-col gap-10 mt-10">
              <div className="flex items-center gap-4">
                <div className="h-10 w-2 bg-indigo-600 rounded-full"></div>
                <h2 className="text-3xl font-black dark:text-white uppercase tracking-tighter">Student Reviews</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Review Form */}
                <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 p-8 flex flex-col gap-6 shadow-sm">
                  <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Leave a review</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star}
                          onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                          className="transition-transform active:scale-90"
                        >
                          <Star className={cn(
                            "w-8 h-8",
                            star <= reviewForm.rating ? "text-amber-500 fill-amber-500" : "text-zinc-200 dark:text-zinc-800"
                          )} />
                        </button>
                      ))}
                    </div>
                    <textarea 
                      placeholder="Share your learning experience..."
                      value={reviewForm.content}
                      onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full min-h-[120px] p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-sm font-medium dark:text-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none"
                    />
                    <button 
                      onClick={handleSubmitReview}
                      disabled={submittingReview}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Review'}
                    </button>
                  </div>
                </div>

                {/* Reviews List */}
                <div className="flex flex-col gap-6">
                  {courseReviews.map(review => (
                    <div key={review.id} className="bg-white/50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img 
                            src={review.userPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.userName)}&background=6366f1&color=fff&bold=true`} 
                            className="w-10 h-10 rounded-xl object-cover"
                            alt={review.userName}
                          />
                          <div>
                            <div className="text-[10px] font-black dark:text-white uppercase tracking-tight">{review.userName}</div>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={cn("w-2 h-2", i < review.rating ? "text-amber-500 fill-amber-500" : "text-zinc-200 dark:text-zinc-800")} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                        "{review.content}"
                      </p>
                    </div>
                  ))}
                  {courseReviews.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-zinc-50/50 dark:bg-zinc-800/20 rounded-[3rem] border border-dashed border-zinc-200 dark:border-zinc-800">
                      <Star className="w-10 h-10 text-zinc-200 mb-4" />
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">No reviews yet. Be the first to share your feedback!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div 
              onClick={() => setSelectedImage({ url: getProductImage(), title: displayItem.title })}
              className="hidden lg:block w-full aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-2xl border-6 border-white dark:border-zinc-900 bg-zinc-950 transition-all hover:scale-[1.02] duration-500 cursor-zoom-in group/img relative animate-fade-in mb-4 flex items-center justify-center p-6"
            >
              {/* Embedded background blur */}
              <img 
                src={getProductImage()} 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover opacity-10 blur-xl scale-105 pointer-events-none"
                referrerPolicy="no-referrer"
              />
              <img src={getProductImage()} alt={displayItem.title} className="max-w-full max-h-full object-contain rounded-[1.5rem] relative z-10" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center z-20">
                <Eye className="w-12 h-12 text-white opacity-0 group-hover/img:opacity-100 transition-all scale-50 group-hover/img:scale-100" />
              </div>
            </div>
            <div className="sticky top-28 p-10 bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-xl shadow-indigo-100/50 dark:shadow-none flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">
                  {isCourseView ? 'Complete Course Package' : (selectedItemIds.length > 0 ? `${selectedItemIds.length} Items Selected` : 'Selection Summary')}
                </span>
                <div className="flex flex-col gap-1.5 align-start font-sans">
                  {isPurchased ? (
                    <span className="text-3xl font-black text-emerald-500 uppercase tracking-wide">Already Bought</span>
                  ) : (
                    (() => {
                      const oPrice = isCourseView ? originalPrice : (selectedItemIds.length > 0 ? selectedOriginalPrice : Number((displayItem as any).price || 0));
                      const dPrice = isCourseView ? purchasePrice : (selectedItemIds.length > 0 ? selectedPrice : Number((displayItem as any).discountPrice || (displayItem as any).price || 0));
                      const isFree = isCourseView ? false : (selectedItemIds.length === 0 && (displayItem.isFree || (displayItem as any).price <= 0));
                      const itmId = isCourseView ? displayItem.id : (selectedItemIds.length > 0 ? undefined : displayItem.id);
                      
                      return (
                        <PriceDisplay
                          price={oPrice}
                          discountPrice={dPrice}
                          itemId={itmId}
                          isFree={isFree}
                          size="xl"
                        />
                      );
                    })()
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {(isAdmin || isPurchased || (!isCourseView && (displayItem.isFree || (displayItem as any).price <= 0))) ? (
                  <button 
                    onClick={() => {
                      if (!user) {
                        navigate('/login', { state: { from: location.pathname + location.search } });
                        return;
                      }
                      if (isAdmin || isPurchased) {
                        navigate('/dashboard');
                      } else {
                        // For free items, we can either enroll them or just let them access via the curriculum
                        // Enrollment is better because it adds to their "Purchased Material" (which includes free)
                        handlePurchase(displayItem);
                      }
                    }}
                    className={cn(
                      "w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg",
                      (isAdmin || isPurchased) 
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    )}
                  >
                    {isAdmin ? 'Admin View' : (isPurchased ? 'Already Bought' : 'Unlock Free Access')}
                  </button>
                ) : isCourseView ? (
                  <>
                    <button 
                      onClick={() => {
                        if (!user) {
                          navigate('/login', { state: { from: location.pathname + location.search } });
                          return;
                        }
                        
                        // Add complete course to cart
                        addToCart({
                          id: id,
                          title: displayItem.title,
                          price: originalPrice,
                          discountPrice: purchasePrice,
                          type: 'course',
                          coverImage: getProductImage(),
                          courseId: id,
                          gstPercent: 0
                        });
                        setNotification({ message: 'Added complete course to cart! Redirecting to checkout...', type: 'success' });
                        setTimeout(() => navigate('/cart'), 800);
                      }}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 hover:scale-[1.02] transition-all shadow-xl shadow-indigo-200 dark:shadow-none"
                    >
                      Add Complete Course To Cart
                    </button>
                    <button 
                      onClick={() => {
                        // Find all note units to include in purchaseIds batch
                        const subItemIds = [
                          ...notes.map(n => n.id),
                          ...lectures.map(l => l.id),
                          ...liveClasses.map(lc => lc.id)
                        ];
                        Object.values(noteCurriculum).forEach((curric: any) => {
                          if (curric.units) {
                            subItemIds.push(...curric.units.map((u: any) => u.id));
                          }
                        });
                        const batchIds = Array.from(new Set([id, ...subItemIds]));

                        handlePurchase({ 
                          title: displayItem.title, 
                          price: originalPrice, 
                          discountPrice: purchasePrice, 
                          id: id, 
                          batchIds: batchIds 
                        });
                      }}
                      disabled={purchasing}
                      className="w-full py-5 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                      {purchasing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Instant Buy Complete Course'}
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={handleAddSelectedToCart}
                      disabled={selectedItemIds.length === 0}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 hover:scale-[1.02] transition-all shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                    >
                      Add Selected to Cart
                    </button>
                    {selectedItemIds.length > 0 && (
                      <button 
                        onClick={() => handlePurchase({ title: `${selectedItemIds.length} Selected Items`, price: selectedOriginalPrice, discountPrice: selectedPrice, id: 'batch_selection', batchIds: selectedItemIds })}
                        disabled={purchasing}
                        className="w-full py-5 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50"
                      >
                        {purchasing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Instant Buy Selected'}
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t border-zinc-50 dark:border-zinc-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">What's included in this track</span>
                <div className="grid gap-3">
                  {[
                    { label: 'Full Chapter Notes', icon: FileText },
                    { label: 'Video Tutorials', icon: Video },
                    { label: 'Live Q&A Access', icon: Radio },
                    { label: 'Lifetime Updates', icon: ShieldCheck }
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      <feat.icon className="w-4 h-4 text-indigo-600" />
                      {feat.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SecurePDFViewer 
        isOpen={viewerConfig.isOpen}
        url={viewerConfig.url}
        title={viewerConfig.title}
        onClose={() => setViewerConfig({ ...viewerConfig, isOpen: false })}
      />

      <SecureVideoViewer
        isOpen={videoViewerConfig.isOpen}
        url={videoViewerConfig.url}
        title={videoViewerConfig.title}
        onClose={() => setVideoViewerConfig({ ...videoViewerConfig, isOpen: false })}
      />

      <VirtualClassroom
        isOpen={classroomConfig.isOpen}
        onClose={() => setClassroomConfig({ ...classroomConfig, isOpen: false })}
        roomName={classroomConfig.roomName}
        userName={classroomConfig.userName}
        isModerator={isAdmin}
        classId={classroomConfig.classId}
        externalUrl={classroomConfig.externalUrl}
      />

      {/* Image Zoom Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-12 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              className="absolute inset-0 bg-zinc-950/95 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 p-4 z-50">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                  }}
                  className="p-3 bg-white/10 hover:bg-red-500 text-white rounded-full transition-all relative pointer-events-auto"
                  title="Close Preview"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="w-full h-full flex flex-col gap-6 md:gap-10 items-center justify-center p-4">
                <div className="relative w-full h-[70vh] flex items-center justify-center">
                  <motion.img 
                    src={selectedImage.url} 
                    alt={selectedImage.title}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                    transition={{ duration: 0.3 }}
                  />
                </div>
                
                <div className="bg-white/10 backdrop-blur-md px-10 py-5 rounded-3xl text-center border border-white/10 max-w-2xl">
                  <h3 className="text-xl md:text-3xl font-display font-black text-white">{selectedImage.title}</h3>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <p className="text-zinc-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em]">Visual Showcase</p>
                    <span className="w-1 h-1 rounded-full bg-zinc-600" />
                    <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em]">Internal Preview</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={cn(
              "px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-white",
              notification.type === 'success' ? "bg-emerald-600" : "bg-red-600"
            )}>
              {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {notification.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo Razorpay Payment Simulator Modal */}
      <AnimatePresence>
        {showDemoPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
              
              <div className="flex items-center justify-between mb-5 mt-1 font-sans">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                    S
                  </div>
                  <div>
                    <h3 className="font-display font-black text-xs dark:text-white uppercase tracking-tight">Vectonix Simulator</h3>
                    <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">SECURE PAY SIMULATION</p>
                  </div>
                </div>
                <button 
                  onClick={() => showDemoPayment.onCancel()}
                  className="p-1 text-zinc-400 hover:text-zinc-650 dark:hover:text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4 text-xs mb-6 font-sans">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/20 rounded-xl text-amber-800 dark:text-amber-300">
                  <p className="font-black text-[10px] uppercase tracking-wider mb-0.5">Demo Checkout Mode</p>
                  <p className="text-[9px] leading-relaxed opacity-90">
                    No active Razorpay API key-pair was configured in AI Studio environments. A simulated sandbox is loaded so you can test content access without real charges.
                  </p>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-850/50 rounded-xl border border-zinc-150 dark:border-zinc-800 space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-450 uppercase tracking-widest text-[8px] font-bold">Simulator Merchant</span>
                    <span className="font-mono text-zinc-600 dark:text-zinc-300 font-bold">Vectonix Pay_Sandbox</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-450 uppercase tracking-widest text-[8px] font-bold">Order Token</span>
                    <span className="font-mono text-zinc-600 dark:text-zinc-300">{showDemoPayment.orderId}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2.5 border-t border-zinc-200 dark:border-zinc-750">
                    <span className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[9px]">TOTAL DUE</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {formatCurrency(showDemoPayment.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 font-sans">
                <button
                  type="button"
                  onClick={() => showDemoPayment.onCancel()}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-205 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-black uppercase tracking-widest text-[9px] rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    const btn = e.currentTarget;
                    btn.innerText = "SIMULATING SUCCESS...";
                    btn.disabled = true;
                    setTimeout(() => {
                      showDemoPayment.onSuccess();
                    }, 1200);
                  }}
                  className="flex-1.5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] rounded-xl transition-all shadow-md shadow-indigo-100 dark:shadow-none flex items-center justify-center animate-pulse"
                >
                  Proceed with Success
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
