import { Match } from '../types';

export function generateKnockoutBracket(athleteIds: string[], tournamentId: string, bracketId: string, manual: boolean = false): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
  const n = athleteIds.length;
  if (n < 2) return [];

  // Shuffle athletes if not manual
  const shuffled = manual ? [] : [...athleteIds].sort(() => Math.random() - 0.5);

  // Determine bracket size (power of 2)
  let bracketSize = 1;
  while (bracketSize < n) {
    bracketSize *= 2;
  }

  const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const rounds = Math.log2(bracketSize);

  // Helper to find or create a match in the list
  const getMatch = (round: number, position: number) => {
    return matches.find(m => m.round === round && m.position === position);
  };

  // Initial rounds creation
  for (let r = 1; r <= rounds; r++) {
    const roundSize = Math.pow(2, rounds - r);
    for (let p = 0; p < roundSize; p++) {
      matches.push({
        tournamentId,
        bracketId,
        round: r,
        position: p,
        scoreA: 0,
        scoreB: 0,
        status: 'pending'
      });
    }
  }

  // Fill Round 1 and advance byes
  for (let i = 0; i < bracketSize; i += 2) {
    const athleteA = shuffled[i];
    const athleteB = shuffled[i+1];
    const round1Match = getMatch(1, i / 2);
    
    if (round1Match) {
      round1Match.athleteAId = athleteA || undefined;
      round1Match.athleteBId = athleteB || undefined;
      
      // Advance byes only if NOT in manual mode and at least one athlete is present
      if (!manual && (!athleteA || !athleteB) && (athleteA || athleteB)) {
        round1Match.status = 'completed';
        const winner = athleteA || athleteB;
        round1Match.winnerId = winner || undefined;
        
        // Advance to round 2
        if (winner && rounds >= 2) {
          const r2Match = getMatch(2, Math.floor((i / 2) / 2));
          if (r2Match) {
            if ((i / 2) % 2 === 0) {
              r2Match.athleteAId = winner;
            } else {
              r2Match.athleteBId = winner;
            }
          }
        }
      }
    }
  }

  return matches;
}
