import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, TrendingUp, Users, Activity, Search, ChevronRight } from 'lucide-react';
import { collection, query, limit, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Athlete } from '../types';
import AthleteProfile from './AthleteProfile';

const MOCK_STATS = [
  { name: 'Jan', wins: 4, losses: 1 },
  { name: 'Feb', wins: 7, losses: 2 },
  { name: 'Mar', wins: 5, losses: 3 },
  { name: 'Apr', wins: 9, losses: 1 },
  { name: 'May', wins: 12, losses: 2 },
];

export default function AthleteStats() {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchTopAthletes() {
      setLoading(true);
      try {
        const q = query(collection(db, 'athletes'), orderBy('wins', 'desc'), limit(10));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ athleteId: d.id, ...d.data() } as Athlete));
        setAthletes(items);
      } catch (error) {
        console.error("Error fetching athletes:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTopAthletes();
  }, []);

  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.clubName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedAthleteId) {
    return <AthleteProfile athleteId={selectedAthleteId} onBack={() => setSelectedAthleteId(null)} />;
  }

  return (
    <div className="space-y-12">
      <header className="mb-12">
        <span className="font-mono text-xs uppercase opacity-50 block mb-2 tracking-widest">Performance Insights</span>
        <h2 className="text-5xl font-black italic uppercase tracking-tighter">Global Analytics</h2>
        <div className="h-px bg-[#141414] w-full mt-4" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-12">
          {/* Trend Chart */}
          <div className="border border-[#141414] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Victory Trend</h3>
              <TrendingUp size={16} className="opacity-30" />
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_STATS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={{ stroke: '#141414' }} 
                    tickLine={false} 
                    tick={{ fill: '#141414', fontSize: 10, fontFamily: 'monospace' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#141414', fontSize: 10, fontFamily: 'monospace' }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#141414', 
                      border: 'none', 
                      borderRadius: '0px', 
                      color: '#E4E3E0',
                      fontFamily: 'monospace',
                      fontSize: '10px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="wins" 
                    stroke="#141414" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#141414', strokeWidth: 2, stroke: '#E4E3E0' }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <SmallStat icon={<Users size={16} />} label="Total Registered" value="1,240" />
            <SmallStat icon={<Activity size={16} />} label="Matches Fought" value="5,821" />
            <SmallStat icon={<Trophy size={16} />} label="Clubs Active" value="86" />
            <SmallStat icon={<TrendingUp size={16} />} label="Tournaments" value="14" />
          </div>
        </div>

        {/* Athlete Leaderboard / List */}
        <div className="border border-[#141414] bg-[#E4E3E0] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] flex flex-col h-full">
          <div className="p-8 border-b border-[#141414] bg-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Top Ranked Athletes</h3>
              <Trophy size={16} className="opacity-30" />
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
              <input 
                type="text"
                placeholder="SEARCH ATHLETE OR CLUB..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-[#141414] font-mono text-[10px] uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#FF4E00] transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px]">
             {loading ? (
                <div className="p-12 text-center font-mono text-xs opacity-50 animate-pulse">Scanning records...</div>
             ) : (
                <div className="divide-y divide-[#141414]">
                  {filteredAthletes.map((ath, idx) => (
                    <button 
                      key={ath.athleteId} 
                      onClick={() => setSelectedAthleteId(ath.athleteId)}
                      className="w-full flex items-center justify-between p-6 bg-white hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group text-left"
                    >
                      <div className="flex items-center gap-6">
                        <span className="font-mono text-xs opacity-30 w-6">0{idx + 1}</span>
                        <div>
                          <div className="font-black uppercase tracking-tight text-lg leading-none mb-1">{ath.name}</div>
                          <div className="font-mono text-[9px] uppercase tracking-widest opacity-50 group-hover:opacity-70">{ath.clubName || 'Independent'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-mono font-bold">{ath.wins}W - {ath.losses}L</div>
                          <div className="font-mono text-[9px] uppercase tracking-tight opacity-50">Win Rate: {(ath.wins / (ath.totalMatches || 1) * 100).toFixed(0)}%</div>
                        </div>
                        <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                  {filteredAthletes.length === 0 && (
                    <div className="p-12 text-center opacity-30 font-mono text-xs italic">No matching athletes found.</div>
                  )}
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallStat({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="border border-[#141414] p-6 bg-white flex items-center gap-4 group hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
      <div className="w-10 h-10 border border-[#141414] flex items-center justify-center group-hover:border-[#E4E3E0]">
        {icon}
      </div>
      <div>
        <div className="font-mono text-[9px] uppercase tracking-widest opacity-50 group-hover:opacity-70">{label}</div>
        <div className="font-bold text-xl tracking-tight">{value}</div>
      </div>
    </div>
  );
}

