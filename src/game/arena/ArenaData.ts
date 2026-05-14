export interface ArenaData {
  id: string;
  name: string;
  left: number;
  right: number;
  groundY: number;
  cameraMinX: number;
  cameraMaxX: number;
}

export const DEFAULT_ARENA: ArenaData = {
  id: "training-yard",
  name: "Iron Yard",
  left: 120,
  right: 2280,
  groundY: 420,
  cameraMinX: 480,
  cameraMaxX: 1920,
};
