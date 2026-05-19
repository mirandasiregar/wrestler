export type UserRole = 'athlete' | 'coach' | 'admin';

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  clubId?: string;
  createdAt: any;
  updatedAt: any;
}

export type TournamentStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  location: string;
  startDate: any;
  endDate: any;
  organizerId: string;
  status: TournamentStatus;
  description?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Bracket {
  id: string;
  weightClass: string;
  gender: 'male' | 'female';
  style: 'freestyle' | 'greco-roman';
  tournamentId: string;
  createdAt: any;
}

export type MatchStatus = 'pending' | 'ongoing' | 'completed';

export interface Match {
  id: string;
  bracketId: string;
  tournamentId: string;
  round: number;
  position: number;
  athleteAId?: string;
  athleteBId?: string;
  scoreA: number;
  scoreB: number;
  winnerId?: string;
  status: MatchStatus;
  createdAt: any;
  updatedAt: any;
}

export interface Athlete {
  athleteId: string;
  userId?: string;
  name: string;
  clubId?: string;
  clubName?: string;
  tournamentId: string;
  bracketId: string;
  status: 'pending' | 'ongoing' | 'completed';
  totalMatches: number;
  wins: number;
  losses: number;
  gender: 'male' | 'female';
  photoURL?: string;
  weightClass?: string;
  weight?: number;
  createdAt: any;
  updatedAt: any;
}
