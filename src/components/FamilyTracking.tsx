import { useState, useEffect } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { UserProfile, Location } from '../types';
import Map from './Map';
import { Shield, MapPin, HeartPulse, ShieldCheck, Clock, Navigation, ArrowLeft, Activity, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export default function FamilyTracking() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const q = query(collection(db, 'users'), where('trackingToken', '==', token), where('trackingEnabled', '==', true), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setTargetUser(snapshot.docs[0].data() as UserProfile);
      else setTargetUser(null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-brand-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-500/20 animate-pulse">
            <Shield size={40} className="text-white" />
          </div>
          <p className="text-white font-black uppercase tracking-[0.2em] text-xs">Establishing Secure Connection...</p>
        </motion.div>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full card-premium p-12 text-center">
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
            <Shield size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Link Inactive</h2>
          <p className="text-slate-500 mb-10 font-medium leading-relaxed">This tracking link has expired or the user has disabled real-time sharing for your security.</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full h-14">
            <ArrowLeft size={20} />
            BACK TO HOME
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch gap-6">
          <div className="flex-1 card-premium bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-600/20 rounded-full blur-[100px] -mr-32 -mt-32" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-20 h-20 bg-brand-600 rounded-[2rem] flex items-center justify-center text-3xl font-black shadow-2xl shadow-brand-500/20">
                {targetUser.displayName[0]}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-black tracking-tighter uppercase">{targetUser.displayName}</h1>
                  <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Live
                  </div>
                </div>
                <p className="text-slate-400 font-medium flex items-center gap-2">
                  <ShieldCheck size={16} className="text-brand-400" />
                  Secure Guardian Connection Established
                </p>
              </div>
            </div>
          </div>
          
          <div className="lg:w-80 card-premium flex flex-col justify-center items-center text-center p-6">
            <div className="relative w-20 h-20 mb-3">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={226} strokeDashoffset={226 - (226 * targetUser.safetyScore) / 100} className={cn("transition-all duration-1000", targetUser.safetyScore > 70 ? "text-green-500" : "text-red-500")} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black">{targetUser.safetyScore}</span>
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Safety Score</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Map Area */}
          <div className="lg:col-span-8 h-[650px] card-premium p-2 overflow-hidden relative">
            {targetUser.lastKnownLocation ? (
              <Map
                center={targetUser.lastKnownLocation}
                markers={[{ position: targetUser.lastKnownLocation, label: targetUser.displayName, type: 'user' }]}
              />
            ) : (
              <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">Waiting for Signal...</p>
              </div>
            )}
            <div className="absolute bottom-8 left-8 z-[1000] neo-blur px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Last Update</p>
                <p className="text-sm font-black text-slate-900">{targetUser.lastKnownLocation?.timestamp ? new Date(targetUser.lastKnownLocation.timestamp).toLocaleTimeString() : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Status Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="card-premium">
              <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center"><Activity size={20} /></div>
                Live Status
              </h3>
              <div className="space-y-6">
                <StatusItem icon={<Clock size={18} />} label="Last Seen" value={targetUser.lastKnownLocation?.timestamp ? new Date(targetUser.lastKnownLocation.timestamp).toLocaleTimeString() : 'Unknown'} />
                <StatusItem icon={<Compass size={18} />} label="Coordinates" value={targetUser.lastKnownLocation ? `${targetUser.lastKnownLocation.latitude.toFixed(4)}, ${targetUser.lastKnownLocation.longitude.toFixed(4)}` : 'N/A'} />
                <StatusItem icon={<Shield size={18} />} label="Safety Level" value={targetUser.safetyScore > 70 ? 'SECURE' : 'CAUTION'} color={targetUser.safetyScore > 70 ? 'text-green-600' : 'text-red-600'} />
              </div>
            </div>

            <div className="card-premium bg-slate-900 text-white border-none shadow-2xl shadow-slate-900/20">
              <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center"><HeartPulse size={20} className="text-red-500" /></div>
                Emergency
              </h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                If you detect unusual movement or a significant drop in safety score, please alert the authorities immediately.
              </p>
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tourism Helpline</p>
                <p className="text-3xl font-black text-brand-400 tracking-tighter">1363</p>
              </div>
            </div>

            <button onClick={() => navigate('/')} className="btn-ghost w-full py-5 text-xs">
              <ArrowLeft size={16} />
              EXIT GUARDIAN VIEW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ icon, label, value, color = 'text-slate-900' }: { icon: React.ReactNode, label: string, value: string, color?: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <span className={cn("font-black text-sm", color)}>{value}</span>
    </div>
  );
}
