import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  setSessionId: (id: string) => void;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
  setSessionId: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionIdState] = useState<string | null>(localStorage.getItem('sessionId'));
  const setSessionId = (id: string) => {
    localStorage.setItem('sessionId', id);
    setSessionIdState(id);
  };

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      if (authenticatedUser) {
        setLoading(true);
        setUser(authenticatedUser);
        
        // Real-time profile listener to detect session changes
        unsubscribeProfile = onSnapshot(doc(db, 'users', authenticatedUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfile(data);

            // Single session check
            const currentSessionId = localStorage.getItem('sessionId');
            
            // Check if user is restricted
            if (data.restricted) {
              console.warn('Account is restricted. Logging out.');
              signOut(auth);
              localStorage.removeItem('sessionId');
              const isHome = window.location.pathname === '/' || window.location.pathname === '/landing';
              window.location.replace('/');
              if (isHome) {
                window.location.reload();
              }
              return;
            }

            // Only trigger auto-logout if we have a session ID locally and it differs from the one in DB
            // and the one in DB is NOT null (because null means we just logged out or haven't set it yet)
            if (currentSessionId && data.sessionId && data.sessionId !== currentSessionId) {
              // Wait for server source to be sure it's not a stale cache mismatch
              if (!snapshot.metadata.fromCache) {
                console.warn('Session mismatch detected. Logging out.', {
                  local: currentSessionId,
                  remote: data.sessionId
                });
                
                // Automatically log out if session ID mismatch detected
                signOut(auth);
                localStorage.removeItem('sessionId');
                const isHome = window.location.pathname === '/' || window.location.pathname === '/landing';
                window.location.replace('/');
                if (isHome) {
                  window.location.reload();
                }
              }
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile snapshot error:", err);
          setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const isAdmin = user?.email === 'vectonixclasses@gmail.com' || 
                  (profile?.role === 'admin' && user?.email === 'vectonixclasses@gmail.com');

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, refreshProfile, setSessionId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return React.useContext(AuthContext);
}
