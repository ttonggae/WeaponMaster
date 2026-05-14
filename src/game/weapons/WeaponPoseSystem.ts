import {
  GUARD_BREAK_ACTIVE_END,
  GUARD_BREAK_ACTIVE_START,
  PARRY_ACTIVE_SECONDS,
} from "../constants";
import { clamp, lerp, lerpAngle, lerpVec2, smoothstep } from "../math/geometry";
import type { PlayerState } from "../state/PlayerState";
import type { Segment, Vec2, WeaponPose } from "../types";
import { getWeaponData } from "./weaponData";

interface PoseIntent {
  angle: number;
  handOffset: Vec2;
}

export class WeaponPoseSystem {
  static compute(player: PlayerState, dt = 0): WeaponPose {
    const data = getWeaponData(player.weaponType);
    const targetIntent = this.computeIntent(player);
    const intent = this.updateVisualIntent(player, targetIntent, dt);
    const handPosition = {
      x: player.x + player.facing * intent.handOffset.x,
      y: player.y + intent.handOffset.y,
    };
    const direction = {
      x: player.facing * Math.cos(intent.angle),
      y: Math.sin(intent.angle),
    };
    const normal = {
      x: -direction.y,
      y: direction.x,
    };
    const gripPosition = {
      x: handPosition.x - direction.x * 16,
      y: handPosition.y - direction.y * 16,
    };
    const tipPosition = {
      x: handPosition.x + direction.x * data.length,
      y: handPosition.y + direction.y * data.length,
    };

    const shaftSegment: Segment = {
      start: gripPosition,
      end: tipPosition,
      radius: this.shaftRadius(player),
    };
    const bladeStart = this.bladeStart(player, handPosition, tipPosition, direction);
    const bladeEnd = tipPosition;
    const bladeSegment: Segment = {
      start: bladeStart,
      end: bladeEnd,
      radius: data.radius,
    };
    const guardSegment = this.guardSegment(player, handPosition, normal);
    const headSegment = this.headSegment(player, tipPosition, direction, normal);
    const strikeZone = this.strikeZone(player, bladeSegment, direction, headSegment);
    const previous = player.previousWeapon;

    return {
      weaponType: player.weaponType,
      handPosition,
      gripPosition,
      direction,
      normal,
      angle: intent.angle,
      length: data.length,
      tipPosition,
      bladeStart,
      bladeEnd,
      shaftSegment,
      bladeSegment,
      blockZone: shaftSegment,
      strikeZone,
      guardSegment,
      headSegment,
      headPosition: headSegment
        ? {
            x: (headSegment.start.x + headSegment.end.x) / 2,
            y: (headSegment.start.y + headSegment.end.y) / 2,
          }
        : undefined,
      previousTipPosition: previous?.tipPosition,
      previousBladeStart: previous?.bladeStart,
      previousBladeEnd: previous?.bladeEnd,
      previousStrikeZone: previous?.strikeZone,
      active: this.isDamageActive(player),
      guardActive: player.action === "guard",
      parryActive: player.action === "parry" && player.actionTime <= PARRY_ACTIVE_SECONDS,
    };
  }

  private static computeIntent(player: PlayerState): PoseIntent {
    if (player.action === "attack") {
      return this.attackIntent(player);
    }
    if (player.action === "charge") {
      return this.chargeIntent(player);
    }
    if (player.action === "recovery") {
      return this.recoveryIntent(player);
    }
    if (player.action === "guard") {
      return {
        angle: player.weaponAngle,
        handOffset: { x: 18, y: -118 },
      };
    }
    if (player.action === "parry") {
      const snap = Math.sin(clamp(player.actionTime / PARRY_ACTIVE_SECONDS, 0, 1) * Math.PI);
      return {
        angle: player.weaponAngle + player.attackSwingSign * snap * 0.32,
        handOffset: { x: 28 + snap * 8, y: -118 - snap * 4 },
      };
    }
    if (player.action === "kick") {
      return {
        angle: player.weaponAngle - 0.22,
        handOffset: { x: 8, y: -108 },
      };
    }
    if (player.action === "guardBreak") {
      const t = smoothstep(clamp(player.actionTime / GUARD_BREAK_ACTIVE_END, 0, 1));
      return {
        angle: player.weaponAngle,
        handOffset: { x: lerp(16, 48, t), y: lerp(-116, -108, t) },
      };
    }
    if (player.action === "stunned") {
      const wobble = Math.sin(player.actionTime * 28) * 0.08;
      return {
        angle: player.weaponAngle - 0.45 + wobble,
        handOffset: { x: -4, y: -100 },
      };
    }
    if (player.action === "feint") {
      return {
        angle: player.weaponAngle - player.attackSwingSign * 0.22,
        handOffset: { x: 12, y: -112 },
      };
    }

    const breath = Math.sin(player.actionTime * 2.3);
    return {
      angle: player.weaponAngle + breath * 0.018,
      handOffset: { x: 22, y: -116 + breath * 1.2 },
    };
  }

  private static updateVisualIntent(
    player: PlayerState,
    target: PoseIntent,
    dt: number,
  ): PoseIntent {
    if (!player.visualPoseReady || dt <= 0) {
      if (!player.visualPoseReady) {
        player.visualPoseAngle = target.angle;
        player.visualHandOffset = { ...target.handOffset };
        player.visualPoseReady = true;
      }
      return {
        angle: player.visualPoseAngle,
        handOffset: player.visualHandOffset,
      };
    }

    const t = clamp(this.poseBlendSpeed(player) * dt, 0, 1);
    player.visualPoseAngle = lerpAngle(player.visualPoseAngle, target.angle, t);
    player.visualHandOffset = lerpVec2(player.visualHandOffset, target.handOffset, t);
    return {
      angle: player.visualPoseAngle,
      handOffset: player.visualHandOffset,
    };
  }

  private static poseBlendSpeed(player: PlayerState): number {
    if (player.action === "attack") {
      return player.weaponType === "axe" ? 18 : player.weaponType === "spear" ? 22 : 24;
    }
    if (player.action === "parry") {
      return 34;
    }
    if (player.action === "charge") {
      return player.weaponType === "axe" ? 8 : player.weaponType === "spear" ? 10 : 11;
    }
    if (player.action === "recovery") {
      return player.weaponType === "axe" ? 6 : 9;
    }
    if (player.action === "guard") {
      return 14;
    }
    if (player.action === "guardBreak") {
      return 10;
    }
    if (player.action === "stunned") {
      return 7;
    }
    return 12;
  }

  private static chargeIntent(player: PlayerState): PoseIntent {
    const data = getWeaponData(player.weaponType);
    const t = smoothstep(clamp(player.actionTime / data.chargeTime, 0, 1));
    if (player.weaponType === "longsword" && player.attackVariant === "thrust") {
      return {
        angle: player.attackBaseAngle,
        handOffset: {
          x: lerp(22, 2, t),
          y: lerp(-116, -115, t),
        },
      };
    }
    const draw =
      player.weaponType === "axe" ? 0.82 : player.weaponType === "spear" ? 0.16 : 0.5;
    const readyY = player.weaponType === "axe" ? -126 : player.weaponType === "spear" ? -112 : -120;
    const readyX = player.weaponType === "spear" ? 4 : -2;
    return {
      angle: player.attackBaseAngle - player.attackSwingSign * draw * t,
      handOffset: {
        x: lerp(22, readyX, t),
        y: lerp(-116, readyY, t),
      },
    };
  }

  private static attackIntent(player: PlayerState): PoseIntent {
    const data = getWeaponData(player.weaponType);
    const motionTime = data.timing.windup + data.timing.active;
    const t = smoothstep(clamp(player.actionTime / motionTime, 0, 1));

    if (player.weaponType === "spear") {
      return {
        angle: player.attackBaseAngle,
        handOffset: { x: lerp(4, 62, t), y: lerp(-112, -110, t) },
      };
    }
    if (player.weaponType === "axe") {
      return {
        angle:
          player.attackBaseAngle +
          lerp(-player.attackSwingSign * 1.06, player.attackSwingSign * 0.9, t),
        handOffset: { x: lerp(-4, 38, t), y: lerp(-126, -108, t) },
      };
    }
    if (player.weaponType === "longsword" && player.attackVariant === "thrust") {
      return {
        angle: player.attackBaseAngle,
        handOffset: { x: lerp(2, 58, t), y: lerp(-115, -112, t) },
      };
    }
    const swingStart =
      player.attackVariant === "overhead" ? -player.attackSwingSign * 0.92 : -player.attackSwingSign * 0.68;
    const swingEnd =
      player.attackVariant === "upswing" ? player.attackSwingSign * 0.92 : player.attackSwingSign * 0.78;
    return {
      angle:
        player.attackBaseAngle +
        lerp(swingStart, swingEnd, t),
      handOffset: { x: lerp(4, 36, t), y: lerp(-120, -110, t) },
    };
  }

  private static recoveryIntent(player: PlayerState): PoseIntent {
    const t = smoothstep(
      player.recoverySeconds > 0 ? clamp(player.actionTime / player.recoverySeconds, 0, 1) : 1,
    );
    const drop = player.weaponType === "axe" ? 0.5 : 0.28;
    return {
      angle: player.weaponAngle + player.attackSwingSign * lerp(drop, 0, t),
      handOffset: {
        x: lerp(36, 22, t),
        y: lerp(-104, -116, t),
      },
    };
  }

  private static bladeStart(
    player: PlayerState,
    handPosition: Vec2,
    tipPosition: Vec2,
    direction: Vec2,
  ): Vec2 {
    if (player.weaponType === "spear") {
      return {
        x: tipPosition.x - direction.x * 28,
        y: tipPosition.y - direction.y * 28,
      };
    }
    if (player.weaponType === "axe") {
      return {
        x: tipPosition.x - direction.x * 22,
        y: tipPosition.y - direction.y * 22,
      };
    }
    return {
      x: handPosition.x + direction.x * 12,
      y: handPosition.y + direction.y * 12,
    };
  }

  private static guardSegment(
    player: PlayerState,
    handPosition: Vec2,
    normal: Vec2,
  ): Segment | undefined {
    if (player.weaponType !== "longsword") {
      return undefined;
    }
    return {
      start: {
        x: handPosition.x - normal.x * 17,
        y: handPosition.y - normal.y * 17,
      },
      end: {
        x: handPosition.x + normal.x * 17,
        y: handPosition.y + normal.y * 17,
      },
      radius: 4,
    };
  }

  private static headSegment(
    player: PlayerState,
    tipPosition: Vec2,
    direction: Vec2,
    normal: Vec2,
  ): Segment | undefined {
    if (player.weaponType === "spear") {
      return {
        start: {
          x: tipPosition.x - direction.x * 24,
          y: tipPosition.y - direction.y * 24,
        },
        end: {
          x: tipPosition.x + direction.x * 8,
          y: tipPosition.y + direction.y * 8,
        },
        radius: 8,
      };
    }
    if (player.weaponType !== "axe") {
      return undefined;
    }
    return {
      start: {
        x: tipPosition.x - direction.x * 10 - normal.x * 20,
        y: tipPosition.y - direction.y * 10 - normal.y * 20,
      },
      end: {
        x: tipPosition.x - direction.x * 4 + normal.x * 22,
        y: tipPosition.y - direction.y * 4 + normal.y * 22,
      },
      radius: 11,
    };
  }

  private static strikeZone(
    player: PlayerState,
    bladeSegment: Segment,
    direction: Vec2,
    headSegment?: Segment,
  ): Segment {
    if (player.weaponType === "longsword") {
      if (player.attackVariant === "thrust" && player.action === "attack") {
        return {
          start: {
            x: bladeSegment.end.x - direction.x * 42,
            y: bladeSegment.end.y - direction.y * 42,
          },
          end: bladeSegment.end,
          radius: bladeSegment.radius + 2,
        };
      }
      return bladeSegment;
    }
    if (headSegment) {
      return headSegment;
    }
    return bladeSegment;
  }

  private static shaftRadius(player: PlayerState): number {
    if (player.weaponType === "longsword") {
      return 3;
    }
    if (player.weaponType === "spear") {
      return 4;
    }
    return 5;
  }

  private static isDamageActive(player: PlayerState): boolean {
    if (player.action === "guardBreak") {
      return (
        player.actionTime >= GUARD_BREAK_ACTIVE_START &&
        player.actionTime <= GUARD_BREAK_ACTIVE_END
      );
    }
    if (player.action !== "attack") {
      return false;
    }
    const data = getWeaponData(player.weaponType);
    return (
      player.actionTime >= data.timing.windup &&
      player.actionTime <= data.timing.windup + data.timing.active
    );
  }
}
