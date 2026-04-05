import { useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { UserProfile, Location, Geofence, Alert, WeatherData, ItineraryPoint } from '../types';
import Map from './Map';
import SafetyConcierge from './SafetyConcierge';
import CommunityReporting from './CommunityReporting';
import { calculateDistance, cn } from '../lib/utils';
import { 
  AlertTriangle, MapPin, ShieldAlert, Navigation, QrCode, PhoneCall, Info, 
  CloudRain, Wind, Thermometer, Share2, Languages, Mic, Plus, Trash2, 
  CheckCircle2, ShieldCheck, HeartPulse, History, Map as MapIcon, 
  Activity, Fingerprint, Lock, Eye, EyeOff, Copy, ExternalLink, 
  ArrowRight, Compass, Sparkles, Zap, Shield, HelpCircle, X, Radio
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { weatherService } from '../services/weatherService';
import { blockchainService } from '../services/blockchainService';
import { format } from 'date-fns';
import CryptoJS from 'crypto-js';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function TouristView({ user }: { user: UserProfile }) {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useState<Location | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [lastGeofenceId, setLastGeofenceId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showItinerary, setShowItinerary] = useState(false);
  const [newItineraryPoint, setNewItineraryPoint] = useState<Partial<ItineraryPoint>>({ 
    label: '', 
    latitude: 28.6139, 
    longitude: 77.2090 
  });
  const [isListening, setIsListening] = useState(false);
  const [isSOSLoading, setIsSOSLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [passportInput, setPassportInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [safetyFeed, setSafetyFeed] = useState<string[]>([
    "Local police patrolling near India Gate.",
    "Weather update: Heavy rain expected in 2 hours.",
    "Tourist help center opened at Connaught Place.",
    "Caution: High crowd density reported at Chandni Chowk."
  ]);

  const interactionCountRef = useRef(0);
  const lastInteractionTimeRef = useRef(Date.now());

  // Language Switcher
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    updateDoc(doc(db, 'users', user.uid), { language: lng });
  };

  // Generate Secure ID Hash
  const generateSecureID = async () => {
    if (!passportInput) return;
    setIsRegistering(true);
    const hash = CryptoJS.SHA256(passportInput + user.uid).toString();
    await updateDoc(doc(db, 'users', user.uid), { 
      passportHash: hash,
      verificationHash: hash.substring(0, 16),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });
    setIsRegistering(false);
    setPassportInput('');
  };

  // Silent Distress Detection
  const trackInteraction = useCallback(() => {
    const now = Date.now();
    const diff = now - lastInteractionTimeRef.current;
    if (diff < 300) interactionCountRef.current += 1;
    else interactionCountRef.current = 0;

    if (interactionCountRef.current > 10) {
      addDoc(collection(db, 'alerts'), {
        userId: user.uid,
        userDisplayName: user.displayName,
        type: 'SILENT_DISTRESS',
        location: location || { latitude: 0, longitude: 0 },
        status: 'active',
        priority: 'high',
        timestamp: serverTimestamp(),
        details: 'Unusual rapid interaction pattern detected.'
      });
      interactionCountRef.current = 0;
    }
    lastInteractionTimeRef.current = now;
  }, [user.uid, user.displayName, location]);

  useEffect(() => {
    window.addEventListener('click', trackInteraction);
    return () => window.removeEventListener('click', trackInteraction);
  }, [trackInteraction]);

  // Data Subscriptions
  useEffect(() => {
    const unsubGf = onSnapshot(collection(db, 'geofences'), (s) => setGeofences(s.docs.map(d => ({ id: d.id, ...d.data() } as Geofence))), (err) => handleFirestoreError(err, OperationType.LIST, 'geofences'));
    const unsubPl = onSnapshot(collection(db, 'places'), (s) => setPlaces(s.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => handleFirestoreError(err, OperationType.LIST, 'places'));
    const q = query(collection(db, 'alerts'), where('userId', '==', user.uid), where('status', '==', 'active'));
    const unsubAl = onSnapshot(q, (s) => setActiveAlerts(s.docs.map(d => ({ id: d.id, ...d.data() } as Alert))), (err) => handleFirestoreError(err, OperationType.LIST, 'alerts'));
    
    return () => { unsubGf(); unsubPl(); unsubAl(); };
  }, [user.uid]);

  // Weather & Location
  useEffect(() => {
    if (location) weatherService.getWeatherData(location.latitude, location.longitude).then(setWeather);
  }, [location]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, timestamp: new Date().toISOString() };
        setLocation(newLoc);
        if (user.uid) updateDoc(doc(db, 'users', user.uid), { lastKnownLocation: newLoc });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user.uid]);

  // Geofencing & Deviation
  useEffect(() => {
    if (!location || geofences.length === 0) return;
    let currentGf: Geofence | null = null;
    for (const gf of geofences) {
      if (calculateDistance(location.latitude, location.longitude, gf.center.latitude, gf.center.longitude) <= gf.radius) {
        currentGf = gf; break;
      }
    }

    if (currentGf && currentGf.id !== lastGeofenceId) {
      addDoc(collection(db, 'alerts'), {
        userId: user.uid,
        userDisplayName: user.displayName,
        type: 'GEOFENCE_ENTER',
        location,
        status: 'active',
        priority: currentGf.type === 'HIGH_RISK' ? 'high' : 'low',
        timestamp: serverTimestamp(),
        details: `Entered ${currentGf.name} (${currentGf.type})`
      });
      setLastGeofenceId(currentGf.id || null);
      if (currentGf.type === 'HIGH_RISK') updateDoc(doc(db, 'users', user.uid), { safetyScore: Math.max(0, user.safetyScore - 10) });
    } else if (!currentGf && lastGeofenceId) setLastGeofenceId(null);

    if (user.itinerary?.length) {
      const minDistance = Math.min(...user.itinerary.map(p => calculateDistance(location.latitude, location.longitude, p.latitude, p.longitude)));
      if (minDistance > 2000) {
        addDoc(collection(db, 'alerts'), {
          userId: user.uid,
          userDisplayName: user.displayName,
          type: 'ROUTE_DEVIATION',
          location,
          status: 'active',
          priority: 'medium',
          timestamp: serverTimestamp(),
          details: `Route deviation detected: ${Math.round(minDistance / 1000)}km from planned itinerary.`
        });
      }
    }
  }, [location, geofences, lastGeofenceId, user.uid, user.displayName, user.itinerary, user.safetyScore]);

  const handleSOS = async () => {
    if (!location) return;
    setIsSOSLoading(true);
    try {
      await addDoc(collection(db, 'alerts'), {
        userId: user.uid,
        userDisplayName: user.displayName,
        type: 'SOS',
        location,
        status: 'active',
        priority: 'critical',
        timestamp: serverTimestamp(),
        details: 'Emergency SOS triggered by user.'
      });
      blockchainService.addEntry(user.uid, 'SOS_TRIGGERED', { location, timestamp: Date.now() });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSOSLoading(false);
    }
  };

  const startVoiceSOS = () => {
    if (!('webkitSpeechRecognition' in window)) return;
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => {
      const t = e.results[0][0].transcript.toLowerCase();
      if (t.includes('help') || t.includes('emergency') || t.includes('sos')) handleSOS();
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const copyTrackingLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/track/${user.trackingToken}`);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-1 card-premium bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-600/20 rounded-full blur-[100px] -mr-32 -mt-32" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-brand-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-500/20">
                <Sparkles className="text-white" size={32} />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tighter">{t('welcome', { name: user.displayName.split(' ')[0] })}</h2>
                <p className="text-slate-400 font-medium flex items-center gap-2">
                  <Fingerprint size={16} className="text-brand-400" />
                  ID: <span className="font-mono text-xs opacity-60">{user.passportHash?.substring(0, 12)}...</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button onClick={handleSOS} disabled={isSOSLoading} className="btn-danger flex-1 sm:flex-none h-14 px-8 group">
                {isSOSLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldAlert size={24} className="group-hover:scale-110 transition-transform" />}
                <span className="uppercase tracking-widest font-black">{t('sos')}</span>
              </button>
              <CommunityReporting user={user} location={location} />
              <button onClick={startVoiceSOS} className={cn("btn-ghost h-14 px-6 border-none", isListening ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white hover:bg-white/20")}>
                <Mic size={20} />
                <span className="font-bold">{isListening ? 'LISTENING...' : 'VOICE SOS'}</span>
              </button>
              <button onClick={() => setShowQR(!showQR)} className="btn-ghost h-14 px-6 bg-white/10 text-white hover:bg-white/20 border-none">
                <QrCode size={20} />
                <span className="font-bold">{t('digitalId')}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:w-80 space-y-4">
          <div className="card-premium h-full flex flex-col justify-center items-center text-center p-6">
            <div className="relative w-24 h-24 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={276} strokeDashoffset={276 - (276 * user.safetyScore) / 100} className={cn("transition-all duration-1000", user.safetyScore > 70 ? "text-green-500" : user.safetyScore > 40 ? "text-orange-500" : "text-red-500")} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black">{user.safetyScore}</span>
              </div>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('safetyScore')}</p>
            <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
              <ShieldCheck size={14} className={user.safetyScore > 70 ? "text-green-500" : "text-orange-500"} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{user.safetyScore > 70 ? 'SECURE' : 'CAUTION'}</span>
            </div>
          </div>
        </div>
      </div>

      <SafetyConcierge userLocation={location} userName={user.displayName} safetyScore={user.safetyScore} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Map Area */}
        <div className="lg:col-span-8 space-y-8">
          <div className="h-[600px] relative card-premium p-2 overflow-hidden">
            {location ? (
              <Map
                center={location}
                markers={[
                  { position: location, label: 'You', type: 'user' },
                  ...(user.itinerary || []).map(p => ({ position: p, label: p.label, type: 'spot' as const })),
                  ...places.map(p => ({ position: { latitude: p.latitude, longitude: p.longitude }, label: p.name, type: 'spot' as const }))
                ]}
                geofences={geofences}
              />
            ) : (
              <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">Locating Signal...</p>
              </div>
            )}

            <AnimatePresence>
              {weather?.alerts.length && (
                <div className="absolute top-6 left-6 right-6 z-[1000] space-y-2">
                  {weather.alerts.map((a, i) => (
                    <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="neo-blur bg-red-600/90 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
                      <AlertTriangle size={20} className="animate-pulse" />
                      <p className="text-sm font-bold">{a}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-6 left-6 z-[1000] flex gap-2">
              <div className="neo-blur px-4 py-2 rounded-xl flex items-center gap-3 shadow-xl">
                <div className={cn("w-3 h-3 rounded-full animate-pulse", weather?.riskLevel === 'high' ? "bg-red-500" : "bg-green-500")} />
                <span className="text-xs font-black uppercase tracking-widest">{weather?.condition || 'CLEAR'}</span>
                <span className="text-xs font-bold text-slate-500">{Math.round(weather?.temp || 0)}°C</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Itinerary */}
            <div className="card-premium">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center"><Navigation size={20} /></div>
                  {t('itinerary')}
                </h3>
                <button onClick={() => setShowItinerary(!showItinerary)} className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-all">
                  {showItinerary ? <X size={20} /> : <Plus size={20} />}
                </button>
              </div>

              <AnimatePresence>
                {showItinerary && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-8 space-y-3">
                    <input type="text" placeholder="Destination Name" className="input-premium py-3" value={newItineraryPoint.label} onChange={e => setNewItineraryPoint({...newItineraryPoint, label: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" placeholder="Lat" className="input-premium py-3" value={newItineraryPoint.latitude} onChange={e => setNewItineraryPoint({...newItineraryPoint, latitude: Number(e.target.value)})} />
                      <input type="number" placeholder="Lng" className="input-premium py-3" value={newItineraryPoint.longitude} onChange={e => setNewItineraryPoint({...newItineraryPoint, longitude: Number(e.target.value)})} />
                    </div>
                    <button onClick={() => { if(newItineraryPoint.label && newItineraryPoint.latitude) { updateDoc(doc(db, 'users', user.uid), { itinerary: [...(user.itinerary || []), newItineraryPoint as ItineraryPoint] }); setNewItineraryPoint({ label: '' }); } }} className="btn-accent w-full">ADD TO TRIP</button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {user.itinerary?.map((p, i) => (
                  <div key={i} className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-xs font-black text-brand-600 shadow-sm">{i + 1}</div>
                      <div>
                        <p className="font-bold text-slate-900">{p.label}</p>
                        <p className="text-[10px] font-mono text-slate-400">{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</p>
                      </div>
                    </div>
                    <button onClick={() => { const it = [...(user.itinerary || [])]; it.splice(i, 1); updateDoc(doc(db, 'users', user.uid), { itinerary: it }); }} className="p-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                  </div>
                ))}
                {!user.itinerary?.length && <div className="text-center py-12 text-slate-400 italic text-sm">No destinations added yet.</div>}
              </div>
            </div>

            {/* Nearby Places */}
            <div className="card-premium">
              <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><Compass size={20} /></div>
                Nearby Spots
              </h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {places.map((p, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4 hover:bg-white hover:shadow-md transition-all">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-600 shadow-sm shrink-0">
                      {p.type === 'restaurant' ? <Zap size={18} /> : <MapPin size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-slate-900">{p.name}</p>
                        <span className="text-[10px] font-black text-green-600">{p.priceRange}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{p.details}</p>
                      <div className="mt-2 flex gap-2">
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-600 text-[9px] font-black rounded-md uppercase">{p.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* Secure ID Registration */}
          {!user.passportHash && (
            <div className="card-premium border-brand-100 bg-brand-50/30">
              <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center"><Fingerprint size={20} /></div>
                {t('register')}
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('passport')}</label>
                  <input 
                    type="text" 
                    placeholder="Enter ID Number" 
                    className="input-premium py-3" 
                    value={passportInput}
                    onChange={e => setPassportInput(e.target.value)}
                  />
                </div>
                <button 
                  onClick={generateSecureID} 
                  disabled={!passportInput || isRegistering}
                  className="btn-primary w-full h-12 text-xs group"
                >
                  {isRegistering ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock size={16} className="group-hover:scale-110 transition-transform" />}
                  <span className="uppercase tracking-widest font-black">{t('generateHash')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Live Safety Feed */}
          <div className="card-premium">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center"><Radio size={20} className="animate-pulse" /></div>
              {t('safetyFeed')}
            </h3>
            <div className="space-y-4">
              {safetyFeed.map((item, i) => (
                <div key={i} className="flex gap-3 items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 bg-brand-500 rounded-full mt-1.5 shrink-0" />
                  <p className="text-xs font-medium text-slate-600 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="card-premium border-red-100 bg-red-50/30">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center"><ShieldAlert size={20} /></div>
              {t('alerts')}
            </h3>
            <div className="space-y-3">
              {activeAlerts.map((a, i) => (
                <motion.div key={i} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={cn("p-4 rounded-2xl border flex items-start gap-3", a.priority === 'critical' ? "bg-red-600 text-white border-red-700 shadow-lg shadow-red-200" : "bg-white border-red-100 text-red-700")}>
                  <AlertTriangle size={18} className="shrink-0 mt-1" />
                  <div>
                    <p className="font-black text-sm uppercase tracking-tight">{a.type.replace('_', ' ')}</p>
                    <p className="text-[10px] font-medium opacity-80 leading-tight mt-1">{a.details}</p>
                  </div>
                </motion.div>
              ))}
              {!activeAlerts.length && (
                <div className="text-center py-8">
                  <ShieldCheck size={48} className="mx-auto text-green-500/20 mb-3" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">All Systems Secure</p>
                </div>
              )}
            </div>
          </div>

          {/* Family Tracking */}
          <div className="card-premium">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Share2 size={20} /></div>
              Guardian Link
            </h3>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="font-black text-slate-900">Live Tracking</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Share secure access</p>
                </div>
                <button onClick={() => updateDoc(doc(db, 'users', user.uid), { trackingEnabled: !user.trackingEnabled })} className={cn("w-14 h-7 rounded-full transition-all relative", user.trackingEnabled ? "bg-brand-600" : "bg-slate-300")}>
                  <div className={cn("absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm", user.trackingEnabled ? "right-1" : "left-1")} />
                </button>
              </div>

              {user.trackingEnabled && (
                <div className="space-y-4">
                  {!user.trackingToken ? (
                    <button onClick={() => updateDoc(doc(db, 'users', user.uid), { trackingToken: Math.random().toString(36).substring(2, 15) })} className="btn-accent w-full text-xs">GENERATE SECURE TOKEN</button>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-[9px] break-all text-slate-500 leading-relaxed">
                        {window.location.origin}/track/{user.trackingToken}
                      </div>
                      <button onClick={copyTrackingLink} className={cn("btn-primary w-full text-xs", copySuccess && "bg-green-600 hover:bg-green-600")}>
                        {copySuccess ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        {copySuccess ? 'COPIED!' : 'COPY SECURE LINK'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Language & Settings */}
          <div className="card-premium">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center"><Languages size={20} /></div>
              Preferences
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Language</label>
                <select value={i18n.language} onChange={(e) => changeLanguage(e.target.value)} className="input-premium py-3 appearance-none cursor-pointer">
                  <option value="en">English (Global)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="fr">Français (French)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="zh">中文 (Chinese)</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="ar">العربية (Arabic)</option>
                  <option value="ru">Русский (Russian)</option>
                  <option value="pt">Português (Portuguese)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Emergency Contacts */}
          <div className="card-premium bg-slate-900 text-white border-none shadow-2xl shadow-slate-900/20">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center"><PhoneCall size={20} /></div>
              Quick Help
            </h3>
            <div className="space-y-4">
              <EmergencyItem label="Tourism Police" number="100" />
              <EmergencyItem label="National Helpline" number="1363" />
              <EmergencyItem label="Medical Emergency" number="108" />
            </div>
          </div>
        </div>
      </div>

      {/* Digital ID Modal */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQR(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-5xl shadow-2xl overflow-hidden">
              <div className="p-8 md:p-12">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-3xl font-black tracking-tighter">Digital Identity</h3>
                  <button onClick={() => setShowQR(false)} className="w-12 h-12 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center transition-all"><X size={24} /></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div className="flex flex-col items-center p-8 bg-slate-50 rounded-4xl border-2 border-dashed border-slate-200">
                    <QRCodeSVG value={user.qrCode || user.uid} size={200} className="rounded-xl" />
                    <p className="mt-6 font-mono text-[10px] text-slate-400 uppercase tracking-widest">{user.uid}</p>
                  </div>
                  
                  <div className="space-y-6">
                    <IDInfo label="Passport Hash" value={user.passportHash || 'PENDING...'} mono />
                    <IDInfo label="Valid Until" value={user.validUntil ? format(new Date(user.validUntil), 'PPP') : 'N/A'} />
                    <div className="p-5 bg-green-50 rounded-3xl border border-green-100 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-500 shadow-sm"><ShieldCheck size={24} /></div>
                      <div>
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Status</p>
                        <p className="font-black text-green-900">Verified Secure</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blockchain Verified • Smart Tourism Safety System</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmergencyItem({ label, number }: { label: string, number: string }) {
  return (
    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer group">
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
        <p className="text-xl font-black text-white">{number}</p>
      </div>
      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-brand-600 transition-all"><PhoneCall size={18} /></div>
    </div>
  );
}

function IDInfo({ label, value, mono }: { label: string, value: string, mono?: boolean }) {
  return (
    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={cn("font-bold text-slate-900 break-all", mono && "font-mono text-[10px] opacity-70")}>{value}</p>
    </div>
  );
}
