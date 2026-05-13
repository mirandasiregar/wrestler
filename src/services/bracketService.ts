import { Match } from '../types';

export function generateKnockoutBracket(athleteIds: string[], tournamentId: string, bracketId: string): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
  const n = athleteIds.length;
  if (n < 2) return [];

  // Determine bracket size (power of 2)
  let bracketSize = 1;
  while (bracketSize < n) {
    bracketSize *= 2;
  }

  const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const rounds = Math.log2(bracketSize);

  // Initial round (Round 1)
  // Fill slots in Round 1
  const slots: (string | null)[] = Array(bracketSize).fill(null);
  
  // Seed distribution logic (simplified)
  athleteIds.forEach((id, index) => {
    slots[index] = id;
  });

  // Create matches for Round 1
  for (let i = 0; i < bracketSize; i += 2) {
    const athleteA = slots[i];
    const athleteB = slots[i + 1];
    
    matches.push({
      tournamentId,
      bracketId,
      round: 1,
      position: i / 2,
      athleteAId: athleteA || undefined,
      athleteBId: athleteB || undefined,
      scoreA: 0,
      scoreB: 0,
      status: (!athleteA || !athleteB) ? 'completed' : 'pending',
      winnerId: (!athleteA ? athleteB : (!athleteB ? athleteA : undefined)) || undefined
    });
  }

  // Generate empty matches for subsequent rounds
  let currentRoundSize = bracketSize / 2;
  for (let r = 2; r <= rounds; r++) {
    currentRoundSize /= 2;
    for (let p = 0; p < currentRoundSize; p++) {
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

  return matches;
}
