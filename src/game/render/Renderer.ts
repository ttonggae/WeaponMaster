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
      this.drawForgeBackdrop(ctx, state.time);
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

  private drawForgeBackdrop(ctx: CanvasRenderingContext2D, time: number): void {
    this.drawForgeWall(ctx);
    this.drawForgeFurnace(ctx, time);
    this.drawAnvilAndTools(ctx, time);
    this.drawForgeSparks(ctx, time);
    this.drawForgeVignette(ctx);
  }

  private drawForgeWall(ctx: CanvasRenderingContext2D): void {
    const wall = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    wall.addColorStop(0, "#12110f");
    wall.addColorStop(0.48, "#1a1713");
    wall.addColorStop(1, "#0a0908");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.strokeStyle = "rgba(84, 76, 62, 0.18)";
    ctx.lineWidth = 2;
    for (let y = 72; y < GROUND_Y - 12; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(LOGICAL_WIDTH, y + Math.sin(y * 0.08) * 3);
      ctx.stroke();
    }
    for (let x = 34; x < LOGICAL_WIDTH; x += 92) {
      ctx.beginPath();
      ctx.moveTo(x, 74);
      ctx.lineTo(x + Math.sin(x) * 8, GROUND_Y - 20);
      ctx.stroke();
    }

    ctx.fillStyle = "#17110c";
    ctx.fillRect(0, GROUND_Y - 12, LOGICAL_WIDTH, LOGICAL_HEIGHT - GROUND_Y + 12);
    ctx.strokeStyle = "rgba(118, 96, 62, 0.25)";
    for (let x = 0; x < LOGICAL_WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 2);
      ctx.lineTo(x - 28, LOGICAL_HEIGHT);
      ctx.stroke();
    }
  }

  private drawForgeFurnace(ctx: CanvasRenderingContext2D, time: number): void {
    const pulse = 0.78 + Math.sin(time * 5.2) * 0.1 + Math.sin(time * 12.7) * 0.04;
    const glow = ctx.createRadialGradient(722, 302, 18, 722, 302, 260);
    glow.addColorStop(0, `rgba(255, 205, 92, ${0.72 * pulse})`);
    glow.addColorStop(0.24, `rgba(196, 72, 30, ${0.45 * pulse})`);
    glow.addColorStop(0.72, "rgba(82, 35, 20, 0.18)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(430, 70, 520, 380);

    ctx.fillStyle = "#211b15";
    ctx.fillRect(596, 238, 252, 128);
    ctx.strokeStyle = "#5d4932";
    ctx.lineWidth = 5;
    ctx.strokeRect(596, 238, 252, 128);

    ctx.fillStyle = "#100d0a";
    ctx.beginPath();
    ctx.roundRect(626, 260, 190, 82, 8);
    ctx.fill();

    const inner = ctx.createRadialGradient(722, 310, 8, 722, 310, 100);
    inner.addColorStop(0, "#ffe083");
    inner.addColorStop(0.36, "#d46b2b");
    inner.addColorStop(1, "#341710");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.roundRect(638, 270, 168, 62, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(22, 17, 12, 0.78)";
    ctx.fillRect(568, 366, 310, 22);
    ctx.fillStyle = "#2a2118";
    ctx.fillRect(612, 214, 222, 24);
  }

  private drawAnvilAndTools(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.beginPath();
    ctx.ellipse(294, GROUND_Y + 7, 118, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#242422";
    ctx.fillRect(238, GROUND_Y - 64, 112, 30);
    ctx.fillRect(270, GROUND_Y - 34, 48, 46);
    ctx.fillRect(222, GROUND_Y + 8, 144, 14);
    ctx.fillStyle = "#35352f";
    ctx.beginPath();
    ctx.moveTo(212, GROUND_Y - 64);
    ctx.lineTo(250, GROUND_Y - 82);
    ctx.lineTo(354, GROUND_Y - 82);
    ctx.lineTo(382, GROUND_Y - 62);
    ctx.lineTo(350, GROUND_Y - 50);
    ctx.lineTo(238, GROUND_Y - 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 176, 133, 0.18)";
    ctx.stroke();

    const hammerLift = Math.max(0, Math.sin(time * 4.1));
    ctx.save();
    ctx.translate(252, GROUND_Y - 116 - hammerLift * 18);
    ctx.rotate(-0.58 - hammerLift * 0.22);
    ctx.fillStyle = "#5c4933";
    ctx.fillRect(-4, 0, 8, 92);
    ctx.fillStyle = "#2b2a27";
    ctx.fillRect(-28, -12, 56, 20);
    ctx.restore();

    ctx.strokeStyle = "rgba(117, 101, 75, 0.56)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i += 1) {
      const x = 78 + i * 34;
      ctx.beginPath();
      ctx.moveTo(x, 160);
      ctx.lineTo(x + 18, 356);
      ctx.stroke();
    }
  }

  private drawForgeSparks(ctx: CanvasRenderingContext2D, time: number): void {
    for (let i = 0; i < 42; i += 1) {
      const seed = i * 37.19;
      const cycle = (time * (0.18 + (i % 5) * 0.035) + i * 0.071) % 1;
      const drift = Math.sin(seed) * 60;
      const x = 690 + drift + Math.sin(time * 3.3 + seed) * 18;
      const y = 340 - cycle * (210 + (i % 7) * 18);
      const alpha = Math.sin(cycle * Math.PI) * (0.3 + (i % 4) * 0.08);
      const radius = 1 + (i % 3) * 0.7;
      ctx.fillStyle = `rgba(255, ${150 + (i % 4) * 22}, 58, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawForgeVignette(ctx: CanvasRenderingContext2D): void {
    const shade = ctx.createRadialGradient(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 120, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 560);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(0.72, "rgba(0, 0, 0, 0.18)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.68)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
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
