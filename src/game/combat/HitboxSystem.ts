import { CharacterRenderer } from "../render/CharacterRenderer";
import type { PlayerState } from "../state/PlayerState";
import type { Segment, Vec2, WeaponGeometry } from "../types";
import { capsulesOverlap, segmentMidpoint, segmentSegmentDistance } from "../math/geometry";

export interface WeaponHitResult {
  hit: boolean;
  point: Vec2;
}

export class HitboxSystem {
  weaponSweepHitsPlayer(attacker: PlayerState, defender: PlayerState): WeaponHitResult {
    const current = attacker.currentWeapon;
    if (!current) {
      return { hit: false, point: { x: attacker.x, y: attacker.y } };
    }

    const sweptSegments = this.buildWeaponSweep(attacker.previousWeapon, current, true);
    const bodyParts = CharacterRenderer.computeBodyParts(defender, defender.currentWeapon);

    for (const weaponSegment of sweptSegments) {
      for (const bodyPart of bodyParts) {
        if (capsulesOverlap(weaponSegment, bodyPart.segment)) {
          return {
            hit: true,
            point: segmentMidpoint(weaponSegment),
          };
        }
      }
    }

    return {
      hit: false,
      point: segmentMidpoint(current.strikeZone),
    };
  }

  weaponSweepIntersectsWeapon(attacker: PlayerState, defender: PlayerState): WeaponHitResult {
    const current = attacker.currentWeapon;
    const defenderWeapon = defender.currentWeapon;
    if (!current || !defenderWeapon) {
      return { hit: false, point: { x: attacker.x, y: attacker.y - 90 } };
    }

    const sweptSegments = this.buildWeaponSweep(attacker.previousWeapon, current, true);
    const defenderSegments = this.weaponBlockSegments(defenderWeapon);

    for (const attackSegment of sweptSegments) {
      for (const defenseSegment of defenderSegments) {
        if (capsulesOverlap(attackSegment, defenseSegment)) {
          return {
            hit: true,
            point: {
              x: (segmentMidpoint(attackSegment).x + segmentMidpoint(defenseSegment).x) / 2,
              y: (segmentMidpoint(attackSegment).y + segmentMidpoint(defenseSegment).y) / 2,
            },
          };
        }
      }
    }

    return { hit: false, point: segmentMidpoint(current.strikeZone) };
  }

  weaponsClash(a: PlayerState, b: PlayerState): WeaponHitResult {
    if (!a.currentWeapon?.active || !b.currentWeapon?.active) {
      return { hit: false, point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 90 } };
    }

    const aSegments = this.weaponDamageSegments(a.currentWeapon);
    const bSegments = this.weaponDamageSegments(b.currentWeapon);
    for (const first of aSegments) {
      for (const second of bSegments) {
        if (segmentSegmentDistance(first, second) <= first.radius + second.radius + 4) {
          return {
            hit: true,
            point: {
              x: (segmentMidpoint(first).x + segmentMidpoint(second).x) / 2,
              y: (segmentMidpoint(first).y + segmentMidpoint(second).y) / 2,
            },
          };
        }
      }
    }
    return { hit: false, point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 90 } };
  }

  private buildWeaponSweep(
    previous: WeaponGeometry | null,
    current: WeaponGeometry,
    damageOnly: boolean,
  ): Segment[] {
    const currentSegments = damageOnly
      ? this.weaponDamageSegments(current)
      : this.weaponBlockSegments(current);
    if (!previous) {
      return currentSegments;
    }

    const previousSegments = damageOnly
      ? this.weaponDamageSegments(previous)
      : this.weaponBlockSegments(previous);
    const swept: Segment[] = [...currentSegments, ...previousSegments];

    if (damageOnly && current.previousStrikeZone) {
      swept.push({
        start: current.previousStrikeZone.start,
        end: current.strikeZone.start,
        radius: Math.max(current.previousStrikeZone.radius, current.strikeZone.radius),
      });
      swept.push({
        start: current.previousStrikeZone.end,
        end: current.strikeZone.end,
        radius: Math.max(current.previousStrikeZone.radius, current.strikeZone.radius),
      });
    }

    for (let index = 0; index < currentSegments.length; index += 1) {
      const prev = previousSegments[index] ?? previousSegments[0];
      const curr = currentSegments[index];
      swept.push({
        start: prev.start,
        end: curr.start,
        radius: Math.max(prev.radius, curr.radius),
      });
      swept.push({
        start: prev.end,
        end: curr.end,
        radius: Math.max(prev.radius, curr.radius),
      });
    }

    return swept;
  }

  private weaponDamageSegments(geometry: WeaponGeometry): Segment[] {
    return [geometry.strikeZone];
  }

  private weaponBlockSegments(geometry: WeaponGeometry): Segment[] {
    const segments = [geometry.blockZone];
    if (geometry.guardSegment) {
      segments.push(geometry.guardSegment);
    }
    if (geometry.headSegment) {
      segments.push(geometry.headSegment);
    }
    return segments;
  }
}
