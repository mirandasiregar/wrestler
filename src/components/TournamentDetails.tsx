import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, addDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { Tournament, Bracket, Match, Athlete, UserProfile } from '../types';
import { ChevronLeft, ChevronRight, Trophy, Users, Info, Layout, Plus, UserPlus, Edit3, Save, X as CloseIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ScoringPanel from './ScoringPanel';
import MatchDetails from './MatchDetails';
import { generateKnockoutBracket } from '../services/bracketService';
import AthleteProfile from './AthleteProfile';

export default function TournamentDetails({ tournament, profile, onBack }: { tournament: Tournament, profile: UserProfile | null, onBack: () => void }) {
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [activeBracket, setActiveBracket] = useState<Bracket | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [viewingMatchId, setViewingMatchId] = useState<string | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  const viewingMatch = viewingMatchId ? matches.find(m => m.id === viewingMatchId) : null;
  const [loading, setLoading] = useState(true);
  const [isAddingAthlete, setIsAddingAthlete] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState('');
  const [newAthleteGender, setNewAthleteGender] = useState<'male' | 'female'>('male');
  const [newAthleteBracketId, setNewAthleteBracketId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ongoing' | 'completed'>('all');
  const [pairingSlot, setPairingSlot] = useState<{ matchId: string, slot: 'A' | 'B' } | null>(null);
  const [isEditPairingsMode, setIsEditPairingsMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'bracket' | 'athletes'>('bracket');
  const [isEditingTournament, setIsEditingTournament] = useState(false);
  const [editTournamentData, setEditTournamentData] = useState({
    name: tournament.name,
    location: tournament.location,
    status: tournament.status,
    startDate: tournament.startDate?.toDate ? tournament.startDate.toDate().toISOString().split('T')[0] : new Date(tournament.startDate).toISOString().split('T')[0]
  });

  const handleDeleteAthlete = async (e: React.MouseEvent, athleteId: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'athletes', athleteId));
    } catch (error) {
      console.error("Error deleting athlete:", error);
    }
  };

  const handleAssignAthlete = async (athleteId: string | null) => {
    if (!pairingSlot || !activeBracket) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches/${pairingSlot.matchId}`);
      await updateDoc(matchRef, {
        [pairingSlot.slot === 'A' ? 'athleteAId' : 'athleteBId']: athleteId,
        updatedAt: new Date()
      });
      setPairingSlot(null);
    } catch (error) {
      console.error("Error assigning athlete:", error);
    }
  };

  const handleCreateEmptyBracket = async () => {
    if (!activeBracket) return;
    const athletesSnap = await getDocs(query(collection(db, 'athletes'), where('bracketId', '==', activeBracket.id)));
    const athleteIds = athletesSnap.docs.map(d => d.id);
    
    if (athleteIds.length < 2) {
      alert("Need at least 2 athletes to generate a bracket structure.");
      return;
    }

    const hasAnyMatches = matches.length > 0;
    if (hasAnyMatches) {
      if (!confirm("This will clear all current matches and start a fresh manual pairing. Continue?")) {
        return;
      }
    }

    // Generate bracket structure for the current number of athletes, but don't assign them
    const finalMatches = generateKnockoutBracket(athleteIds, tournament.id, activeBracket.id, true);
    
    const batch = writeBatch(db);
    // Remove existing matches
    const currentMatchesSnap = await getDocs(collection(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches`));
    currentMatchesSnap.forEach(d => batch.delete(d.ref));

    finalMatches.forEach(m => {
      const matchId = `r${m.round}-p${m.position}`;
      const mRef = doc(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches`, matchId);
      batch.set(mRef, { ...m, createdAt: new Date(), updatedAt: new Date() });
    });
    await batch.commit();
    setIsEditPairingsMode(true);
  };

  const isOrganizer = auth.currentUser?.uid === tournament.organizerId || profile?.role === 'admin';

  const handleUpdateTournament = async () => {
    try {
      const docRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(docRef, {
        ...editTournamentData,
        startDate: new Date(editTournamentData.startDate),
        updatedAt: new Date()
      });
      setIsEditingTournament(false);
      // In a real app, we might want to trigger a refresh or let the parent listener handle it
    } catch (error) {
      console.error("Error updating tournament:", error);
      alert("Failed to update tournament.");
    }
  };

  useEffect(() => {
    if (activeBracket) {
      setNewAthleteGender(activeBracket.gender);
      setNewAthleteBracketId(activeBracket.id);
    }
  }, [activeBracket]);

  const handleAddAthlete = async () => {
    if (!newAthleteName || !newAthleteBracketId) return;
    const targetBracket = brackets.find(b => b.id === newAthleteBracketId);
    if (!targetBracket) return;

    try {
      await addDoc(collection(db, 'athletes'), {
        name: newAthleteName,
        gender: newAthleteGender,
        tournamentId: tournament.id,
        bracketId: targetBracket.id,
        weightClass: targetBracket.weightClass,
        status: 'pending',
        wins: 0,
        losses: 0,
        totalMatches: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Partial<Athlete>);
      setNewAthleteName('');
      setIsAddingAthlete(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateBracket = async () => {
    if (!activeBracket) return;
    
    const hasActiveMatches = matches.some(m => m.status !== 'pending' || m.winnerId || m.scoreA > 0 || m.scoreB > 0);
    const hasAnyMatches = matches.length > 0;

    if (hasAnyMatches) {
      const warningText = hasActiveMatches 
        ? "CRITICAL: This bracket already has ongoing or completed matches. Regenerating will DELETE all current scores, results, and progress for the athletes. Are you sure you want to proceed?"
        : "Matches already exist for this bracket. Regenerating will replace the current setup. Continue?";
      
      if (!confirm(warningText)) {
        return;
      }
    }

    const athletesSnap = await getDocs(query(collection(db, 'athletes'), where('bracketId', '==', activeBracket.id)));
    const athleteIds = athletesSnap.docs.map(d => d.id);
    
    if (athleteIds.length < 2) {
      alert("Need at least 2 athletes to generate a bracket.");
      return;
    }

    const matchesToCreate = generateKnockoutBracket(athleteIds, tournament.id, activeBracket.id);
    
    const batch = writeBatch(db);
    // Remove existing matches
    const currentMatchesSnap = await getDocs(collection(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches`));
    currentMatchesSnap.forEach(d => batch.delete(d.ref));

    matchesToCreate.forEach(m => {
      const matchId = `r${m.round}-p${m.position}`;
      const mRef = doc(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches`, matchId);
      batch.set(mRef, { ...m, createdAt: new Date(), updatedAt: new Date() });
    });
    await batch.commit();
    setIsEditPairingsMode(false);
  };

  useEffect(() => {
    const qBrackets = query(collection(db, `tournaments/${tournament.id}/brackets`));
    const unsubBrackets = onSnapshot(qBrackets, (snap) => {
      const bItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as Bracket));
      setBrackets(bItems);
      if (bItems.length > 0 && !activeBracket) {
        setActiveBracket(bItems[0]);
      }
      setLoading(false);
    });
    return () => unsubBrackets();
  }, [tournament.id, activeBracket]);

  useEffect(() => {
    if (!activeBracket) return;
    
    // Fetch Athletes for this bracket to have names available
    const qAthletes = query(collection(db, 'athletes'), where('bracketId', '==', activeBracket.id));
    const unsubAthletes = onSnapshot(qAthletes, (snap) => {
      const aItems = snap.docs.map(d => ({ athleteId: d.id, ...d.data() } as Athlete));
      setAthletes(aItems);
    });

    const qMatches = query(collection(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches`));
    const unsubMatches = onSnapshot(qMatches, (snap) => {
      const mItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(mItems);
    });
    return () => {
      unsubAthletes();
      unsubMatches();
    };
  }, [activeBracket, tournament.id]);

  const handleUpdateAthleteStatus = async (athleteId: string, newStatus: 'pending' | 'ongoing' | 'completed') => {
    try {
      await updateDoc(doc(db, 'athletes', athleteId), {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error updating athlete status:", error);
    }
  };

  if (selectedAthleteId) {
    return <AthleteProfile athleteId={selectedAthleteId} profile={profile} onBack={() => setSelectedAthleteId(null)} />;
  }

  const athleteMap = athletes.reduce((acc, a) => {
    acc[a.athleteId] = a.name;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="space-y-12">
      <header className="relative pt-12 md:pt-0 mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="absolute top-0 left-0 md:relative md:block">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-colors mb-8 shadow-[4px_4px_0px_0px_rgba(255,78,0,0.3)]"
          >
            <ChevronLeft size={14} /> Back
          </button>
        </div>
        <div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">{tournament.name}</h2>
          <div className="flex items-center gap-6 mt-4">
            <Badge icon={<Trophy size={14} />} label={tournament.status} color="orange" />
            <span className="font-mono text-xs opacity-50 uppercase tracking-widest">{tournament.location}</span>
          </div>
        </div>

        {isOrganizer && (
          <div className="flex gap-4">
            <button 
              onClick={() => setIsEditingTournament(true)}
              className="flex items-center gap-2 border border-[#141414] px-4 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
            >
              <Edit3 size={14} /> Edit Tournament
            </button>
            {activeBracket && (
              <>
                <button 
                  onClick={() => setIsAddingAthlete(true)}
                  className="flex items-center gap-2 border border-[#141414] px-4 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  <UserPlus size={14} /> Add Athlete
                </button>
                <button 
                  onClick={handleGenerateBracket}
                  className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                >
                  <Layout size={14} /> Generate Bracket
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {isAddingAthlete && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="p-8 bg-black/5 border-2 border-dashed border-[#141414] rounded-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-end">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-50">Athlete Name</label>
              <input 
                type="text" 
                value={newAthleteName}
                onChange={(e) => setNewAthleteName(e.target.value)}
                className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2 focus:border-[#FF4E00] transition-colors"
                placeholder="e.g. John Doe"
              />
            </div>
            
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-50">Gender</label>
              <div className="flex gap-2">
                {['male', 'female'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setNewAthleteGender(g as any)}
                    className={cn(
                      "flex-1 py-2 font-mono text-[10px] uppercase tracking-widest border border-[#141414] transition-all",
                      newAthleteGender === g ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414]/5"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-50 block">Weight Class / Bracket</label>
              <select 
                value={newAthleteBracketId}
                onChange={(e) => setNewAthleteBracketId(e.target.value)}
                className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2 focus:border-[#FF4E00] transition-colors appearance-none"
              >
                {brackets.map(b => (
                  <option key={b.id} value={b.id} className="text-black">
                    {b.gender === 'male' ? 'M' : 'F'} | {b.weightClass} {b.style}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end gap-4">
            <button 
              onClick={() => setIsAddingAthlete(false)} 
              className="px-6 py-2 font-mono text-xs uppercase tracking-widest hover:bg-[#141414]/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddAthlete} 
              className="bg-[#141414] text-[#E4E3E0] px-8 py-2 font-mono text-xs uppercase tracking-widest hover:bg-orange-600 transition-colors shadow-[4px_4px_0px_0px_rgba(255,78,0,0.3)]"
            >
              Register Athlete
            </button>
          </div>
        </motion.div>
      )}

      {/* Bracket Tabs */}
      <div className="space-y-6">
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide border-b border-[#141414]/10">
          {brackets.map(b => (
            <button
              key={b.id}
              onClick={() => setActiveBracket(b)}
              className={cn(
                "px-6 py-3 font-mono text-[10px] uppercase tracking-widest transition-colors flex-shrink-0 border-b-2",
                activeBracket?.id === b.id ? "border-[#FF4E00] text-[#141414] font-black" : "border-transparent opacity-50 hover:opacity-100"
              )}
            >
              {b.gender === 'male' ? 'M' : 'F'} | {b.weightClass} {b.style}
            </button>
          ))}
        </div>

        {activeBracket && (
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('bracket')}
              className={cn(
                "px-4 py-1 font-mono text-[9px] uppercase tracking-widest border border-[#141414] transition-colors",
                activeTab === 'bracket' ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414]/5"
              )}
            >
              Bracket View
            </button>
            <button
              onClick={() => setActiveTab('athletes')}
              className={cn(
                "px-4 py-1 font-mono text-[9px] uppercase tracking-widest border border-[#141414] transition-colors",
                activeTab === 'athletes' ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414]/5"
              )}
            >
              Participants ({athletes.length})
            </button>
            {activeBracket && matches.length > 0 && isOrganizer && (
              <button
                onClick={() => setIsEditPairingsMode(!isEditPairingsMode)}
                className={cn(
                  "px-4 py-1 font-mono text-[9px] uppercase tracking-widest border border-[#141414] transition-colors flex items-center gap-2",
                  isEditPairingsMode ? "bg-[#FF4E00] text-white" : "hover:bg-[#141414]/5"
                )}
              >
                <Users size={12} /> {isEditPairingsMode ? 'Finish Pairing' : 'Edit Pairings'}
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'bracket' ? (
        <div className="min-h-[500px] overflow-x-auto py-12">
        <div className="flex justify-between items-center mb-8 border-b border-[#141414] pb-4">
          <div className="flex items-center gap-4">
            <label className="font-mono text-[10px] uppercase tracking-widest opacity-50">Filter Status:</label>
            <div className="flex gap-2">
              {(['all', 'pending', 'ongoing', 'completed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3 py-1 font-mono text-[9px] uppercase tracking-widest border border-[#141414] transition-colors",
                    statusFilter === status ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414]/5"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeBracket ? (
          <div className="flex flex-col gap-12">
            {matches.length > 0 ? (
              <div className="flex gap-16 min-w-max pb-8">
                {groupMatchesByRound(matches.filter(m => statusFilter === 'all' || m.status === statusFilter)).map((roundMatches, roundIdx) => (
                  <div key={roundIdx} className="flex flex-col justify-around gap-8">
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-30 text-center mb-4">Round {roundIdx + 1}</h4>
                    {roundMatches.map(match => (
                      <MatchCard 
                        key={match.id} 
                        match={match} 
                        athleteMap={athleteMap}
                        isEditable={isEditPairingsMode && match.round === 1 && match.status === 'pending'}
                        onAssignAthlete={(slot) => setPairingSlot({ matchId: match.id, slot })}
                        onClick={isEditPairingsMode ? undefined : () => setViewingMatchId(match.id)}
                        onViewAthlete={setSelectedAthleteId}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-[#141414]/10 bg-white/30 rounded-sm">
                <Layout size={48} className="mx-auto mb-4 opacity-10" />
                {athletes.length >= 2 ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-black uppercase italic text-2xl tracking-tighter">Ready for Pairing</h3>
                      <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-1">
                        {athletes.length} participants registered in this category
                      </p>
                    </div>
                    {isOrganizer && (
                      <div className="flex gap-4 justify-center">
                        <button 
                          onClick={handleGenerateBracket}
                          className="bg-[#141414] text-[#E4E3E0] px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] hover:bg-[#FF4E00] transition-all shadow-[8px_8px_0px_0px_rgba(255,78,0,0.3)] hover:-translate-y-1"
                        >
                          Auto Pair (Random)
                        </button>
                        <button 
                          onClick={handleCreateEmptyBracket}
                          className="border-2 border-[#141414] text-[#141414] px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] hover:bg-white transition-all shadow-[8px_8px_0px_0px_rgba(20,20,20,0.1)] hover:-translate-y-1"
                        >
                          Manual Pairing
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-black uppercase italic text-xl tracking-tighter opacity-40">Awaiting Participants</h3>
                    <p className="font-mono text-[10px] uppercase tracking-widest opacity-30 max-w-xs mx-auto">
                      Need at least 2 athletes registered in this category to generate pairings.
                    </p>
                    {isOrganizer && (
                      <button 
                        onClick={() => setIsAddingAthlete(true)}
                        className="inline-flex items-center gap-2 border border-[#141414] px-6 py-2 font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors mt-4"
                      >
                        <UserPlus size={14} /> Register Athlete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-24 opacity-20 space-y-4">
            <Layout size={48} />
            <p className="font-mono text-xs uppercase tracking-widest">Select a weight class to manage pairings</p>
          </div>
        )}
      </div>
      ) : (
        <div className="py-12 space-y-12">
          {(['pending', 'ongoing', 'completed'] as const).map(groupStatus => {
            const groupedAthletes = athletes.filter(a => {
              const status = a.status || 'pending';
              return status === groupStatus;
            });
            if (groupedAthletes.length === 0) return null;

            return (
              <div key={groupStatus} className="space-y-6">
                <div className="flex items-center gap-4">
                  <h3 className={cn(
                    "text-xl font-black uppercase italic tracking-tighter px-4 py-1",
                    groupStatus === 'pending' ? "bg-zinc-100 text-[#141414]" : 
                    (groupStatus === 'ongoing' ? "bg-orange-500 text-white" : "bg-green-500 text-white")
                  )}>
                    {groupStatus} ({groupedAthletes.length})
                  </h3>
                  <div className="h-px bg-[#141414]/10 flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedAthletes.map(athlete => (
                    <div 
                      key={athlete.athleteId} 
                      className="bg-white border border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] hover:-translate-y-1 transition-all cursor-pointer group"
                      onClick={() => setSelectedAthleteId(athlete.athleteId)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="font-black uppercase italic text-xl tracking-tighter group-hover:text-[#FF4E00] transition-colors line-clamp-1">{athlete.name}</div>
                          <div className="flex gap-2 mt-1">
                            <span className={cn(
                              "px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-white inline-block",
                              athlete.gender === 'male' ? "bg-blue-600" : "bg-pink-600"
                            )}>
                              {athlete.gender}
                            </span>
                          </div>
                        </div>
                        {isOrganizer && (
                          <div className="flex items-center gap-2">
                             <select 
                              value={athlete.status || 'pending'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateAthleteStatus(athlete.athleteId, e.target.value as any)}
                              className="font-mono text-[8px] uppercase tracking-widest border border-[#141414] bg-zinc-50 px-2 py-1 outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="ongoing">Ongoing</option>
                              <option value="completed">Completed</option>
                            </select>
                            <button 
                              onClick={(e) => handleDeleteAthlete(e, athlete.athleteId!)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-full ml-2"
                              title="Delete Athlete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 border-t border-[#141414]/10 pt-4">
                        <div>
                          <p className="font-mono text-[8px] uppercase tracking-widest opacity-40">Wins</p>
                          <p className="font-bold text-lg">{athlete.wins}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[8px] uppercase tracking-widest opacity-40">Losses</p>
                          <p className="font-bold text-lg">{athlete.losses}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[8px] uppercase tracking-widest opacity-40">Matches</p>
                          <p className="font-bold text-lg">{athlete.totalMatches}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {athletes.length === 0 && (
            <div className="py-24 text-center border-2 border-dashed border-[#141414]/10">
              <Users size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-30 italic">No participants registered in this category yet.</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {pairingSlot && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-lg p-8 shadow-[12px_12px_0px_0px_rgba(255,78,0,1)]"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Assign Athlete</h3>
                  <p className="font-mono text-[9px] uppercase tracking-widest opacity-50 mt-1">Match #{parseInt(pairingSlot.matchId.split('-p')[1]) + 1} | Slot {pairingSlot.slot}</p>
                </div>
                <button onClick={() => setPairingSlot(null)}>
                  <CloseIcon size={24} />
                </button>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-6 bg-orange-50 p-3 border-l-4 border-orange-500">
                Select an athlete from the list below to assign them to this match slot. Only unassigned athletes are available.
              </p>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                <button 
                  onClick={() => handleAssignAthlete(null)}
                  className="w-full text-left p-4 border border-dashed border-[#141414]/30 font-mono text-xs uppercase hover:bg-red-50 hover:border-red-500 transition-colors"
                >
                  Clear Selection (TBA)
                </button>
                {athletes.map(athlete => {
                  const isAssigned = matches.some(m => m.round === 1 && (m.athleteAId === athlete.athleteId || m.athleteBId === athlete.athleteId));
                  return (
                    <button
                      key={athlete.athleteId}
                      disabled={isAssigned}
                      onClick={() => handleAssignAthlete(athlete.athleteId)}
                      className={cn(
                        "w-full text-left p-4 border border-[#141414] group transition-all flex justify-between items-center",
                        isAssigned ? "opacity-30 cursor-not-allowed bg-zinc-100" : "hover:bg-[#141414] hover:text-[#E4E3E0]"
                      )}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-bold uppercase italic">{athlete.name}</span>
                        <span className={cn(
                          "font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 border",
                          athlete.status === 'pending' ? "bg-zinc-100 border-[#141414]" : (athlete.status === 'ongoing' ? "bg-orange-400 border-[#141414]" : "bg-green-400 border-[#141414]")
                        )}>
                          {athlete.status}
                        </span>
                      </div>
                      {isAssigned ? (
                        <span className="font-mono text-[8px] uppercase tracking-widest bg-zinc-200 text-zinc-500 px-2 py-1">Already Assigned</span>
                      ) : (
                        athlete.status !== 'pending' && <span className="font-mono text-[8px] uppercase tracking-widest bg-red-100 text-red-500 px-2 py-1">Busy/Finished</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingTournament && (
          <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-lg p-8 shadow-[12px_12px_0px_0px_rgba(255,78,0,0.5)]"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Edit Tournament</h3>
                  <p className="font-mono text-[10px] opacity-50 uppercase tracking-widest mt-1">General Information</p>
                </div>
                <button onClick={() => setIsEditingTournament(false)} className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                  <CloseIcon size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase tracking-widest opacity-50 block">Tournament Name</label>
                  <input 
                    type="text"
                    value={editTournamentData.name}
                    onChange={(e) => setEditTournamentData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2 focus:border-[#FF4E00] transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase tracking-widest opacity-50 block">Location</label>
                  <input 
                    type="text"
                    value={editTournamentData.location}
                    onChange={(e) => setEditTournamentData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2 focus:border-[#FF4E00] transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase tracking-widest opacity-50 block">Start Date</label>
                    <input 
                      type="date"
                      value={editTournamentData.startDate}
                      onChange={(e) => setEditTournamentData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2 focus:border-[#FF4E00] transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase tracking-widest opacity-50 block">Status</label>
                    <select 
                      value={editTournamentData.status}
                      onChange={(e) => setEditTournamentData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2 focus:border-[#FF4E00] transition-colors appearance-none"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    onClick={handleUpdateTournament}
                    className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#FF4E00] transition-colors flex items-center justify-center gap-2"
                  >
                    <Save size={16} /> Save Changes
                  </button>
                  <button 
                    onClick={() => setIsEditingTournament(false)}
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

      <AnimatePresence>
        {selectedMatch && activeBracket && (
          <ScoringPanel 
            match={selectedMatch} 
            athleteMap={athleteMap}
            tournamentId={tournament.id} 
            bracketId={activeBracket.id} 
            onOpenChange={(open) => !open && setSelectedMatch(null)} 
          />
        )}
      </AnimatePresence>

      <MatchDetails 
        match={viewingMatch!} 
        athleteMap={athleteMap} 
        isOpen={!!viewingMatchId} 
        onClose={() => setViewingMatchId(null)} 
        isOrganizer={isOrganizer}
        onEnterScoring={() => setSelectedMatch(viewingMatch!)}
      />
    </div>
  );
}

function Badge({ icon, label, color }: { icon: React.ReactNode, label: string, color: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 rounded-sm">
      {icon}
      <span className="font-mono text-[9px] uppercase tracking-widest">{label}</span>
    </div>
  );
}

function groupMatchesByRound(matches: Match[]) {
  const rounds: Match[][] = [];
  matches.forEach(m => {
    if (!rounds[m.round - 1]) rounds[m.round - 1] = [];
    rounds[m.round - 1].push(m);
  });
  rounds.forEach(r => r.sort((a, b) => a.position - b.position));
  return rounds;
}

interface MatchCardProps {
  match: Match;
  athleteMap: Record<string, string>;
  onClick?: () => void;
  onViewAthlete?: (id: string | null) => void;
  isEditable?: boolean;
  onAssignAthlete?: (slot: 'A' | 'B') => void;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, athleteMap, onClick, onViewAthlete, isEditable, onAssignAthlete }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    let interval: any;
    if (match.status === 'ongoing') {
      // Calculate based on updatedAt as a proxy for start time
      const startTime = match.updatedAt?.toDate ? match.updatedAt.toDate().getTime() : (match.updatedAt ? new Date(match.updatedAt).getTime() : Date.now());
      
      const updateTimer = () => {
        const now = Date.now();
        setElapsed(Math.max(0, Math.floor((now - startTime) / 1000)));
      };

      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [match.status, match.updatedAt]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const matchIdNum = parseInt(match.id.split('-p')[1]) || 0;

  return (
    <div 
      className={cn(
        "w-64 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col overflow-hidden group transition-all",
        onClick ? "hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(255,78,0,0.8)]" : "",
        isEditable && "border-[#FF4E00] border-2 shadow-[4px_4px_0px_0px_rgba(255,78,0,0.3)]"
      )}
    >
      <div 
        onClick={onClick}
        className={cn(
          "bg-[#141414] text-[#E4E3E0] p-1 flex justify-between items-center cursor-default",
          onClick && "cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] ml-2">Match #{matchIdNum + 1}</span>
          {match.status === 'ongoing' && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono text-[9px] text-orange-400 font-bold">
                 [{formatTimer(elapsed)}]
              </span>
            </div>
          )}
        </div>
        <div className={cn(
          "px-2 py-0.5 text-[8px] font-mono uppercase tracking-tighter",
          match.status === 'ongoing' ? "bg-orange-600" : (match.status === 'completed' ? "bg-green-600" : "bg-zinc-800")
        )}>
          {match.status}
        </div>
      </div>
      
      <AthleteRow 
        name={match.athleteAId ? (athleteMap[match.athleteAId] || "Loading...") : "TBA"} 
        id={match.athleteAId}
        score={match.scoreA} 
        isWinner={match.winnerId === match.athleteAId} 
        onView={!isEditable ? onViewAthlete : undefined}
        onAssign={isEditable ? () => onAssignAthlete?.('A') : undefined}
      />
      <div className="h-px bg-[#141414] opacity-10" />
      <AthleteRow 
        name={match.athleteBId ? (athleteMap[match.athleteBId] || "Loading...") : "TBA"} 
        id={match.athleteBId}
        score={match.scoreB} 
        isWinner={match.winnerId === match.athleteBId} 
        onView={!isEditable ? onViewAthlete : undefined}
        onAssign={isEditable ? () => onAssignAthlete?.('B') : undefined}
      />
    </div>
  );
}

function AthleteRow({ name, id, score, isWinner, onView, onAssign }: { name: string, id?: string, score: number, isWinner: boolean, onView?: (id: string | null) => void, onAssign?: () => void }) {
  return (
    <div 
      onClick={onAssign}
      className={cn(
        "flex justify-between items-center p-3 h-12 transition-colors",
        isWinner ? "bg-green-50" : "bg-white",
        onAssign && "cursor-pointer hover:bg-orange-50"
      )}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1">
        <span 
          onClick={(e) => {
            if (onView && id) {
              e.stopPropagation();
              onView(id);
            }
          }}
          className={cn(
            "font-bold uppercase tracking-tight text-sm truncate",
            isWinner ? "text-green-800" : "opacity-80",
            id && onView && "cursor-pointer hover:underline decoration-[#FF4E00] decoration-2"
          )}
        >
          {name}
        </span>
        {onAssign && !id && <span className="font-mono text-[8px] animate-pulse text-[#FF4E00]">Click to Pair</span>}
      </div>
      <span className="font-mono font-bold text-lg tabular-nums">{score}</span>
    </div>
  );
}
