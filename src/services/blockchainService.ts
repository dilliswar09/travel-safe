import { db } from '../firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import CryptoJS from 'crypto-js';
import { LedgerEntry } from '../types';

export const blockchainService = {
  async getLatestHash(): Promise<string> {
    const q = query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return '0'; // Genesis hash
    }
    return (snapshot.docs[0].data() as LedgerEntry).dataHash;
  },

  async addEntry(userId: string, action: string, data: any): Promise<void> {
    const previousHash = await this.getLatestHash();
    const dataString = JSON.stringify(data);
    const dataHash = CryptoJS.SHA256(dataString + previousHash + Date.now()).toString();

    const entry: Partial<LedgerEntry> = {
      userId,
      action,
      dataHash,
      previousHash,
      timestamp: serverTimestamp() as any,
    };

    await addDoc(collection(db, 'ledger'), entry);
  },

  async verifyChain(): Promise<boolean> {
    const q = query(collection(db, 'ledger'), orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    let currentPreviousHash = '0';

    for (const doc of snapshot.docs) {
      const entry = doc.data() as LedgerEntry;
      if (entry.previousHash !== currentPreviousHash) {
        return false;
      }
      currentPreviousHash = entry.dataHash;
    }
    return true;
  }
};
