import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collectionGroup, collection, query, where, onSnapshot, getDocs, doc, updateDoc, increment, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Match, Athlete, Tournament, Bracket } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, Trophy, Sparkles, Volume2, VolumeX, ShieldAlert, Award, Activity, Hourglass, ZoomIn, Clock, ArrowLeft, Check, Plus, Minus, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useParams } from 'react-router-dom';
import { usePairingLogic } from './usePairingLogic';

export function LiveScoreboard() {
  const { matchId, tournamentId: routeTournamentId, bracketId: routeBracketId } = useParams<{ matchId?: string; tournamentId?: string; bracketId?: string }>();
  const { autoPairRemainingAthletes } = usePairingLogic();

  const [ongoingMatches, setOngoingMatches] = useState<Match[]>([]);
  const [recentCompletedMatches, setRecentCompletedMatches] = useState<Match[]>([]);
  const [athletes, setAthletes] = useState<Record<string, Athlete>>({});
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({});
  const [brackets, setBrackets] = useState<Record<string, Bracket>>({});
  
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchMinutes, setMatchMinutes] = useState(6);
  const [matchSeconds, setMatchSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastScoreA, setLastScoreA] = useState<Record<string, number>>({});
  const [lastScoreB, setLastScoreB] = useState<Record<string, number>>({});
  const [scoreAlert, setScoreAlert] = useState<{ message: string; side: 'A' | 'B' | null } | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);

  // Auth & Profile Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (u) {
        const profileSnap = await getDocs(query(collection(db, 'users'), where('userId', '==', u.uid), limit(1)));
        if (!profileSnap.empty) {
          setUserProfile(profileSnap.docs[0].data());
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubAuth();
  }, []);

  // 1. Listen to all ONGOING and recently COMPLETED matches in real time using collectionGroup
  useEffect(() => {
    const ongoingQuery = query(collectionGroup(db, 'matches'), where('status', '==', 'ongoing'));
    const unsubOngoing = onSnapshot(ongoingQuery, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      
      // Look for score changes to trigger sound/visual alert
      list.forEach(match => {
        const prevA = lastScoreA[match.id];
        const prevB = lastScoreB[match.id];
        const athleteAName = match.athleteAId ? (athletes[match.athleteAId]?.name || "Athlete A") : "Athlete A";
        const athleteBName = match.athleteBId ? (athletes[match.athleteBId]?.name || "Athlete B") : "Athlete B";

        if (prevA !== undefined && match.scoreA > prevA) {
          triggerAlert(`${athleteAName} scored! (+${match.scoreA - prevA} pts)`, 'A');
        }
        if (prevB !== undefined && match.scoreB > prevB) {
          triggerAlert(`${athleteBName} scored! (+${match.scoreB - prevB} pts)`, 'B');
        }

        setLastScoreA(prev => ({ ...prev, [match.id]: match.scoreA }));
        setLastScoreB(prev => ({ ...prev, [match.id]: match.scoreB }));
      });

      setOngoingMatches(list);
    }, (error) => {
      console.error("Ongoing matches listener error:", error);
    });

    const completedQuery = query(collectionGroup(db, 'matches'), where('status', '==', 'completed'));
    const unsubCompleted = onSnapshot(completedQuery, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      setRecentCompletedMatches(list.sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).slice(0, 8));
    }, (error) => {
      console.error("Completed matches listener error:", error);
    });

    return () => {
      unsubOngoing();
      unsubCompleted();
    };
  }, [athletes, lastScoreA, lastScoreB]);

  // 2. Fetch all base metadata to map athlete names, bracket info, and tournament details
  useEffect(() => {
    const unsubAthletes = onSnapshot(collection(db, 'athletes'), (snap) => {
      const map: Record<string, Athlete> = {};
      snap.docs.forEach(d => {
        map[d.id] = { athleteId: d.id, ...d.data() } as Athlete;
      });
      setAthletes(map);
    });

    const unsubTournaments = onSnapshot(collection(db, 'tournaments'), (snap) => {
      const map: Record<string, Tournament> = {};
      snap.docs.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() } as Tournament;
      });
      setTournaments(map);
    });

    const unsubBrackets = onSnapshot(query(collectionGroup(db, 'brackets')), (snap) => {
      const map: Record<string, Bracket> = {};
      snap.docs.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() } as Bracket;
      });
      setBrackets(map);
    });

    return () => {
      unsubAthletes();
      unsubTournaments();
      unsubBrackets();
    };
  }, []);

  // 3. Optional deep link matchId routing
  useEffect(() => {
    if (!matchId) return;

    let unsubscribe: () => void = () => {};

    if (routeTournamentId && routeBracketId) {
      const matchDocRef = doc(db, `tournaments/${routeTournamentId}/brackets/${routeBracketId}/matches/${matchId}`);
      unsubscribe = onSnapshot(matchDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setSelectedMatch({ id: docSnap.id, ...docSnap.data() } as Match);
        }
      }, (err) => {
        console.error("Error loading route match:", err);
      });
    } else {
      const q = query(collectionGroup(db, 'matches'));
      unsubscribe = onSnapshot(q, (snap) => {
        const found = snap.docs.find(d => d.id === matchId);
        if (found) {
          const mData = found.data() as Match;
          setSelectedMatch({ id: found.id, ...mData } as Match);
        }
      }, (err) => {
        console.error("Error searching collectionGroup match:", err);
      });
    }

    return () => unsubscribe();
  }, [matchId, routeTournamentId, routeBracketId]);

  // Timer logic for Stadium Display
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        if (matchSeconds > 0) {
          setMatchSeconds(s => s - 1);
        } else if (matchMinutes > 0) {
          setMatchMinutes(m => m - 1);
          setMatchSeconds(59);
        } else {
          setIsTimerRunning(false);
          if (soundEnabled) {
            playBuzzer();
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, matchMinutes, matchSeconds]);

  const triggerAlert = (msg: string, side: 'A' | 'B' | null) => {
    setScoreAlert({ message: msg, side });
    if (soundEnabled) {
      playSound(side);
    }
    setTimeout(() => {
      setScoreAlert(null);
    }, 4000);
  };

  const playSound = (side: 'A' | 'B' | null) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(side === 'A' ? 650 : 850, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    } catch (e) {
      console.warn("Audio not initialized yet:", e);
    }
  };

  const playBuzzer = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.3);
    } catch (_) {}
  };

  const isAuthorizedReferee = () => {
    if (!currentUser) return false;
    if (userProfile?.role === 'admin') return true;
    
    if (liveSelectedMatch) {
      const matchTournament = tournaments[liveSelectedMatch.tournamentId];
      if (matchTournament && matchTournament.organizerId === currentUser.uid) {
        return true;
      }
    }
    return false;
  };

  const handleUpdateScoreLive = async (side: 'A' | 'B', newScore: number) => {
    if (!liveSelectedMatch) return;
    if (liveSelectedMatch.status !== 'ongoing') return;

    try {
      // Find exact doc path
      let tId = liveSelectedMatch.tournamentId;
      let bId = liveSelectedMatch.bracketId;
      let mId = liveSelectedMatch.id;

      const matchRef = doc(db, `tournaments/${tId}/brackets/${bId}/matches/${mId}`);
      await updateDoc(matchRef, {
        [side === 'A' ? 'scoreA' : 'scoreB']: newScore,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error setting score:", error);
    }
  };

  const handleFinishMatch = async (explicitWinnerId?: string) => {
    if (!liveSelectedMatch) return;
    setLoading(true);
    try {
      let finalWinnerId = explicitWinnerId;
      const scoreA = liveSelectedMatch.scoreA;
      const scoreB = liveSelectedMatch.scoreB;

      if (!finalWinnerId) {
        if (scoreA > scoreB) {
          finalWinnerId = liveSelectedMatch.athleteAId;
        } else if (scoreB > scoreA) {
          finalWinnerId = liveSelectedMatch.athleteBId;
        } else {
          finalWinnerId = liveSelectedMatch.athleteAId;
        }
      }

      const tId = liveSelectedMatch.tournamentId;
      const bId = liveSelectedMatch.bracketId;
      const mId = liveSelectedMatch.id;

      const matchRef = doc(db, `tournaments/${tId}/brackets/${bId}/matches/${mId}`);
      await updateDoc(matchRef, {
        winnerId: finalWinnerId || null,
        status: 'completed',
        updatedAt: new Date()
      });

      // Update stats and statuses in database
      if (liveSelectedMatch.athleteAId || liveSelectedMatch.athleteBId) {
        const promises = [];
        
        if (liveSelectedMatch.athleteAId) {
          const isWinnerA = finalWinnerId === liveSelectedMatch.athleteAId;
          const isLoserA = finalWinnerId && finalWinnerId !== liveSelectedMatch.athleteAId;
          promises.push(updateDoc(doc(db, 'athletes', liveSelectedMatch.athleteAId), {
            totalMatches: increment(1),
            wins: isWinnerA ? increment(1) : increment(0),
            losses: isLoserA ? increment(1) : increment(0),
            status: isWinnerA ? 'pending' : 'completed',
            updatedAt: new Date()
          }));
        }

        if (liveSelectedMatch.athleteBId) {
          const isWinnerB = finalWinnerId === liveSelectedMatch.athleteBId;
          const isLoserB = finalWinnerId && finalWinnerId !== liveSelectedMatch.athleteBId;
          promises.push(updateDoc(doc(db, 'athletes', liveSelectedMatch.athleteBId), {
            totalMatches: increment(1),
            wins: isWinnerB ? increment(1) : increment(0),
            losses: isLoserB ? increment(1) : increment(0),
            status: isWinnerB ? 'pending' : 'completed',
            updatedAt: new Date()
          }));
        }

        await Promise.all(promises);
      }

      // Advance winner to the next round if applicable (knockout)
      if (finalWinnerId) {
        const nextRound = liveSelectedMatch.round + 1;
        const nextPosition = Math.floor(liveSelectedMatch.position / 2);
        const isAthleteA = liveSelectedMatch.position % 2 === 0;
        
        const nextMatchId = `r${nextRound}-p${nextPosition}`;
        const nextMatchRef = doc(db, `tournaments/${tId}/brackets/${bId}/matches/${nextMatchId}`);
        
        await updateDoc(nextMatchRef, {
          [isAthleteA ? 'athleteAId' : 'athleteBId']: finalWinnerId,
          updatedAt: new Date()
        }).catch(() => {});
      }

      // Trigger autoPair for remaining idle athletes
      await autoPairRemainingAthletes(tId, bId);

      setShowWinnerConfirm(false);
      setSelectedMatch(null);
    } catch (error) {
      console.error("Error closing completed match:", error);
    } finally {
      setLoading(false);
    }
  };

  const liveSelectedMatch = selectedMatch 
    ? [...ongoingMatches, ...recentCompletedMatches].find(m => m.id === selectedMatch.id) || selectedMatch
    : null;

  const isEditable = isAuthorizedReferee() && liveSelectedMatch?.status === 'ongoing';

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Visual Header */}
      {!matchId && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#141414]/10 pb-6">
          <div>
            <span className="font-mono text-xs uppercase opacity-50 block mb-2 tracking-widest flex items-center gap-2">
              <Activity size={12} className="text-[#FF4E00] animate-pulse" /> Live Spectator Ticker
            </span>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter flex items-center gap-3">
               Wrestle Scoreboard
            </h2>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#141414]/60 mt-1">
              Dynamic real-time scoreboard & stadium broadcast board connected to active arenas
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "p-3 border border-[#141414] font-mono text-[9px] uppercase tracking-widest transition-all flex items-center gap-2",
                soundEnabled ? "bg-[#141414] text-[#E4E3E0]" : "bg-white text-[#141414] hover:bg-zinc-50"
              )}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {soundEnabled ? "Scores Audio: On" : "Scores Audio: Off"}
            </button>
          </div>
        </div>
      )}

      {/* Floating score alerts banner */}
      <AnimatePresence>
        {scoreAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "border border-[#141414] p-4 text-center font-mono font-black uppercase text-xs tracking-wider shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex items-center justify-center gap-2",
              scoreAlert.side === 'A' ? "bg-blue-50 text-blue-900 border-blue-600" :
              scoreAlert.side === 'B' ? "bg-red-50 text-red-900 border-red-600" :
              "bg-zinc-100 text-zinc-900"
            )}
          >
            <Sparkles size={14} className="animate-spin text-[#FF4E00]" />
            {scoreAlert.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* STADIUM DISPLAY MODE (Giant screen mode) */}
      {liveSelectedMatch && (
        <div className="bg-[#141414] text-[#E4E3E0] p-8 border-4 border-[#141414] shadow-[12px_12px_0px_0px_rgba(255,78,0,0.5)] flex flex-col relative overflow-hidden">
          <div className="absolute right-0 top-0 text-[180px] font-black italic tracking-tighter opacity-5 select-none pointer-events-none -mr-16 -mt-16">LIVE</div>
          
          <div className="flex justify-between items-center mb-6 z-10">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#FF4E00] font-bold">
                STADIUM CENTRAL BOARD {isEditable && "(MODERATOR / REFEREE)"}
              </span>
            </div>
            
            {!matchId && (
              <button
                onClick={() => {
                  setSelectedMatch(null);
                  setIsTimerRunning(false);
                }}
                className="text-[#E4E3E0]/70 hover:text-white border border-[#E4E3E0]/20 px-3 py-1 font-mono text-[9px] uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Exit Stadium View
              </button>
            )}
          </div>

          {/* Tournament & Bracket Info */}
          <div className="text-center mb-10 z-10">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-40 block mb-1">
              {tournaments[liveSelectedMatch.tournamentId]?.name || "Active Wrestle Event"}
            </span>
            <h3 className="text-2xl font-black italic uppercase tracking-tight text-white">
              {brackets[liveSelectedMatch.bracketId] ? `${brackets[liveSelectedMatch.bracketId].style} ${brackets[liveSelectedMatch.bracketId].weightClass} (${brackets[liveSelectedMatch.bracketId].gender})` : "Championship Division"}
            </h3>
            <div className="mt-2 inline-block font-mono text-[9px] uppercase bg-white/10 text-white/90 px-3 py-0.5 rounded-sm tracking-wider">
              Round {liveSelectedMatch.round} | Match #{parseInt(liveSelectedMatch.id.split('-p')[1]) + 1}
            </div>
          </div>

          {/* GIANT SCORE CARD */}
          <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-8 mb-4 z-10">
            {/* Athlete A (Blue Side) */}
            <div className="md:col-span-3 text-center flex flex-col items-center bg-blue-950/40 p-6 border border-blue-500/25 rounded-lg">
              <div className="font-mono text-[10px] tracking-widest uppercase bg-blue-600 font-bold px-3 py-0.5 rounded-sm text-white mb-4">
                BLUE CONTESTANT
              </div>
              <h4 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter truncate max-w-full text-white min-h-[40px]">
                {liveSelectedMatch.athleteAId ? (athletes[liveSelectedMatch.athleteAId]?.name || "Fetching...") : "ATHLETE A"}
              </h4>
              
              <div className="text-8xl md:text-9xl font-black italic text-blue-400 mt-6 select-none leading-none tabular-nums animate-bounce">
                {liveSelectedMatch.scoreA}
              </div>

              {/* Score Control for Referee */}
              {isEditable && (
                <div className="mt-8 space-y-3 w-full">
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map(pts => (
                      <button 
                        key={pts}
                        onClick={() => handleUpdateScoreLive('A', liveSelectedMatch.scoreA + pts)}
                        className="py-2.5 bg-blue-900 hover:bg-blue-800 text-white border border-blue-700 font-mono text-xs font-bold rounded"
                      >
                        +{pts}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleUpdateScoreLive('A', Math.max(0, liveSelectedMatch.scoreA - 1))}
                      className="py-2 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 font-mono text-[10px] uppercase font-bold rounded"
                    >
                      Kurangi (-1)
                    </button>
                    <button 
                      onClick={() => handleUpdateScoreLive('A', 0)}
                      className="py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 font-mono text-[10px] uppercase font-bold rounded"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Stadium Clock / Controls */}
            <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 rounded-lg h-full max-h-[300px]">
              <Clock size={20} className="opacity-40 mb-3" />
              <div className="font-mono text-3xl font-bold tracking-widest text-[#FF4E00] tabular-nums select-none mb-4">
                {matchMinutes.toString().padStart(2, '0')}:{matchSeconds.toString().padStart(2, '0')}
              </div>
              
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={cn(
                    "w-full py-1.5 font-mono text-[8px] uppercase tracking-wider text-center border font-bold transition-all",
                    isTimerRunning 
                      ? "bg-red-800 text-white border-red-700 hover:bg-red-900" 
                      : "bg-emerald-800 text-white border-emerald-700 hover:bg-emerald-900"
                  )}
                >
                  {isTimerRunning ? "PAUSE" : "START"}
                </button>
                <button
                  onClick={() => {
                    setIsTimerRunning(false);
                    setMatchMinutes(3);
                    setMatchSeconds(0);
                  }}
                  className="w-full py-1 font-mono text-[8px] uppercase tracking-widest text-center border border-white/20 hover:bg-white/10 transition-colors"
                >
                  RESET
                </button>
              </div>
            </div>

            {/* Athlete B (Red Side) */}
            <div className="md:col-span-3 text-center flex flex-col items-center bg-red-950/40 p-6 border border-red-500/25 rounded-lg">
              <div className="font-mono text-[10px] tracking-widest uppercase bg-red-600 font-bold px-3 py-0.5 rounded-sm text-white mb-4">
                RED CONTESTANT
              </div>
              <h4 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter truncate max-w-full text-white min-h-[40px]">
                {liveSelectedMatch.athleteBId ? (athletes[liveSelectedMatch.athleteBId]?.name || "Fetching...") : "ATHLETE B"}
              </h4>
              
              <div className="text-8xl md:text-9xl font-black italic text-red-400 mt-6 select-none leading-none tabular-nums animate-bounce">
                {liveSelectedMatch.scoreB}
              </div>

              {/* Score Control for Referee */}
              {isEditable && (
                <div className="mt-8 space-y-3 w-full">
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map(pts => (
                      <button 
                        key={pts}
                        onClick={() => handleUpdateScoreLive('B', liveSelectedMatch.scoreB + pts)}
                        className="py-2.5 bg-red-900 hover:bg-red-800 text-white border border-red-700 font-mono text-xs font-bold rounded"
                      >
                        +{pts}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleUpdateScoreLive('B', Math.max(0, liveSelectedMatch.scoreB - 1))}
                      className="py-2 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-mono text-[10px] uppercase font-bold rounded"
                    >
                      Kurangi (-1)
                    </button>
                    <button 
                      onClick={() => handleUpdateScoreLive('B', 0)}
                      className="py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 font-mono text-[10px] uppercase font-bold rounded"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stop / Selesai Match Button directly on stadium view for moderator */}
          {isEditable && (
            <div className="mt-4 mb-4 flex justify-center w-full z-10">
              <button 
                onClick={() => setShowWinnerConfirm(true)}
                className="py-3 px-12 bg-orange-600 hover:bg-orange-500 border border-orange-400 font-mono text-xs uppercase font-bold tracking-widest rounded text-white flex items-center gap-2 shadow-lg"
              >
                <Check size={14} /> Selesai Pertandingan (Tentukan Pemenang)
              </button>
            </div>
          )}

          <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono opacity-50 uppercase tracking-widest">
            <span>Room ID: ARENA-LIVE</span>
            <span className="flex items-center gap-1">
              Status Match: <span className="text-[#FF4E00] font-bold">{liveSelectedMatch.status}</span>
            </span>
            <span>Broadcast Feed: HD Live Stream</span>
          </div>
        </div>
      )}

      {/* Pop-up Dialog: Konfirmasi Pemenang dalam scoreboard */}
      <AnimatePresence>
        {showWinnerConfirm && liveSelectedMatch && (
          <div className="fixed inset-0 bg-[#141414]/95 backdrop-blur-sm z-[220] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(255,78,0,1)] flex flex-col items-center"
            >
              <Award size={48} className="text-[#FF4E00] mb-4" />
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-center">Tentukan Pemenang</h3>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#141414]/60 text-center mt-1 mb-8">Pilih atlet untuk memperebutkan skor pertandingan ini</p>

              <div className="space-y-4 w-full">
                <button 
                  disabled={loading || !liveSelectedMatch.athleteAId}
                  onClick={() => liveSelectedMatch.athleteAId && handleFinishMatch(liveSelectedMatch.athleteAId)}
                  className={cn(
                    "w-full py-4 px-4 border-2 border-[#141414] font-black italic uppercase text-left flex justify-between items-center transition-all bg-white shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-1",
                    liveSelectedMatch.scoreA >= liveSelectedMatch.scoreB && "bg-blue-100 border-blue-500 shadow-[3px_3px_0px_0px_rgba(59,130,246,1)]"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-mono lowercase opacity-50 not-italic">atlet a (biru)</span>
                    <span className="text-sm truncate max-w-[200px]">
                      {liveSelectedMatch.athleteAId ? (athletes[liveSelectedMatch.athleteAId]?.name || "Loading...") : "TBA"}
                    </span>
                  </div>
                  <span className="text-2xl font-black italic font-mono">{liveSelectedMatch.scoreA} pts</span>
                </button>

                <button 
                  disabled={loading || !liveSelectedMatch.athleteBId}
                  onClick={() => liveSelectedMatch.athleteBId && handleFinishMatch(liveSelectedMatch.athleteBId)}
                  className={cn(
                    "w-full py-4 px-4 border-2 border-[#141414] font-black italic uppercase text-left flex justify-between items-center transition-all bg-white shadow-[3px_3px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-1",
                    liveSelectedMatch.scoreB >= liveSelectedMatch.scoreA && "bg-red-100 border-red-500 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)]"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-mono lowercase opacity-50 not-italic">atlet b (merah)</span>
                    <span className="text-sm truncate max-w-[200px]">
                      {liveSelectedMatch.athleteBId ? (athletes[liveSelectedMatch.athleteBId]?.name || "Loading...") : "TBA"}
                    </span>
                  </div>
                  <span className="text-2xl font-black italic font-mono">{liveSelectedMatch.scoreB} pts</span>
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
          </div>
        )}
      </AnimatePresence>

      {/* Main Board Pools (Only showed if we are not locked under standalone matchId route, or if we want to explore) */}
      {!matchId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column Group: Ongoing matches */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <h3 className="font-black uppercase italic tracking-tighter text-sm flex items-center gap-2">
                <Tv size={16} className="text-[#FF4E00]" /> Ongoing Matches Pool ({ongoingMatches.length})
              </h3>
              <span className="font-mono text-[8px] uppercase bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-sm tracking-widest font-bold">
                Real-time update live
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ongoingMatches.map(match => {
                const nameA = match.athleteAId ? (athletes[match.athleteAId]?.name || "TBA") : "TBA";
                const nameB = match.athleteBId ? (athletes[match.athleteBId]?.name || "TBA") : "TBA";
                const tName = tournaments[match.tournamentId]?.name || "Tournament";
                const bName = brackets[match.bracketId] ? `${brackets[match.bracketId].style} ${brackets[match.bracketId].weightClass}` : "Wrestling Division";

                return (
                  <div 
                    key={match.id}
                    onClick={() => {
                      setSelectedMatch(match);
                      setMatchMinutes(3);
                      setMatchSeconds(0);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-white border border-[#141414] p-5 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(255,100,0,0.4)] transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="border-b border-zinc-100 pb-2 mb-3 flex justify-between items-center">
                        <span className="font-mono text-[7px] uppercase tracking-widest opacity-50 truncate max-w-[140px]" title={tName}>
                          {tName}
                        </span>
                        <span className="bg-red-50 text-red-600 border border-red-200 uppercase font-mono text-[7px] px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-bold animate-pulse">
                          <span className="w-1 h-1 bg-red-600 rounded-full" /> LIVE
                        </span>
                      </div>

                      <h4 className="font-mono text-[9px] uppercase tracking-widest font-black text-zinc-500 mb-3 truncate">
                        {bName}
                      </h4>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-black italic uppercase text-xs group-hover:text-[#FF4E00] transition-colors truncate max-w-[140px]">
                            {nameA}
                          </span>
                          <span className="font-mono text-xl font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-sm min-w-[32px] text-center">
                            {match.scoreA}
                          </span>
                        </div>
                        
                        <div className="h-px bg-zinc-100 flex-1 relative my-1">
                          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[7px] bg-white px-2 opacity-25">VS</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="font-black italic uppercase text-xs truncate max-w-[140px]">
                            {nameB}
                          </span>
                          <span className="font-mono text-xl font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-sm min-w-[32px] text-center">
                            {match.scoreB}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-100 pt-3 mt-4 flex items-center justify-between text-[8px] font-mono text-zinc-400 uppercase tracking-widest">
                      <span>Round {match.round}</span>
                      <span className="text-[#FF4E00] flex items-center gap-1 group-hover:underline">
                        Launch Central Board <ZoomIn size={10} />
                      </span>
                    </div>
                  </div>
                );
              })}

              {ongoingMatches.length === 0 && (
                <div className="col-span-full py-24 text-center border-2 border-dashed border-[#141414]/15 bg-white/50 rounded-sm">
                  <ShieldAlert size={36} className="mx-auto text-zinc-400 mb-4" />
                  <p className="font-black uppercase italic text-sm text-zinc-650">No Live Ongoing Matches</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest opacity-50 mt-1 max-w-xs mx-auto">
                    When tournament-organizers set any matches to "Ongoing", the scoreboards will stream here.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column Group: Completed matches */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#141414] text-[#E4E3E0] p-4 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <h3 className="font-black uppercase italic tracking-tighter text-sm flex items-center gap-2">
                <Award size={16} className="text-[#FF4E00]" /> Recent Results
              </h3>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {recentCompletedMatches.map(match => {
                const nameA = match.athleteAId ? (athletes[match.athleteAId]?.name || "TBA") : "TBA";
                const nameB = match.athleteBId ? (athletes[match.athleteBId]?.name || "TBA") : "TBA";
                const isWinnerA = match.winnerId === match.athleteAId;
                const isWinnerB = match.winnerId === match.athleteBId;
                const bName = brackets[match.bracketId] ? `${brackets[match.bracketId].style} ${brackets[match.bracketId].weightClass}` : "Division";

                return (
                  <div 
                    key={match.id}
                    className="bg-white border border-zinc-200 p-4 transition-all"
                  >
                    <p className="font-mono text-[7px] uppercase opacity-40 mb-2 tracking-widest">
                      {bName} | Round {match.round}
                    </p>

                    <div className="space-y-1.5 mb-2">
                      <div className="flex justify-between items-center">
                        <span className={cn(
                          "text-xs uppercase italic truncate max-w-[120px]",
                          isWinnerA ? "font-black text-[#141414]" : "text-zinc-400 line-through"
                        )}>
                          {nameA}
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-650 bg-zinc-50 px-1.5 py-0.5 rounded-sm">
                          {match.scoreA}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className={cn(
                          "text-xs uppercase italic truncate max-w-[120px]",
                          isWinnerB ? "font-black text-[#141414]" : "text-zinc-400 line-through"
                        )}>
                          {nameB}
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-650 bg-zinc-50 px-1.5 py-0.5 rounded-sm">
                          {match.scoreB}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-100/50 pt-2 flex items-center justify-between text-[8px] font-mono text-green-700 uppercase tracking-widest font-bold">
                      <span className="flex items-center gap-1">
                        <Trophy size={10} /> Winner: {isWinnerA ? nameA : isWinnerB ? nameB : "Draw"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {recentCompletedMatches.length === 0 && (
                <div className="py-12 text-center border border-dashed border-zinc-200 bg-white/40">
                  <p className="font-mono text-[9px] uppercase tracking-widest opacity-40">No completed matches recorded yet.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default LiveScoreboard;
