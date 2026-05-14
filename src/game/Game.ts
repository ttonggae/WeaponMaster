import { CombatSystem } from "./combat/CombatSystem";
import { DEFAULT_REMOTE_WEAPON, MAX_DELTA_SECONDS } from "./constants";
import { FirebaseAuthService } from "./firebase/FirebaseAuth";
import {
  getFirebaseServices,
  getMissingFirebaseEnvKeys,
  type FirebaseServices,
} from "./firebase/FirebaseApp";
import { FriendlyRoomService } from "./firebase/FriendlyRoomService";
import { MatchmakingService } from "./firebase/MatchmakingService";
import { SignalingService } from "./firebase/SignalingService";
import { LOCAL_PLAYER_KEYBINDS } from "./input/Keybinds";
import { InputManager } from "./input/InputManager";
import type { NetMessage } from "./net/NetMessages";
import { P2PClient } from "./net/P2PClient";
import { StateSync } from "./net/StateSync";
import { Renderer } from "./render/Renderer";
import { DuelState } from "./state/DuelState";
import type { ControlState, PlayerId, WeaponType } from "./types";
import { ConnectionPanel } from "./ui/ConnectionPanel";
import { Menu } from "./ui/Menu";
import type { SignalingRoom } from "./net/SignalingTypes";

type Unsubscribe = () => void;

export class Game {
  private readonly state = new DuelState();
  private readonly renderer: Renderer;
  private readonly input = new InputManager();
  private readonly combat = new CombatSystem();
  private readonly menu: Menu;
  private readonly connectionPanel: ConnectionPanel;
  private p2p: P2PClient | null = null;
  private stateSync: StateSync | null = null;
  private localPlayerId: PlayerId = "p1";
  private localP2PWeapon: WeaponType = "longsword";
  private fallbackRemoteWeapon: WeaponType = DEFAULT_REMOTE_WEAPON;
  private sentReady = false;
  private lastTime = performance.now();
  private firebaseServices: FirebaseServices | null = null;
  private firebaseUserId: string | null = null;
  private matchmakingService: MatchmakingService | null = null;
  private matchmakingPollId: number | null = null;
  private signalingUnsubs: Unsubscribe[] = [];
  private activeSignalingRoomId: string | null = null;
  private activeSignalingCollection: "friendlyRooms" | "matchRooms" | null = null;
  private signalingCleanupTimer: number | null = null;
  private onlineMode: "manual" | "friendly" | "matchmaking" = "manual";
  private readonly clientSessionId = crypto.randomUUID();

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.menu = new Menu(uiRoot, {
      onOpenP2P: (localWeapon) => this.openP2PPanel(localWeapon),
      onOpenOnline: (localWeapon) => this.openOnlinePanel(localWeapon),
      onOpenFriendly: (localWeapon) => this.openFriendlyPanel(localWeapon),
    });
    this.connectionPanel = new ConnectionPanel(uiRoot, {
      onCreateOffer: () => this.createOffer(),
      onCreateAnswer: (offer) => this.createAnswer(offer),
      onAcceptAnswer: (answer) => this.acceptAnswer(answer),
      onCreateRoom: () => this.createFriendlyRoom(),
      onJoinRoom: (code) => this.joinFriendlyRoom(code),
      onStartMatchmaking: () => this.startMatchmaking(),
      onCancelMatchmaking: () => this.cancelMatchmaking(),
      onBack: () => this.returnToMenu(),
    });

    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape" && this.state.mode !== "menu") {
        this.returnToMenu();
      }
    });
  }

  start(): void {
    requestAnimationFrame(this.loop);
  }

  private readonly loop = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, MAX_DELTA_SECONDS);
    this.lastTime = time;

    this.state.updateVisualTimers(dt);
    this.update(dt);
    this.renderer.render(this.state, this.localPlayerId, dt);
    requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.state.mode === "p2p") {
      const stateSync = this.stateSync;
      if (!stateSync) {
        return;
      }
      const localInput = this.input.getControls(
        this.localPlayerId,
        LOCAL_PLAYER_KEYBINDS,
        this.getMouseAim(),
        true,
      );
      const remoteInput = stateSync.consumeRemoteInput();
      const controls: Partial<Record<PlayerId, ControlState>> = {};
      controls[this.localPlayerId] = localInput;
      controls[this.remotePlayerId()] = remoteInput;

      this.trySendReady();
      this.p2p?.send(stateSync.makeInputMessage(this.state.frame, localInput));
      this.combat.update(this.state, controls, dt);
      if (stateSync.shouldSendState(this.state.frame)) {
        this.p2p?.send(stateSync.makeStateMessage(this.state));
      }
      const drift = stateSync.getDriftWarning();
      if (drift) {
        this.connectionPanel.setStatus(`${this.state.connectionStatus}: ${drift}`);
      }
    }
  }

  private openP2PPanel(localWeapon: WeaponType): void {
    this.onlineMode = "manual";
    this.localP2PWeapon = localWeapon;
    this.fallbackRemoteWeapon = DEFAULT_REMOTE_WEAPON;
    this.menu.hide();
    this.connectionPanel.setMode("manual");
    this.connectionPanel.show();
  }

  private openOnlinePanel(localWeapon: WeaponType): void {
    this.onlineMode = "matchmaking";
    this.localP2PWeapon = localWeapon;
    this.fallbackRemoteWeapon = DEFAULT_REMOTE_WEAPON;
    this.menu.hide();
    this.connectionPanel.setMode("matchmaking");
    this.connectionPanel.show();
  }

  private openFriendlyPanel(localWeapon: WeaponType): void {
    this.onlineMode = "friendly";
    this.localP2PWeapon = localWeapon;
    this.fallbackRemoteWeapon = DEFAULT_REMOTE_WEAPON;
    this.menu.hide();
    this.connectionPanel.setMode("friendly");
    this.connectionPanel.show();
  }

  private async createOffer(): Promise<string> {
    this.setupP2P("p1");
    this.state.startDuel("p2p", this.localP2PWeapon, this.fallbackRemoteWeapon);
    return this.requireP2P().createOffer();
  }

  private async createAnswer(offer: string): Promise<string> {
    this.setupP2P("p2");
    this.state.startDuel("p2p", this.fallbackRemoteWeapon, this.localP2PWeapon);
    return this.requireP2P().createAnswerFromOffer(offer);
  }

  private async acceptAnswer(answer: string): Promise<void> {
    await this.requireP2P().acceptAnswer(answer);
  }

  private setupP2P(localPlayerId: PlayerId): void {
    this.closeP2P();
    this.localPlayerId = localPlayerId;
    this.sentReady = false;
    this.stateSync = new StateSync(localPlayerId, this.remotePlayerId(localPlayerId));
    this.p2p = new P2PClient();
    this.p2p.onMessage((message) => this.handleNetMessage(message));
    this.p2p.onStatus((status, detail) => {
      this.state.connectionStatus = status;
      this.connectionPanel.setStatus(detail ? `${status}: ${detail}` : status);
      if (status === "connected") {
        this.trySendReady();
        this.connectionPanel.hide();
        this.scheduleSignalingCleanup();
      }
    });
  }

  private async createFriendlyRoom(): Promise<string> {
    const services = await this.ensureFirebase();
    const uid = await this.ensureFirebaseUser(services);
    const roomService = new FriendlyRoomService(services);
    const room = await roomService.createRoom(uid);
    await this.startSignaledHost("friendlyRooms", room);
    return room.code ?? room.id;
  }

  private async joinFriendlyRoom(codeInput: string): Promise<void> {
    const services = await this.ensureFirebase();
    const uid = await this.ensureFirebaseUser(services);
    const roomService = new FriendlyRoomService(services);
    const room = await roomService.joinRoom(codeInput, uid);
    await this.startSignaledGuest("friendlyRooms", room);
  }

  private async startMatchmaking(): Promise<void> {
    const services = await this.ensureFirebase();
    const uid = await this.ensureFirebaseUser(services);
    this.matchmakingService = new MatchmakingService(services, this.clientSessionId);
    const immediateRoom = await this.matchmakingService.joinQueue(uid);
    if (immediateRoom) {
      await this.startMatchedRoom(immediateRoom, uid);
      return;
    }
    this.connectionPanel.setStatus("Waiting for opponent. Queue joined.");
    this.signalingUnsubs.push(
      this.matchmakingService.watchMatchForPlayer(uid, (room) => {
        void this.startMatchedRoom(room, uid);
      }, (error) => {
        this.connectionPanel.setStatus(`Match listener failed: ${error.message}`);
      }),
    );
    this.startMatchmakingPolling(uid);
  }

  private async cancelMatchmaking(): Promise<void> {
    this.stopMatchmakingPolling();
    await this.matchmakingService?.cancel();
    this.clearSignalingWatchers();
    void this.cleanupActiveSignalingRoom();
    this.activeSignalingRoomId = null;
  }

  private async startSignaledHost(
    collectionName: "friendlyRooms" | "matchRooms",
    room: SignalingRoom,
  ): Promise<void> {
    if (this.activeSignalingRoomId === room.id) {
      return;
    }
    this.stopMatchmakingPolling();
    const services = await this.ensureFirebase();
    this.setupP2P("p1");
    this.activeSignalingRoomId = room.id;
    this.activeSignalingCollection = collectionName;
    this.state.startDuel("p2p", this.localP2PWeapon, this.fallbackRemoteWeapon);
    const signaling = new SignalingService(services, collectionName);
    this.p2p?.onIceCandidate((candidate) => {
      void signaling.addIceCandidate(room.id, "host", candidate);
    });
    this.signalingUnsubs.push(
      signaling.watchCandidates(room.id, "guest", (candidate) => {
        void this.p2p?.addIceCandidate(candidate);
      }),
      signaling.watchRoom(room.id, (updated) => {
        if (updated?.answer) {
          void this.acceptAnswer(JSON.stringify(updated.answer));
        }
      }),
    );
    this.connectionPanel.setStatus(room.code ? `Room created: ${room.code}` : "Exchanging offer");
    const offer = await this.requireP2P().createOffer();
    await signaling.writeOffer(room.id, JSON.parse(offer) as RTCSessionDescriptionInit);
  }

  private async startSignaledGuest(
    collectionName: "friendlyRooms" | "matchRooms",
    room: SignalingRoom,
  ): Promise<void> {
    if (this.activeSignalingRoomId === room.id) {
      return;
    }
    this.stopMatchmakingPolling();
    const services = await this.ensureFirebase();
    this.setupP2P("p2");
    this.activeSignalingRoomId = room.id;
    this.activeSignalingCollection = collectionName;
    this.state.startDuel("p2p", this.fallbackRemoteWeapon, this.localP2PWeapon);
    const signaling = new SignalingService(services, collectionName);
    let answered = false;
    const answerOffer = async (offer: RTCSessionDescriptionInit): Promise<void> => {
      if (answered) {
        return;
      }
      answered = true;
      this.connectionPanel.setStatus("Exchanging answer");
      const answer = await this.requireP2P().createAnswerFromOffer(JSON.stringify(offer));
      await signaling.writeAnswer(room.id, JSON.parse(answer) as RTCSessionDescriptionInit);
    };
    this.p2p?.onIceCandidate((candidate) => {
      void signaling.addIceCandidate(room.id, "guest", candidate);
    });
    this.signalingUnsubs.push(
      signaling.watchCandidates(room.id, "host", (candidate) => {
        void this.p2p?.addIceCandidate(candidate);
      }),
      signaling.watchRoom(room.id, (updated) => {
        if (updated?.offer) {
          void answerOffer(updated.offer);
        }
      }),
    );
    if (room.offer) {
      await answerOffer(room.offer);
    } else {
      this.connectionPanel.setStatus("Exchanging offer");
    }
  }

  private async ensureFirebase(): Promise<FirebaseServices> {
    this.connectionPanel.setStatus("Connecting to Firebase");
    this.firebaseServices = this.firebaseServices ?? getFirebaseServices();
    if (!this.firebaseServices) {
      const missing = getMissingFirebaseEnvKeys();
      const details = missing.length > 0 ? ` Missing: ${missing.join(", ")}` : "";
      throw new Error(`Firebase env is missing. Manual P2P still works.${details}`);
    }
    return this.firebaseServices;
  }

  private async ensureFirebaseUser(services: FirebaseServices): Promise<string> {
    if (this.firebaseUserId) {
      return this.firebaseUserId;
    }
    this.firebaseUserId = await new FirebaseAuthService(services).signInAnonymous();
    return this.firebaseUserId;
  }

  private handleNetMessage(message: NetMessage): void {
    this.stateSync?.handleMessage(message, this.state);
  }

  private trySendReady(): void {
    if (this.sentReady || !this.stateSync) {
      return;
    }
    if (this.p2p?.send(this.stateSync.makeReadyMessage(this.localP2PWeapon))) {
      this.sentReady = true;
    }
  }

  private returnToMenu(): void {
    this.closeP2P();
    this.state.mode = "menu";
    this.state.connectionStatus = "offline";
    this.connectionPanel.hide();
    this.menu.show();
  }

  private closeP2P(): void {
    this.stopMatchmakingPolling();
    void this.cleanupActiveSignalingRoom();
    this.clearSignalingWatchers();
    this.p2p?.close();
    this.p2p = null;
    this.stateSync = null;
    this.sentReady = false;
  }

  private clearSignalingWatchers(): void {
    this.signalingUnsubs.forEach((unsubscribe) => unsubscribe());
    this.signalingUnsubs = [];
  }

  private requireP2P(): P2PClient {
    if (!this.p2p) {
      throw new Error("P2P client is not initialized.");
    }
    return this.p2p;
  }

  private remotePlayerId(localPlayerId = this.localPlayerId): PlayerId {
    return localPlayerId === "p1" ? "p2" : "p1";
  }

  private isHostForRoom(room: SignalingRoom, uid: string): boolean {
    if (room.hostSessionId || room.guestSessionId) {
      return room.hostSessionId === this.clientSessionId;
    }
    return room.hostId === uid;
  }

  private isGuestForRoom(room: SignalingRoom, uid: string): boolean {
    if (room.hostSessionId || room.guestSessionId) {
      return room.guestSessionId === this.clientSessionId;
    }
    return room.guestId === uid;
  }

  private async startMatchedRoom(room: SignalingRoom, uid: string): Promise<void> {
    if (this.isHostForRoom(room, uid)) {
      await this.startSignaledHost("matchRooms", room);
      return;
    }
    if (this.isGuestForRoom(room, uid)) {
      await this.startSignaledGuest("matchRooms", room);
      return;
    }
    this.connectionPanel.setStatus("Matched room ignored: session mismatch.");
  }

  private startMatchmakingPolling(uid: string): void {
    this.stopMatchmakingPolling();
    const poll = async (): Promise<void> => {
      if (!this.matchmakingService || this.activeSignalingRoomId) {
        return;
      }
      try {
        const room = await this.matchmakingService.tryCreateMatch(uid);
        if (room) {
          await this.startMatchedRoom(room, uid);
        }
      } catch (error) {
        this.stopMatchmakingPolling();
        this.connectionPanel.setStatus(
          error instanceof Error ? `Matchmaking failed: ${error.message}` : "Matchmaking failed.",
        );
      }
    };

    this.matchmakingPollId = window.setInterval(() => {
      void poll();
    }, 1500);
  }

  private stopMatchmakingPolling(): void {
    if (this.matchmakingPollId === null) {
      return;
    }
    window.clearInterval(this.matchmakingPollId);
    this.matchmakingPollId = null;
  }

  private scheduleSignalingCleanup(): void {
    const roomId = this.activeSignalingRoomId;
    const collectionName = this.activeSignalingCollection;
    if (!roomId || !collectionName) {
      return;
    }

    const services = this.firebaseServices ?? getFirebaseServices();
    if (services) {
      void new SignalingService(services, collectionName).markConnected(roomId);
    }

    if (this.signalingCleanupTimer !== null) {
      window.clearTimeout(this.signalingCleanupTimer);
    }
    this.signalingCleanupTimer = window.setTimeout(() => {
      void this.cleanupActiveSignalingRoom();
    }, 8000);
  }

  private async cleanupActiveSignalingRoom(): Promise<void> {
    const roomId = this.activeSignalingRoomId;
    const collectionName = this.activeSignalingCollection;
    if (this.signalingCleanupTimer !== null) {
      window.clearTimeout(this.signalingCleanupTimer);
      this.signalingCleanupTimer = null;
    }
    if (!roomId || !collectionName) {
      return;
    }

    this.activeSignalingRoomId = null;
    this.activeSignalingCollection = null;
    this.clearSignalingWatchers();

    const services = this.firebaseServices ?? getFirebaseServices();
    if (!services) {
      return;
    }
    try {
      await new SignalingService(services, collectionName).cleanupRoom(roomId);
    } catch {
      // Cleanup is best effort; stale rooms are also removed by TTL cleanup.
    }
  }

  private getMouseAim(): { x: number; y: number } {
    const pointer = this.input.getPointerClient();
    return this.renderer.screenToWorld(pointer.x, pointer.y);
  }
}
