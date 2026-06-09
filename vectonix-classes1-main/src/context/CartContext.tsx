import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  discountPrice?: number;
  type: 'course' | 'note' | 'lecture' | 'live' | 'unit';
  coverImage?: string;
  courseId?: string;
  subject?: string;
  gstPercent?: number;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  couponCode: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  expiryDate?: string;
  applicableProducts?: string[];
  isActive: boolean;
  type?: string;
  maxUsage?: number;
  usageCount?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  isInCart: (id: string) => boolean;
  promotions: Promotion[];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const prevUserRef = useRef<string | null>(null);
  
  // Create a ref for items to prevent stale closure inside subscription effects
  const itemsRef = useRef<CartItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Integrate automatic local storage persistence for both guest and authenticated users
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // Load promotions - handled gracefully to avoid crashing the context on initialization
  useEffect(() => {
    const q = query(collection(db, 'promotions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promos = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Promotion))
        .filter(p => p.isActive !== false);
      setPromotions(promos);
    }, (error) => {
      console.warn('Firestore Promotions Subscription Warn (falling back to empty promotions):', error);
    });
    return () => unsubscribe();
  }, []);

  // Track logout transition and clear cart
  useEffect(() => {
    if (!user && prevUserRef.current !== null) {
      setItems([]);
      localStorage.removeItem('cart');
    }
    prevUserRef.current = user ? user.uid : null;
  }, [user]);

  // Sync cart with Firestore database when user is logged in
  useEffect(() => {
    if (!user) return;

    const cartDocRef = doc(db, 'carts', user.uid);
    let isInitial = true;

    const unsubscribe = onSnapshot(cartDocRef, async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const dbItems = Array.isArray(data.items) ? data.items : [];
          
          if (isInitial) {
            isInitial = false;
            const localItems = itemsRef.current || [];
            
            // Merge local guest items with database items (avoid durps based on id)
            const mergedItems = [...dbItems];
            localItems.forEach((localItem) => {
              if (localItem && localItem.id && !mergedItems.some((item) => item.id === localItem.id)) {
                mergedItems.push(localItem);
              }
            });

            // Update state & localStorage
            setItems(mergedItems);
            localStorage.setItem('cart', JSON.stringify(mergedItems));

            // If local state had items that weren't in the DB cart, sync the merged Cart to Firestore
            const hasNewLocalItems = localItems.some(
              (localItem) => localItem && localItem.id && !dbItems.some((item) => item.id === localItem.id)
            );
            if (hasNewLocalItems) {
              await setDoc(cartDocRef, {
                items: mergedItems,
                updatedAt: new Date().toISOString()
              });
            }
          } else {
            setItems(dbItems);
            localStorage.setItem('cart', JSON.stringify(dbItems));
          }
        } else if (isInitial) {
          // If snapshot doesn't exist on first load, initialize DB cart with current local/memory items
          isInitial = false;
          await setDoc(cartDocRef, {
            items: itemsRef.current || [],
            updatedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn('Firestore Cart Sync Operation Error:', error);
      }
    }, (error) => {
      console.warn('Firestore Cart Subscription Warn (falling back to client-only cart):', error);
    });

    return () => unsubscribe();
  }, [user]);

  const addToCart = async (item: CartItem) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      const updatedItems = exists ? prev : [...prev, item];
      localStorage.setItem('cart', JSON.stringify(updatedItems));

      if (user) {
        const cartDocRef = doc(db, 'carts', user.uid);
        setTimeout(async () => {
          try {
            await setDoc(cartDocRef, {
              items: updatedItems,
              updatedAt: new Date().toISOString()
            });
          } catch (error) {
            console.warn('Firestore Cart sync on add failed:', error);
          }
        }, 0);
      }
      return updatedItems;
    });
  };

  const removeFromCart = async (id: string) => {
    setItems((prev) => {
      const updatedItems = prev.filter((item) => item.id !== id);
      localStorage.setItem('cart', JSON.stringify(updatedItems));

      if (user) {
        const cartDocRef = doc(db, 'carts', user.uid);
        setTimeout(async () => {
          try {
            await setDoc(cartDocRef, {
              items: updatedItems,
              updatedAt: new Date().toISOString()
            });
          } catch (error) {
            console.warn('Firestore Cart sync on remove failed:', error);
          }
        }, 0);
      }
      return updatedItems;
    });
  };

  const clearCart = async () => {
    setItems([]);
    localStorage.removeItem('cart');

    if (user) {
      const cartDocRef = doc(db, 'carts', user.uid);
      try {
        await setDoc(cartDocRef, {
          items: [],
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Firestore Cart sync on clear failed (retaining local state):', error);
      }
    }
  };

  const total = items.reduce((sum, item) => sum + (Number(item.discountPrice || item.price) || 0), 0);
  const itemCount = items.length;

  const isInCart = (id: string) => items.some(item => item.id === id);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, total, itemCount, isInCart, promotions }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
