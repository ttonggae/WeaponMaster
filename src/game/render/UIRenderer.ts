import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PLAYER_MAX_HEALTH,
  PLAYER_MAX_STAMINA,
} from "../constants";
import type { DuelState } from "../state/DuelState";
import type { Language } from "../i18n/Localization";
import { actionLabel, t, weaponLabel } from "../i18n/Localization";
import type { PlayerId } from "../types";
import { clamp } from "../math/geometry";
import { getWeaponData } from "../weapons/weaponData";

export class UIRenderer {
  static draw(ctx: CanvasRenderingContext2D, state: DuelState, language: Language): void {
    this.drawPlayerPanel(ctx, state, "p1", 24, 22, false, language);
    this.drawPlayerPanel(ctx, state, "p2", LOGICAL_WIDTH - 264, 22, true, language);

    ctx.fillStyle = "rgba(10, 9, 7, 0.72)";
    ctx.fillRect(LOGICAL_WIDTH / 2 - 72, 18, 144, 38);
    ctx.strokeStyle = "rgba(190, 170, 130, 0.24)";
    ctx.strokeRect(LOGICAL_WIDTH / 2 - 72, 18, 144, 38);
    ctx.fillStyle = "#cdbd98";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t(language, "onlineDuel"), LOGICAL_WIDTH / 2, 42);

    this.drawBottomInfo(ctx, state, language);

    if (state.winner) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.fillStyle = "#e9dcc0";
      ctx.font = "48px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${state.winner.toUpperCase()} ${t(language, "victory")}`, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#a99b82";
      ctx.fillText(t(language, "postDuel"), LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 34);
    }
  }

  private static drawPlayerPanel(
    ctx: CanvasRenderingContext2D,
    state: DuelState,
    playerId: PlayerId,
    x: number,
    y: number,
    alignRight: boolean,
    language: Language,
  ): void {
    const player = state.players[playerId];
    const weapon = getWeaponData(player.weaponType);
    const panelWidth = 240;

    ctx.fillStyle = "rgba(12, 11, 9, 0.76)";
    ctx.fillRect(x, y, panelWidth, 82);
    ctx.strokeStyle = "rgba(190, 170, 130, 0.22)";
    ctx.strokeRect(x, y, panelWidth, 82);

    ctx.fillStyle = "#e4d8c0";
    ctx.font = "15px sans-serif";
    ctx.textAlign = alignRight ? "right" : "left";
    const textX = alignRight ? x + panelWidth - 12 : x + 12;
    ctx.fillText(`${playerId.toUpperCase()} ${weaponLabel(weapon.type, language)}`, textX, y + 20);

    this.drawBar(ctx, x + 12, y + 31, panelWidth - 24, 12, player.health / PLAYER_MAX_HEALTH, "#7a2f28");
    this.drawBar(
      ctx,
      x + 12,
      y + 50,
      panelWidth - 24,
      10,
      player.stamina / PLAYER_MAX_STAMINA,
      "#b29352",
    );

    ctx.fillStyle = "#a79b84";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${actionLabel(player.action, language)} / angle ${player.weaponAngle.toFixed(1)}`, textX, y + 73);
  }

  private static drawBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
    color: string,
  ): void {
    ctx.fillStyle = "#171410";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * clamp(value, 0, 1), height);
    ctx.strokeStyle = "rgba(220, 200, 160, 0.18)";
    ctx.strokeRect(x, y, width, height);
  }

  private static drawBottomInfo(ctx: CanvasRenderingContext2D, state: DuelState, language: Language): void {
    ctx.fillStyle = "rgba(9, 8, 7, 0.68)";
    ctx.fillRect(22, LOGICAL_HEIGHT - 68, LOGICAL_WIDTH - 44, 44);
    ctx.strokeStyle = "rgba(190, 170, 130, 0.18)";
    ctx.strokeRect(22, LOGICAL_HEIGHT - 68, LOGICAL_WIDTH - 44, 44);

    ctx.fillStyle = "#b9ad94";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      t(language, "controls"),
      36,
      LOGICAL_HEIGHT - 46,
    );
    ctx.fillText(
      t(language, "remoteSync"),
      36,
      LOGICAL_HEIGHT - 30,
    );

    ctx.textAlign = "right";
    ctx.fillText(
      `${t(language, "connection")}: ${state.connectionStatus}`,
      LOGICAL_WIDTH - 36,
      LOGICAL_HEIGHT - 30,
    );
  }
}
