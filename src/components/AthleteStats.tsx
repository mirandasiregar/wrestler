import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { motion } from 'motion/react';
import { Trophy, TrendingUp, Users, Activity } from 'lucide-react';

const MOCK_STATS = [
  { name: 'Jan', wins: 4, losses: 1 },
  { name: 'Feb', wins: 7, losses: 2 },
  { name: 'Mar', wins: 5, losses: 3 },
  { name: 'Apr', wins: 9, losses: 1 },
  { name: 'May', wins: 12, losses: 2 },
];

const MOCK_ATHLETES = [
  { name: 'Andi Wijaya', wins: 45, losses: 12, rate: 78.9 },
  { name: 'Budi Santoso', wins: 38, losses: 15, rate: 71.7 },
  { name: 'Citra Dewi', wins: 52, losses: 8, rate: 86.7 },
  { name: 'Dedi Kurniawan', wins: 30, losses: 20, rate: 60.0 },
];

export default function AthleteStats() {
  return (
    <div className="space-y-12">
      <header className="mb-12">
        <span className="font-mono text-xs uppercase opacity-50 block mb-2 tracking-widest">Performance Insights</span>
        <h2 className="text-5xl font-black italic uppercase tracking-tighter">Global Analytics</h2>
        <div className="h-px bg-[#141414] w-full mt-4" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
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

        {/* Top Performers Bar Chart */}
        <div className="border border-[#141414] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Top Win Rates (%)</h3>
            <Trophy size={16} className="opacity-30" />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_ATHLETES} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  tick={{ fill: '#141414', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(20,20,20,0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#141414', 
                    border: 'none', 
                    color: '#E4E3E0',
                    fontFamily: 'monospace',
                    fontSize: '10px'
                  }} 
                />
                <Bar dataKey="rate" fill="#141414" radius={[0, 4, 4, 0]}>
                  {MOCK_ATHLETES.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#FF4E00' : '#141414'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <SmallStat icon={<Users size={16} />} label="Total Registered" value="1,240" />
        <SmallStat icon={<Activity size={16} />} label="Matches Fought" value="5,821" />
        <SmallStat icon={<Trophy size={16} />} label="Clubs Active" value="86" />
        <SmallStat icon={<TrendingUp size={16} />} label="Active Tournaments" value="14" />
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
