import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, UserRole } from './types';
import Auth from './components/Auth';
import TouristView from './components/TouristView';
import AdminDashboard from './components/AdminDashboard';
import FamilyTracking from './components/FamilyTracking';
import { Shield, MapPin, AlertTriangle, Menu, X, LogOut, User as UserIcon, ShieldCheck, Fingerprint, Languages, Sparkles, Zap, Compass, ArrowRight, Bot, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './i18n';
import { useTranslation } from 'react-i18next';
import CryptoJS from 'crypto-js';

import ErrorBoundary from './components/ErrorBoundary';

// Auth Context
const AuthContext = createContext<{
  user: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          setUser(userData);
          if (userData.language) i18n.changeLanguage(userData.language);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'Guest Tourist',
            role: firebaseUser.email === 'dilliswarkinjarapu@gmail.com' ? 'admin' : 'tourist',
            safetyScore: 100,
            failedLoginAttempts: 0,
            trackingEnabled: false,
            consentGiven: true,
            language: 'en',
            lastInteractionTime: Date.now(),
            interactionCount: 0,
            passportHash: null,
            validUntil: null,
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setUser(newProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [i18n]);

  useEffect(() => {
    const seedData = async () => {
      const gfSnap = await getDocs(collection(db, 'geofences'));
      if (gfSnap.empty) {
        const initialGeofences = [
          { name: 'Red Fort', type: 'VIEW_SPOT', center: { latitude: 28.6562, longitude: 77.2410 }, radius: 500, riskScore: 10 },
          { name: 'India Gate', type: 'VIEW_SPOT', center: { latitude: 28.6129, longitude: 77.2295 }, radius: 400, riskScore: 5 },
          { name: 'Qutub Minar', type: 'VIEW_SPOT', center: { latitude: 28.5245, longitude: 77.1855 }, radius: 300, riskScore: 5 },
          { name: 'Yamuna Flood Zone', type: 'DANGER_INJURY', center: { latitude: 28.6600, longitude: 77.2600 }, radius: 1000, riskScore: 80 },
          { name: 'Old Delhi Market', type: 'DANGER_THEFT', center: { latitude: 28.6500, longitude: 77.2300 }, radius: 600, riskScore: 60 },
          { name: 'Parliament St Police', type: 'TOURIST_OFFICE', center: { latitude: 28.6276, longitude: 77.2155 }, radius: 200, riskScore: 0 },
          { name: 'AIIMS Hospital', type: 'HELP_CENTER', center: { latitude: 28.5672, longitude: 77.2100 }, radius: 300, riskScore: 0 },
          { name: 'Tourist Information Center', type: 'TOURIST_OFFICE', center: { latitude: 28.6300, longitude: 77.2200 }, radius: 250, riskScore: 0 },
        ];
        for (const gf of initialGeofences) await addDoc(collection(db, 'geofences'), gf);
      }
      const placesSnap = await getDocs(collection(db, 'places'));
      if (placesSnap.empty) {
        const initialPlaces = [
          { name: "Karim's Restaurant", type: 'restaurant', latitude: 28.6508, longitude: 77.2334, details: 'Famous Mughlai cuisine', priceRange: '$$' },
          { name: 'Paranthe Wali Gali', type: 'restaurant', latitude: 28.6558, longitude: 77.2321, details: 'Traditional Indian flatbreads', priceRange: '$' },
          { name: 'The Imperial Hotel', type: 'hotel', latitude: 28.6255, longitude: 77.2185, details: 'Luxury heritage hotel', priceRange: '$$$$' },
          { name: 'The Oberoi', type: 'hotel', latitude: 28.5985, longitude: 77.2375, details: 'Premium luxury stay', priceRange: '$$$$' },
        ];
        for (const p of initialPlaces) await addDoc(collection(db, 'places'), p);
      }
    };
    if (user && user.role === 'admin') seedData();
  }, [user]);

  const handleSignOut = () => auth.signOut();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-brand-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-500/20 animate-pulse">
            <Shield size={40} className="text-white" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-white font-black uppercase tracking-[0.2em] text-xs">Initializing Secure System</p>
            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} className="w-full h-full bg-brand-500" />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, loading, signOut: handleSignOut }}>
        <Router>
          <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-brand-100 selection:text-brand-900">
            <Routes>
              <Route path="/track/:token" element={<FamilyTracking />} />
              <Route path="/" element={
                !user ? (
                  <LandingPage />
                ) : (
                  <div className="flex flex-col min-h-screen">
                    <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-[2000]">
                      <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-slate-200">
                            <Shield size={24} />
                          </div>
                          <div>
                            <h1 className="font-black text-2xl tracking-tighter text-slate-900 uppercase">SafeGuard <span className="text-brand-600">Pro</span></h1>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                              Secure Monitoring Active
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="hidden lg:flex items-center gap-3 px-5 py-2.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <ShieldCheck size={16} className="text-brand-500" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                              {user.role.replace('_', ' ')} Mode
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 pl-6 border-l border-slate-100">
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-black text-slate-900 leading-none mb-1">{user.displayName}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{user.email}</p>
                            </div>
                            <button onClick={handleSignOut} className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                              <LogOut size={22} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </header>

                    <main className="flex-1 py-12">
                      {user.role === 'tourist' ? <TouristView user={user} /> : <AdminDashboard user={user} />}
                    </main>

                    {/* Demo Role Switcher */}
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl px-8 py-4 rounded-3xl shadow-2xl border border-white/10 flex items-center gap-6 z-[3000]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r border-white/10 pr-6">Demo Roles</p>
                      {(['tourist', 'police', 'tourism_officer', 'admin'] as UserRole[]).map((role) => (
                        <button
                          key={role}
                          onClick={() => setUser({ ...user, role })}
                          className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                            user.role === role ? 'text-brand-400 scale-110' : 'text-slate-500 hover:text-white'
                          }`}
                        >
                          {role.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              } />
            </Routes>
          </div>
        </Router>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-600 rounded-full blur-[150px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[150px] animate-float" style={{ animationDelay: '-3s' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl w-full text-center relative z-10">
        <div className="w-28 h-28 bg-brand-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
          <Shield size={56} className="text-white" />
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[0.9]">
          TRAVEL WITH <br />
          <span className="text-brand-500">ABSOLUTE CONFIDENCE</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-400 mb-16 max-w-2xl mx-auto leading-relaxed font-medium">
          The next generation of smart tourism safety. Real-time monitoring, blockchain verification, and instant emergency response.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
          <Auth />
          <button className="btn-ghost h-16 px-10 bg-white/5 border-white/10 text-white hover:bg-white/10">
            <span className="uppercase tracking-widest font-black">Learn More</span>
            <ArrowRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <FeatureCard icon={<Bot className="text-brand-400" />} title="AI Safety Concierge" desc="24/7 AI-powered safety assistant providing real-time advice and local emergency guidance." />
          <FeatureCard icon={<Users className="text-green-400" />} title="Community Safety" desc="Crowdsourced safety reports from fellow travelers to identify safe zones and potential risks." />
          <FeatureCard icon={<ShieldCheck className="text-purple-400" />} title="Blockchain ID" desc="Secure, tamper-proof digital identity verified at every checkpoint for your safety." />
        </div>
      </motion.div>

      <footer className="absolute bottom-10 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
        Tourism Department • Police Command Center • Secure Infrastructure
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-10 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-all duration-500 group">
      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">{icon}</div>
      <h3 className="font-black text-2xl mb-3 tracking-tight">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm font-medium">{desc}</p>
    </div>
  );
}
