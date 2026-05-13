import React, { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { X, Plus, Trash2, Trophy, MapPin, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { generateKnockoutBracket } from '../services/bracketService';

export default function CreateTournament({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [weightClasses, setWeightClasses] = useState(['57kg', '65kg', '74kg']);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name || !location) return;
    setLoading(true);

    try {
      const tournamentData = {
        name,
        location,
        organizerId: auth.currentUser?.uid,
        status: 'draft',
        startDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tournamentRef = await addDoc(collection(db, 'tournaments'), tournamentData);

      // Create brackets and empty matches
      for (const wc of weightClasses) {
        const bracketRef = doc(collection(db, `tournaments/${tournamentRef.id}/brackets`));
        await setDoc(bracketRef, {
          bracketId: bracketRef.id,
          weightClass: wc,
          style: 'freestyle',
          tournamentId: tournamentRef.id,
          createdAt: new Date(),
        });
      }

      onOpenChange(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tournaments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#141414]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-2xl p-8"
      >
        <div className="flex justify-between items-start mb-12">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">New Tournament</h2>
          <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InputField label="Tournament Name" value={name} onChange={setName} placeholder="e.g. Kejurnas 2024" />
            <InputField label="Location" value={location} onChange={setLocation} placeholder="e.g. Istora Senayan" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Weight Classes</span>
              <button 
                onClick={() => setWeightClasses([...weightClasses, ''])}
                className="text-[10px] font-mono uppercase bg-[#141414] text-[#E4E3E0] px-3 py-1"
              >
                + Add Class
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {weightClasses.map((wc, idx) => (
                <div key={idx} className="relative group">
                  <input 
                    type="text" 
                    value={wc} 
                    onChange={(e) => {
                      const newClasses = [...weightClasses];
                      newClasses[idx] = e.target.value;
                      setWeightClasses(newClasses);
                    }}
                    className="w-full bg-white border border-[#141414] p-3 font-mono text-xs uppercase outline-none focus:bg-[#141414] focus:text-[#E4E3E0] transition-colors"
                  />
                  <button 
                    onClick={() => setWeightClasses(weightClasses.filter((_, i) => i !== idx))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button 
            disabled={loading}
            onClick={handleCreate}
            className="w-full py-6 bg-[#141414] text-[#E4E3E0] font-black uppercase tracking-[0.2em] italic text-lg hover:scale-[0.99] transition-transform disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Initialize Tournament'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder: string }) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] uppercase tracking-widest opacity-50">{label}</label>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        className="w-full bg-white border border-[#141414] p-4 font-bold uppercase tracking-tight placeholder:opacity-20 outline-none focus:ring-2 focus:ring-[#FF4E00] transition-all"
      />
    </div>
  );
}
