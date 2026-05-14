import { GROUND_Y, LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../constants";
import { DEFAULT_ARENA } from "../arena/ArenaData";
import { CameraSystem } from "../camera/CameraSystem";
import type { DuelState } from "../state/DuelState";
import type { PlayerId } from "../types";
import { CharacterRenderer } from "./CharacterRenderer";
import { EffectsRenderer } from "./EffectsRenderer";
import { UIRenderer } from "./UIRenderer";
import { WeaponRenderer } from "./WeaponRenderer";
import { WeaponPoseSystem } from "../weapons/WeaponPoseSystem";

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = LOGICAL_WIDTH;
  private height = LOGICAL_HEIGHT;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private readonly camera = new CameraSystem();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    this.ctx = ctx;
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  render(state: DuelState, focusPlayerId: PlayerId, dt: number): void {
    this.resize();
    this.camera.update(state, focusPlayerId, dt);
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#090807";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    this.drawSky(ctx);

    if (state.mode !== "menu") {
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 0.6 : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);
      this.applyCamera(ctx);
      this.drawArena(ctx);
      this.drawDuel(ctx, state);
      ctx.restore();
      UIRenderer.draw(ctx, state);
    } else {
      this.drawTitleBackdrop(ctx);
    }

    ctx.restore();
  }

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    this.resize();
    const logical = {
      x: (clientX - this.offsetX) / this.scale,
      y: (clientY - this.offsetY) / this.scale,
    };
    return this.camera.screenToWorld(logical);
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, window.innerWidth);
    const height = Math.max(240, window.innerHeight);

    if (this.canvas.width !== Math.floor(width * dpr)) {
      this.canvas.width = Math.floor(width * dpr);
    }
    if (this.canvas.height !== Math.floor(height * dpr)) {
      this.canvas.height = Math.floor(height * dpr);
    }
    this.width = width;
    this.height = height;
    this.scale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
    this.offsetX = (width - LOGICAL_WIDTH * this.scale) / 2;
    this.offsetY = (height - LOGICAL_HEIGHT * this.scale) / 2;
  }

  private applyCamera(ctx: CanvasRenderingContext2D): void {
    const origin = this.camera.worldToScreen({ x: 0, y: 0 });
    ctx.translate(origin.x, origin.y);
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    sky.addColorStop(0, "#11100e");
    sky.addColorStop(0.58, "#171410");
    sky.addColorStop(1, "#0c0a08");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  private drawArena(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#17120d";
    ctx.fillRect(
      DEFAULT_ARENA.left - 260,
      GROUND_Y,
      DEFAULT_ARENA.right - DEFAULT_ARENA.left + 520,
      LOGICAL_HEIGHT - GROUND_Y,
    );

    ctx.strokeStyle = "rgba(109, 94, 68, 0.35)";
    ctx.lineWidth = 2;
    for (let x = DEFAULT_ARENA.left - 180; x <= DEFAULT_ARENA.right + 180; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 6);
      ctx.lineTo(x - 26, LOGICAL_HEIGHT);
      ctx.stroke();
    }

    ctx.strokeStyle = "#3f3424";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(DEFAULT_ARENA.left, GROUND_Y + 2);
    ctx.lineTo(DEFAULT_ARENA.right, GROUND_Y + 2);
    ctx.stroke();

    for (let x = DEFAULT_ARENA.left + 220; x < DEFAULT_ARENA.right; x += 360) {
      ctx.fillStyle = "rgba(48, 38, 26, 0.78)";
      ctx.fillRect(x, GROUND_Y - 112, 18, 114);
      ctx.strokeStyle = "rgba(132, 111, 76, 0.32)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 44, GROUND_Y - 78);
      ctx.lineTo(x + 84, GROUND_Y - 68);
      ctx.stroke();
    }

    ctx.fillStyle = "#221b13";
    ctx.fillRect(DEFAULT_ARENA.left - 18, GROUND_Y - 114, 14, 116);
    ctx.fillRect(DEFAULT_ARENA.right + 4, GROUND_Y - 114, 14, 116);
    ctx.strokeStyle = "rgba(124, 105, 72, 0.38)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(DEFAULT_ARENA.left - 10, GROUND_Y - 82);
    ctx.lineTo(DEFAULT_ARENA.left + 120, GROUND_Y - 66);
    ctx.moveTo(DEFAULT_ARENA.right - 120, GROUND_Y - 66);
    ctx.lineTo(DEFAULT_ARENA.right + 10, GROUND_Y - 82);
    ctx.stroke();
  }

  private drawTitleBackdrop(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(55, 43, 27, 0.15)";
    ctx.fillRect(160, GROUND_Y - 20, LOGICAL_WIDTH - 320, 4);
    ctx.fillStyle = "rgba(142, 116, 72, 0.12)";
    ctx.fillRect(LOGICAL_WIDTH / 2 - 90, GROUND_Y - 142, 180, 116);
  }

  private drawDuel(ctx: CanvasRenderingContext2D, state: DuelState): void {
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    const p1Weapon = p1.currentWeapon ?? WeaponPoseSystem.compute(p1);
    const p2Weapon = p2.currentWeapon ?? WeaponPoseSystem.compute(p2);

    this.drawShadow(ctx, p1.x, p1.y);
    this.drawShadow(ctx, p2.x, p2.y);

    const first = p1.x <= p2.x ? p1 : p2;
    const second = first === p1 ? p2 : p1;
    CharacterRenderer.draw(ctx, first, first === p1 ? p1Weapon : p2Weapon);
    WeaponRenderer.draw(ctx, first === p1 ? p1Weapon : p2Weapon);
    CharacterRenderer.draw(ctx, second, second === p1 ? p1Weapon : p2Weapon);
    WeaponRenderer.draw(ctx, second === p1 ? p1Weapon : p2Weapon);
    this.drawDebugHitboxes(ctx, state);

    EffectsRenderer.draw(ctx, state);
  }

  private drawDebugHitboxes(ctx: CanvasRenderingContext2D, state: DuelState): void {
    if (!import.meta.env.DEV) {
      return;
    }
    for (const player of Object.values(state.players)) {
      const kick = CharacterRenderer.computeKickHitbox(player);
      if (!kick) {
        continue;
      }
      ctx.save();
      ctx.strokeStyle = "rgba(120, 190, 255, 0.55)";
      ctx.lineWidth = kick.radius * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(kick.start.x, kick.start.y);
      ctx.lineTo(kick.end.x, kick.end.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 42, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
