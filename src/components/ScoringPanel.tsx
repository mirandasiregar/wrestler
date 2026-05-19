import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { Match } from '../types';
import { Check, X, ShieldAlert, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function ScoringPanel({ match, athleteMap, tournamentId, bracketId, onOpenChange }: { match: Match, athleteMap: Record<string, string>, tournamentId: string, bracketId: string, onOpenChange: (open: boolean) => void }) {
  const [scoreA, setScoreA] = useState(match.scoreA);
  const [scoreB, setScoreB] = useState(match.scoreB);
  const [loading, setLoading] = useState(false);

  const nameA = match.athleteAId ? (athleteMap[match.athleteAId] || "Loading...") : "TBA";
  const nameB = match.athleteBId ? (athleteMap[match.athleteBId] || "Loading...") : "TBA";

  const handleUpdateScore = async () => {
    setLoading(true);
    try {
      const matchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
      const updates: any = {
        scoreA,
        scoreB,
        updatedAt: new Date()
      };

      // Automatically set status to ongoing if it's currently pending
      if (match.status === 'pending') {
        updates.status = 'ongoing';
        // Also update athlete statuses to ongoing
        if (match.athleteAId) {
          await updateDoc(doc(db, 'athletes', match.athleteAId), { 
            status: 'ongoing',
            updatedAt: new Date()
          });
        }
        if (match.athleteBId) {
          await updateDoc(doc(db, 'athletes', match.athleteBId), { 
            status: 'ongoing',
            updatedAt: new Date()
          });
        }
      }

      await updateDoc(matchRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishMatch = async (explicitWinnerId?: string) => {
    setLoading(true);
    try {
      let finalWinnerId = explicitWinnerId;
      if (!finalWinnerId) {
        if (scoreA > scoreB) {
          finalWinnerId = match.athleteAId;
        } else if (scoreB > scoreA) {
          finalWinnerId = match.athleteBId;
        }
      }

      const matchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
      await updateDoc(matchRef, {
        scoreA,
        scoreB,
        winnerId: finalWinnerId || null,
        status: 'completed',
        updatedAt: new Date()
      });

      // Update athlete statistics and STATUSES
      if (match.athleteAId || match.athleteBId) {
        const promises = [];
        
        if (match.athleteAId) {
          const isWinnerA = finalWinnerId === match.athleteAId;
          const isLoserA = finalWinnerId && finalWinnerId !== match.athleteAId;
          promises.push(updateDoc(doc(db, 'athletes', match.athleteAId), {
            totalMatches: increment(1),
            wins: isWinnerA ? increment(1) : increment(0),
            losses: isLoserA ? increment(1) : increment(0),
            status: isWinnerA ? 'pending' : 'completed', // Winner is pending for next match, Loser is finished
            updatedAt: new Date()
          }));
        }

        if (match.athleteBId) {
          const isWinnerB = finalWinnerId === match.athleteBId;
          const isLoserB = finalWinnerId && finalWinnerId !== match.athleteBId;
          promises.push(updateDoc(doc(db, 'athletes', match.athleteBId), {
            totalMatches: increment(1),
            wins: isWinnerB ? increment(1) : increment(0),
            losses: isLoserB ? increment(1) : increment(0),
            status: isWinnerB ? 'pending' : 'completed', // Winner is pending for next match, Loser is finished
            updatedAt: new Date()
          }));
        }

        await Promise.all(promises);
      }

      // Advance winner to the next round
      if (finalWinnerId) {
        const nextRound = match.round + 1;
        const nextPosition = Math.floor(match.position / 2);
        const isAthleteA = match.position % 2 === 0;
        
        const nextMatchId = `r${nextRound}-p${nextPosition}`;
        const nextMatchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${nextMatchId}`);
        
        // We update the next match if it exists
        await updateDoc(nextMatchRef, {
          [isAthleteA ? 'athleteAId' : 'athleteBId']: finalWinnerId,
          updatedAt: new Date()
        }).catch(err => {
          // If next match doesn't exist (e.g. final round reached), it's fine
          console.log("Next match not found or final round reached", err);
        });
      }

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
            name={nameA} 
            score={scoreA} 
            onChange={setScoreA} 
            color="blue"
          />
          
          <ScoreControl 
            name={nameB} 
            score={scoreB} 
            onChange={setScoreB} 
            color="red"
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              disabled={loading}
              onClick={handleUpdateScore}
              className="py-4 border-2 border-[#141414] text-[#141414] font-mono text-sm uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-50"
            >
              Update Score
            </button>
            <button 
              disabled={loading}
              onClick={() => handleFinishMatch()}
              className="py-4 bg-[#FF4E00] text-white border-2 border-[#141414] font-black italic uppercase tracking-widest hover:bg-[#CC3E00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check size={18} /> Finish Match
            </button>
          </div>
          
          <div className="pt-6 border-t border-[#141414]/10">
            <p className="font-mono text-[10px] uppercase opacity-40 mb-3 text-center">Override Winner (Manual Selective)</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                disabled={loading || !match.athleteAId}
                onClick={() => match.athleteAId && handleFinishMatch(match.athleteAId)}
                className="py-3 border border-[#141414] text-[#141414] font-mono text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-20"
              >
                <Trophy size={12} /> Force Winner A
              </button>
              <button 
                disabled={loading || !match.athleteBId}
                onClick={() => match.athleteBId && handleFinishMatch(match.athleteBId)}
                className="py-3 border border-[#141414] text-[#141414] font-mono text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-20"
              >
                <Trophy size={12} /> Force Winner B
              </button>
            </div>
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
      <div className="grid grid-cols-5 gap-2 w-full mb-4">
         {[1, 2, 3, 4, 5].map(pts => (
           <button 
             key={pts}
             onClick={() => onChange(score + pts)} 
             className="py-3 border border-[#141414] font-mono text-[10px] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
           >
             +{pts}
           </button>
         ))}
      </div>
      <div className="flex gap-4 w-full">
        <button onClick={() => onChange(Math.max(0, score - 1))} className="flex-1 h-12 border-2 border-[#141414] flex items-center justify-center font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">DECREASE (-1)</button>
        <button onClick={() => onChange(0)} className="px-4 h-12 border-2 border-red-500 text-red-500 flex items-center justify-center font-mono text-[8px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors">Reset</button>
      </div>
    </div>
  );
}
