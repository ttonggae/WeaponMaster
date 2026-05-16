import { CombatSystem } from "./combat/CombatSystem";
import { GameAudio } from "./audio/GameAudio";
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
import type { Language } from "./i18n/Localization";
import { loadLanguage, saveLanguage, t } from "./i18n/Localization";
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
import { SettingsPanel } from "./ui/SettingsPanel";

type Unsubscribe = () => void;

export class Game {
  private readonly state = new DuelState();
  private readonly renderer: Renderer;
  private readonly input = new InputManager();
  private readonly combat = new CombatSystem();
  private readonly menu: Menu;
  private readonly connectionPanel: ConnectionPanel;
  private readonly matchOverlay: MatchOverlay;
  private readonly settingsPanel: SettingsPanel;
  private readonly audio = new GameAudio();
  private readonly clientSessionId = crypto.randomUUID();
  private language: Language = loadLanguage();
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
  private matchmakingUnsubs: Unsubscribe[] = [];
  private signalingUnsubs: Unsubscribe[] = [];
  private acceptedSignalingRoomId: string | null = null;
  private activeSignalingRoomId: string | null = null;
  private activeSignalingCollection: "friendlyRooms" | "matchRooms" | null = null;
  private signalingCleanupTimer: number | null = null;
  private p2pConnectTimeoutId: number | null = null;
  private duelStartedForConnection = false;
  private currentMatchType: MatchType | null = null;
  private rankResultRecorded = false;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.setLanguage(this.language);
    this.menu = new Menu(uiRoot, {
      onStartRanked: (localWeapon) => void this.startOnlineMatch("ranked", localWeapon),
      onStartCasual: (localWeapon) => void this.startOnlineMatch("casual", localWeapon),
      onOpenFriendly: (localWeapon) => this.openFriendlyPanel(localWeapon),
    }, this.language);
    this.connectionPanel = new ConnectionPanel(uiRoot, {
      onCreateRoom: () => this.createFriendlyRoom(),
      onJoinRoom: (code) => this.joinFriendlyRoom(code),
      onBack: () => this.returnToMenu(),
    }, this.language);
    this.matchOverlay = new MatchOverlay(uiRoot, {
      onCancel: () => this.cancelOnlineSearch(),
    }, this.language);
    this.settingsPanel = new SettingsPanel(uiRoot, {
      initialVolume: this.audio.getVolumePercent(),
      initialLanguage: this.language,
      onVolumeChange: (volumePercent) => this.audio.setVolumePercent(volumePercent),
      onLanguageChange: (language) => this.setLanguage(language),
    });
    this.audio.setMenuActive(true);

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
    this.audio.playCombatActions([this.state.players.p1, this.state.players.p2]);
    this.audio.playNewEffects(this.state.effects);
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
    this.audio.setMenuActive(false);
    this.audio.setGameActive(true);
    this.connectionPanel.hide();
    this.matchOverlay.show(
      undefined,
      matchType === "ranked"
        ? t(this.language, "findingRanked")
        : t(this.language, "findingCasual"),
    );

    try {
      await this.startMatchmaking(matchType);
    } catch (error) {
      this.matchOverlay.show(
        t(this.language, "matchmakingFailed"),
        error instanceof Error
          ? error.message
          : t(this.language, "matchmakingStartFailed"),
        true,
      );
    }
  }

  private openFriendlyPanel(localWeapon: WeaponType): void {
    this.currentMatchType = "friendly";
    this.localP2PWeapon = localWeapon;
    this.fallbackRemoteWeapon = DEFAULT_REMOTE_WEAPON;
    this.menu.hide();
    this.audio.setMenuActive(false);
    this.audio.setGameActive(true);
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
    this.duelStartedForConnection = false;
    this.stateSync = new StateSync(localPlayerId, this.remotePlayerId(localPlayerId));
    this.p2p = new P2PClient();
    this.p2p.onMessage((message) => this.handleNetMessage(message));
    this.p2p.onStatus((status, detail) => {
      this.state.connectionStatus = status;
      this.connectionPanel.setStatus(detail ? `${status}: ${detail}` : status);
      if (status === "connected") {
        this.clearP2PConnectTimeout();
        this.beginConnectedDuel();
        this.trySendReady();
        this.connectionPanel.hide();
        this.matchOverlay.hide();
        this.scheduleSignalingCleanup();
      } else if (status === "error") {
        void this.handleP2PConnectionFailure(detail ?? "WebRTC connection failed.");
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

    this.matchOverlay.setDetail(t(this.language, "queued"));
    this.matchmakingUnsubs.push(
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
    this.clearMatchmakingWatchers();
    this.clearSignalingWatchers();
    void this.cleanupActiveSignalingRoom();
    this.acceptedSignalingRoomId = null;
    this.activeSignalingRoomId = null;
  }

  private async cancelOnlineSearch(): Promise<void> {
    await this.cancelMatchmaking();
    this.currentMatchType = null;
    this.menu.show();
    this.audio.setGameActive(false);
    this.audio.setMenuActive(true);
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
    this.startP2PConnectTimeout(collectionName);
    this.matchOverlay.setCancelable(false);
    if (collectionName === "matchRooms") {
      this.matchOverlay.show(t(this.language, "connectingP2P"), t(this.language, "opponentFound"), false);
    } else {
      this.matchOverlay.hide();
    }

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

    this.connectionPanel.setStatus(room.code ? `${t(this.language, "roomCreated")}: ${room.code}` : t(this.language, "exchangingOffer"));
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
    this.startP2PConnectTimeout(collectionName);
    this.matchOverlay.setCancelable(false);
    if (collectionName === "matchRooms") {
      this.matchOverlay.show(t(this.language, "connectingP2P"), t(this.language, "opponentFound"), false);
    } else {
      this.matchOverlay.hide();
    }

    const signaling = new SignalingService(services, collectionName);
    let answered = false;
    const answerOffer = async (offer: RTCSessionDescriptionInit): Promise<void> => {
      if (answered) {
        return;
      }
      answered = true;
      this.connectionPanel.setStatus(t(this.language, "exchangingAnswer"));
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
      this.connectionPanel.setStatus(t(this.language, "exchangingOffer"));
    }
  }

  private async ensureFirebase(): Promise<FirebaseServices> {
    this.connectionPanel.setStatus(t(this.language, "connectingFirebase"));
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
        this.menu.setAccountStatus(t(this.language, "signInOnce"));
        return;
      }
      this.authProfile = profile;
      await this.syncRankProfile(profile, services);
    } catch {
      this.menu.setAccountStatus(t(this.language, "signInRetry"));
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
    this.acceptedSignalingRoomId = null;
    this.connectionPanel.hide();
    this.matchOverlay.hide();
    this.menu.show();
    this.audio.setGameActive(false);
    this.audio.setMenuActive(true);
    void this.refreshLeaderboard();
  }

  private closeP2P(): void {
    this.clearP2PConnectTimeout();
    this.stopMatchmakingPolling();
    this.clearMatchmakingWatchers();
    void this.cleanupActiveSignalingRoom();
    this.clearSignalingWatchers();
    this.p2p?.close();
    this.p2p = null;
    this.stateSync = null;
    this.sentReady = false;
    this.duelStartedForConnection = false;
  }

  private clearSignalingWatchers(): void {
    this.signalingUnsubs.forEach((unsubscribe) => unsubscribe());
    this.signalingUnsubs = [];
  }

  private clearMatchmakingWatchers(): void {
    this.matchmakingUnsubs.forEach((unsubscribe) => unsubscribe());
    this.matchmakingUnsubs = [];
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
    if (this.acceptedSignalingRoomId) {
      return;
    }

    this.acceptedSignalingRoomId = room.id;
    this.stopMatchmakingPolling();
    this.clearMatchmakingWatchers();
    this.matchOverlay.setCancelable(false);
    this.matchOverlay.hide();

    try {
      if (this.isHostForRoom(room, uid)) {
        await this.startSignaledHost("matchRooms", room);
        return;
      }
      if (this.isGuestForRoom(room, uid)) {
        await this.startSignaledGuest("matchRooms", room);
        return;
      }
      throw new Error("Matched room ignored: session mismatch.");
    } catch (error) {
      this.acceptedSignalingRoomId = null;
      this.closeP2P();
      this.currentMatchType = null;
      this.rankResultRecorded = false;
      this.state.mode = "menu";
      this.state.connectionStatus = "error";
      this.connectionPanel.hide();
      this.matchOverlay.show(
        t(this.language, "connectionFailed"),
        error instanceof Error ? error.message : t(this.language, "acceptRoomFailed"),
        true,
      );
      this.menu.show();
      this.audio.setGameActive(false);
      this.audio.setMenuActive(true);
    }
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
          error instanceof Error ? `${t(this.language, "matchmakingFailed")}: ${error.message}` : t(this.language, "matchmakingFailed"),
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

  private beginConnectedDuel(): void {
    if (this.duelStartedForConnection || !this.stateSync) {
      return;
    }

    this.duelStartedForConnection = true;
    const remoteWeapon = this.stateSync.getRemoteWeapon() ?? this.fallbackRemoteWeapon;
    if (this.localPlayerId === "p1") {
      this.state.startDuel("p2p", this.localP2PWeapon, remoteWeapon);
    } else {
      this.state.startDuel("p2p", remoteWeapon, this.localP2PWeapon);
    }
  }

  private async handleP2PConnectionFailure(detail: string): Promise<void> {
    if (!this.activeSignalingRoomId && !this.acceptedSignalingRoomId) {
      return;
    }

    this.closeP2P();
    this.acceptedSignalingRoomId = null;
    this.currentMatchType = null;
    this.rankResultRecorded = false;
    this.state.mode = "menu";
    this.state.connectionStatus = "error";
    this.connectionPanel.hide();
    this.menu.show();
    this.audio.setGameActive(false);
    this.audio.setMenuActive(true);
    this.matchOverlay.show(t(this.language, "connectionFailed"), detail, true);
  }

  private startP2PConnectTimeout(collectionName: "friendlyRooms" | "matchRooms"): void {
    this.clearP2PConnectTimeout();
    if (collectionName !== "matchRooms") {
      return;
    }

    this.p2pConnectTimeoutId = window.setTimeout(() => {
      if (this.state.connectionStatus === "connected" || this.duelStartedForConnection) {
        return;
      }
      void this.handleP2PConnectionFailure(t(this.language, "connectionTimeout"));
    }, 10000);
  }

  private clearP2PConnectTimeout(): void {
    if (this.p2pConnectTimeoutId === null) {
      return;
    }
    window.clearTimeout(this.p2pConnectTimeoutId);
    this.p2pConnectTimeoutId = null;
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

  private setLanguage(language: Language): void {
    this.language = language;
    saveLanguage(language);
    this.renderer.setLanguage(language);
    this.menu.setLanguage(language);
    this.connectionPanel.setLanguage(language);
    this.matchOverlay.setLanguage(language);
    this.settingsPanel.setLanguage(language);
  }

  private getMouseAim(): { x: number; y: number } {
    const pointer = this.input.getPointerClient();
    return this.renderer.screenToWorld(pointer.x, pointer.y);
  }
}
