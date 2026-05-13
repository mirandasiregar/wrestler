import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { Tournament, Bracket, Match, Athlete } from '../types';
import { ChevronLeft, ChevronRight, Trophy, Users, Info, Layout, Plus, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ScoringPanel from './ScoringPanel';
import { generateKnockoutBracket } from '../services/bracketService';

export default function TournamentDetails({ tournament, onBack }: { tournament: Tournament, onBack: () => void }) {
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [activeBracket, setActiveBracket] = useState<Bracket | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddingAthlete, setIsAddingAthlete] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState('');

  const isOrganizer = auth.currentUser?.uid === tournament.organizerId;

  const handleAddAthlete = async () => {
    if (!newAthleteName || !activeBracket) return;
    try {
      await addDoc(collection(db, 'athletes'), {
        name: newAthleteName,
        tournamentId: tournament.id,
        bracketId: activeBracket.id,
        createdAt: new Date()
      });
      setNewAthleteName('');
      setIsAddingAthlete(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateBracket = async () => {
    if (!activeBracket) return;
    const athletesSnap = await getDocs(query(collection(db, 'athletes'), where('bracketId', '==', activeBracket.id)));
    const athleteNames = athletesSnap.docs.map(d => d.data().name);
    
    if (athleteNames.length < 2) {
      alert("Need at least 2 athletes to generate a bracket.");
      return;
    }

    const matchesToCreate = generateKnockoutBracket(athleteNames, tournament.id, activeBracket.id);
    
    const batch = writeBatch(db);
    matchesToCreate.forEach(m => {
      const mRef = doc(collection(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches`));
      batch.set(mRef, { ...m, createdAt: new Date(), updatedAt: new Date() });
    });
    await batch.commit();
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
  }, [tournament.id]);

  useEffect(() => {
    if (!activeBracket) return;
    const qMatches = query(collection(db, `tournaments/${tournament.id}/brackets/${activeBracket.id}/matches`));
    const unsubMatches = onSnapshot(qMatches, (snap) => {
      const mItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(mItems);
    });
    return () => unsubMatches();
  }, [activeBracket, tournament.id]);

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity mb-4"
          >
            <ChevronLeft size={14} /> Back to Tournaments
          </button>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">{tournament.name}</h2>
          <div className="flex items-center gap-6 mt-4">
            <Badge icon={<Trophy size={14} />} label={tournament.status} color="orange" />
            <span className="font-mono text-xs opacity-50 uppercase tracking-widest">{tournament.location}</span>
          </div>
        </div>

        {isOrganizer && activeBracket && (
          <div className="flex gap-4">
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
          </div>
        )}
      </header>

      {isAddingAthlete && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 border-2 border-dashed border-[#141414] flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest opacity-50">Athlete Name</label>
            <input 
              type="text" 
              value={newAthleteName}
              onChange={(e) => setNewAthleteName(e.target.value)}
              className="w-full bg-transparent border-b border-[#141414] outline-none font-bold uppercase py-2"
              placeholder="e.g. John Doe"
            />
          </div>
          <button onClick={handleAddAthlete} className="bg-[#141414] text-[#E4E3E0] px-6 py-2 font-mono text-xs uppercase tracking-widest">Add</button>
          <button onClick={() => setIsAddingAthlete(false)} className="px-4 py-2 font-mono text-xs uppercase tracking-widest">Cancel</button>
        </motion.div>
      )}

      {/* Bracket Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-hide border-b border-[#141414]">
        {brackets.map(b => (
          <button
            key={b.id}
            onClick={() => setActiveBracket(b)}
            className={cn(
              "px-6 py-3 font-mono text-[10px] uppercase tracking-widest transition-colors flex-shrink-0",
              activeBracket?.id === b.id ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414] hover:text-[#E4E3E0] opacity-50 hover:opacity-100"
            )}
          >
            {b.weightClass} {b.style}
          </button>
        ))}
        {brackets.length === 0 && (
          <div className="font-mono text-xs opacity-30 p-3 italic">No brackets found.</div>
        )}
      </div>

      {/* Bracket View */}
      <div className="min-h-[500px] overflow-x-auto py-12">
        {activeBracket ? (
          <div className="flex gap-16 min-w-max">
            {groupMatchesByRound(matches).map((roundMatches, roundIdx) => (
              <div key={roundIdx} className="flex flex-col justify-around gap-8">
                <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-30 text-center mb-4">Round {roundIdx + 1}</h4>
                {roundMatches.map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match} 
                    onClick={isOrganizer ? () => setSelectedMatch(match) : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-24 opacity-20 space-y-4">
            <Layout size={48} />
            <p className="font-mono text-xs uppercase tracking-widest">Select a bracket to view</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedMatch && activeBracket && (
          <ScoringPanel 
            match={selectedMatch} 
            tournamentId={tournament.id} 
            bracketId={activeBracket.id} 
            onOpenChange={(open) => !open && setSelectedMatch(null)} 
          />
        )}
      </AnimatePresence>
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

function MatchCard({ match, onClick }: { match: Match, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "w-64 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col overflow-hidden group transition-all",
        onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(255,78,0,0.8)]" : "opacity-90"
      )}
    >
      <div className="bg-[#141414] text-[#E4E3E0] p-1 flex justify-between items-center">
        <span className="text-[8px] font-mono uppercase tracking-[0.2em] ml-2">Match #{match.position + 1}</span>
        <div className={cn(
          "px-2 py-0.5 text-[8px] font-mono uppercase tracking-tighter",
          match.status === 'ongoing' ? "bg-orange-600" : (match.status === 'completed' ? "bg-green-600" : "bg-zinc-800")
        )}>
          {match.status}
        </div>
      </div>
      
      <AthleteRow name={match.athleteAId || "TBA"} score={match.scoreA} isWinner={match.winnerId === match.athleteAId} />
      <div className="h-px bg-[#141414] opacity-10" />
      <AthleteRow name={match.athleteBId || "TBA"} score={match.scoreB} isWinner={match.winnerId === match.athleteBId} />
    </div>
  );
}

function AthleteRow({ name, score, isWinner }: { name: string, score: number, isWinner: boolean }) {
  return (
    <div className={cn(
      "flex justify-between items-center p-3 h-12 transition-colors",
      isWinner ? "bg-green-50" : "bg-white"
    )}>
      <span className={cn(
        "font-bold uppercase tracking-tight text-sm truncate",
        isWinner ? "text-green-800" : "opacity-80"
      )}>{name}</span>
      <span className="font-mono font-bold text-lg">{score}</span>
    </div>
  );
}
