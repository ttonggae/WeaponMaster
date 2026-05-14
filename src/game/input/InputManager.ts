import type { ControlState, KeyBindings, PlayerId, Vec2 } from "../types";

const NEUTRAL: ControlState = {
  aim: { x: 0, y: 0 },
  attackDown: false,
  attackPressed: false,
  guardDown: false,
  parryPressed: false,
  feintPressed: false,
  kickPressed: false,
  guardBreakPressed: false,
  moveAxis: 0,
};

export class InputManager {
  private readonly held = new Set<string>();
  private readonly previous = new Map<PlayerId, ControlState>();
  private pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    leftDown: false,
    rightDown: false,
  };

  constructor(private readonly target: Window = window) {
    this.target.addEventListener("keydown", this.handleKeyDown);
    this.target.addEventListener("keyup", this.handleKeyUp);
    this.target.addEventListener("mousemove", this.handleMouseMove);
    this.target.addEventListener("mousedown", this.handleMouseDown);
    this.target.addEventListener("mouseup", this.handleMouseUp);
    this.target.addEventListener("contextmenu", this.handleContextMenu);
    this.target.addEventListener("blur", this.handleBlur);
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("mousemove", this.handleMouseMove);
    this.target.removeEventListener("mousedown", this.handleMouseDown);
    this.target.removeEventListener("mouseup", this.handleMouseUp);
    this.target.removeEventListener("contextmenu", this.handleContextMenu);
    this.target.removeEventListener("blur", this.handleBlur);
  }

  getControls(
    playerId: PlayerId,
    bindings: KeyBindings,
    aim: Vec2,
    usePointerActions: boolean,
  ): ControlState {
    const previous = this.previous.get(playerId) ?? NEUTRAL;
    const attackDown = usePointerActions
      ? this.pointer.leftDown
      : this.held.has(bindings.attack);
    const guardDown = usePointerActions
      ? this.pointer.rightDown
      : this.held.has(bindings.guard);
    const parryDown = this.held.has(bindings.parry);
    const feintDown = this.held.has(bindings.feint);
    const kickDown = this.held.has(bindings.kick);
    const guardBreakDown = this.held.has(bindings.guardBreak);

    const state: ControlState = {
      aim,
      attackDown,
      attackPressed: attackDown && !previous.attackDown,
      guardDown,
      parryPressed: parryDown && !this.wasPressed(playerId, "parryPressed", bindings.parry),
      feintPressed: feintDown && !this.wasPressed(playerId, "feintPressed", bindings.feint),
      kickPressed: kickDown && !this.wasPressed(playerId, "kickPressed", bindings.kick),
      guardBreakPressed:
        guardBreakDown && !this.wasPressed(playerId, "guardBreakPressed", bindings.guardBreak),
      moveAxis:
        (this.held.has(bindings.moveRight) ? 1 : 0) -
        (this.held.has(bindings.moveLeft) ? 1 : 0),
    };

    this.previous.set(playerId, {
      ...state,
      attackPressed: attackDown,
      parryPressed: parryDown,
      feintPressed: feintDown,
      kickPressed: kickDown,
      guardBreakPressed: guardBreakDown,
    });
    return state;
  }

  getPointerClient(): Vec2 {
    return { x: this.pointer.x, y: this.pointer.y };
  }

  private wasPressed(playerId: PlayerId, key: keyof ControlState, code: string): boolean {
    const previous = this.previous.get(playerId);
    if (!previous) {
      return false;
    }
    return Boolean(previous[key]) && this.held.has(code);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isEditableTarget(event.target)) {
      return;
    }
    if (this.isGameKey(event.code)) {
      event.preventDefault();
    }
    this.held.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.isEditableTarget(event.target) && this.isGameKey(event.code)) {
      event.preventDefault();
    }
    this.held.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.held.clear();
    this.pointer.leftDown = false;
    this.pointer.rightDown = false;
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (this.isEditableTarget(event.target)) {
      return;
    }
    if (event.button === 0) {
      this.pointer.leftDown = true;
      event.preventDefault();
    }
    if (event.button === 2) {
      this.pointer.rightDown = true;
      event.preventDefault();
    }
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.pointer.leftDown = false;
    }
    if (event.button === 2) {
      this.pointer.rightDown = false;
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    if (!this.isEditableTarget(event.target)) {
      event.preventDefault();
    }
  };

  private isGameKey(code: string): boolean {
    return code.startsWith("Key") || code === "Space";
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }
}
