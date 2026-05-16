import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  onSnapshot,
  type Unsubscribe,
  where,
} from "firebase/firestore";
import type { SignalingRoom } from "../net/SignalingTypes";
import type { MatchType } from "../types";
import type { FirebaseServices } from "./FirebaseApp";
import { SignalingService } from "./SignalingService";

const QUEUE_TTL_MS = 2 * 60 * 1000;
const ROOM_TTL_MS = 10 * 60 * 1000;
const MATCH_SEARCH_LIMIT = 32;
const STALE_MATCH_ERROR = "MATCH_QUEUE_STALE";

export class MatchmakingService {
  private queueDocId: string | null = null;

  constructor(
    private readonly services: FirebaseServices,
    private readonly sessionId: string,
  ) {}

  async joinQueue(playerId: string, matchType: MatchType): Promise<SignalingRoom | null> {
    await this.cleanupOldQueueEntries();
    await this.cleanupOldRooms();
    await this.ensureQueueEntry(playerId, matchType);
    return this.tryCreateMatch(playerId, matchType);
  }

  async tryCreateMatch(playerId: string, matchType: MatchType): Promise<SignalingRoom | null> {
    if (!this.queueDocId) {
      return null;
    }

    const waiting = await getDocs(
      query(
        collection(this.services.db, "matchQueue"),
        where("status", "==", "waiting"),
        limit(MATCH_SEARCH_LIMIT),
      ),
    );

    const now = Date.now();
    const opponent = waiting.docs
      .filter((entry) => entry.data().sessionId !== this.sessionId)
      .filter((entry) => entry.data().matchType === matchType)
      .sort((a, b) => Number(a.data().createdAt ?? 0) - Number(b.data().createdAt ?? 0))[0];
    if (!opponent) {
      return null;
    }

    const opponentId = opponent.data().playerId as string;
    const opponentSessionId = opponent.data().sessionId as string | undefined;
    const roomId = `match-${now}-${Math.floor(Math.random() * 100000)}`;
    const room: SignalingRoom = {
      id: roomId,
      status: "matched",
      hostId: opponentId,
      guestId: playerId,
      hostSessionId: opponentSessionId ?? "",
      guestSessionId: this.sessionId,
      matchType,
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
    };

    try {
      await runTransaction(this.services.db, async (transaction) => {
        const ownRef = doc(this.services.db, "matchQueue", this.queueDocId!);
        const roomRef = doc(this.services.db, "matchRooms", roomId);
        const ownSnapshot = await transaction.get(ownRef);
        const opponentSnapshot = await transaction.get(opponent.ref);

        if (
          !ownSnapshot.exists() ||
          !opponentSnapshot.exists() ||
          ownSnapshot.data().status !== "waiting" ||
          opponentSnapshot.data().status !== "waiting" ||
          ownSnapshot.data().sessionId !== this.sessionId ||
          ownSnapshot.data().playerId !== playerId ||
          ownSnapshot.data().matchType !== matchType ||
          Number(ownSnapshot.data().expiresAt ?? 0) <= now ||
          opponentSnapshot.data().sessionId === this.sessionId ||
          opponentSnapshot.data().playerId === playerId ||
          opponentSnapshot.data().matchType !== matchType ||
          Number(opponentSnapshot.data().expiresAt ?? 0) <= now
        ) {
          throw new Error(STALE_MATCH_ERROR);
        }

        transaction.delete(ownRef);
        transaction.delete(opponent.ref);
        transaction.set(roomRef, room);
      });
    } catch (error) {
      if (error instanceof Error && error.message === STALE_MATCH_ERROR) {
        return null;
      }
      throw error;
    }

    this.queueDocId = null;
    return room;
  }

  async ensureQueueEntry(playerId: string, matchType: MatchType): Promise<void> {
    if (this.queueDocId) {
      return;
    }
    const now = Date.now();
    const queueRef = await addDoc(collection(this.services.db, "matchQueue"), {
      playerId,
      sessionId: this.sessionId,
      matchType,
      status: "waiting",
      createdAt: now,
      expiresAt: now + QUEUE_TTL_MS,
    });
    this.queueDocId = queueRef.id;
  }

  async cancel(): Promise<void> {
    if (!this.queueDocId) {
      return;
    }
    await deleteDoc(doc(this.services.db, "matchQueue", this.queueDocId));
    this.queueDocId = null;
  }

  watchMatchForPlayer(
    playerId: string,
    matchType: MatchType,
    callback: (room: SignalingRoom) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const hostQuery = query(collection(this.services.db, "matchRooms"), where("hostId", "==", playerId));
    const guestQuery = query(collection(this.services.db, "matchRooms"), where("guestId", "==", playerId));
    const notifyIfActive = (room: SignalingRoom): void => {
      if (
        room.expiresAt <= Date.now() ||
        room.status === "closed" ||
        room.status === "expired" ||
        room.matchType !== matchType ||
        !this.belongsToCurrentSession(room, playerId)
      ) {
        return;
      }
      callback(room);
    };
    const unsubs = [
      onSnapshot(hostQuery, (snapshot) => {
        snapshot.docs.forEach((entry) => notifyIfActive(entry.data() as SignalingRoom));
      }, onError),
      onSnapshot(guestQuery, (snapshot) => {
        snapshot.docs.forEach((entry) => notifyIfActive(entry.data() as SignalingRoom));
      }, onError),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }

  private belongsToCurrentSession(room: SignalingRoom, playerId: string): boolean {
    if (room.hostSessionId || room.guestSessionId) {
      return room.hostSessionId === this.sessionId || room.guestSessionId === this.sessionId;
    }
    return room.hostId === playerId || room.guestId === playerId;
  }

  private async cleanupOldQueueEntries(): Promise<void> {
    const expired = await getDocs(
      query(collection(this.services.db, "matchQueue"), where("expiresAt", "<", Date.now())),
    );
    await Promise.all(expired.docs.map((entry) => deleteDoc(entry.ref)));
  }

  private async cleanupOldRooms(): Promise<void> {
    const expired = await getDocs(
      query(collection(this.services.db, "matchRooms"), where("expiresAt", "<", Date.now())),
    );
    const signaling = new SignalingService(this.services, "matchRooms");
    await Promise.all(expired.docs.map((entry) => signaling.cleanupRoom(entry.id)));
  }
}
