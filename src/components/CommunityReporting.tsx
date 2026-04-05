import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Location, UserProfile, CommunityReport } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Users, Sun, AlertTriangle, Heart, X, Send, MapPin, Sparkles, Zap, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface CommunityReportingProps {
  user: UserProfile;
  location: Location | null;
}

export default function CommunityReporting({ user, location }: CommunityReportingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<CommunityReport['type'] | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!reportType || !location) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'community_reports'), {
        userId: user.uid,
        userDisplayName: user.displayName,
        type: reportType,
        location,
        timestamp: serverTimestamp(),
        comment
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsOpen(false);
        setReportType(null);
        setComment('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'community_reports');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reportOptions: { type: CommunityReport['type'], label: string, icon: React.ReactNode, color: string }[] = [
    { type: 'SAFE', label: 'Safe & Secure', icon: <ShieldCheck size={20} />, color: 'text-green-600 bg-green-50' },
    { type: 'WELL_LIT', label: 'Well Lit Area', icon: <Sun size={20} />, color: 'text-yellow-600 bg-yellow-50' },
    { type: 'CROWDED', label: 'Very Crowded', icon: <Users size={20} />, color: 'text-blue-600 bg-blue-50' },
    { type: 'HELPFUL_STAFF', label: 'Helpful Staff', icon: <Heart size={20} />, color: 'text-pink-600 bg-pink-50' },
    { type: 'UNSAFE', label: 'Unsafe Feeling', icon: <AlertTriangle size={20} />, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn-accent h-14 px-8 bg-brand-600 text-white hover:bg-brand-700 shadow-2xl shadow-brand-200 group"
      >
        <Sparkles size={20} className="group-hover:scale-110 transition-transform" />
        <span className="uppercase tracking-widest font-black">Report Safety</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsOpen(false)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative w-full max-w-lg bg-white rounded-5xl shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter">Community Report</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Help other tourists stay safe</p>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="w-12 h-12 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center transition-all"><X size={24} /></button>
                </div>

                {showSuccess ? (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12">
                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShieldCheck size={48} />
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 mb-2">Report Submitted!</h4>
                    <p className="text-slate-500 font-medium">Thank you for contributing to the safety network.</p>
                  </motion.div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 gap-3">
                      {reportOptions.map((opt) => (
                        <button
                          key={opt.type}
                          onClick={() => setReportType(opt.type)}
                          className={cn(
                            "flex items-center gap-4 p-5 rounded-3xl border-2 transition-all text-left group",
                            reportType === opt.type 
                              ? "border-brand-600 bg-brand-50 shadow-lg shadow-brand-100" 
                              : "border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200"
                          )}
                        >
                          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", opt.color)}>
                            {opt.icon}
                          </div>
                          <span className={cn("font-black text-sm uppercase tracking-tight", reportType === opt.type ? "text-brand-900" : "text-slate-600")}>
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Additional Comments (Optional)</label>
                      <textarea 
                        className="input-premium py-4 min-h-[100px] resize-none" 
                        placeholder="Tell us more about the situation..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                    </div>

                    <button 
                      onClick={handleSubmit} 
                      disabled={!reportType || isSubmitting || !location}
                      className="btn-primary w-full h-16 text-lg group"
                    >
                      {isSubmitting ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={20} className="group-hover:translate-x-1 transition-transform" />}
                      <span className="uppercase tracking-widest font-black">SUBMIT SAFETY REPORT</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                  <MapPin size={12} className="text-brand-500" />
                  Your location will be shared anonymously
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
