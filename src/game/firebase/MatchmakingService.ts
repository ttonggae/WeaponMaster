import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
  where,
} from "firebase/firestore";
import type { SignalingRoom } from "../net/SignalingTypes";
import type { FirebaseServices } from "./FirebaseApp";

const QUEUE_TTL_MS = 2 * 60 * 1000;
const ROOM_TTL_MS = 10 * 60 * 1000;
const MATCH_SEARCH_LIMIT = 8;

export class MatchmakingService {
  private queueDocId: string | null = null;

  constructor(
    private readonly services: FirebaseServices,
    private readonly sessionId: string,
  ) {}

  async joinQueue(playerId: string): Promise<SignalingRoom | null> {
    await this.cleanupOldQueueEntries();
    await this.cleanupOldRooms();
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
      .sort((a, b) => Number(a.data().createdAt ?? 0) - Number(b.data().createdAt ?? 0))[0];
    if (opponent) {
      const opponentId = opponent.data().playerId as string;
      const opponentSessionId = opponent.data().sessionId as string | undefined;
      await updateDoc(opponent.ref, { status: "matched" });
      const roomId = `match-${now}-${Math.floor(Math.random() * 100000)}`;
      const room: SignalingRoom = {
        id: roomId,
        status: "matched",
        hostId: opponentId,
        guestId: playerId,
        hostSessionId: opponentSessionId ?? "",
        guestSessionId: this.sessionId,
        createdAt: now,
        expiresAt: now + ROOM_TTL_MS,
      };
      await setDoc(doc(this.services.db, "matchRooms", roomId), room);
      return room;
    }

    const queueRef = await addDoc(collection(this.services.db, "matchQueue"), {
      playerId,
      sessionId: this.sessionId,
      status: "waiting",
      createdAt: now,
      expiresAt: now + QUEUE_TTL_MS,
    });
    this.queueDocId = queueRef.id;
    return null;
  }

  async cancel(): Promise<void> {
    if (!this.queueDocId) {
      return;
    }
    await deleteDoc(doc(this.services.db, "matchQueue", this.queueDocId));
    this.queueDocId = null;
  }

  watchMatchForPlayer(playerId: string, callback: (room: SignalingRoom) => void): Unsubscribe {
    const hostQuery = query(collection(this.services.db, "matchRooms"), where("hostId", "==", playerId));
    const guestQuery = query(collection(this.services.db, "matchRooms"), where("guestId", "==", playerId));
    const notifyIfActive = (room: SignalingRoom): void => {
      if (room.expiresAt <= Date.now() || room.status === "closed" || room.status === "expired") {
        return;
      }
      callback(room);
    };
    const unsubs = [
      onSnapshot(hostQuery, (snapshot) => {
        snapshot.docs.forEach((entry) => notifyIfActive(entry.data() as SignalingRoom));
      }),
      onSnapshot(guestQuery, (snapshot) => {
        snapshot.docs.forEach((entry) => notifyIfActive(entry.data() as SignalingRoom));
      }),
    ];
    return () => unsubs.forEach((unsub) => unsub());
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
    await Promise.all(expired.docs.map((entry) => deleteDoc(entry.ref)));
  }
}
