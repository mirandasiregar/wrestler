import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, query, getDocs, where, limit, orderBy, onSnapshot, doc, setDoc, collectionGroup } from 'firebase/firestore';
import { Trophy, Users, BarChart3, Settings, LogOut, ChevronRight, Plus, MapPin, Calendar, Layout, User as UserIcon, Tv } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from './lib/utils';
import { Tournament, Athlete, UserProfile } from './types';
import TournamentDetails from './components/TournamentDetails';
import { HashRouter, Routes, Route } from 'react-router-dom';

import AthleteStats from './components/AthleteStats';
import AnalyticsModule from './components/AnalyticsModule';
import CreateTournament from './components/CreateTournament';
import LiveScoreboard from './components/LiveScoreboard';

// Mock/Initial Data for demonstration if empty
const INITIAL_TOURNAMENTS: Partial<Tournament>[] = [
  { id: '1', name: 'Kejuaraan Nasional Gulat 2024', location: 'Jakarta', status: 'ongoing', startDate: new Date(), createdAt: new Date() },
  { id: '2', name: 'Piala Gubernur Banten', location: 'Serang', status: 'upcoming', startDate: new Date(Date.now() + 86400000 * 14), createdAt: new Date() },
];

function AppMainContent() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'tournaments' | 'stats' | 'dashboard' | 'analytics' | 'scoreboard'>('tournaments');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [liveMatchesCount, setLiveMatchesCount] = useState(0);
  const [totalAthletesCount, setTotalAthletesCount] = useState(0);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch profile
        const profileSnap = await getDocs(query(collection(db, 'users'), where('userId', '==', u.uid), limit(1)));
        if (!profileSnap.empty) {
          setProfile(profileSnap.docs[0].data() as UserProfile);
        } else {
          // Create initial profile
          const newProfile: UserProfile = {
            userId: u.uid,
            displayName: u.displayName || 'Unnamed Athlete',
            email: u.email || '',
            role: 'athlete',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Fetch tournaments for public view
    const q = collection(db, 'tournaments');
    const unsubTournaments = onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
      setTournaments(items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      
      // Calculate upcoming events in real-time
      const upcoming = items.filter(t => t.status === 'upcoming').length;
      setUpcomingEventsCount(upcoming);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tournaments');
    });

    // Real-time live matches
    const matchesQ = query(collectionGroup(db, 'matches'), where('status', '==', 'ongoing'));
    const unsubMatches = onSnapshot(matchesQ, (snap) => {
      setLiveMatchesCount(snap.size);
    }, (error) => {
      console.error("Matches listener error:", error);
    });

    // Real-time total athletes
    const athletesQ = collection(db, 'athletes');
    const unsubAthletes = onSnapshot(athletesQ, (snap) => {
      setTotalAthletesCount(snap.size);
    }, (error) => {
      console.error("Athletes listener error:", error);
    });

    return () => {
      unsubscribe();
      unsubTournaments();
      unsubMatches();
      unsubAthletes();
    };
  }, []);

  const handleLogin = async () => {
    console.log('Login attempt started');
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
      console.log('Login successful');
    } catch (err: any) {
      console.error('Login Error:', err);
      const errCode = (err?.code || '').toLowerCase();
      const errMsg = (err?.message || '').toLowerCase();
      const isCancelled = 
        errCode.includes('cancel') || 
        errCode.includes('closed-by-user') ||
        errMsg.includes('cancel') ||
        errMsg.includes('closed-by-user') ||
        errMsg.includes('popup-closed-by-user') ||
        errMsg.includes('popup_closed_by_user');

      if (!isCancelled) {
        setAuthError(err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setSelectedTournament(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center font-mono">
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5] }} 
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-[#141414] tracking-widest uppercase text-sm"
        >
          Initializing WrestleTracker...
        </motion.div>
      </div>
    );
  }

  const renderDashboardShell = () => (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-20 md:w-64 border-r border-[#141414] bg-[#E4E3E0] z-50 flex flex-col pt-8">
        <div className="px-6 mb-12">
          <button onClick={() => { setActiveTab('tournaments'); setSelectedTournament(null); }} className="flex items-center gap-3 outline-none cursor-pointer">
            <div className="w-10 h-10 bg-[#141414] flex items-center justify-center text-[#E4E3E0] rounded-sm">
              <Trophy size={24} />
            </div>
            <h1 className="hidden md:block font-bold text-xl tracking-tighter uppercase italic">WrestleTracker</h1>
          </button>
        </div>

        <div className="flex-1 space-y-2 px-3">
          <NavButton 
            active={activeTab === 'tournaments'} 
            onClick={() => { setActiveTab('tournaments'); setSelectedTournament(null); }}
            icon={<Trophy size={20} />}
            label="Tournaments"
          />
          <NavButton 
            active={activeTab === 'scoreboard'} 
            onClick={() => { setActiveTab('scoreboard'); setSelectedTournament(null); }}
            icon={<Tv size={20} />}
            label="Live Board"
          />
          <NavButton 
            active={activeTab === 'analytics'} 
            onClick={() => { setActiveTab('analytics'); setSelectedTournament(null); }}
            icon={<BarChart3 size={20} />}
            label="Analytics"
          />
          <NavButton 
            active={activeTab === 'stats'} 
            onClick={() => { setActiveTab('stats'); setSelectedTournament(null); }}
            icon={<Users size={20} />}
            label="Athlete Stats"
          />
           {user && (
            <NavButton 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setSelectedTournament(null); }}
              icon={<Layout size={20} />}
              label={profile?.role === 'admin' ? "Admin Dashboard" : "My Dashboard"}
            />
          )}
        </div>

        <div className="p-4 border-t border-[#141414]">
          {authError && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 text-xs rounded">
              <p className="font-bold">Login Error:</p>
              <p>{authError}</p>
              <p className="mt-1 opacity-70">Add this domain to "Authorized Domains" in Firebase Console.</p>
            </div>
          )}
          {user ? (
            <div className="space-y-2">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-3 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-sm group outline-none cursor-pointer"
              >
                <LogOut size={20} />
                <div className="hidden md:block font-mono text-[10px] uppercase tracking-widest text-left truncate">
                  {user.displayName || 'User'}
                  <div className="opacity-50 text-[8px] lowercase">{profile?.role || 'user'}</div>
                </div>
              </button>
              
              {profile && (
                <button
                  onClick={async () => {
                    const nextRole = profile.role === 'admin' ? 'athlete' : 'admin';
                    try {
                      await setDoc(doc(db, 'users', user.uid), { role: nextRole, updatedAt: new Date() }, { merge: true });
                      setProfile(prev => prev ? { ...prev, role: nextRole } : null);
                    } catch (err) {
                      console.error("Failed to toggle role:", err);
                    }
                  }}
                  className="hidden md:flex w-full items-center justify-center gap-1.5 py-1 px-2 border border-dashed border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] font-mono text-[8px] uppercase tracking-widest font-bold transition-all"
                  title="Switch sandbox test role between Admin and Athlete"
                >
                  Switch Test Role to {profile.role === 'admin' ? 'ATHLETE' : 'ADMIN'}
                </button>
              )}
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className={cn(
                "flex items-center gap-3 w-full p-3 transition-all rounded-sm outline-none cursor-pointer",
                isLoggingIn ? "bg-zinc-500 text-white cursor-wait" : "bg-[#141414] text-[#E4E3E0] hover:bg-opacity-90 active:scale-[0.98]"
              )}
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : (
                <UserIcon size={20} />
              )}
              <span className="hidden md:block font-mono text-xs uppercase tracking-wider">
                {isLoggingIn ? 'Wait...' : 'Login'}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="ml-20 md:ml-64 p-8 min-h-screen">
        <AnimatePresence mode="wait">
          {selectedTournament ? (
            <motion.div
              key="tournament-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <TournamentDetails 
                tournament={selectedTournament} 
                profile={profile}
                onBack={() => setSelectedTournament(null)} 
              />
            </motion.div>
          ) : (
            <React.Fragment>
              {activeTab === 'tournaments' && (
                <motion.section
                  key="tournaments"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-6xl mx-auto"
                >
                  <header className="mb-12">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <span className="font-mono text-xs uppercase opacity-50 block mb-2 tracking-widest">Active Events</span>
                        <h2 className="text-5xl font-black italic uppercase tracking-tighter">Live Tournaments</h2>
                      </div>
                    </div>
                    <div className="h-px bg-[#141414] w-full mt-4" />
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                     {tournaments.length > 0 ? tournaments.map(t => (
                        <TournamentCard key={t.id} tournament={t} onClick={() => setSelectedTournament(t)} />
                      )) : INITIAL_TOURNAMENTS.map(t => (
                        <TournamentCard key={t.id} tournament={t as any} onClick={() => setSelectedTournament(t as any)} />
                      ))}
                  </div>
                </motion.section>
              )}

              {activeTab === 'scoreboard' && (
                <motion.section
                  key="scoreboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-6xl mx-auto"
                >
                  <LiveScoreboard />
                </motion.section>
              )}

              {activeTab === 'analytics' && (
                <motion.section
                  key="analytics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-6xl mx-auto"
                >
                  <AnalyticsModule profile={profile} />
                </motion.section>
              )}

              {activeTab === 'stats' && (
                <motion.section
                  key="stats"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-6xl mx-auto"
                >
                  <AthleteStats profile={profile} />
                </motion.section>
              )}

              {activeTab === 'dashboard' && user && (
                 <motion.section
                   key="dashboard"
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   className="max-w-6xl mx-auto"
                 >
                   <header className="mb-12">
                     <span className="font-mono text-xs uppercase opacity-50 block mb-2 tracking-widest">
                       {profile?.role === 'admin' ? 'ADMIN MANAGER PANEL' : 'ATHLETE PANEL'}
                     </span>
                     <h2 className="text-5xl font-black italic uppercase tracking-tighter">
                       {profile?.role === 'admin' ? 'Dashboard Admin Pengelola' : 'My Dashboard'}
                     </h2>
                     <div className="h-px bg-[#141414] w-full mt-4" />
                   </header>

                   {profile?.role === 'admin' && (
                     <div className="mb-10 bg-white border-2 border-[#141414] p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-[8px_8px_0px_0px_rgba(255,78,0,0.15)] relative overflow-hidden group">
                       <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#FF4E00]/10 to-transparent pointer-events-none" />
                       <div className="space-y-2 max-w-2xl relative z-10">
                         <div className="flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-[#FF4E00] animate-pulse" />
                           <span className="font-mono text-[9px] uppercase tracking-widest font-bold text-orange-600">Event Manager Tool</span>
                         </div>
                         <h3 className="text-3xl font-black italic uppercase tracking-tight">Buat Turnamen Baru</h3>
                         <p className="font-mono text-[10px] uppercase opacity-60 tracking-wider leading-relaxed">
                           Mulai turnamen baru, kelola data kontestan, atur mat tanding, dan buat bagan bagan kompetisi dengan kontrol admin penuh.
                         </p>
                       </div>
                       <button 
                         onClick={() => setShowCreateModal(true)}
                         className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-8 py-4 font-mono text-[11px] uppercase font-bold tracking-widest hover:bg-[#FF4E00] hover:text-white hover:scale-[0.98] transition-all shrink-0 duration-200 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]"
                       >
                         <Plus size={16} /> Tambah Turnamen
                       </button>
                     </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <StatCard label="Live Matches" value={liveMatchesCount.toString()} sub="Active now" />
                     <StatCard label="Total Athletes" value={totalAthletesCount.toString()} sub="Across all clubs" />
                     <StatCard label="Upcoming Events" value={upcomingEventsCount.toString()} sub="This month" />
                   </div>
                 </motion.section>
              )}
            </React.Fragment>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCreateModal && (
            <CreateTournament onOpenChange={setShowCreateModal} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );

  return (
    <Routes>
      <Route path="/match/:matchId" element={
        <div className="min-h-screen bg-[#141414] text-white p-8">
          <LiveScoreboard />
        </div>
      } />
      <Route path="/match/:tournamentId/:bracketId/:matchId" element={
        <div className="min-h-screen bg-[#141414] text-white p-8">
          <LiveScoreboard />
        </div>
      } />
      <Route path="/*" element={renderDashboardShell()} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppMainContent />
    </HashRouter>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void, key?: any }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-4 transition-all rounded-sm group outline-none",
        active ? "bg-[#141414] text-[#E4E3E0]" : "hover:bg-[#141414] hover:text-[#E4E3E0] text-[#141414] opacity-70 hover:opacity-100"
      )}
    >
      <div className={cn("transition-transform", active && "scale-110")}>{icon}</div>
      <span className="hidden md:block font-mono text-[10px] uppercase tracking-[0.2em] font-medium">{label}</span>
      {active && <motion.div layoutId="nav-active" className="ml-auto hidden md:block"><ChevronRight size={14} /></motion.div>}
    </button>
  );
}

function TournamentCard({ tournament, onClick }: { tournament: Partial<Tournament>, onClick: () => void, key?: any }) {
  return (
    <motion.div 
      onClick={onClick}
      whileHover={{ y: -5 }}
      className="group bg-white border border-[#141414] p-6 flex flex-col cursor-pointer transition-shadow hover:shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
    >
      <div className="mb-12 flex justify-between items-start">
        <div className={cn(
          "px-3 py-1 font-mono text-[9px] uppercase tracking-widest border border-[#141414]",
          tournament.status === 'ongoing' ? "bg-orange-500 text-white" : "bg-black text-white"
        )}>
          {tournament.status}
        </div>
        <div className="opacity-30 group-hover:opacity-100 transition-opacity">
          <ChevronRight size={20} />
        </div>
      </div>
      
      <div className="flex-1">
        <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 leading-[0.9] italic">
          {tournament.name}
        </h3>
        
        <div className="space-y-3 mt-6">
          <div className="flex items-center gap-2 font-mono text-[10px] opacity-60 uppercase tracking-widest">
            <MapPin size={12} /> {tournament.location}
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] opacity-60 uppercase tracking-widest">
            <Calendar size={12} /> {formatDate(tournament.startDate)}
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-[#141414] flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/60-lines.png')] bg-repeat">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">Entry Open</div>
        <div className="flex -space-x-1 shadow-sm">
          {[1,2,3].map(i => (
             <div key={i} className="w-8 h-8 rounded-full border border-[#141414] bg-[#E4E3E0] flex items-center justify-center -mr-2">
               <Users size={12} />
             </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, sub }: { label: string, value: string, sub: string }) {
  return (
    <div className="border border-[#141414] p-8 aspect-video flex flex-col justify-between group hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#141414] opacity-[0.02] -mr-16 -mt-16 rounded-full group-hover:opacity-[0.05]" />
      <div className="space-y-1 relative z-10">
        <span className="font-mono text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-100">{label}</span>
        <div className="text-7xl font-black italic tracking-tighter">{value}</div>
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest opacity-30 group-hover:opacity-70 relative z-10">{sub}</div>
    </div>
  );
}
