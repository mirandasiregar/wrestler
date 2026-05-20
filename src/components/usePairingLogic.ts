import { db } from '../lib/firebase';
import { collection, doc, query, where, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { Match, Athlete } from '../types';

export function usePairingLogic() {
  const autoPairRemainingAthletes = async (tournamentId: string, bracketId: string) => {
    try {
      // 1. Fetch all athletes in this bracket
      const athletesSnap = await getDocs(
        query(collection(db, 'athletes'), where('bracketId', '==', bracketId))
      );
      const athletes = athletesSnap.docs.map(d => ({ athleteId: d.id, ...d.data() } as Athlete));

      if (athletes.length < 2) return;

      // 2. Fetch all matches in this bracket
      const matchesSnap = await getDocs(
        collection(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches`)
      );
      const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

      // 3. Find active (pending or ongoing) matches
      const activeMatches = matches.filter(m => m.status === 'pending' || m.status === 'ongoing');

      // 4. Determine which athletes are already scheduled/busy in active matches
      const busyAthleteIds = new Set<string>();
      activeMatches.forEach(m => {
        if (m.athleteAId) busyAthleteIds.add(m.athleteAId);
        if (m.athleteBId) busyAthleteIds.add(m.athleteBId);
      });

      // 5. Free athletes are those who are not busy and haven't retired
      const freeAthletes = athletes.filter(a => !busyAthleteIds.has(a.athleteId) && a.status !== 'completed');
      if (freeAthletes.length < 2) {
        return;
      }

      // 6. Gather all pairs that have already played (in completed matches) to avoid duplicates (round-robin rule)
      const playedPairings = new Set<string>();
      matches.forEach(m => {
        if (m.status === 'completed' && m.athleteAId && m.athleteBId) {
          playedPairings.add(`${m.athleteAId}-${m.athleteBId}`);
          playedPairings.add(`${m.athleteBId}-${m.athleteAId}`);
        }
      });

      // 7. Find new pairings among free athletes
      const newMatchesToCreate: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = [];
      const unpaired = [...freeAthletes];
      
      // Determine next position index for Round 1 matches
      const round1Matches = matches.filter(m => m.round === 1);
      let nextPosition = round1Matches.reduce((max, m) => m.position > max ? m.position : max, -1) + 1;

      while (unpaired.length > 1) {
        const athleteA = unpaired.shift()!;
        
        // Find first remaining athlete in unpaired who hasn't played athleteA yet
        const opponentIdx = unpaired.findIndex(opponent => {
          return !playedPairings.has(`${athleteA.athleteId}-${opponent.athleteId}`);
        });

        if (opponentIdx !== -1) {
          const athleteB = unpaired.splice(opponentIdx, 1)[0];
          newMatchesToCreate.push({
            tournamentId,
            bracketId,
            round: 1,
            position: nextPosition++,
            athleteAId: athleteA.athleteId,
            athleteBId: athleteB.athleteId,
            scoreA: 0,
            scoreB: 0,
            status: 'pending'
          });
        }
      }

      // If we have any new matches, commit them to Firestore
      if (newMatchesToCreate.length > 0) {
        const batch = writeBatch(db);
        newMatchesToCreate.forEach(m => {
          const matchId = `r${m.round}-p${m.position}`;
          const mRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches`, matchId);
          batch.set(mRef, {
            ...m,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        });
        await batch.commit();
        console.log(`Successfully auto-paired ${newMatchesToCreate.length} matches.`);
      }
    } catch (error) {
      console.error("Error in autoPairRemainingAthletes:", error);
    }
  };

  const handleManualPair = async (tournamentId: string, bracketId: string, matchId: string, slot: 'A' | 'B', athleteId: string | null) => {
    try {
      const matchRef = doc(db, `tournaments/${tournamentId}/brackets/${bracketId}/matches/${matchId}`);
      await updateDoc(matchRef, {
        [slot === 'A' ? 'athleteAId' : 'athleteBId']: athleteId || null,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error in handleManualPair:", error);
    }
  };

  return {
    autoPairRemainingAthletes,
    handleManualPair
  };
}
