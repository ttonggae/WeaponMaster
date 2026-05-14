import { BODY } from "../constants";
import type { BodyPart, Segment, Vec2, WeaponPose } from "../types";
import type { PlayerState } from "../state/PlayerState";

export class CharacterRenderer {
  static computeKickHitbox(player: PlayerState): Segment | null {
    if (player.action !== "kick") {
      return null;
    }
    const t = Math.sin(Math.min(1, player.actionTime / 0.24) * Math.PI);
    const foot = {
      x: player.x + player.facing * (34 + 42 + t * 28),
      y: player.y - 1 - 18 * t,
    };
    return {
      start: {
        x: foot.x - player.facing * 18,
        y: foot.y - 2,
      },
      end: {
        x: foot.x + player.facing * 10,
        y: foot.y - 2,
      },
      radius: 10,
    };
  }

  static computeBodyParts(player: PlayerState, weapon?: WeaponPose | null): BodyPart[] {
    const lean = player.visualLean;
    const breath = player.action === "idle" ? Math.sin(player.actionTime * 2.3) * 1.3 : 0;
    const walk = player.moveAxis !== 0 ? Math.sin(player.actionTime * 10) : 0;
    const bob = player.moveAxis !== 0 ? Math.abs(walk) * 2 : 0;
    const torsoBottom: Vec2 = {
      x: player.x - lean * 0.32,
      y: player.y - BODY.legLength + breath * 0.4 - bob,
    };
    const torsoTop: Vec2 = {
      x: player.x + lean,
      y: torsoBottom.y - BODY.torsoLength + breath - bob,
    };
    const shoulderFront: Vec2 = {
      x: torsoTop.x + player.facing * BODY.shoulderWidth * 0.5,
      y: torsoTop.y + 12,
    };
    const shoulderBack: Vec2 = {
      x: torsoTop.x - player.facing * BODY.shoulderWidth * 0.5,
      y: torsoTop.y + 15,
    };
    const hipFront: Vec2 = {
      x: torsoBottom.x + player.facing * BODY.hipWidth * 0.5,
      y: torsoBottom.y,
    };
    const hipBack: Vec2 = {
      x: torsoBottom.x - player.facing * BODY.hipWidth * 0.5,
      y: torsoBottom.y,
    };
    const hand = weapon?.handPosition ?? {
      x: player.x + player.facing * 45,
      y: player.y - 116,
    };
    const offHand = this.computeOffHand(player, shoulderBack, weapon);
    const feet = this.computeFeet(player, hipFront, hipBack, walk);

    return [
      {
        name: "leftLeg",
        segment: this.capsule(hipBack, feet.back, BODY.legRadius),
        color: "#4b4438",
      },
      {
        name: "rightLeg",
        segment: this.capsule(hipFront, feet.front, BODY.legRadius),
        color: "#5a503f",
      },
      {
        name: "torso",
        segment: this.capsule(torsoTop, torsoBottom, BODY.torsoRadius),
        color: player.id === "p1" ? "#554739" : "#4a4d50",
      },
      {
        name: "leftArm",
        segment: this.capsule(shoulderBack, offHand, BODY.armRadius),
        color: "#5f5548",
      },
      {
        name: "rightArm",
        segment: this.capsule(shoulderFront, hand, BODY.armRadius),
        color: "#6b5e4e",
      },
      {
        name: "head",
        segment: this.capsule(
          {
            x: torsoTop.x,
            y: torsoTop.y - BODY.headRadius - 7,
          },
          {
            x: torsoTop.x,
            y: torsoTop.y - BODY.headRadius - 7,
          },
          BODY.headRadius,
        ),
        color: "#b4a083",
      },
    ];
  }

  static draw(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    weapon?: WeaponPose | null,
  ): void {
    const parts = this.computeBodyParts(player, weapon);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const part of parts) {
      if (part.name === "head") {
        this.drawHead(ctx, part.segment, part.color, player.facing);
      } else {
        this.drawBox(ctx, part.segment, part.color, part.name === "torso");
      }
    }

    if (player.counterWindow > 0) {
      ctx.strokeStyle = "rgba(216, 199, 154, 0.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y - 96, 34, -0.5, Math.PI + 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  private static drawBox(
    ctx: CanvasRenderingContext2D,
    segment: Segment,
    color: string,
    isTorso = false,
  ): void {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const length = Math.max(2, Math.hypot(dx, dy));
    const width = segment.radius * 2;
    const midX = (segment.start.x + segment.end.x) / 2;
    const midY = (segment.start.y + segment.end.y) / 2;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = "#1c1813";
    ctx.fillRect(-length / 2 - 2, -width / 2 - 2, length + 4, width + 4);
    ctx.fillStyle = color;
    ctx.fillRect(-length / 2, -width / 2, length, width);
    if (isTorso) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
      ctx.fillRect(-length / 2 + 6, -width / 2, 4, width);
      ctx.fillStyle = "rgba(219, 199, 156, 0.08)";
      ctx.fillRect(-length / 2, -width / 2, length, 4);
    }
    ctx.restore();
  }

  private static drawHead(
    ctx: CanvasRenderingContext2D,
    segment: Segment,
    color: string,
    facing: 1 | -1,
  ): void {
    const size = segment.radius * 2;
    ctx.fillStyle = "#191612";
    ctx.fillRect(segment.start.x - segment.radius - 2, segment.start.y - segment.radius - 2, size + 4, size + 4);

    ctx.fillStyle = color;
    ctx.fillRect(segment.start.x - segment.radius, segment.start.y - segment.radius, size, size);

    ctx.strokeStyle = "#30271c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(segment.start.x + facing * 2, segment.start.y - 3);
    ctx.lineTo(segment.start.x + facing * 12, segment.start.y - 2);
    ctx.stroke();
  }

  private static computeOffHand(
    player: PlayerState,
    shoulder: Vec2,
    weapon?: WeaponPose | null,
  ): Vec2 {
    if (weapon) {
      const offset =
        player.weaponType === "spear" ? 34 : player.weaponType === "axe" ? 22 : 18;
      return {
        x: weapon.handPosition.x - weapon.direction.x * offset,
        y: weapon.handPosition.y - weapon.direction.y * offset,
      };
    }
    return {
      x: shoulder.x + player.facing * 26,
      y: shoulder.y + 40,
    };
  }

  private static computeFeet(
    player: PlayerState,
    hipFront: Vec2,
    hipBack: Vec2,
    walk: number,
  ): { front: Vec2; back: Vec2 } {
    const frontBase = {
      x: player.x + player.facing * 34,
      y: player.y - 1,
    };
    const backBase = {
      x: player.x - player.facing * 30,
      y: player.y - 2,
    };

    if (player.action === "kick") {
      const t = Math.sin(Math.min(1, player.actionTime / 0.24) * Math.PI);
      return {
        front: {
          x: frontBase.x + player.facing * (42 + t * 28),
          y: frontBase.y - 18 * t,
        },
        back: {
          x: backBase.x - player.facing * 12,
          y: backBase.y,
        },
      };
    }

    if (player.action === "guardBreak" || player.action === "attack") {
      const push = player.action === "guardBreak" ? 26 : 16;
      return {
        front: {
          x: frontBase.x + player.facing * push,
          y: frontBase.y,
        },
        back: {
          x: backBase.x - player.facing * 10,
          y: backBase.y,
        },
      };
    }

    if (player.action === "stunned") {
      return {
        front: {
          x: hipFront.x + player.facing * 18,
          y: player.y - 1,
        },
        back: {
          x: hipBack.x - player.facing * 44,
          y: player.y - 2,
        },
      };
    }

    if (player.moveAxis !== 0) {
      return {
        front: {
          x: frontBase.x + player.moveAxis * walk * 12,
          y: frontBase.y - Math.max(0, walk) * 5,
        },
        back: {
          x: backBase.x - player.moveAxis * walk * 12,
          y: backBase.y + Math.min(0, walk) * 5,
        },
      };
    }

    return { front: frontBase, back: backBase };
  }

  private static capsule(start: Vec2, end: Vec2, radius: number): Segment {
    return { start, end, radius };
  }
}
