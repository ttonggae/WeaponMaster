import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import type { SignalingCandidate, SignalingRoom } from "../net/SignalingTypes";
import type { FirebaseServices } from "./FirebaseApp";

export class SignalingService {
  constructor(
    private readonly services: FirebaseServices,
    private readonly roomCollection: "friendlyRooms" | "matchRooms",
  ) {}

  async writeOffer(roomId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    await updateDoc(doc(this.services.db, this.roomCollection, roomId), {
      offer,
      status: "offer",
    });
  }

  async writeAnswer(roomId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    await updateDoc(doc(this.services.db, this.roomCollection, roomId), {
      answer,
      status: "answer",
    });
  }

  async markConnected(roomId: string): Promise<void> {
    await updateDoc(doc(this.services.db, this.roomCollection, roomId), {
      status: "connected",
    });
  }

  async addIceCandidate(
    roomId: string,
    role: "host" | "guest",
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    await addDoc(
      collection(this.services.db, this.roomCollection, roomId, `${role}Candidates`),
      {
        role,
        candidate,
        createdAt: Date.now(),
      } satisfies SignalingCandidate,
    );
  }

  watchRoom(roomId: string, callback: (room: SignalingRoom | null) => void): Unsubscribe {
    return onSnapshot(doc(this.services.db, this.roomCollection, roomId), (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as SignalingRoom) : null);
    });
  }

  watchCandidates(
    roomId: string,
    roleToRead: "host" | "guest",
    callback: (candidate: RTCIceCandidateInit) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(this.services.db, this.roomCollection, roomId, `${roleToRead}Candidates`),
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const data = change.doc.data() as SignalingCandidate;
            callback(data.candidate);
          }
        }
      },
    );
  }

  async createMatchRoom(room: SignalingRoom): Promise<void> {
    await setDoc(doc(this.services.db, this.roomCollection, room.id), room);
  }

  async cleanupRoom(roomId: string): Promise<void> {
    const candidateCollections = ["hostCandidates", "guestCandidates"];
    await Promise.all(
      candidateCollections.map(async (candidateCollection) => {
        const snapshot = await getDocs(
          collection(this.services.db, this.roomCollection, roomId, candidateCollection),
        );
        await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
      }),
    );
    await deleteDoc(doc(this.services.db, this.roomCollection, roomId));
  }
}
