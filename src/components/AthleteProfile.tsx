import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, collectionGroup, updateDoc } from 'firebase/firestore';
import { Athlete, Match, UserProfile } from '../types';
import { ChevronLeft, Trophy, Activity, Target, Shield, Edit3, Save, X as CloseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { auth } from '../lib/firebase';

export default function AthleteProfile({ athleteId, profile, onBack }: { athleteId: string, profile: UserProfile | null, onBack: () => void }) {
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [history, setHistory] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    name: '',
    clubName: '',
    photoURL: '',
    wins: 0,
    losses: 0,
    totalMatches: 0,
    weightClass: ''
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch athlete details
        const docRef = doc(db, 'athletes', athleteId);
        const athSnap = await getDoc(docRef);
        
        if (athSnap.exists()) {
          const data = athSnap.data() as Athlete;
          setAthlete({ ...data, athleteId: athSnap.id } as Athlete);
          setEditValues({
            name: data.name || '',
            clubName: data.clubName || '',
            photoURL: data.photoURL || '',
            wins: data.wins || 0,
            losses: data.losses || 0,
            totalMatches: data.totalMatches || 0,
            weightClass: data.weightClass || ''
          });
        }

        // Fetch match history using collectionGroup to search across all tournaments/brackets
        const qHistoryA = query(
          collectionGroup(db, 'matches'), 
          where('athleteAId', '==', athleteId),
          orderBy('createdAt', 'desc'),
          limit(10)
        );

        const qHistoryB = query(
          collectionGroup(db, 'matches'), 
          where('athleteBId', '==', athleteId),
          orderBy('createdAt', 'desc'),
          limit(10)
        );

        const [snapA, snapB] = await Promise.all([getDocs(qHistoryA), getDocs(qHistoryB)]);
        const combined = [
          ...snapA.docs.map(d => ({ id: d.id, ...d.data() } as Match)),
          ...snapB.docs.map(d => ({ id: d.id, ...d.data() } as Match))
        ].sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 10);

        setHistory(combined);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    }
    fetchData();
  }, [athleteId]);

  const handleSaveStats = async () => {
    try {
      const docRef = doc(db, 'athletes', athleteId);
      await updateDoc(docRef, {
        ...editValues,
        updatedAt: new Date()
      });
      setAthlete(prev => prev ? { ...prev, ...editValues } : null);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving stats:", error);
    }
  };

  if (loading) return <div className="p-12 font-mono text-xs animate-pulse">Loading Profile...</div>;
  if (!athlete) return <div className="p-12 font-mono text-xs">Athlete not found.</div>;

  const winRate = athlete.totalMatches > 0 ? (athlete.wins / athlete.totalMatches * 100).toFixed(1) : '0';

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-0 pb-20 relative pt-12 md:pt-0"
    >
      <div className="absolute top-0 left-4 md:relative md:left-0 mb-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-colors shadow-[4px_4px_0px_0px_rgba(255,78,0,0.3)]"
        >
          <ChevronLeft size={14} /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-12">
        <div className="md:col-span-2 space-y-4 md:space-y-6">
          <div className="inline-block">
            <span className="font-mono text-[9px] md:text-xs uppercase bg-[#141414] text-[#E4E3E0] px-3 py-1 tracking-widest">Athlete Profile</span>
          </div>
          <h2 className="text-3xl md:text-6xl font-black italic uppercase tracking-tighter leading-tight break-words">{athlete.name}</h2>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 font-mono text-[10px] md:text-sm opacity-60">
              <Shield size={16} className="shrink-0" /> 
              <span className="truncate">{athlete.clubName || 'Independent'}</span>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-[#FF4E00] transition-colors"
              >
                <Edit3 size={12} /> Edit Profile
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-[#141414] text-[#E4E3E0] p-4 md:p-8 flex flex-col justify-center items-center relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(255,78,0,0.3)] md:shadow-[8px_8px_0px_0px_rgba(255,78,0,0.3)] min-h-[160px]">
          {athlete.photoURL ? (
            <img 
              src={athlete.photoURL} 
              alt={athlete.name} 
              className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Trophy className="absolute -right-4 -bottom-4 opacity-10 w-24 h-24 md:w-32 md:h-32" />
          )}
          <div className="text-3xl md:text-5xl font-black italic mb-2 z-10">{winRate}%</div>
          <div className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-60 z-10 text-center">Career Win Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatBox label="Total Wins" value={athlete.wins} icon={<Trophy size={14} />} />
        <StatBox label="Total Losses" value={athlete.losses} icon={<Activity size={14} />} />
        <StatBox label="Total Matches" value={athlete.totalMatches} icon={<Target size={14} />} />
        <StatBox label="Weight Class" value={athlete.weightClass || 'N/A'} icon={<Shield size={14} />} />
      </div>

      <section>
        <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-6 border-b border-[#141414] pb-2">Recent Match History</h3>
        <div className="space-y-4">
          {history.length > 0 ? (
             history.map((m, i) => (
                <HistoryRow key={i} match={m} athleteId={athleteId} />
             ))
          ) : (
            <div className="p-12 border border-dashed border-[#141414] text-center opacity-30 font-mono text-xs">
              No recent match records found in database.
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-lg p-8 shadow-[12px_12px_0px_0px_rgba(255,78,0,0.5)]"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Edit Athlete Profile</h3>
                  <p className="font-mono text-[10px] opacity-50 uppercase tracking-widest mt-1">Manual modification</p>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                <EditField 
                  label="Full Name" 
                  value={editValues.name} 
                  onChange={(v) => setEditValues(prev => ({ ...prev, name: v }))} 
                  type="text"
                />
                <EditField 
                  label="Club / Team Name" 
                  value={editValues.clubName} 
                  onChange={(v) => setEditValues(prev => ({ ...prev, clubName: v }))} 
                  type="text"
                />
                <EditField 
                  label="Photo URL" 
                  value={editValues.photoURL} 
                  onChange={(v) => setEditValues(prev => ({ ...prev, photoURL: v }))} 
                  type="text"
                />
                <div className="grid grid-cols-2 gap-6">
                  <EditField 
                    label="Wins" 
                    value={editValues.wins} 
                    onChange={(v) => setEditValues(prev => ({ ...prev, wins: parseInt(v) || 0 }))} 
                    type="number"
                  />
                  <EditField 
                    label="Losses" 
                    value={editValues.losses} 
                    onChange={(v) => setEditValues(prev => ({ ...prev, losses: parseInt(v) || 0 }))} 
                    type="number"
                  />
                </div>
                <EditField 
                  label="Total Matches" 
                  value={editValues.totalMatches} 
                  onChange={(v) => setEditValues(prev => ({ ...prev, totalMatches: parseInt(v) || 0 }))} 
                  type="number"
                />
                <EditField 
                  label="Weight Class" 
                  value={editValues.weightClass} 
                  onChange={(v) => setEditValues(prev => ({ ...prev, weightClass: v }))} 
                  type="text"
                />

                <div className="pt-6 flex gap-4">
                  <button 
                    onClick={handleSaveStats}
                    className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#FF4E00] transition-colors flex items-center justify-center gap-2"
                  >
                    <Save size={16} /> Save Changes
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-4 border border-[#141414] font-mono text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EditField({ label, value, onChange, type }: { label: string, value: string | number, onChange: (v: string) => void, type: 'text' | 'number' }) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] uppercase tracking-widest opacity-50 block">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2 focus:border-[#FF4E00] transition-colors"
      />
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="border border-[#141414] p-4 md:p-6 group hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors bg-white">
      <div className="flex items-center gap-2 mb-2 opacity-50 group-hover:opacity-100">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-black italic">{value}</div>
    </div>
  );
}

function HistoryRow({ match, athleteId }: { match: Match, athleteId: string, key?: any }) {
  const isWinner = match.winnerId === athleteId;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-[#141414] hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all bg-white gap-4 sm:gap-0">
      <div className="flex items-center gap-4 md:gap-6">
        <div className={cn(
          "w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center font-black italic text-lg md:text-xl",
          isWinner ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        )}>
          {isWinner ? 'W' : 'L'}
        </div>
        <div>
          <div className="font-bold uppercase text-xs md:text-sm tracking-tight truncate max-w-[150px] md:max-w-none">MATCH #{match.id.slice(-4)}</div>
          <div className="font-mono text-[8px] md:text-[10px] opacity-40 uppercase tracking-widest">TRN-ID: {match.tournamentId.slice(0, 8)}...</div>
        </div>
      </div>
      <div className="flex sm:flex-col justify-between items-end">
        <div className="font-mono font-bold text-base md:text-lg">{match.scoreA} - {match.scoreB}</div>
        <div className="font-mono text-[8px] md:text-[9px] opacity-40 uppercase tracking-tight">{formatDate(match.updatedAt)}</div>
      </div>
    </div>
  );
}
