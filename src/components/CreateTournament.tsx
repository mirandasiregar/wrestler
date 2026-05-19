import React, { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { X, Plus, Trash2, Trophy, MapPin, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { generateKnockoutBracket } from '../services/bracketService';

export default function CreateTournament({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [weightClasses, setWeightClasses] = useState<string[]>(['57kg', '65kg', '74kg']);
  const [customWC, setCustomWC] = useState('');
  const [loading, setLoading] = useState(false);

  const STANDARD_WEIGHT_CLASSES = [
    '50kg', '53kg', '57kg', '61kg', '65kg', '70kg', '74kg', '79kg', '86kg', '92kg', '97kg', '125kg'
  ];

  const toggleWeightClass = (wc: string) => {
    if (weightClasses.includes(wc)) {
      setWeightClasses(weightClasses.filter(w => w !== wc));
    } else {
      setWeightClasses([...weightClasses, wc]);
    }
  };

  const addCustomWC = () => {
    if (customWC && !weightClasses.includes(customWC)) {
      setWeightClasses([...weightClasses, customWC.trim().toUpperCase()]);
      setCustomWC('');
    }
  };

  const handleCreate = async () => {
    if (!name || !location || weightClasses.length === 0) return;
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

      // Create brackets
      for (const wc of weightClasses) {
        if (!wc) continue;
        const bracketRef = doc(collection(db, `tournaments/${tournamentRef.id}/brackets`));
        await setDoc(bracketRef, {
          id: bracketRef.id,
          weightClass: wc,
          gender: 'male', // Default to male, can be adjusted later in TournamentDetails
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
        className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-start mb-8">
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

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Select Standard Weight Classes</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {STANDARD_WEIGHT_CLASSES.map((wc) => (
                <button
                  key={wc}
                  onClick={() => toggleWeightClass(wc)}
                  className={cn(
                    "px-4 py-2 font-mono text-[10px] uppercase tracking-widest border border-[#141414] transition-all",
                    weightClasses.includes(wc) 
                      ? "bg-[#141414] text-[#E4E3E0] shadow-[4px_4px_0px_0px_rgba(255,78,0,0.5)]" 
                      : "bg-white hover:bg-[#141414]/5"
                  )}
                >
                  {wc}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Add Custom Class</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={customWC}
                onChange={(e) => setCustomWC(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomWC()}
                placeholder="e.g. 130kg"
                className="flex-1 bg-white border border-[#141414] p-3 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-[#FF4E00] transition-all"
              />
              <button 
                onClick={addCustomWC}
                className="bg-[#141414] text-[#E4E3E0] px-6 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-colors"
              >
                + Add
              </button>
            </div>
          </div>

          {weightClasses.length > 0 && (
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Active Selections ({weightClasses.length})</span>
              <div className="flex flex-wrap gap-2 p-4 border border-dashed border-[#141414]/20 bg-white/50">
                {weightClasses.map(wc => (
                  <div key={wc} className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 font-mono text-[9px] uppercase tracking-widest">
                    {wc}
                    <button onClick={() => toggleWeightClass(wc)} className="hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            disabled={loading || !name || !location || weightClasses.length === 0}
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
