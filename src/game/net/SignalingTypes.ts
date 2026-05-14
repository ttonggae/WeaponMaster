export type OnlineStatus =
  | "Offline"
  | "Connecting to Firebase"
  | "Waiting for opponent"
  | "Room created"
  | "Joining room"
  | "Exchanging offer"
  | "Exchanging answer"
  | "Connecting P2P"
  | "Connected"
  | "Failed"
  | "Disconnected";

export interface SignalingRoom {
  id: string;
  code?: string;
  status: "waiting" | "matched" | "offer" | "answer" | "connected" | "expired" | "closed";
  hostId: string;
  guestId?: string;
  hostSessionId?: string;
  guestSessionId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: number;
  expiresAt: number;
}

export interface SignalingCandidate {
  role: "host" | "guest";
  candidate: RTCIceCandidateInit;
  createdAt: number;
}
