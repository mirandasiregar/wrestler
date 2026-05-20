import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Athlete, Match, Bracket } from '../types';
import { 
  Users, 
  Info, 
  ShieldAlert, 
  ArrowRight, 
  HelpCircle, 
  UserCheck, 
  Play, 
  Check, 
  Trophy, 
  Trash2, 
  Plus, 
  Sparkles, 
  PlusCircle, 
  Award, 
  AlertCircle 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ManualPairingProps {
  athletes: Athlete[];
  matches: Match[];
  activeBracket: Bracket;
  onAssignAthlete: (matchId: string, slot: 'A' | 'B', athleteId: string | null) => Promise<void>;
  isOrganizer: boolean;
  onStartMatch?: (match: Match) => Promise<void>;
  onEnterScoring?: (match: Match) => void;
}

interface PendingSlot {
  id: string; // e.g. "pending-r2-p0"
  round: number;
  position: number;
  athleteAId: string | null;
  athleteBId: string | null;
}

export default function ManualPairing({
  athletes,
  matches,
  activeBracket,
  onAssignAthlete,
  isOrganizer,
  onStartMatch,
  onEnterScoring,
}: ManualPairingProps) {
  const [draggedAthleteId, setDraggedAthleteId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ matchId: string; slot: 'A' | 'B'; isPendingSlot: boolean } | null>(null);
  const [activeRoundTab, setActiveRoundTab] = useState<number>(1);
  const [pendingSlots, setPendingSlots] = useState<Record<number, PendingSlot[]>>({});
  const [loadingMatchCreation, setLoadingMatchCreation] = useState(false);

  // Group matches by round for presentation
  const rounds: Record<number, Match[]> = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });
  
  // Sort match rounds
  Object.keys(rounds).forEach(r => {
    rounds[Number(r)].sort((a, b) => a.position - b.position);
  });

  // Calculate existing & draft round numbers dynamically
  const roundNumbersFromMatches = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const roundNumbersFromPending = Object.keys(pendingSlots).map(Number).sort((a, b) => a - b);
  const roundNumbers = Array.from(
    new Set([1, ...roundNumbersFromMatches, ...roundNumbersFromPending])
  ).sort((a, b) => a - b);

  // When rounds change or load, automatically default activeRoundTab if out of bounds
  useEffect(() => {
    if (roundNumbers.length > 0 && !roundNumbers.includes(activeRoundTab)) {
      setActiveRoundTab(Math.min(...roundNumbers));
    }
  }, [matches, pendingSlots]);

  // Track who is assigned in the current active round
  const activeMatchesInCurrentRound = matches.filter(m => m.round === activeRoundTab && (m.status === 'pending' || m.status === 'ongoing'));
  const assignedAthleteIds = new Set<string>();
  activeMatchesInCurrentRound.forEach(m => {
    if (m.athleteAId) assignedAthleteIds.add(m.athleteAId);
    if (m.athleteBId) assignedAthleteIds.add(m.athleteBId);
  });
  // Also track inside current round's local pending slots
  const currentPendingSlots = pendingSlots[activeRoundTab] || [];
  currentPendingSlots.forEach(s => {
    if (s.athleteAId) assignedAthleteIds.add(s.athleteAId);
    if (s.athleteBId) assignedAthleteIds.add(s.athleteBId);
  });

  // Filter athletes of the same bracket
  const bracketAthletes = athletes.filter(a => a.bracketId === activeBracket.id);

  // Athlete map for fast lookup
  const athleteMap = athletes.reduce((acc, current) => {
    acc[current.athleteId] = current;
    return acc;
  }, {} as Record<string, Athlete>);

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, athleteId: string) => {
    setDraggedAthleteId(athleteId);
    e.dataTransfer.setData('text/plain', athleteId);
  };

  // Handle Drag Over
  const handleDragOver = (
    e: React.DragEvent, 
    matchId: string, 
    slot: 'A' | 'B', 
    targetMatch: Match | null, 
    targetPendingSlot: PendingSlot | null
  ) => {
    e.preventDefault();
    if (!draggedAthleteId) return;

    let oppositeId: string | null = null;
    if (targetMatch) {
      oppositeId = slot === 'A' ? (targetMatch.athleteBId || null) : (targetMatch.athleteAId || null);
    } else if (targetPendingSlot) {
      oppositeId = slot === 'A' ? (targetPendingSlot.athleteBId || null) : (targetPendingSlot.athleteAId || null);
    }

    if (draggedAthleteId === oppositeId) return;

    setDragOverTarget({ 
      matchId, 
      slot, 
      isPendingSlot: !!targetPendingSlot 
    });
  };

  // Handle Drag Leave
  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  // Handle Drop on standard match
  const handleDrop = async (e: React.DragEvent, matchId: string, slot: 'A' | 'B', currentMatch: Match) => {
    e.preventDefault();
    setDragOverTarget(null);
    const athleteId = e.dataTransfer.getData('text/plain') || draggedAthleteId;
    setDraggedAthleteId(null);

    if (!athleteId) return;

    const oppositeSlotAthleteId = slot === 'A' ? currentMatch.athleteBId : currentMatch.athleteAId;
    if (athleteId === oppositeSlotAthleteId) {
      alert("An athlete cannot fight themselves!");
      return;
    }

    // Checking if athlete already assigned to another match in this round
    const otherMatchInRoundWithAthlete = matches.find(m => 
      m.round === currentMatch.round && 
      m.id !== currentMatch.id && 
      (m.athleteAId === athleteId || m.athleteBId === athleteId)
    );
    if (otherMatchInRoundWithAthlete) {
      alert("This athlete is already scheduled for another match in this round!");
      return;
    }

    await onAssignAthlete(matchId, slot, athleteId);
  };

  // Handle Drop on local Pending Draft Slot
  const handleDropOnPendingSlot = async (e: React.DragEvent, pendingSlotId: string, slot: 'A' | 'B') => {
    e.preventDefault();
    setDragOverTarget(null);
    const athleteId = e.dataTransfer.getData('text/plain') || draggedAthleteId;
    setDraggedAthleteId(null);

    if (!athleteId) return;

    let targetRound: number | null = null;
    let targetIdx = -1;

    Object.entries(pendingSlots).forEach(([rNumStr, slots]) => {
      const slotList = slots as PendingSlot[];
      const idx = slotList.findIndex(s => s.id === pendingSlotId);
      if (idx !== -1) {
        targetRound = Number(rNumStr);
        targetIdx = idx;
      }
    });

    if (targetRound === null || targetIdx === -1) return;

    const currentSlots = pendingSlots[targetRound];
    const pSlot = currentSlots[targetIdx];

    const oppositeSlotAthleteId = slot === 'A' ? pSlot.athleteBId : pSlot.athleteAId;
    if (athleteId === oppositeSlotAthleteId) {
      alert("An athlete cannot fight themselves!");
      return;
    }

    // Ensure they aren't assigned elsewhere in this round's real matches OR other local draft slots
    const isAlreadyInRealMatch = matches.some(m => 
      m.round === targetRound && (m.athleteAId === athleteId || m.athleteBId === athleteId)
    );
    const isAlreadyInDraftSlots = currentSlots.some((s, idx) => 
      idx !== targetIdx && (s.athleteAId === athleteId || s.athleteBId === athleteId)
    );

    if (isAlreadyInRealMatch || isAlreadyInDraftSlots) {
      alert("This athlete is already scheduled for a match in this round!");
      return;
    }

    // Update state locally
    const updatedSlots = [...currentSlots];
    updatedSlots[targetIdx] = {
      ...pSlot,
      [slot === 'A' ? 'athleteAId' : 'athleteBId']: athleteId
    };

    setPendingSlots(prev => ({
      ...prev,
      [targetRound!]: updatedSlots
    }));

    // Auto-save to Firestore if BOTH roles are filled!
    const finalSlot = updatedSlots[targetIdx];
    if (finalSlot.athleteAId && finalSlot.athleteBId) {
      setLoadingMatchCreation(true);
      try {
        const mId = `r${targetRound}-p${finalSlot.position}`;
        const matchRef = doc(db, `tournaments/${activeBracket.tournamentId}/brackets/${activeBracket.id}/matches/${mId}`);
        await setDoc(matchRef, {
          id: mId,
          bracketId: activeBracket.id,
          tournamentId: activeBracket.tournamentId,
          round: targetRound,
          position: finalSlot.position,
          athleteAId: finalSlot.athleteAId,
          athleteBId: finalSlot.athleteBId,
          scoreA: 0,
          scoreB: 0,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Remove slot from local state so Firestore listener replaces it seamlessly
        setPendingSlots(prev => {
          const nextPending = { ...prev };
          const filtered = nextPending[targetRound!].filter(s => s.id !== pendingSlotId);
          if (filtered.length === 0) {
            delete nextPending[targetRound!];
          } else {
            nextPending[targetRound!] = filtered;
          }
          return nextPending;
        });
      } catch (err) {
        console.error("Error creating match document:", err);
        alert("Failed to commit match to database.");
      } finally {
        setLoadingMatchCreation(false);
      }
    }
  };

  // Add next round empty slots manually
  const handleAddNextRound = (currentRound: number) => {
    const currentRoundMatchesCount = matches.filter(m => m.round === currentRound).length;
    const numSlotsValue = Math.max(1, Math.ceil(currentRoundMatchesCount / 2));

    const existingMatchesForNextRound = matches.filter(m => m.round === currentRound + 1);
    const existingPositions = new Set(existingMatchesForNextRound.map(m => m.position));

    const newPendingSlots: PendingSlot[] = [];
    for (let i = 0; i < numSlotsValue; i++) {
      if (!existingPositions.has(i)) {
        newPendingSlots.push({
          id: `pending-r${currentRound + 1}-p${i}`,
          round: currentRound + 1,
          position: i,
          athleteAId: null,
          athleteBId: null,
        });
      }
    }

    if (newPendingSlots.length === 0) {
      alert(`Round ${currentRound + 1} already has matching slot allocations generated in Firestore!`);
      setActiveRoundTab(currentRound + 1);
      return;
    }

    setPendingSlots(prev => ({
      ...prev,
      [currentRound + 1]: newPendingSlots
    }));

    setActiveRoundTab(currentRound + 1);
  };

  // Auto-generate next round from current round winners
  const handleGenerateOtomatis = async (currentRound: number) => {
    const winners = matches
      .filter(m => m.round === currentRound && m.status === 'completed' && m.winnerId)
      .sort((a, b) => a.position - b.position)
      .map(m => m.winnerId) as string[];

    if (winners.length < 2) {
      alert(`Need at least 2 completed matches with winners in Round ${currentRound} to auto-generate the next round.`);
      return;
    }

    const confirmGen = confirm(`Generate Round ${currentRound + 1} matches automatically using the ${winners.length} winners from Round ${currentRound}?`);
    if (!confirmGen) return;

    setLoadingMatchCreation(true);
    try {
      const batch = writeBatch(db);
      const nextRound = currentRound + 1;
      const numNewMatches = Math.floor(winners.length / 2);

      for (let i = 0; i < numNewMatches; i++) {
        const athleteAId = winners[i * 2];
        const athleteBId = winners[i * 2 + 1];
        const matchId = `r${nextRound}-p${i}`;
        const matchRef = doc(db, `tournaments/${activeBracket.tournamentId}/brackets/${activeBracket.id}/matches/${matchId}`);

        batch.set(matchRef, {
          id: matchId,
          bracketId: activeBracket.id,
          tournamentId: activeBracket.tournamentId,
          round: nextRound,
          position: i,
          athleteAId,
          athleteBId,
          scoreA: 0,
          scoreB: 0,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // If odd number of winners, last winner gets a bye (partially assigned match)
      if (winners.length % 2 !== 0) {
        const lastWinnerId = winners[winners.length - 1];
        const lastPosition = numNewMatches;
        const matchId = `r${nextRound}-p${lastPosition}`;
        const matchRef = doc(db, `tournaments/${activeBracket.tournamentId}/brackets/${activeBracket.id}/matches/${matchId}`);

        batch.set(matchRef, {
          id: matchId,
          bracketId: activeBracket.id,
          tournamentId: activeBracket.tournamentId,
          round: nextRound,
          position: lastPosition,
          athleteAId: lastWinnerId,
          athleteBId: null,
          scoreA: 0,
          scoreB: 0,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await batch.commit();

      // Clear any local pending slots for the next round since they are now real
      setPendingSlots(prev => {
        const nextPending = { ...prev };
        delete nextPending[nextRound];
        return nextPending;
      });

      setActiveRoundTab(nextRound);
    } catch (err) {
      console.error("Error auto-generating round matches:", err);
      alert("Failed to auto-generate matches.");
    } finally {
      setLoadingMatchCreation(false);
    }
  };

  // Reset or delete round matches entirely
  const handleResetRound = async (rNum: number) => {
    const roundMatches = matches.filter(m => m.round === rNum);
    if (roundMatches.length === 0) {
      setPendingSlots(prev => {
        const nextPending = { ...prev };
        delete nextPending[rNum];
        return nextPending;
      });
      setActiveRoundTab(Math.max(1, rNum - 1));
      return;
    }

    const confirmReset = confirm(`WARNING: This will permanently DELETE all ${roundMatches.length} matches and their scores for Round ${rNum}. Are you sure?`);
    if (!confirmReset) return;

    setLoadingMatchCreation(true);
    try {
      const batch = writeBatch(db);
      roundMatches.forEach(m => {
        const mRef = doc(db, `tournaments/${activeBracket.tournamentId}/brackets/${activeBracket.id}/matches/${m.id}`);
        batch.delete(mRef);
      });
      await batch.commit();

      setPendingSlots(prev => {
        const nextPending = { ...prev };
        delete nextPending[rNum];
        return nextPending;
      });

      setActiveRoundTab(Math.max(1, rNum - 1));
    } catch (err) {
      console.error("Error resetting round matches:", err);
      alert("Failed to delete matches for this round.");
    } finally {
      setLoadingMatchCreation(false);
    }
  };

  const activeRoundMatches = rounds[activeRoundTab] || [];
  const activeRoundDraftSlots = pendingSlots[activeRoundTab] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar: Draggable Athletes list */}
      <div className="lg:col-span-1 bg-white border border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
        <div className="border-b border-[#141414]/10 pb-4 mb-4">
          <h3 className="text-lg font-black tracking-tighter uppercase italic flex items-center gap-2">
            <Users size={16} /> Athletes Pool
          </h3>
          <p className="font-mono text-[8px] uppercase tracking-widest opacity-50 mt-1">
            Drag athletes to active round pairing slots
          </p>
        </div>

        {/* Dynamic tips depending on activeRoundTab */}
        <div className="bg-orange-50 border-l-4 border-[#FF4E00] p-3 mb-4 rounded-sm">
          <p className="font-mono text-[9px] uppercase tracking-wider text-orange-950 leading-relaxed font-bold">
            {activeRoundTab === 1 ? (
              "💡 Drag athletes into empty slots (A or B) in Round 1. Redundant active matches prevent duplicate assigns."
            ) : (
              "💡 You can drag name cards from the sidebar OR drag winners from Round " + (activeRoundTab - 1) + " completed matches into empty slots!"
            )}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {bracketAthletes.map(athlete => {
            const isAssigned = assignedAthleteIds.has(athlete.athleteId);
            return (
              <div
                key={athlete.athleteId}
                draggable={!isAssigned && isOrganizer}
                onDragStart={(e) => handleDragStart(e, athlete.athleteId)}
                onDragEnd={() => setDraggedAthleteId(null)}
                className={cn(
                  "border p-3 flex flex-col gap-1 transition-all select-none cursor-default",
                  isAssigned
                    ? "bg-[#141414]/5 border-zinc-200 opacity-40 cursor-not-allowed"
                    : isOrganizer
                    ? "bg-white border-[#141414] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(255,78,0,0.8)] cursor-grab active:cursor-grabbing"
                    : "bg-white border-zinc-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black italic uppercase text-xs truncate max-w-[130px]">{athlete.name}</span>
                  <span className={cn(
                    "text-[7px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm border",
                    isAssigned 
                      ? "bg-zinc-800 text-white border-zinc-800" 
                      : (athlete.status === 'completed' ? "bg-green-100 text-green-700 border-green-200" : "bg-zinc-100 text-[#141414] border-zinc-300")
                  )}>
                    {isAssigned ? "Matched" : athlete.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                  <span>{athlete.weightClass}</span>
                  <span>W: {athlete.wins} - L: {athlete.losses}</span>
                </div>
              </div>
            );
          })}

          {bracketAthletes.length === 0 && (
            <div className="py-12 text-center border border-dashed border-[#141414]/10">
              <p className="font-mono text-[9px] uppercase tracking-widest opacity-40">No athletes registered in this bracket division.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Bracket workspace */}
      <div className="lg:col-span-3 space-y-6 flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-[#141414]/10 pb-4 mb-6">
            <div>
              <h3 className="text-xl font-black tracking-tighter uppercase italic">Manual Pairing Bracket</h3>
              <p className="font-mono text-[8px] uppercase tracking-widest opacity-50 mt-1">
                Customize pairing matches round-by-round with manual drag or automatic qualifiers
              </p>
            </div>
            {loadingMatchCreation && (
              <div className="flex items-center gap-2 text-xs font-mono uppercase animate-pulse text-[#FF4E00]">
                <PlusCircle className="animate-spin" size={14} /> Saving pairings...
              </div>
            )}
          </div>

          {/* ROUNDS TAB BAR */}
          <div className="flex border-b border-[#141414] mb-8 overflow-x-auto">
            {roundNumbers.map(rNum => (
              <button
                key={rNum}
                onClick={() => setActiveRoundTab(rNum)}
                className={cn(
                  "px-6 py-2.5 font-black text-xs uppercase italic tracking-wider border-t-2 border-r border-l border-transparent hover:bg-[#141414]/5 transition-all text-nowrap whitespace-nowrap",
                  activeRoundTab === rNum 
                    ? "border-t-[#FF4E00] border-r-[#141414] border-l-[#141414] border-b-transparent bg-white text-[#141414] font-black"
                    : "text-zinc-500 border-b-[#141414]"
                )}
              >
                Round {rNum}
                {(rounds[rNum]?.length > 0 || pendingSlots[rNum]?.length > 0) && (
                  <span className="ml-2 font-mono text-[8px] bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200">
                    {(rounds[rNum]?.length || 0) + (pendingSlots[rNum]?.length || 0)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* LIST/GRID WORKSPACE */}
          {(activeRoundMatches.length === 0 && activeRoundDraftSlots.length === 0) ? (
            <div className="py-24 text-center border-2 border-dashed border-[#141414]/10 bg-white/50 rounded-sm">
              <ShieldAlert size={32} className="mx-auto text-[#FF4E00] mb-4" />
              <p className="font-black uppercase italic tracking-tighter">Round {activeRoundTab} matches do not exist yet.</p>
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-1 max-w-sm mx-auto mb-6">
                Use the buttons below to establish draft slots or populate matches from the previous round automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-h-[calc(100vh-380px)] overflow-y-auto pr-2">
              
              {/* REAL FIRESTORE MATCHES */}
              {activeRoundMatches.map(match => {
                const isMatchSelectable = match.status === 'pending';

                return (
                  <div
                    key={match.id}
                    className={cn(
                      "bg-white border p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] transition-all",
                      isMatchSelectable ? "border-[#141414]" : "border-zinc-200 opacity-80"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-[#141414]/10 pb-2">
                      <span className="font-mono text-[8px] uppercase tracking-widest bg-zinc-800 text-[#E4E3E0] px-2 py-0.5 rounded-sm">
                        MATCH #{parseInt(match.id.split('-p')[1]) + 1}
                      </span>
                      <span className={cn(
                        "font-mono text-[8px] uppercase tracking-widest font-bold",
                        match.status === 'ongoing' ? "text-orange-600 animate-pulse" :
                        match.status === 'completed' ? "text-green-600" : "text-zinc-400"
                      )}>
                        {match.status}
                      </span>
                    </div>

                    {/* Athlete A Slot */}
                    <div
                      onDragOver={(e) => isMatchSelectable && handleDragOver(e, match.id, 'A', match, null)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => isMatchSelectable && handleDrop(e, match.id, 'A', match)}
                      className={cn(
                        "border p-2 mb-2 transition-all rounded-sm flex justify-between items-center min-h-[38px]",
                        dragOverTarget?.matchId === match.id && dragOverTarget?.slot === 'A' && !dragOverTarget?.isPendingSlot
                          ? "border-2 border-dashed border-[#FF4E00] bg-orange-50/50 scale-[1.02]"
                          : match.athleteAId
                          ? "border-zinc-200 bg-zinc-50/30"
                          : "border-dashed border-zinc-300 hover:border-zinc-400 bg-zinc-50/50"
                      )}
                    >
                      <div className="overflow-hidden flex-1">
                        {match.athleteAId ? (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase italic truncate block">
                              {athleteMap[match.athleteAId]?.name || "Loading..."}
                            </span>
                            {isMatchSelectable && isOrganizer && (
                              <button
                                onClick={() => onAssignAthlete(match.id, 'A', null)}
                                className="text-[10px] text-red-500 font-mono uppercase px-1.5 py-0.5 hover:bg-red-50 border border-transparent hover:border-red-250"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">
                            {isMatchSelectable ? "Drop Athlete A here" : "Awaiting Winner"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* VS separator */}
                    <div className="text-center font-mono opacity-20 text-[8px] py-0.5">VS</div>

                    {/* Athlete B Slot */}
                    <div
                      onDragOver={(e) => isMatchSelectable && handleDragOver(e, match.id, 'B', match, null)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => isMatchSelectable && handleDrop(e, match.id, 'B', match)}
                      className={cn(
                        "border p-2 transition-all rounded-sm flex justify-between items-center min-h-[38px]",
                        dragOverTarget?.matchId === match.id && dragOverTarget?.slot === 'B' && !dragOverTarget?.isPendingSlot
                          ? "border-2 border-dashed border-[#FF4E00] bg-orange-50/50 scale-[1.02]"
                          : match.athleteBId
                          ? "border-zinc-200 bg-zinc-50/30"
                          : "border-dashed border-zinc-300 hover:border-zinc-400 bg-zinc-50/50"
                      )}
                    >
                      <div className="overflow-hidden flex-1">
                        {match.athleteBId ? (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase italic truncate block">
                              {athleteMap[match.athleteBId]?.name || "Loading..."}
                            </span>
                            {isMatchSelectable && isOrganizer && (
                              <button
                                onClick={() => onAssignAthlete(match.id, 'B', null)}
                                className="text-[10px] text-red-500 font-mono uppercase px-1.5 py-0.5 hover:bg-red-50 border border-transparent hover:border-red-200"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-widest opacity-40">
                            {isMatchSelectable ? "Drop Athlete B here" : "Awaiting Winner"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Drag winner feature */}
                    {match.status === 'completed' && match.winnerId && (
                      <div 
                        draggable={isOrganizer}
                        onDragStart={(e) => handleDragStart(e, match.winnerId!)}
                        className="mt-3 border border-dashed border-emerald-600 p-2 bg-emerald-50 text-emerald-950 font-bold font-mono text-[9px] uppercase tracking-wider flex items-center justify-between cursor-grab hover:bg-emerald-100 rounded transition-all"
                        title="Drag this winner into the next round's empty slots!"
                      >
                        <span className="flex items-center gap-1">🏆 Winner: {athleteMap[match.winnerId]?.name || "Loading..."}</span>
                        <span className="text-[7px] text-emerald-700 bg-emerald-200 px-1 py-0.5 rounded font-black">DRAG TO NEXT ROUND</span>
                      </div>
                    )}

                    {/* Match Action area */}
                    {isOrganizer && (
                      <div className="mt-4 pt-3 border-t border-[#141414]/10">
                        {match.status === 'pending' ? (
                          <button
                            disabled={!match.athleteAId || !match.athleteBId}
                            onClick={() => onStartMatch?.(match)}
                            className="w-full bg-[#141414] text-[#E4E3E0] hover:bg-[#FF4E00] disabled:opacity-40 disabled:hover:bg-[#141414] py-1.5 px-3 font-mono text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 font-bold shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] disabled:shadow-none hover:-translate-y-0.5"
                          >
                            <Play size={10} /> ▶ Mulai Pertandingan
                          </button>
                        ) : match.status === 'ongoing' ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-1.5 font-mono text-[8px] uppercase tracking-widest text-[#FF4E00] font-bold animate-pulse bg-orange-50 py-1 border border-orange-200 rounded">
                              <span className="w-1.5 h-1.5 bg-[#FF4E00] rounded-full animate-ping" /> Sedang Berlangsung
                            </div>
                            <button
                              onClick={() => onEnterScoring?.(match)}
                              className="w-full border-2 border-[#141414] bg-white hover:bg-zinc-100 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-all font-bold text-center shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-0.5"
                            >
                              Lanjutkan Scoring
                            </button>
                          </div>
                        ) : (
                          <div className="text-center font-mono text-[9px] uppercase tracking-widest text-emerald-700 bg-emerald-50 py-1.5 border border-emerald-200 rounded font-bold flex items-center justify-center gap-1">
                            <Check size={11} /> Selesai ✓
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* LOCAL PENDING PLOTS (DRAFTS) */}
              {activeRoundDraftSlots.map((pSlot, index) => {
                return (
                  <div
                    key={pSlot.id}
                    className="bg-[#FF4E00]/5 border-2 border-dashed border-[#FF4E00]/40 p-4 transition-all hover:border-[#FF4E00]/80"
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-[#FF4E00]/20 pb-2">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-orange-850 font-bold bg-[#FF4E00]/10 px-2 py-0.5 rounded-sm">
                        DRAFT MATCH #{pSlot.position + 1}
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-widest text-orange-600 font-bold animate-pulse">
                        Awaiting Athletes
                      </span>
                    </div>

                    {/* Athlete A Slot */}
                    <div
                      onDragOver={(e) => handleDragOver(e, pSlot.id, 'A', null, pSlot)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropOnPendingSlot(e, pSlot.id, 'A')}
                      className={cn(
                        "border p-2 mb-2 transition-all rounded-sm flex justify-between items-center min-h-[38px]",
                        dragOverTarget?.matchId === pSlot.id && dragOverTarget?.slot === 'A' && dragOverTarget?.isPendingSlot
                          ? "border-2 border-dashed border-[#FF4E00] bg-orange-50/50 scale-[1.02]"
                          : pSlot.athleteAId
                          ? "border-emerald-300 bg-emerald-50/30"
                          : "border-dashed border-orange-200 hover:border-orange-400 bg-white"
                      )}
                    >
                      <div className="overflow-hidden flex-1">
                        {pSlot.athleteAId ? (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase italic truncate block text-orange-950">
                              {athleteMap[pSlot.athleteAId]?.name || "Loading..."}
                            </span>
                            <button
                              onClick={() => {
                                const updated = [...pendingSlots[activeRoundTab]];
                                updated[index] = { ...pSlot, athleteAId: null };
                                setPendingSlots(prev => ({ ...prev, [activeRoundTab]: updated }));
                              }}
                              className="text-[10px] text-red-500 font-mono uppercase px-1.5 py-0.5 hover:bg-red-50 border border-transparent hover:border-red-200"
                            >
                              Clear
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF4E00]/60">
                            Drop Athlete A Here
                          </span>
                        )}
                      </div>
                    </div>

                    {/* VS indicator */}
                    <div className="text-center font-mono opacity-20 text-[8px] py-0.5">VS</div>

                    {/* Athlete B Slot */}
                    <div
                      onDragOver={(e) => handleDragOver(e, pSlot.id, 'B', null, pSlot)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropOnPendingSlot(e, pSlot.id, 'B')}
                      className={cn(
                        "border p-2 transition-all rounded-sm flex justify-between items-center min-h-[38px]",
                        dragOverTarget?.matchId === pSlot.id && dragOverTarget?.slot === 'B' && dragOverTarget?.isPendingSlot
                          ? "border-2 border-dashed border-[#FF4E00] bg-orange-50/50 scale-[1.02]"
                          : pSlot.athleteBId
                          ? "border-emerald-300 bg-emerald-50/30"
                          : "border-dashed border-orange-200 hover:border-orange-400 bg-white"
                      )}
                    >
                      <div className="overflow-hidden flex-1">
                        {pSlot.athleteBId ? (
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase italic truncate block text-orange-950">
                              {athleteMap[pSlot.athleteBId]?.name || "Loading..."}
                            </span>
                            <button
                              onClick={() => {
                                const updated = [...pendingSlots[activeRoundTab]];
                                updated[index] = { ...pSlot, athleteBId: null };
                                setPendingSlots(prev => ({ ...prev, [activeRoundTab]: updated }));
                              }}
                              className="text-[10px] text-red-500 font-mono uppercase px-1.5 py-0.5 hover:bg-red-50 border border-transparent hover:border-red-200"
                            >
                              Clear
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF4E00]/60">
                            Drop Athlete B Here
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-center">
                      <span className="font-mono text-[7px] uppercase tracking-wider text-[#FF4E00]" style={{ letterSpacing: '0.15em' }}>
                        Pair both to save automatically
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ORGANIZER CONTROL BUTTONS AT BOTTOM */}
        {isOrganizer && (
          <div className="mt-8 border-t border-[#141414]/15 pt-6 flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-55 bg-white p-5 border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="text-left w-full md:w-auto">
              <h4 className="font-black uppercase italic text-xs tracking-tighter text-[#141414]">Round {activeRoundTab} Administration Panel</h4>
              <p className="font-mono text-[8px] uppercase tracking-widest text-[#141414]/65 mt-0.5">
                Set up next round alignments or reset matches configurations.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2.5 w-full md:w-auto justify-end">
              {/* Reset Current Round Button */}
              <button
                onClick={() => handleResetRound(activeRoundTab)}
                className="px-3 py-1.5 border border-red-500 hover:bg-red-50 text-red-700 font-mono text-[9px] uppercase font-bold tracking-wider rounded transition-all flex items-center gap-1.5"
                title={`Delete all matches in Round ${activeRoundTab}`}
              >
                <Trash2 size={11} /> Reset Round {activeRoundTab}
              </button>

              {/* Generate Next Round Otomatis Button */}
              <button
                onClick={() => handleGenerateOtomatis(activeRoundTab)}
                className="px-3 py-1.5 bg-[#141414] text-[#E4E3E0] hover:bg-[#FF4E00] font-mono text-[9px] uppercase font-bold tracking-wider rounded transition-all flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]"
                title="Automatically pairs winners into next round matches sequentially"
              >
                <Trophy size={11} /> Auto-Pair Round {activeRoundTab + 1}
              </button>

              {/* Add Next Round Manual Slots Button */}
              <button
                onClick={() => handleAddNextRound(activeRoundTab)}
                className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 font-mono text-[9px] uppercase font-bold tracking-wider rounded transition-all flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]"
                title="Create empty placeholder slots for the next round to manually drag athletes"
              >
                <Plus size={11} /> Next Round Manual Slots
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
