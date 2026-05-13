import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Athlete, Match } from '../types';
import { ChevronLeft, Trophy, Activity, Target, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

export default function AthleteProfile({ athleteId, onBack }: { athleteId: string, onBack: () => void }) {
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [history, setHistory] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch athlete details
        const athSnap = await getDocs(query(collection(db, 'athletes'), where('athleteId', '==', athleteId), limit(1)));
        if (!athSnap.empty) {
          setAthlete(athSnap.docs[0].data() as Athlete);
        }

        // Fetch match history (query across subcollections is harder, but for this demo we'll assume a flattened history or search by athlete name)
        // In a real production app, we would use a collection group query for 'matches'
        const qHistory = query(
          collection(db, 'matches'), 
          where('athleteAId', '==', athleteId),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        // Note: Collection group query would be better here: query(collectionGroup(db, 'matches'), ...)
        // For simplicity in this demo, we'll show the UI structure
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    }
    fetchData();
  }, [athleteId]);

  if (loading) return <div className="p-12 font-mono text-xs animate-pulse">Loading Profile...</div>;
  if (!athlete) return <div className="p-12 font-mono text-xs">Athlete not found.</div>;

  const winRate = athlete.totalMatches > 0 ? (athlete.wins / athlete.totalMatches * 100).toFixed(1) : '0';

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-0 pb-20"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity mb-6 md:mb-8"
      >
        <ChevronLeft size={14} /> Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-12">
        <div className="md:col-span-2 space-y-4 md:space-y-6">
          <div className="inline-block">
            <span className="font-mono text-[9px] md:text-xs uppercase bg-[#141414] text-[#E4E3E0] px-3 py-1 tracking-widest">Athlete Profile</span>
          </div>
          <h2 className="text-3xl md:text-6xl font-black italic uppercase tracking-tighter leading-tight break-words">{athlete.name}</h2>
          <div className="flex items-center gap-3 font-mono text-[10px] md:text-sm opacity-60">
            <Shield size={16} className="shrink-0" /> 
            <span className="truncate">{athlete.clubName || 'Independent'}</span>
          </div>
        </div>
        
        <div className="bg-[#141414] text-[#E4E3E0] p-4 md:p-8 flex flex-col justify-center items-center relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(255,78,0,0.3)] md:shadow-[8px_8px_0px_0px_rgba(255,78,0,0.3)]">
          <Trophy className="absolute -right-4 -bottom-4 opacity-10 w-24 h-24 md:w-32 md:h-32" />
          <div className="text-3xl md:text-5xl font-black italic mb-2 z-10">{winRate}%</div>
          <div className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest opacity-60 z-10 text-center">Career Win Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatBox label="Total Wins" value={athlete.wins} icon={<Trophy size={14} />} />
        <StatBox label="Total Losses" value={athlete.losses} icon={<Activity size={14} />} />
        <StatBox label="Total Matches" value={athlete.totalMatches} icon={<Target size={14} />} />
        <StatBox label="Weight Class" value={athlete.weight ? `${athlete.weight}kg` : 'N/A'} icon={<Shield size={14} />} />
      </div>

      <section>
        <h3 className="font-mono text-xs uppercase tracking-widest font-bold mb-6 border-b border-[#141414] pb-2">Recent Match History</h3>
        <div className="space-y-4">
          {history.length > 0 ? history.map((m, i) => (
             <HistoryRow key={i} match={m} athleteId={athleteId} />
          )) : (
            <div className="p-12 border border-dashed border-[#141414] text-center opacity-30 font-mono text-xs">
              No recent match records found in database.
            </div>
          )}
        </div>
      </section>
    </motion.div>
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
          <div className="font-bold uppercase text-xs md:text-sm tracking-tight truncate max-w-[150px] md:max-w-none">vs. {match.athleteAId === athleteId ? match.athleteBId : match.athleteAId}</div>
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
