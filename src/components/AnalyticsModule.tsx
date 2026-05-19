import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, TrendingUp, Users, Activity, Search, 
  ChevronRight, Target, Zap, Shield, BarChart3, 
  Filter, UserPlus, X, Info
} from 'lucide-react';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Athlete, UserProfile } from '../types';
import { cn } from '../lib/utils';
import AthleteProfile from './AthleteProfile';

// Mock data for advanced analytics since it's not in the DB yet
const TECHNIQUE_DATA = [
  { name: 'Double Leg Takdown', success: 75, attempts: 20 },
  { name: 'Single Leg', success: 60, attempts: 32 },
  { name: 'Sprawl & Spin', success: 90, attempts: 15 },
  { name: 'Gut Wrench', success: 45, attempts: 12 },
  { name: 'Ankle Lace', success: 80, attempts: 8 },
  { name: 'Duck Under', success: 55, attempts: 18 },
];

const HEATMAP_DATA = [
  { zone: 'Head', intensity: 12, attacks: ['Snap Down', 'Head Lock'] },
  { zone: 'Shoulders', intensity: 45, attacks: ['Arm Drag', 'Shoulder Throw'] },
  { zone: 'Waist', intensity: 80, attacks: ['Body Lock', 'Waist Roll'] },
  { zone: 'Legs', intensity: 95, attacks: ['Single Leg', 'Double Leg', 'Ankle Pick'] },
];

const COMPARISON_METRICS = [
  { subject: 'Speed', fullMark: 100 },
  { subject: 'Power', fullMark: 100 },
  { subject: 'Endurance', fullMark: 100 },
  { subject: 'Technique', fullMark: 100 },
  { subject: 'Defense', fullMark: 100 },
  { subject: 'Agility', fullMark: 100 },
];

const COLORS = ['#FF4E00', '#141414', '#525252', '#A3A3A3'];

export default function AnalyticsModule({ profile }: { profile: UserProfile | null }) {
  const [loading, setLoading] = useState(true);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMetric, setActiveMetric] = useState<'techniques' | 'heatmap' | 'comparison'>('techniques');

  useEffect(() => {
    async function fetchAthletes() {
      try {
        const q = query(collection(db, 'athletes'), orderBy('wins', 'desc'), limit(20));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ athleteId: d.id, ...d.data() } as Athlete));
        setAthletes(items);
        // Initially select top 2 for comparison
        if (items.length >= 2) {
          setSelectedAthletes([items[0], items[1]]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAthletes();
  }, []);

  const toggleAthleteSelection = (athlete: Athlete) => {
    if (selectedAthletes.find(a => a.athleteId === athlete.athleteId)) {
      setSelectedAthletes(prev => prev.filter(a => a.athleteId !== athlete.athleteId));
    } else {
      if (selectedAthletes.length < 3) {
        setSelectedAthletes(prev => [...prev, athlete]);
      }
    }
  };

  const filteredItems = athletes.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedAthleteId) {
    return <AthleteProfile athleteId={selectedAthleteId} profile={profile} onBack={() => setSelectedAthleteId(null)} />;
  }

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <header className="mb-12">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-4">
          <div>
            <span className="font-mono text-xs uppercase opacity-50 block mb-2 tracking-widest">Advanced Module</span>
            <h2 className="text-5xl font-black italic uppercase tracking-tighter">Performance Analytics</h2>
          </div>
          <div className="flex gap-2 bg-white border border-[#141414] p-1 rounded-sm">
            <MetricTab active={activeMetric === 'techniques'} onClick={() => setActiveMetric('techniques')} label="Techniques" />
            <MetricTab active={activeMetric === 'heatmap'} onClick={() => setActiveMetric('heatmap')} label="Attack Zones" />
            <MetricTab active={activeMetric === 'comparison'} onClick={() => setActiveMetric('comparison')} label="Comparison" />
          </div>
        </div>
        <div className="h-px bg-[#141414] w-full mt-4" />
      </header>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        
        {/* Left Column: athlete Selector */}
        <div className="xl:col-span-1 space-y-6 sticky top-8">
          <div className="border border-[#141414] bg-white p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest">Compare Athletes</h3>
              <span className="font-mono text-[10px] opacity-40">{selectedAthletes.length}/3 SELECTED</span>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
              <input 
                type="text" 
                placeholder="Find athlete..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[#141414] font-mono text-[10px] uppercase outline-none focus:bg-zinc-50"
              />
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredItems.map(a => {
                const isSelected = selectedAthletes.find(sa => sa.athleteId === a.athleteId);
                return (
                  <div 
                    key={a.athleteId} 
                    className={cn(
                      "w-full p-3 border transition-all flex items-center justify-between group",
                      isSelected ? "bg-[#141414] border-[#141414] text-white" : "border-zinc-200 hover:border-[#141414]"
                    )}
                  >
                    <button 
                      onClick={() => setSelectedAthleteId(a.athleteId)}
                      className="text-left flex-1 min-w-0 mr-2"
                    >
                      <div className="font-bold uppercase tracking-tight text-[11px] truncate leading-none mb-1 group-hover:underline">{a.name}</div>
                      <div className={cn("font-mono text-[8px] uppercase tracking-widest opacity-50", isSelected && "opacity-70")}>{a.clubName || 'INDEPENDENT'}</div>
                    </button>
                    <button 
                      onClick={() => toggleAthleteSelection(a)}
                      className="shrink-0 p-1 hover:bg-white/10 rounded"
                    >
                      {isSelected ? <X size={12} /> : <UserPlus size={12} className={cn("opacity-30 group-hover:opacity-100", !isSelected && "text-black")} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {selectedAthletes.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 bg-[#FF4E00] text-white font-mono text-[10px] uppercase tracking-[0.2em] flex items-center justify-between"
              >
                <span>Analyzing {selectedAthletes.length} profiles</span>
                <Zap size={12} className="animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Dynamic Charts */}
        <div className="xl:col-span-3 space-y-8">
          <AnimatePresence mode="wait">
            {activeMetric === 'techniques' && (
              <motion.div 
                key="techniques"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
              >
                {/* Technique Success Box */}
                <ChartBox title="Technique Success Rate (%)" icon={<Target size={16} />}>
                   <div className="h-[350px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={TECHNIQUE_DATA} layout="vertical" margin={{ left: 20, right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} stroke="#141414" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#141414', fontFamily: 'monospace' }} />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 10, fill: '#141414', fontFamily: 'monospace' }} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(20,20,20,0.05)' }}
                            contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontFamily: 'monospace', fontSize: '10px' }} 
                          />
                          <Bar dataKey="success" radius={[0, 4, 4, 0]}>
                            {TECHNIQUE_DATA.map((entry, index) => (
                              <Cell key={index} fill={entry.success > 70 ? '#FF4E00' : '#141414'} />
                            ))}
                          </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                   </div>
                </ChartBox>

                {/* Utilization Scatter */}
                <ChartBox title="Volume vs Efficiency" icon={<Activity size={16} />}>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" dataKey="attempts" name="Attempts" unit="" label={{ value: 'ATTEMPTS', position: 'bottom', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: '#141414' }} tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis type="number" dataKey="success" name="Success Rate" unit="%" label={{ value: 'SUCCESS', angle: -90, position: 'left', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: '#141414' }} tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <ZAxis type="number" range={[60, 400]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#141414', color: '#fff', fontSize: '10px' }} />
                        <Scatter name="Techniques" data={TECHNIQUE_DATA} fill="#FF4E00" shape="circle" />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex gap-4 justify-center">
                       <span className="font-mono text-[8px] flex items-center gap-1 opacity-50 uppercase"><div className="w-2 h-2 rounded-full bg-[#FF4E00]" /> High Impact</span>
                       <span className="font-mono text-[8px] flex items-center gap-1 opacity-50 uppercase"><div className="w-2 h-2 rounded-full bg-zinc-300" /> Low Frequency</span>
                    </div>
                  </div>
                </ChartBox>
              </motion.div>
            )}

            {activeMetric === 'heatmap' && (
              <motion.div 
                key="heatmap"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-5 gap-8"
              >
                <div className="lg:col-span-2 flex flex-col items-center justify-center border border-[#141414] p-8 bg-white shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]">
                   <h3 className="font-mono text-[10px] font-black uppercase tracking-[0.3em] mb-8 self-start">Target Zone Heatmap</h3>
                   <AttackHeatmap data={HEATMAP_DATA} />
                   <div className="mt-12 w-full space-y-4">
                      {HEATMAP_DATA.map(h => (
                        <div key={h.zone} className="flex items-center justify-between">
                          <span className="font-mono text-[9px] uppercase tracking-widest">{h.zone}</span>
                          <div className="flex-1 mx-4 h-1 bg-zinc-100 relative">
                             <div className="absolute top-0 left-0 h-full bg-[#FF4E00]" style={{ width: `${h.intensity}%` }} />
                          </div>
                          <span className="font-mono text-[9px] font-bold">{h.intensity}%</span>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="lg:col-span-3 space-y-8">
                   <div className="p-8 border border-[#141414] bg-[#141414] text-[#E4E3E0] relative overflow-hidden">
                      <BarChart3 className="absolute -right-8 -top-8 w-48 h-48 opacity-5" />
                      <h4 className="text-2xl font-black italic uppercase tracking-tight mb-4 relative z-10">Strategic Insights</h4>
                      <p className="font-mono text-xs opacity-70 leading-relaxed mb-6 relative z-10">
                        Analyzing match sequences across registered tournaments suggests a high preference for lower-body engagement (Legs: 95%). 
                        Athletes utilizing waist rotations as transitional moves show a 22% higher success rate in finishing.
                      </p>
                      <div className="flex gap-4 relative z-10">
                         <div className="px-4 py-2 border border-white/20 font-mono text-[10px] uppercase tracking-widest">Pivot Index: 4.2</div>
                         <div className="px-4 py-2 border border-white/20 font-mono text-[10px] uppercase tracking-widest">Aggression: High</div>
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 border border-[#141414] bg-white">
                         <div className="font-mono text-[9px] uppercase opacity-40 mb-2">Counter Efficiency</div>
                         <div className="text-3xl font-black italic">68.4%</div>
                      </div>
                      <div className="p-6 border border-[#141414] bg-white">
                         <div className="font-mono text-[9px] uppercase opacity-40 mb-2">Grip Retention</div>
                         <div className="text-3xl font-black italic">14.2s</div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activeMetric === 'comparison' && (
              <motion.div 
                key="comparison"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <ChartBox title="Attribute Overlap" icon={<Zap size={16} />} className="lg:col-span-2 h-[500px]">
                      <ResponsiveContainer width="100%" height="100%">
                         <RadarChart cx="50%" cy="50%" outerRadius="80%" data={COMPARISON_METRICS}>
                            <PolarGrid stroke="#141414" opacity={0.1} />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#141414', fontSize: 10, fontFamily: 'monospace' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#fff', fontSize: '10px' }} />
                            {selectedAthletes.map((a, i) => (
                              <Radar 
                                key={a.athleteId} 
                                name={a.name} 
                                dataKey={() => Math.floor(Math.random() * 40 + 60)} // Simulated data
                                stroke={COLORS[i % COLORS.length]} 
                                fill={COLORS[i % COLORS.length]} 
                                fillOpacity={0.3} 
                              />
                            ))}
                         </RadarChart>
                      </ResponsiveContainer>
                   </ChartBox>

                   <div className="space-y-4">
                      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest px-2">Athletic Breakdown</h3>
                      {selectedAthletes.map((a, i) => (
                        <div key={a.athleteId} className="p-6 border border-[#141414] bg-white relative">
                          <div className="absolute top-0 right-0 p-3 opacity-10">
                             <Trophy size={24} style={{ color: COLORS[i % COLORS.length] }} />
                          </div>
                          <div className="flex items-center gap-3 mb-4">
                             <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                             <span className="font-black uppercase tracking-tight text-lg italic">{a.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <div className="font-mono text-[8px] uppercase opacity-40">Win/Loss</div>
                                <div className="font-bold">{a.wins} / {a.losses}</div>
                             </div>
                             <div>
                                <div className="font-mono text-[8px] uppercase opacity-40">Success</div>
                                <div className="font-bold">{((a.wins / (a.totalMatches || 1)) * 100).toFixed(0)}%</div>
                             </div>
                          </div>
                        </div>
                      ))}
                      {selectedAthletes.length === 0 && (
                        <div className="p-12 border border-dashed border-[#141414] opacity-30 text-center font-mono text-[10px] uppercase">Select athletes to begin comparison</div>
                      )}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function MetricTab({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-2 font-mono text-[10px] uppercase tracking-widest transition-all",
        active ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-zinc-100 opacity-50 hover:opacity-100"
      )}
    >
      {label}
    </button>
  );
}

function ChartBox({ title, icon, children, className }: { title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("border border-[#141414] bg-white p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] flex flex-col", className)}>
      <div className="flex justify-between items-center mb-8">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold border-b-2 border-[#FF4E00] pb-1">{title}</h3>
        <span className="opacity-30">{icon}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function AttackHeatmap({ data }: { data: any[] }) {
  return (
    <div className="relative w-48 h-80 flex flex-col items-center">
      {/* Head */}
      <ZoneCircle size="w-12 h-12" intensity={data[0].intensity} label="H" top="0" />
      {/* Chest/Shoulders */}
      <ZoneCircle size="w-24 h-16" intensity={data[1].intensity} label="S" top="15%" />
      {/* Waist */}
      <ZoneCircle size="w-20 h-20" intensity={data[2].intensity} label="W" top="38%" />
      {/* Legs */}
      <div className="absolute top-[63%] w-24 h-32 flex justify-between">
         <ZoneCircle size="w-8 h-24" intensity={data[3].intensity} label="L" top="0" />
         <ZoneCircle size="w-8 h-24" intensity={data[3].intensity} label="R" top="0" />
      </div>
      
      {/* Human Shape SVG Background (simplified) */}
      <svg className="absolute inset-0 w-full h-full -z-10 opacity-[0.03]" viewBox="0 0 100 200">
         <path d="M50 10 C45 10 40 15 40 20 C40 25 45 30 50 30 C55 30 60 25 60 20 C60 15 55 10 50 10 M30 40 L70 40 L65 75 L35 75 Z M35 80 L45 80 L45 150 L35 150 Z M55 80 L65 80 L65 150 L55 150 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function ZoneCircle({ size, intensity, label, top }: { size: string, intensity: number, label: string, top: string }) {
  return (
    <motion.div 
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        "absolute rounded-full border border-black/10 flex items-center justify-center font-mono text-[10px] font-bold text-white",
        size
      )}
      style={{ 
        top,
        backgroundColor: `rgba(255, 78, 0, ${intensity / 100})`,
        boxShadow: intensity > 60 ? `0 0 20px rgba(255, 78, 0, 0.4)` : 'none'
      }}
    >
      {label}
    </motion.div>
  );
}
