import type { ConnectionStatus } from "../types";
import type { NetMessage } from "./NetMessages";

type MessageHandler = (message: NetMessage) => void;
type StatusHandler = (status: ConnectionStatus, detail?: string) => void;
type IceCandidateHandler = (candidate: RTCIceCandidateInit) => void;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

export class P2PClient {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private messageHandler: MessageHandler | null = null;
  private statusHandler: StatusHandler | null = null;
  private iceCandidateHandler: IceCandidateHandler | null = null;

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onStatus(handler: StatusHandler): void {
    this.statusHandler = handler;
  }

  onIceCandidate(handler: IceCandidateHandler): void {
    this.iceCandidateHandler = handler;
  }

  async createOffer(): Promise<string> {
    this.close();
    this.setStatus("creating-offer");
    const peer = this.createPeer();
    const channel = peer.createDataChannel("weaponmaster-input", {
      ordered: true,
    });
    this.attachChannel(channel);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await this.waitForIce(peer);
    this.setStatus("waiting-answer");
    return JSON.stringify(peer.localDescription);
  }

  async createAnswerFromOffer(offerText: string): Promise<string> {
    this.close();
    this.setStatus("creating-answer");
    const peer = this.createPeer();
    const offer = JSON.parse(offerText) as RTCSessionDescriptionInit;
    await peer.setRemoteDescription(offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await this.waitForIce(peer);
    this.setStatus("connecting");
    return JSON.stringify(peer.localDescription);
  }

  async acceptAnswer(answerText: string): Promise<void> {
    if (!this.peer) {
      throw new Error("Create an offer before accepting an answer.");
    }
    const answer = JSON.parse(answerText) as RTCSessionDescriptionInit;
    await this.peer.setRemoteDescription(answer);
    this.setStatus("connecting");
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peer) {
      return;
    }
    await this.peer.addIceCandidate(candidate);
  }

  send(message: NetMessage): boolean {
    if (!this.channel || this.channel.readyState !== "open") {
      return false;
    }
    this.channel.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    if (this.channel) {
      this.channel.close();
    }
    if (this.peer) {
      this.peer.close();
    }
    this.channel = null;
    this.peer = null;
  }

  private createPeer(): RTCPeerConnection {
    // Public STUN improves direct P2P reachability. This is still not a relay or
    // cheat authority; restrictive NATs may require a later TURN service.
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peer = peer;

    peer.ondatachannel = (event) => {
      this.attachChannel(event.channel);
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.iceCandidateHandler?.(event.candidate.toJSON());
      }
    };
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === "connected") {
        this.setStatus("connected");
      } else if (state === "failed") {
        this.setStatus("error", "WebRTC connection failed.");
      } else if (state === "closed" || state === "disconnected") {
        this.setStatus("closed");
      } else if (state === "connecting") {
        this.setStatus("connecting");
      }
    };

    return peer;
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => this.setStatus("connected");
    channel.onclose = () => this.setStatus("closed");
    channel.onerror = () => this.setStatus("error", "DataChannel error.");
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as NetMessage;
        this.messageHandler?.(message);
      } catch {
        this.setStatus("error", "Received malformed network message.");
      }
    };
  }

  private waitForIce(peer: RTCPeerConnection): Promise<void> {
    if (peer.iceGatheringState === "complete") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        peer.removeEventListener("icegatheringstatechange", check);
        resolve();
      }, 4500);
      const check = () => {
        if (peer.iceGatheringState === "complete") {
          window.clearTimeout(timeout);
          peer.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      peer.addEventListener("icegatheringstatechange", check);
    });
  }

  private setStatus(status: ConnectionStatus, detail?: string): void {
    this.statusHandler?.(status, detail);
  }
}
