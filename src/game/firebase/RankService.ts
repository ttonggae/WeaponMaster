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
  setDoc,
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

  async ensurePlayerEntry(profile: AuthProfile): Promise<LeaderboardEntry> {
    const scoreRef = doc(this.scoreCollection(), profile.uid);
    const legacyLeaderboardRef = doc(this.leaderboardCollection(), profile.uid);
    const now = Date.now();

    const entry = await runTransaction(this.services.db, async (transaction) => {
      const scoreSnapshot = await transaction.get(scoreRef);
      const legacySnapshot = await transaction.get(legacyLeaderboardRef);
      const current = scoreSnapshot.exists()
        ? (scoreSnapshot.data() as LeaderboardEntry)
        : legacySnapshot.exists()
          ? (legacySnapshot.data() as LeaderboardEntry)
          : this.makeDefaultEntry(profile, now);

      const next = {
        ...current,
        uid: profile.uid,
        displayName: profile.displayName,
        score: Number(current.score ?? RANK_BASE_SCORE),
        wins: Number(current.wins ?? 0),
        losses: Number(current.losses ?? 0),
        updatedAt: now,
      } satisfies LeaderboardEntry;
      transaction.set(scoreRef, next);
      return next;
    });

    await this.syncLeaderboard();
    return entry;
  }

  async recordResult(profile: AuthProfile, won: boolean): Promise<LeaderboardEntry> {
    const scoreRef = doc(this.scoreCollection(), profile.uid);
    const now = Date.now();

    // Client-side rank writes are not cheat-proof. Keep this isolated so
    // Cloud Functions or a future authority server can validate results later.
    const entry = await runTransaction(this.services.db, async (transaction) => {
      const snapshot = await transaction.get(scoreRef);
      const current = snapshot.exists()
        ? (snapshot.data() as LeaderboardEntry)
        : this.makeDefaultEntry(profile, now);

      const next = {
        uid: profile.uid,
        displayName: profile.displayName,
        score: Math.max(
          0,
          Number(current.score ?? RANK_BASE_SCORE) + (won ? RANK_WIN_SCORE : -RANK_LOSS_SCORE),
        ),
        wins: Number(current.wins ?? 0) + (won ? 1 : 0),
        losses: Number(current.losses ?? 0) + (won ? 0 : 1),
        updatedAt: now,
      } satisfies LeaderboardEntry;
      transaction.set(scoreRef, next);
      return next;
    });

    await this.syncLeaderboard();
    return entry;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const snapshot = await getDocs(
      query(this.leaderboardCollection(), orderBy("score", "desc"), limit(LEADERBOARD_LIMIT)),
    );
    return snapshot.docs.map((entry) => entry.data() as LeaderboardEntry);
  }

  async getPlayerEntry(uid: string): Promise<LeaderboardEntry | null> {
    const snapshot = await getDoc(doc(this.scoreCollection(), uid));
    return snapshot.exists() ? (snapshot.data() as LeaderboardEntry) : null;
  }

  private async syncLeaderboard(): Promise<void> {
    const scoreSnapshot = await getDocs(query(this.scoreCollection(), orderBy("score", "desc")));
    const topEntries = scoreSnapshot.docs
      .slice(0, LEADERBOARD_LIMIT)
      .map((entry) => entry.data() as LeaderboardEntry);
    const topIds = new Set(topEntries.map((entry) => entry.uid));

    await Promise.all(
      topEntries.map((entry) => setDoc(doc(this.leaderboardCollection(), entry.uid), entry)),
    );

    const leaderboardSnapshot = await getDocs(this.leaderboardCollection());
    await Promise.all(
      leaderboardSnapshot.docs
        .filter((entry) => !topIds.has(entry.id))
        .map((entry) => deleteDoc(entry.ref)),
    );
  }

  private makeDefaultEntry(profile: AuthProfile, updatedAt: number): LeaderboardEntry {
    return {
      uid: profile.uid,
      displayName: profile.displayName,
      score: RANK_BASE_SCORE,
      wins: 0,
      losses: 0,
      updatedAt,
    };
  }

  private scoreCollection() {
    return collection(this.services.db, "rankScores", this.seasonId, "players");
  }

  private leaderboardCollection() {
    return collection(this.services.db, "rankings", this.seasonId, "players");
  }
}
