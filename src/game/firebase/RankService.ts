import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
} from "firebase/firestore";
import {
  CURRENT_SEASON_ID,
  LEADERBOARD_LIMIT,
  RANK_BASE_SCORE,
  RANK_LOSS_SCORE,
  RANK_WIN_SCORE,
} from "../constants";
import type { AuthProfile, LeaderboardEntry } from "../types";
import type { FirebaseServices } from "./FirebaseApp";

export class RankService {
  constructor(
    private readonly services: FirebaseServices,
    private readonly seasonId = CURRENT_SEASON_ID,
  ) {}

  async recordResult(profile: AuthProfile, won: boolean): Promise<void> {
    const playerRef = doc(this.playersCollection(), profile.uid);
    const now = Date.now();

    // Client-side rank writes are not cheat-proof. Keep this isolated so
    // Cloud Functions or a future authority server can validate results later.
    await runTransaction(this.services.db, async (transaction) => {
      const snapshot = await transaction.get(playerRef);
      const current = snapshot.exists()
        ? (snapshot.data() as LeaderboardEntry)
        : {
            uid: profile.uid,
            displayName: profile.displayName,
            score: RANK_BASE_SCORE,
            wins: 0,
            losses: 0,
            updatedAt: now,
          };

      transaction.set(playerRef, {
        uid: profile.uid,
        displayName: profile.displayName,
        score: Math.max(
          0,
          Number(current.score ?? RANK_BASE_SCORE) + (won ? RANK_WIN_SCORE : -RANK_LOSS_SCORE),
        ),
        wins: Number(current.wins ?? 0) + (won ? 1 : 0),
        losses: Number(current.losses ?? 0) + (won ? 0 : 1),
        updatedAt: now,
      } satisfies LeaderboardEntry);
    });

    await this.trimLeaderboard();
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const snapshot = await getDocs(
      query(this.playersCollection(), orderBy("score", "desc"), limit(LEADERBOARD_LIMIT)),
    );
    return snapshot.docs.map((entry) => entry.data() as LeaderboardEntry);
  }

  async getPlayerEntry(uid: string): Promise<LeaderboardEntry | null> {
    const snapshot = await getDoc(doc(this.playersCollection(), uid));
    return snapshot.exists() ? (snapshot.data() as LeaderboardEntry) : null;
  }

  private async trimLeaderboard(): Promise<void> {
    const snapshot = await getDocs(query(this.playersCollection(), orderBy("score", "desc")));
    const entries = snapshot.docs;
    await Promise.all(entries.slice(LEADERBOARD_LIMIT).map((entry) => deleteDoc(entry.ref)));
  }

  private playersCollection() {
    return collection(this.services.db, "rankings", this.seasonId, "players");
  }
}
