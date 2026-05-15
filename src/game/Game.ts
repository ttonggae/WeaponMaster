import { CombatSystem } from "./combat/CombatSystem";
import { ForgeAudio } from "./audio/ForgeAudio";
import { DEFAULT_REMOTE_WEAPON, MAX_DELTA_SECONDS } from "./constants";
import { FirebaseAuthService } from "./firebase/FirebaseAuth";
import {
  getFirebaseServices,
  getMissingFirebaseEnvKeys,
  type FirebaseServices,
} from "./firebase/FirebaseApp";
import { FriendlyRoomService } from "./firebase/FriendlyRoomService";
import { MatchmakingService } from "./firebase/MatchmakingService";
import { RankService } from "./firebase/RankService";
import { SignalingService } from "./firebase/SignalingService";
import { InputManager } from "./input/InputManager";
import { LOCAL_PLAYER_KEYBINDS } from "./input/Keybinds";
import type { NetMessage } from "./net/NetMessages";
import { P2PClient } from "./net/P2PClient";
import type { SignalingRoom } from "./net/SignalingTypes";
import { StateSync } from "./net/StateSync";
import { Renderer } from "./render/Renderer";
import { DuelState } from "./state/DuelState";
import type { AuthProfile, ControlState, MatchType, PlayerId, WeaponType } from "./types";
import { ConnectionPanel } from "./ui/ConnectionPanel";
import { MatchOverlay } from "./ui/MatchOverlay";
import { Menu } from "./ui/Menu";

type Unsubscribe = () => void;

export class Game {
  private readonly state = new DuelState();
  private readonly renderer: Renderer;
  private readonly input = new InputManager();
  private readonly combat = new CombatSystem();
  private readonly menu: Menu;
  private readonly connectionPanel: ConnectionPanel;
  private readonly matchOverlay: MatchOverlay;
  private readonly forgeAudio = new ForgeAudio();
  private readonly clientSessionId = crypto.randomUUID();
  private p2p: P2PClient | null = null;
  private stateSync: StateSync | null = null;
  private localPlayerId: PlayerId = "p1";
  private localP2PWeapon: WeaponType = "longsword";
  private fallbackRemoteWeapon: WeaponType = DEFAULT_REMOTE_WEAPON;
  private sentReady = false;
  private lastTime = performance.now();
  private firebaseServices: FirebaseServices | null = null;
  private authProfile: AuthProfile | null = null;
  private authPromise: Promise<AuthProfile> | null = null;
  private matchmakingService: MatchmakingService | null = null;
  private matchmakingPollId: number | null = null;
  private signalingUnsubs: Unsubscribe[] = [];
  private activeSignalingRoomId: string | null = null;
  private activeSignalingCollection: "friendlyRooms" | "matchRooms" | null = null;
  private signalingCleanupTimer: number | null = null;
  private currentMatchType: MatchType | null = null;
  private rankResultRecorded = false;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.menu = new Menu(uiRoot, {
      onStartRanked: (localWeapon) => void this.startOnlineMatch("ranked", localWeapon),
      onStartCasual: (localWeapon) => void this.startOnlineMatch("casual", localWeapon),
      onOpenFriendly: (localWeapon) => this.openFriendlyPanel(localWeapon),
    });
    this.connectionPanel = new ConnectionPanel(uiRoot, {
      onCreateRoom: () => this.createFriendlyRoom(),
      onJoinRoom: (code) => this.joinFriendlyRoom(code),
      onBack: () => this.returnToMenu(),
    });
    this.matchOverlay = new MatchOverlay(uiRoot, {
      onCancel: () => this.cancelOnlineSearch(),
    });
    this.forgeAudio.setMenuActive(true);

    void this.refreshLeaderboard();
    void this.restoreCachedFirebaseUser();

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
    if (this.state.mode !== "p2p") {
      return;
    }

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
    void this.recordRankResultIfNeeded();

    const drift = stateSync.getDriftWarning();
    if (drift) {
      this.connectionPanel.setStatus(`${this.state.connectionStatus}: ${drift}`);
    }
  }

  private async startOnlineMatch(matchType: "ranked" | "casual", localWeapon: WeaponType): Promise<void> {
    this.currentMatchType = matchType;
    this.localP2PWeapon = localWeapon;
    this.fallbackRemoteWeapon = DEFAULT_REMOTE_WEAPON;
    this.menu.hide();
    this.forgeAudio.setMenuActive(false);
    this.connectionPanel.hide();
    this.matchOverlay.show(
      undefined,
      matchType === "ranked"
        ? "\uB7AD\uD06C \uC0C1\uB300\uB97C \uCC3E\uB294 \uC911\uC785\uB2C8\uB2E4."
        : "\uC77C\uBC18 \uB300\uC804 \uC0C1\uB300\uB97C \uCC3E\uB294 \uC911\uC785\uB2C8\uB2E4.",
    );

    try {
      await this.startMatchmaking(matchType);
    } catch (error) {
      this.matchOverlay.setDetail(
        error instanceof Error
          ? error.message
          : "\uB9E4\uCE6D\uC744 \uC2DC\uC791\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
      );
    }
  }

  private openFriendlyPanel(localWeapon: WeaponType): void {
    this.currentMatchType = "friendly";
    this.localP2PWeapon = localWeapon;
    this.fallbackRemoteWeapon = DEFAULT_REMOTE_WEAPON;
    this.menu.hide();
    this.forgeAudio.setMenuActive(false);
    this.matchOverlay.hide();
    this.connectionPanel.show();
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
        this.matchOverlay.hide();
        this.scheduleSignalingCleanup();
      }
    });
  }

  private async createFriendlyRoom(): Promise<string> {
    const services = await this.ensureFirebase();
    const profile = await this.ensureFirebaseUser(services);
    const roomService = new FriendlyRoomService(services);
    const room = await roomService.createRoom(profile.uid);
    await this.startSignaledHost("friendlyRooms", room);
    return room.code ?? room.id;
  }

  private async joinFriendlyRoom(codeInput: string): Promise<void> {
    const services = await this.ensureFirebase();
    const profile = await this.ensureFirebaseUser(services);
    const roomService = new FriendlyRoomService(services);
    const room = await roomService.joinRoom(codeInput, profile.uid);
    await this.startSignaledGuest("friendlyRooms", room);
  }

  private async startMatchmaking(matchType: "ranked" | "casual"): Promise<void> {
    const services = await this.ensureFirebase();
    const profile = await this.ensureFirebaseUser(services);
    this.matchmakingService = new MatchmakingService(services, this.clientSessionId);
    const immediateRoom = await this.matchmakingService.joinQueue(profile.uid, matchType);
    if (immediateRoom) {
      await this.startMatchedRoom(immediateRoom, profile.uid);
      return;
    }

    this.matchOverlay.setDetail("\uB300\uAE30\uC5F4\uC5D0 \uB4F1\uB85D\uD588\uC2B5\uB2C8\uB2E4. \uC0C1\uB300\uB97C \uCC3E\uB294 \uC911...");
    this.signalingUnsubs.push(
      this.matchmakingService.watchMatchForPlayer(
        profile.uid,
        matchType,
        (room) => {
          void this.startMatchedRoom(room, profile.uid);
        },
        (error) => {
          this.matchOverlay.setDetail(`Matchmaking listener failed: ${error.message}`);
        },
      ),
    );
    this.startMatchmakingPolling(profile.uid, matchType);
  }

  private async cancelMatchmaking(): Promise<void> {
    this.stopMatchmakingPolling();
    await this.matchmakingService?.cancel();
    this.clearSignalingWatchers();
    void this.cleanupActiveSignalingRoom();
    this.activeSignalingRoomId = null;
  }

  private async cancelOnlineSearch(): Promise<void> {
    await this.cancelMatchmaking();
    this.currentMatchType = null;
    this.menu.show();
    this.forgeAudio.setMenuActive(true);
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
    this.currentMatchType = room.matchType ?? this.currentMatchType;
    this.rankResultRecorded = false;
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
    this.matchOverlay.setDetail("Opponent found. Connecting P2P...");
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
    this.currentMatchType = room.matchType ?? this.currentMatchType;
    this.rankResultRecorded = false;
    this.state.startDuel("p2p", this.fallbackRemoteWeapon, this.localP2PWeapon);

    const signaling = new SignalingService(services, collectionName);
    let answered = false;
    const answerOffer = async (offer: RTCSessionDescriptionInit): Promise<void> => {
      if (answered) {
        return;
      }
      answered = true;
      this.connectionPanel.setStatus("Exchanging answer");
      this.matchOverlay.setDetail("Opponent found. Connecting P2P...");
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
      this.matchOverlay.setDetail("Opponent found. Waiting for offer...");
    }
  }

  private async ensureFirebase(): Promise<FirebaseServices> {
    this.connectionPanel.setStatus("Connecting to Firebase");
    this.firebaseServices = this.firebaseServices ?? getFirebaseServices();
    if (!this.firebaseServices) {
      const missing = getMissingFirebaseEnvKeys();
      const details = missing.length > 0 ? ` Missing: ${missing.join(", ")}` : "";
      throw new Error(`Firebase env is missing. Online modes require Firebase config.${details}`);
    }
    return this.firebaseServices;
  }

  private async ensureFirebaseUser(services: FirebaseServices): Promise<AuthProfile> {
    if (this.authProfile) {
      return this.authProfile;
    }

    if (!this.authPromise) {
      this.authPromise = this.signInAndSyncProfile(services);
    }
    return this.authPromise;
  }

  private async restoreCachedFirebaseUser(): Promise<void> {
    const services = getFirebaseServices();
    if (!services) {
      return;
    }

    this.firebaseServices = services;
    try {
      const profile = await new FirebaseAuthService(services).getCachedProfile();
      if (!profile) {
        this.menu.setAccountStatus("Sign in with Google once to save score.");
        return;
      }
      this.authProfile = profile;
      await this.syncRankProfile(profile, services);
    } catch {
      this.menu.setAccountStatus("Google sign-in will retry when online mode starts.");
    }
  }

  private async signInAndSyncProfile(services: FirebaseServices): Promise<AuthProfile> {
    try {
      const profile = await new FirebaseAuthService(services).signInGoogle();
      this.authProfile = profile;
      await this.syncRankProfile(profile, services);
      return profile;
    } catch (error) {
      this.authPromise = null;
      throw error;
    }
  }

  private async syncRankProfile(profile: AuthProfile, services: FirebaseServices): Promise<void> {
    const rankService = new RankService(services);
    const entry = await rankService.ensurePlayerEntry(profile);
    this.menu.setAccountName(profile.displayName);
    this.menu.setPlayerScore(entry);
    this.menu.setLeaderboard(await rankService.getLeaderboard());
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
    this.currentMatchType = null;
    this.rankResultRecorded = false;
    this.connectionPanel.hide();
    this.matchOverlay.hide();
    this.menu.show();
    this.forgeAudio.setMenuActive(true);
    void this.refreshLeaderboard();
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

    this.matchOverlay.setDetail("Matched room ignored: session mismatch.");
  }

  private startMatchmakingPolling(uid: string, matchType: "ranked" | "casual"): void {
    this.stopMatchmakingPolling();
    const poll = async (): Promise<void> => {
      if (!this.matchmakingService || this.activeSignalingRoomId) {
        return;
      }
      try {
        const room = await this.matchmakingService.tryCreateMatch(uid, matchType);
        if (room) {
          await this.startMatchedRoom(room, uid);
        }
      } catch (error) {
        this.stopMatchmakingPolling();
        this.matchOverlay.setDetail(
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

  private async recordRankResultIfNeeded(): Promise<void> {
    if (
      this.rankResultRecorded ||
      this.currentMatchType !== "ranked" ||
      !this.state.winner ||
      !this.authProfile
    ) {
      return;
    }

    this.rankResultRecorded = true;
    const services = this.firebaseServices ?? getFirebaseServices();
    if (!services) {
      return;
    }

    try {
      const entry = await new RankService(services).recordResult(
        this.authProfile,
        this.state.winner === this.localPlayerId,
      );
      this.menu.setPlayerScore(entry);
      await this.refreshLeaderboard();
    } catch {
      // Ranked writes are best-effort until a verified result service exists.
    }
  }

  private async refreshLeaderboard(): Promise<void> {
    const services = this.firebaseServices ?? getFirebaseServices();
    if (!services) {
      return;
    }

    try {
      const rankService = new RankService(services);
      if (this.authProfile) {
        this.menu.setPlayerScore(await rankService.getPlayerEntry(this.authProfile.uid));
      }
      this.menu.setLeaderboard(await rankService.getLeaderboard());
    } catch {
      // Leaderboard read can fail if Firestore rules have not been updated yet.
    }
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
