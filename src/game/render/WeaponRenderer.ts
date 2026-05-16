import type { WeaponPose } from "../types";

export class WeaponRenderer {
  static draw(ctx: CanvasRenderingContext2D, pose: WeaponPose): void {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (pose.weaponType === "spear") {
      this.drawSpear(ctx, pose);
    } else if (pose.weaponType === "axe") {
      this.drawAxe(ctx, pose);
    } else if (pose.weaponType === "zweihander") {
      this.drawZweihander(ctx, pose);
    } else {
      this.drawLongsword(ctx, pose);
    }

    this.drawButtStrike(ctx, pose);

    if (pose.guardActive || pose.parryActive) {
      ctx.strokeStyle = pose.parryActive
        ? "rgba(216, 199, 135, 0.58)"
        : "rgba(176, 166, 139, 0.34)";
      ctx.lineWidth = pose.parryActive ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(pose.blockZone.start.x, pose.blockZone.start.y);
      ctx.lineTo(pose.blockZone.end.x, pose.blockZone.end.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  private static drawButtStrike(ctx: CanvasRenderingContext2D, pose: WeaponPose): void {
    if (!pose.active) {
      return;
    }

    const center = {
      x: (pose.strikeZone.start.x + pose.strikeZone.end.x) / 2,
      y: (pose.strikeZone.start.y + pose.strikeZone.end.y) / 2,
    };
    if (Math.hypot(center.x - pose.gripPosition.x, center.y - pose.gripPosition.y) > 34) {
      return;
    }

    ctx.strokeStyle = "rgba(211, 162, 82, 0.82)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pose.strikeZone.start.x, pose.strikeZone.start.y);
    ctx.lineTo(pose.strikeZone.end.x, pose.strikeZone.end.y);
    ctx.stroke();

    ctx.fillStyle = "#2d2419";
    ctx.beginPath();
    ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private static drawLongsword(ctx: CanvasRenderingContext2D, pose: WeaponPose): void {
    const bladeWidth = pose.active ? 6 : 5;
    const shoulder = {
      x: pose.handPosition.x + pose.direction.x * 10,
      y: pose.handPosition.y + pose.direction.y * 10,
    };

    ctx.strokeStyle = "#3b2e1e";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(pose.gripPosition.x, pose.gripPosition.y);
    ctx.lineTo(pose.handPosition.x, pose.handPosition.y);
    ctx.stroke();

    if (pose.guardSegment) {
      ctx.strokeStyle = "#8b7751";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(pose.guardSegment.start.x, pose.guardSegment.start.y);
      ctx.lineTo(pose.guardSegment.end.x, pose.guardSegment.end.y);
      ctx.stroke();
    }

    ctx.fillStyle = pose.active ? "#d8d1c1" : "#aaa292";
    ctx.beginPath();
    ctx.moveTo(shoulder.x + pose.normal.x * bladeWidth, shoulder.y + pose.normal.y * bladeWidth);
    ctx.lineTo(
      pose.bladeEnd.x + pose.normal.x * 2,
      pose.bladeEnd.y + pose.normal.y * 2,
    );
    ctx.lineTo(
      pose.tipPosition.x + pose.direction.x * 8,
      pose.tipPosition.y + pose.direction.y * 8,
    );
    ctx.lineTo(
      pose.bladeEnd.x - pose.normal.x * 2,
      pose.bladeEnd.y - pose.normal.y * 2,
    );
    ctx.lineTo(shoulder.x - pose.normal.x * bladeWidth, shoulder.y - pose.normal.y * bladeWidth);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 246, 220, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(pose.tipPosition.x, pose.tipPosition.y);
    ctx.stroke();

    ctx.fillStyle = "#2d2419";
    ctx.beginPath();
    ctx.arc(pose.gripPosition.x, pose.gripPosition.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private static drawSpear(ctx: CanvasRenderingContext2D, pose: WeaponPose): void {
    ctx.strokeStyle = "#6d5a3d";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pose.gripPosition.x, pose.gripPosition.y);
    ctx.lineTo(pose.bladeStart.x, pose.bladeStart.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(32, 25, 16, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      pose.gripPosition.x + pose.normal.x * 2,
      pose.gripPosition.y + pose.normal.y * 2,
    );
    ctx.lineTo(pose.bladeStart.x + pose.normal.x * 2, pose.bladeStart.y + pose.normal.y * 2);
    ctx.stroke();

    ctx.fillStyle = pose.active ? "#d7d2c4" : "#a9a290";
    ctx.beginPath();
    ctx.moveTo(
      pose.tipPosition.x + pose.direction.x * 10,
      pose.tipPosition.y + pose.direction.y * 10,
    );
    ctx.lineTo(
      pose.bladeStart.x + pose.normal.x * 9,
      pose.bladeStart.y + pose.normal.y * 9,
    );
    ctx.lineTo(pose.bladeStart.x, pose.bladeStart.y);
    ctx.lineTo(
      pose.bladeStart.x - pose.normal.x * 9,
      pose.bladeStart.y - pose.normal.y * 9,
    );
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#696355";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pose.bladeStart.x, pose.bladeStart.y);
    ctx.lineTo(
      pose.tipPosition.x + pose.direction.x * 8,
      pose.tipPosition.y + pose.direction.y * 8,
    );
    ctx.stroke();
  }

  private static drawZweihander(ctx: CanvasRenderingContext2D, pose: WeaponPose): void {
    const bladeWidth = pose.active ? 8 : 7;
    const shoulder = {
      x: pose.handPosition.x + pose.direction.x * 16,
      y: pose.handPosition.y + pose.direction.y * 16,
    };
    const ricasso = {
      x: pose.handPosition.x + pose.direction.x * 28,
      y: pose.handPosition.y + pose.direction.y * 28,
    };

    ctx.strokeStyle = "#332719";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(pose.gripPosition.x, pose.gripPosition.y);
    ctx.lineTo(pose.handPosition.x + pose.direction.x * 6, pose.handPosition.y + pose.direction.y * 6);
    ctx.stroke();

    if (pose.guardSegment) {
      ctx.strokeStyle = "#9a8359";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(pose.guardSegment.start.x, pose.guardSegment.start.y);
      ctx.lineTo(pose.guardSegment.end.x, pose.guardSegment.end.y);
      ctx.stroke();

      ctx.strokeStyle = "#7f6a45";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(
        pose.handPosition.x - pose.normal.x * 13 + pose.direction.x * 14,
        pose.handPosition.y - pose.normal.y * 13 + pose.direction.y * 14,
      );
      ctx.lineTo(
        pose.handPosition.x + pose.normal.x * 13 + pose.direction.x * 14,
        pose.handPosition.y + pose.normal.y * 13 + pose.direction.y * 14,
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "#5d5140";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(ricasso.x, ricasso.y);
    ctx.stroke();

    ctx.fillStyle = pose.active ? "#ded7c7" : "#b5ad9d";
    ctx.beginPath();
    ctx.moveTo(ricasso.x + pose.normal.x * bladeWidth, ricasso.y + pose.normal.y * bladeWidth);
    ctx.lineTo(
      pose.bladeEnd.x + pose.normal.x * 3,
      pose.bladeEnd.y + pose.normal.y * 3,
    );
    ctx.lineTo(
      pose.tipPosition.x + pose.direction.x * 10,
      pose.tipPosition.y + pose.direction.y * 10,
    );
    ctx.lineTo(
      pose.bladeEnd.x - pose.normal.x * 3,
      pose.bladeEnd.y - pose.normal.y * 3,
    );
    ctx.lineTo(ricasso.x - pose.normal.x * bladeWidth, ricasso.y - pose.normal.y * bladeWidth);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 246, 220, 0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ricasso.x, ricasso.y);
    ctx.lineTo(pose.tipPosition.x, pose.tipPosition.y);
    ctx.stroke();

    ctx.fillStyle = "#2d2419";
    ctx.beginPath();
    ctx.arc(pose.gripPosition.x, pose.gripPosition.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private static drawAxe(ctx: CanvasRenderingContext2D, pose: WeaponPose): void {
    ctx.strokeStyle = "#6b573c";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(pose.gripPosition.x, pose.gripPosition.y);
    ctx.lineTo(pose.tipPosition.x, pose.tipPosition.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(28, 21, 14, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pose.gripPosition.x, pose.gripPosition.y);
    ctx.lineTo(pose.tipPosition.x, pose.tipPosition.y);
    ctx.stroke();

    if (!pose.headSegment) {
      return;
    }

    const headCenter = pose.headPosition ?? pose.tipPosition;
    const rear = {
      x: pose.tipPosition.x - pose.direction.x * 23,
      y: pose.tipPosition.y - pose.direction.y * 23,
    };
    const top = {
      x: pose.headSegment.end.x + pose.direction.x * 6,
      y: pose.headSegment.end.y + pose.direction.y * 6,
    };
    const bottom = {
      x: pose.headSegment.start.x + pose.direction.x * 4,
      y: pose.headSegment.start.y + pose.direction.y * 4,
    };

    ctx.fillStyle = pose.active ? "#cfc7b7" : "#958d7c";
    ctx.beginPath();
    ctx.moveTo(rear.x, rear.y);
    ctx.quadraticCurveTo(
      top.x + pose.normal.x * 4,
      top.y + pose.normal.y * 4,
      top.x,
      top.y,
    );
    ctx.lineTo(
      pose.tipPosition.x + pose.direction.x * 4,
      pose.tipPosition.y + pose.direction.y * 4,
    );
    ctx.lineTo(bottom.x, bottom.y);
    ctx.quadraticCurveTo(
      bottom.x - pose.normal.x * 8,
      bottom.y - pose.normal.y * 8,
      rear.x,
      rear.y,
    );
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#625b4f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();

    ctx.fillStyle = "#5e5445";
    ctx.beginPath();
    ctx.arc(headCenter.x - pose.direction.x * 8, headCenter.y - pose.direction.y * 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
