import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Match } from '../types';
import { Check, X, ShieldAlert, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function ScoringPanel({ match, tournamentId, bracketId, onOpenChange }: { match: Match, tournamentId: string, bracketId: string, onOpenChange: (open: boolean) => void }) {
  const [scoreA, setScoreA] = useState(match.scoreA);
  const [scoreB, setScoreB] = useState(match.scoreB);
  const [loading, setLoading] = useState(false);

  const handleUpdateScore = async () => {
    setLoading(true);
    try {
      const matchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
      await updateDoc(matchRef, {
        scoreA,
        scoreB,
        updatedAt: new Date()
      });
      // In a real app, winner logic might be more complex (pin, tech fall, etc)
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishMatch = async (winnerId: string) => {
    setLoading(true);
    try {
      const matchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
      await updateDoc(matchRef, {
        scoreA,
        scoreB,
        winnerId,
        status: 'completed',
        updatedAt: new Date()
      });
      onOpenChange(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#141414]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-2xl p-8 shadow-[12px_12px_0px_0px_rgba(255,78,0,0.5)]"
      >
        <div className="flex justify-between items-start mb-12">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Live Scoring</h2>
          <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12 relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-black italic text-4xl opacity-10 select-none">VS</div>
          
          <ScoreControl 
            name={match.athleteAId || "Athlete A"} 
            score={scoreA} 
            onChange={setScoreA} 
            color="blue"
          />
          
          <ScoreControl 
            name={match.athleteBId || "Athlete B"} 
            score={scoreB} 
            onChange={setScoreB} 
            color="red"
          />
        </div>

        <div className="space-y-4">
          <button 
            disabled={loading}
            onClick={handleUpdateScore}
            className="w-full py-4 bg-[#141414] text-[#E4E3E0] font-mono text-sm uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Update Live Scores
          </button>
          
          <div className="grid grid-cols-2 gap-4">
            <button 
              disabled={loading}
              onClick={() => handleFinishMatch(match.athleteAId!)}
              className="py-4 border-2 border-[#141414] text-[#141414] font-mono text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Trophy size={14} /> Winner A
            </button>
            <button 
              disabled={loading}
              onClick={() => handleFinishMatch(match.athleteBId!)}
              className="py-4 border-2 border-[#141414] text-[#141414] font-mono text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Trophy size={14} /> Winner B
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ScoreControl({ name, score, onChange, color }: { name: string, score: number, onChange: (s: number) => void, color: 'blue' | 'red' }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        "w-full p-4 mb-4 border border-[#141414] text-center font-bold uppercase tracking-tight truncate",
        color === 'blue' ? "bg-blue-100 text-blue-900" : "bg-red-100 text-red-900"
      )}>
        {name}
      </div>
      <div className="text-8xl font-black italic mb-6 tabular-nums">{score}</div>
      <div className="flex gap-2">
        <button onClick={() => onChange(Math.max(0, score - 1))} className="w-12 h-12 border-2 border-[#141414] flex items-center justify-center font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">-</button>
        <button onClick={() => onChange(score + 1)} className="w-12 h-12 border-2 border-[#141414] bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-bold hover:bg-zinc-800 transition-colors">+</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 w-full">
         <button onClick={() => onChange(score + 2)} className="py-2 border border-[#141414] font-mono text-[10px] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">+2 pts</button>
         <button onClick={() => onChange(score + 4)} className="py-2 border border-[#141414] font-mono text-[10px] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">+4 pts</button>
      </div>
    </div>
  );
}
