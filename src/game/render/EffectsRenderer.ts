import type { DuelState } from "../state/DuelState";

export class EffectsRenderer {
  static draw(ctx: CanvasRenderingContext2D, state: DuelState): void {
    for (const effect of state.effects) {
      const t = Math.max(0, effect.life / effect.maxLife);
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.15);

      if (effect.type === "hit") {
        this.drawHit(ctx, effect.position.x, effect.position.y, effect.intensity, t);
      } else if (effect.type === "guard") {
        this.drawGuard(ctx, effect.position.x, effect.position.y, effect.intensity, t);
      } else if (effect.type === "parry") {
        this.drawParry(ctx, effect.position.x, effect.position.y, effect.intensity, t);
      } else if (effect.type === "clash") {
        this.drawClash(ctx, effect.position.x, effect.position.y, effect.intensity, t);
      } else if (effect.type === "kick") {
        this.drawKick(ctx, effect.position.x, effect.position.y, effect.intensity, t);
      } else {
        this.drawDust(ctx, effect.position.x, effect.position.y, effect.intensity, t);
      }

      ctx.restore();
    }
  }

  private static drawHit(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    intensity: number,
    t: number,
  ): void {
    ctx.strokeStyle = "#b98d47";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI * 0.8 + i * 0.38;
      const length = (12 + intensity * 5) * t;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(70, 35, 24, 0.55)";
    ctx.fillRect(x - 8 * t, y - 4 * t, 16 * t, 8 * t);
  }

  private static drawGuard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    intensity: number,
    t: number,
  ): void {
    ctx.strokeStyle = "#8d8a79";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, (14 + intensity * 3) * t, -0.8, 0.9);
    ctx.stroke();
    ctx.strokeStyle = "#655640";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9 * t, y + 3);
    ctx.lineTo(x + 12 * t, y - 5);
    ctx.stroke();
  }

  private static drawParry(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    intensity: number,
    t: number,
  ): void {
    ctx.strokeStyle = "#d7c987";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, (10 + intensity * 5) * t, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 16 * t, y + 10 * t);
    ctx.lineTo(x + 16 * t, y - 10 * t);
    ctx.stroke();
  }

  private static drawClash(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    intensity: number,
    t: number,
  ): void {
    ctx.strokeStyle = "#c2b889";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      const inner = 3 * t;
      const outer = (10 + intensity * 4) * t;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      ctx.stroke();
    }
  }

  private static drawKick(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    intensity: number,
    t: number,
  ): void {
    ctx.strokeStyle = "#8a7358";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 14 * t, y + 6 * t);
    ctx.lineTo(x + (14 + intensity * 3) * t, y - 2 * t);
    ctx.stroke();
  }

  private static drawDust(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    intensity: number,
    t: number,
  ): void {
    ctx.fillStyle = "rgba(112, 96, 72, 0.42)";
    ctx.fillRect(x - 8 * t, y - 2, (16 + intensity * 6) * t, 4);
  }
}
