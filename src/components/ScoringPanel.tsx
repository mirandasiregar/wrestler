import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, increment, onSnapshot } from 'firebase/firestore';
import { Match } from '../types';
import { Check, X, ShieldAlert, Trophy, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { usePairingLogic } from './usePairingLogic';

export default function ScoringPanel({ 
  match, 
  athleteMap, 
  tournamentId, 
  bracketId, 
  onOpenChange 
}: { 
  match: Match, 
  athleteMap: Record<string, string>, 
  tournamentId: string, 
  bracketId: string, 
  onOpenChange: (open: boolean) => void 
}) {
  const [scoreA, setScoreA] = useState(match.scoreA || 0);
  const [scoreB, setScoreB] = useState(match.scoreB || 0);
  const [loading, setLoading] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);
  const { autoPairRemainingAthletes } = usePairingLogic();

  const nameA = match.athleteAId ? (athleteMap[match.athleteAId] || "Loading...") : "TBA";
  const nameB = match.athleteBId ? (athleteMap[match.athleteBId] || "Loading...") : "TBA";

  // Real-time listener to keep scores synchronized across all referees/viewers
  useEffect(() => {
    const matchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
    const unsubscribe = onSnapshot(matchRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Match;
        setScoreA(data.scoreA || 0);
        setScoreB(data.scoreB || 0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
    });

    return () => unsubscribe();
  }, [tournamentId, bracketId, match.id]);

  // Handle real-time direct score update to Firestore
  const handleUpdateScoreLive = async (side: 'A' | 'B', newScore: number) => {
    try {
      const matchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${match.id}`);
      const updates: any = {
        [side === 'A' ? 'scoreA' : 'scoreB']: newScore,
        updatedAt: new Date()
      };

      // Automatically transition match status to 'ongoing' if it was 'pending'
      if (match.status === 'pending') {
        updates.status = 'ongoing';
        // Set athlete statuses to 'ongoing' in database
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
        } else {
          // If equal score or cannot determine, prompt or fall back to Athlete A
          finalWinnerId = match.athleteAId;
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

      // Advance winner to the next round if knockout structure matches exist
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

      // Auto-pair any remaining and idle athletes for round-robin
      await autoPairRemainingAthletes(tournamentId, bracketId);

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
        className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-2xl p-8 shadow-[12px_12px_0px_0px_rgba(255,78,0,0.5)] relative overflow-hidden"
      >
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter">Live Scoreboard</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Terbuka Pada Semua Perangkat (Sync Real-time)</span>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors border border-transparent hover:border-[#141414]">
            <X size={24} />
          </button>
        </div>

        {/* Scoreboard panel layout */}
        <div className="grid grid-cols-2 gap-12 mb-8 relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-black italic text-4xl opacity-10 select-none pointer-events-none">VS</div>
          
          <ScoreControl 
            name={nameA} 
            score={scoreA} 
            color="blue"
            onScoreChange={(newScore) => handleUpdateScoreLive('A', newScore)}
          />
          
          <ScoreControl 
            name={nameB} 
            score={scoreB} 
            color="red"
            onScoreChange={(newScore) => handleUpdateScoreLive('B', newScore)}
          />
        </div>

        {/* Action button row */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <button 
              disabled={loading}
              onClick={() => setShowWinnerConfirm(true)}
              className="py-4 bg-[#FF4E00] text-white border-2 border-[#141414] font-black italic uppercase text-base tracking-widest hover:bg-[#CC3E00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-0.5 active:translate-y-0"
            >
              <Check size={18} /> Selesai Pertandingan
            </button>
          </div>
          
          <div className="pt-4 border-t border-[#141414]/10 text-center">
            <p className="font-mono text-[9px] uppercase opacity-40">Perubahan skor akan langsung terkirim ke Firestore dan ter-update di panel wasit & penonton seketika.</p>
          </div>
        </div>

        {/* Pop-up Dialog: Konfirmasi Pemenang */}
        <AnimatePresence>
          {showWinnerConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#141414]/95 backdrop-blur-sm z-[110] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-[#E4E3E0] border-2 border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(255,78,0,1)] flex flex-col items-center"
              >
                <Award size={48} className="text-[#FF4E00] mb-4" />
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-center">Pilih Pemenang</h3>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#141414]/60 text-center mt-1 mb-8">Tentukan atlet pemenang untuk menutup pertandingan</p>

                <div className="space-y-4 w-full">
                  {/* Winner Option A */}
                  <button 
                    disabled={loading || !match.athleteAId}
                    onClick={() => match.athleteAId && handleFinishMatch(match.athleteAId)}
                    className={cn(
                      "w-full py-4 px-4 border-2 border-[#141414] font-black italic uppercase text-left flex justify-between items-center transition-all shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-1",
                      scoreA >= scoreB ? "bg-blue-100 border-blue-500 shadow-[3px_3px_0px_0px_rgba(59,130,246,1)]" : "bg-white"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-mono lowercase opacity-50 not-italic">atlet a</span>
                      <span className="text-sm truncate max-w-[200px]">{nameA}</span>
                    </div>
                    <span className="text-2xl font-black italic font-mono">{scoreA} pts</span>
                  </button>

                  {/* Winner Option B */}
                  <button 
                    disabled={loading || !match.athleteBId}
                    onClick={() => match.athleteBId && handleFinishMatch(match.athleteBId)}
                    className={cn(
                      "w-full py-4 px-4 border-2 border-[#141414] font-black italic uppercase text-left flex justify-between items-center transition-all shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-1",
                      scoreB >= scoreA ? "bg-red-100 border-red-500 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)]" : "bg-white"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-mono lowercase opacity-50 not-italic">atlet b</span>
                      <span className="text-sm truncate max-w-[200px]">{nameB}</span>
                    </div>
                    <span className="text-2xl font-black italic font-mono">{scoreB} pts</span>
                  </button>
                </div>

                <div className="flex gap-4 w-full mt-8">
                  <button 
                    disabled={loading}
                    onClick={() => setShowWinnerConfirm(false)}
                    className="flex-1 py-3 border border-zinc-400 font-mono text-[10px] uppercase tracking-widest bg-white hover:bg-zinc-100 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ScoreControl({ 
  name, 
  score, 
  color,
  onScoreChange
}: { 
  name: string, 
  score: number, 
  color: 'blue' | 'red',
  onScoreChange: (s: number) => void
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        "w-full p-3 mb-4 border border-[#141414] text-center font-black italic uppercase tracking-tight truncate rounded-sm shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]",
        color === 'blue' ? "bg-blue-600 text-white" : "bg-red-600 text-white"
      )}>
        {name}
      </div>
      <div className="text-8xl font-black italic mb-6 tabular-nums">{score}</div>
      
      {/* Dynamic additive buttons (+1, +2, +3, +4, +5) */}
      <div className="grid grid-cols-5 gap-2 w-full mb-4">
         {[1, 2, 3, 4, 5].map(pts => (
           <button 
             key={pts}
             onClick={() => onScoreChange(score + pts)} 
             className="py-3 border border-[#141414] font-mono font-bold text-xs hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded shadow-[1px_1px_0px_0px_rgba(20,20,20,1)] bg-white active:translate-y-0.5"
           >
             +{pts}
           </button>
         ))}
      </div>
      
      {/* Subtraction and reset actions */}
      <div className="flex gap-4 w-full">
        <button 
          onClick={() => onScoreChange(Math.max(0, score - 1))} 
          className="flex-1 h-12 border-2 border-[#141414] flex items-center justify-center font-mono font-bold text-[10px] uppercase tracking-wider bg-white hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] active:translate-y-0.5"
        >
          KORANGI (-1)
        </button>
        <button 
          onClick={() => onScoreChange(0)} 
          className="px-4 h-12 border-2 border-red-500 text-red-500 bg-white flex items-center justify-center font-mono text-[9px] uppercase tracking-widest font-bold hover:bg-red-500 hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(20,20,20,0.1)] active:translate-y-0.5"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
