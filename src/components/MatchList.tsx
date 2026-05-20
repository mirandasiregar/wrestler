import React, { useState } from 'react';
import { Match, Athlete } from '../types';
import { Trophy, Play, Check, ShieldAlert, Award } from 'lucide-react';
import { cn } from '../lib/utils';

interface MatchListProps {
  matches: Match[];
  athletes: Athlete[];
  isOrganizer: boolean;
  onEnterScoring: (match: Match) => void;
  onStartMatch: (match: Match) => Promise<void>;
  onFinishMatch: (match: Match, winnerId: string) => Promise<void>;
}

export default function MatchList({
  matches,
  athletes,
  isOrganizer,
  onEnterScoring,
  onStartMatch,
  onFinishMatch,
}: MatchListProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ongoing' | 'completed'>('all');

  const athleteMap = athletes.reduce((acc, a) => {
    acc[a.athleteId] = a;
    return acc;
  }, {} as Record<string, Athlete>);

  const filteredMatches = matches
    .filter(m => statusFilter === 'all' || m.status === statusFilter)
    .sort((a, b) => {
      // Sort pending then ongoing then completed
      const score = { pending: 1, ongoing: 0, completed: 2 };
      return score[a.status] - score[b.status] || a.round - b.round || a.position - b.position;
    });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#141414]/10 pb-4">
        <div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter">Matches List</h3>
          <p className="font-mono text-[8px] uppercase tracking-widest opacity-50 mt-1">
            Browse match fixtures, live streams, and declare results
          </p>
        </div>

        <div className="flex gap-2 self-stretch sm:self-auto overflow-x-auto">
          {(['all', 'pending', 'ongoing', 'completed'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1 font-mono text-[9px] uppercase tracking-widest border border-[#141414] transition-colors flex-shrink-0",
                statusFilter === status ? "bg-[#141414] text-[#E4E3E0]" : "bg-white text-[#141414] hover:bg-zinc-50"
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredMatches.map(match => {
          const athleteA = match.athleteAId ? athleteMap[match.athleteAId] : null;
          const athleteB = match.athleteBId ? athleteMap[match.athleteBId] : null;

          const hasAthletes = !!(match.athleteAId && match.athleteBId);

          return (
            <div
              key={match.id}
              className={cn(
                "border border-[#141414] bg-white p-6 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] transition-all",
                match.status === 'ongoing' ? "border-[#FF4E00] shadow-[6px_6px_0px_0px_rgba(255,100,0,0.15)]" : ""
              )}
            >
              {/* Badge info */}
              <div className="flex justify-between items-center border-b border-[#141414]/10 pb-3 mb-4">
                <span className="font-mono text-[8px] uppercase tracking-wider bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-sm">
                  Round {match.round} | Match #{parseInt(match.id.split('-p')[1]) + 1}
                </span>

                <span className={cn(
                  "font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-sm flex items-center gap-1",
                  match.status === 'completed' ? "bg-green-100 text-green-700 font-bold" :
                  match.status === 'ongoing' ? "bg-orange-100 text-[#FF4E00] animate-pulse font-bold" :
                  "bg-zinc-100 text-zinc-600"
                )}>
                  {match.status === 'ongoing' && <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />}
                  {match.status}
                </span>
              </div>

              {/* Contestants view */}
              <div className="space-y-4 mb-6">
                {/* Athlete A */}
                <div className={cn(
                  "flex justify-between items-center p-3 border",
                  match.winnerId === match.athleteAId
                    ? "bg-green-50 border-green-500/20"
                    : "border-[#141414]/10 bg-zinc-50/50"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="font-black italic uppercase text-sm">
                      {athleteA ? athleteA.name : "TBA"}
                    </span>
                    {match.winnerId === match.athleteAId && (
                      <Trophy size={14} className="text-green-600" />
                    )}
                  </div>
                  <span className="font-mono font-bold text-lg">{match.scoreA}</span>
                </div>

                {/* VS divider */}
                <div className="text-center font-mono text-[8px] opacity-30 uppercase tracking-[0.25em]">
                  versus
                </div>

                {/* Athlete B */}
                <div className={cn(
                  "flex justify-between items-center p-3 border",
                  match.winnerId === match.athleteBId
                    ? "bg-green-50 border-green-500/20"
                    : "border-[#141414]/10 bg-zinc-50/50"
                )}>
                  <div className="flex items-center gap-2">
                    <span className="font-black italic uppercase text-sm">
                      {athleteB ? athleteB.name : "TBA"}
                    </span>
                    {match.winnerId === match.athleteBId && (
                      <Trophy size={14} className="text-green-600" />
                    )}
                  </div>
                  <span className="font-mono font-bold text-lg">{match.scoreB}</span>
                </div>
              </div>

              {/* Admin control buttons */}
              {isOrganizer && (
                <div className="border-t border-[#141414]/10 pt-4 flex gap-2">
                  {match.status === 'pending' && (
                    <button
                      disabled={!hasAthletes}
                      onClick={() => onStartMatch(match)}
                      className="flex-1 bg-[#141414] text-[#E4E3E0] py-2.5 font-mono text-[9px] uppercase tracking-widest hover:bg-[#FF4E00] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Play size={12} /> Start Match
                    </button>
                  )}

                  {match.status === 'ongoing' && (
                    <>
                      <button
                        onClick={() => onEnterScoring(match)}
                        className="flex-1 border-2 border-[#141414] py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                      >
                        Adjust Score
                      </button>
                      <button
                        onClick={() => onEnterScoring(match)} // Triggers custom live scorer overlays
                        className="flex-1 bg-[#FF4E00] text-white border border-[#FF4E00] py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-[#CC3E00] transition-colors flex items-center justify-center gap-1 font-bold"
                      >
                        <Check size={12} /> Match Selesai
                      </button>
                    </>
                  )}

                  {match.status === 'completed' && (
                    <div className="w-full text-center py-2 bg-zinc-100 text-zinc-500 border border-zinc-200 font-mono text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 italic">
                      <Award size={13} /> Winner declared
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredMatches.length === 0 && (
          <div className="col-span-full py-16 text-center border border-dashed border-[#141414]/10 rounded-sm">
            <p className="font-mono text-xs uppercase tracking-widest opacity-40 italic">
              No matches found match with filter criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
