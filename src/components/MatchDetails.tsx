import React from 'react';
import { Match, Athlete } from '../types';
import { X, Trophy, Activity, Target, Clock, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface MatchDetailsProps {
  match: Match;
  athleteMap: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onEnterScoring?: () => void;
  isOrganizer?: boolean;
}

export default function MatchDetails({ match, athleteMap, isOpen, onClose, onEnterScoring, isOrganizer }: MatchDetailsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-600';
      case 'ongoing': return 'bg-orange-600';
      default: return 'bg-zinc-600';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && match && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-lg p-8 shadow-[12px_12px_0px_0px_rgba(255,78,0,0.5)]"
          >
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={cn("px-2 py-0.5 font-mono text-[8px] uppercase tracking-tighter text-white", getStatusColor(match.status))}>
                    {match.status}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-50">Match Details</span>
                </div>
                <h3 className="text-3xl font-black uppercase italic tracking-tighter">Match #{match.position + 1}</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <DetailBox label="Round" value={`Round ${match.round}`} icon={<Target size={14} />} />
              <DetailBox label="Position" value={`Rank ${match.position + 1}`} icon={<Activity size={14} />} />
              <DetailBox label="Status" value={match.status.toUpperCase()} icon={<Clock size={14} />} />
              <DetailBox label="Venue" value="Main Ring" icon={<Shield size={14} />} />
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center mb-2">
                <label className="font-mono text-[10px] uppercase tracking-widest opacity-50 block">Scoreboard</label>
                {match.status === 'ongoing' && (
                  <div className="flex items-center gap-1.5 bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    <span className="font-mono text-[8px] font-bold uppercase tracking-widest">Live</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <p className="font-black uppercase tracking-tight text-lg mb-1 truncate">{match.athleteAId ? athleteMap[match.athleteAId] : 'TBA'}</p>
                  <div className="text-4xl font-mono font-black">{match.scoreA}</div>
                </div>
                <div className="text-2xl font-black italic opacity-20">VS</div>
                <div className="flex-1 text-center">
                  <p className="font-black uppercase tracking-tight text-lg mb-1 truncate">{match.athleteBId ? athleteMap[match.athleteBId] : 'TBA'}</p>
                  <div className="text-4xl font-mono font-black">{match.scoreB}</div>
                </div>
              </div>
            </div>

            {match.winnerId && (
              <div className="mb-8 p-4 bg-green-50 border border-green-200 flex items-center justify-center gap-3">
                <Trophy size={20} className="text-green-600" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-green-700">Winner</p>
                  <p className="font-black uppercase italic text-lg text-green-900">{athleteMap[match.winnerId] || 'Unknown'}</p>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              {isOrganizer && match.status !== 'completed' && (
                <button 
                  onClick={() => {
                    onClose();
                    onEnterScoring?.();
                  }}
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#FF4E00] transition-colors flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
                >
                  <Trophy size={16} /> Enter Scoring
                </button>
              )}
              <button 
                onClick={onClose}
                className={cn(
                  "py-4 font-mono text-xs uppercase tracking-widest border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors",
                  isOrganizer && match.status !== 'completed' ? "px-6" : "w-full"
                )}
              >
                Close View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function DetailBox({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="border border-[#141414]/10 p-3 bg-white/50">
      <div className="flex items-center gap-2 mb-1 opacity-50">
        {icon}
        <span className="font-mono text-[8px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="font-black uppercase text-sm">{value}</p>
    </div>
  );
}
