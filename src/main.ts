import "./style.css";
import { Game } from "./game/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const uiRoot = document.querySelector<HTMLDivElement>("#ui-root");

if (!canvas || !uiRoot) {
  throw new Error("WeaponMaster failed to find required DOM roots.");
}

const game = new Game(canvas, uiRoot);
game.start();
