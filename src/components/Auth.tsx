import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { LogIn, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Auth() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Reset failed attempts on success
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        await updateDoc(userRef, { failedLoginAttempts: 0 });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Track failed attempts if user exists (simulated for demo)
      // In a real app, this would be handled server-side or via a more complex client-side check
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, { failedLoginAttempts: increment(1) });
        
        const userDoc = await getDoc(userRef);
        if (userDoc.exists() && userDoc.data().failedLoginAttempts >= 3) {
          await addDoc(collection(db, 'alerts'), {
            userId: auth.currentUser.uid,
            userDisplayName: auth.currentUser.displayName,
            type: 'SILENT_DISTRESS',
            location: { latitude: 0, longitude: 0 },
            status: 'active',
            priority: 'medium',
            timestamp: serverTimestamp(),
            details: 'Multiple failed login attempts detected.'
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleLogin}
      disabled={loading}
      className="btn-accent h-16 px-12 text-lg group"
    >
      <LogIn size={24} className="group-hover:translate-x-1 transition-transform" />
      <span className="uppercase tracking-widest font-black">{loading ? 'SECURE LOGIN...' : 'LOGIN WITH GOOGLE'}</span>
    </motion.button>
  );
}
