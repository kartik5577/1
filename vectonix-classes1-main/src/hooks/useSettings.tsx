import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface Settings {
  logoUrl: string;
  appName: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  youtubeUrl: string;
  instagramUrl: string;
  telegramUrl: string;
  twitterUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  address?: string;
  studentCountLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  stats: { label: string; value: string; icon: string }[];
  features: { title: string; description: string; icon: string }[];
  gstPercent?: number;
  gaMeasurementId?: string;
  gscVerificationId?: string;
}

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  isFirebaseConnected: boolean | null;
  firebaseErrorCode: string | null;
}

const defaultSettings: Settings = {
  logoUrl: '/logo.png',
  appName: 'Vectonix Classes',
  supportEmail: 'vectonixclasses@gmail.com',
  supportPhone: '+91 7060621439',
  whatsappNumber: '+91 7060621439',
  youtubeUrl: 'https://www.youtube.com/@VectonixClasses',
  instagramUrl: 'https://www.instagram.com/VectonixClasses',
  facebookUrl: 'https://www.facebook.com/VectonixClasses',
  linkedinUrl: 'https://www.linkedin.com/company/vectonix-classes',
  telegramUrl: 'https://t.me/vectonix',
  twitterUrl: 'https://twitter.com',
  address: 'Vectonix Classes, Saharanpur, Uttar Pradesh, India - 247554',
  studentCountLabel: '10,000+',
  heroTitle: 'Master Physics with Vectonix',
  heroSubtitle: 'India\'s most trusted platform for JEE & NEET Physics preparation with expert faculty and high-quality study materials.',
  stats: [
    { label: 'Total Students', value: '10k+', icon: 'users' },
    { label: 'Video Lectures', value: '500+', icon: 'video' },
    { label: 'Study Materials', value: '1000+', icon: 'book' },
    { label: 'Success Rate', value: '98%', icon: 'star' }
  ],
  features: [
    { title: 'Expert Faculty', description: 'Learn from top physics mentors with years of JEE/NEET experience.', icon: 'users' },
    { title: 'Comprehensive Notes', description: 'Scientifically designed notes that cover every concept in detail.', icon: 'book' },
    { title: 'Interactive Sessions', description: 'Join live doubt clearing and masterclass sessions every week.', icon: 'radio' },
    { title: 'Track Progress', description: 'Monitor your growth with regular tests and performance analytics.', icon: 'zap' }
  ],
  gstPercent: 0,
  gaMeasurementId: '',
  gscVerificationId: ''
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  isFirebaseConnected: null,
  firebaseErrorCode: null,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const cached = localStorage.getItem('vectonix_cached_settings');
      if (cached) {
        return { ...defaultSettings, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn('Error reading cached settings:', e);
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean | null>(null);
  const [firebaseErrorCode, setFirebaseErrorCode] = useState<string | null>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        // Conduct a server-only read to force Firebase network handshake check
        await getDocFromServer(doc(db, 'settings', 'general'));
        setIsFirebaseConnected(true);
        setFirebaseErrorCode(null);
      } catch (error: any) {
        const errMsg = error instanceof Error ? error.message : String(error);
        setIsFirebaseConnected(false);
        setFirebaseErrorCode(errMsg);
        console.warn(`[Firebase Connection Check] Offline or database not yet initialized: ${errMsg}`);
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        const merged = { ...defaultSettings, ...doc.data(), logoUrl: '/logo.png' };
        setSettings(merged);
        try {
          localStorage.setItem('vectonix_cached_settings', JSON.stringify(merged));
        } catch (e) {
          console.warn('Error saving settings to local storage cache:', e);
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, isFirebaseConnected, firebaseErrorCode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
