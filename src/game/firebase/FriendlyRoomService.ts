import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  type Unsubscribe,
  where,
} from "firebase/firestore";
import type { SignalingRoom } from "../net/SignalingTypes";
import type { FirebaseServices } from "./FirebaseApp";
import { createRoomCode, normalizeRoomCode } from "./RoomCode";
import { SignalingService } from "./SignalingService";

const ROOM_TTL_MS = 10 * 60 * 1000;

export class FriendlyRoomService {
  constructor(private readonly services: FirebaseServices) {}

  async createRoom(hostId: string): Promise<SignalingRoom> {
    await this.cleanupOldRooms();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = createRoomCode();
      const ref = doc(this.services.db, "friendlyRooms", code);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        continue;
      }
      const now = Date.now();
      const room: SignalingRoom = {
        id: code,
        code,
        status: "waiting",
        hostId,
        matchType: "friendly",
        createdAt: now,
        expiresAt: now + ROOM_TTL_MS,
      };
      await setDoc(ref, room);
      return room;
    }
    throw new Error("Failed to allocate a room code.");
  }

  async joinRoom(codeInput: string, guestId: string): Promise<SignalingRoom> {
    const code = normalizeRoomCode(codeInput);
    const ref = doc(this.services.db, "friendlyRooms", code);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      throw new Error("Room not found.");
    }
    const room = snapshot.data() as SignalingRoom;
    if (room.expiresAt < Date.now() || room.status === "closed") {
      await this.cleanup(code);
      throw new Error("Room expired.");
    }
    await updateDoc(ref, {
      guestId,
      status: "matched",
    });
    return {
      ...room,
      guestId,
      status: "matched",
    };
  }

  watchRoom(codeInput: string, callback: (room: SignalingRoom | null) => void): Unsubscribe {
    const code = normalizeRoomCode(codeInput);
    return onSnapshot(doc(this.services.db, "friendlyRooms", code), (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as SignalingRoom) : null);
    });
  }

  async markConnected(codeInput: string): Promise<void> {
    await updateDoc(doc(this.services.db, "friendlyRooms", normalizeRoomCode(codeInput)), {
      status: "connected",
    });
  }

  async cleanup(codeInput: string): Promise<void> {
    await new SignalingService(this.services, "friendlyRooms").cleanupRoom(normalizeRoomCode(codeInput));
  }

  private async cleanupOldRooms(): Promise<void> {
    const expired = await getDocs(
      query(collection(this.services.db, "friendlyRooms"), where("expiresAt", "<", Date.now())),
    );
    const signaling = new SignalingService(this.services, "friendlyRooms");
    await Promise.all(expired.docs.map((entry) => signaling.cleanupRoom(entry.id)));
  }
}
