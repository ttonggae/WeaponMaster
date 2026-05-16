export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 540;

export const GROUND_Y = 420;
export const ARENA_LEFT = 120;
export const ARENA_RIGHT = 2280;
export const PLAYER_START_DISTANCE = 340;
export const MIN_PLAYER_DISTANCE = 68;

export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_STAMINA = 100;
export const STAMINA_REGEN_PER_SECOND = 22;
export const EXHAUSTED_STAMINA_THRESHOLD = 18;
export const EXHAUSTED_ACTION_SPEED = 0.72;
export const GUARD_STAMINA_DRAIN_PER_SECOND = 9;

export const MOVE_SPEED = 136;
export const GUARD_MOVE_MULTIPLIER = 0.42;
export const CHARGE_MOVE_MULTIPLIER = 0.55;
export const ATTACK_MOVE_MULTIPLIER = 0.2;
export const STUNNED_MOVE_MULTIPLIER = 0;

export const BODY = {
  headRadius: 15,
  torsoLength: 84,
  torsoRadius: 17,
  shoulderWidth: 46,
  hipWidth: 34,
  armLength: 58,
  armRadius: 6,
  legLength: 78,
  legRadius: 7,
};

export const PARRY_ACTIVE_SECONDS = 0.14;
export const PARRY_TOTAL_SECONDS = 0.34;
export const PARRY_STAMINA_COST = 18;
export const PARRY_DAMAGE_MULTIPLIER = 1.5;
export const FEINT_STAMINA_COST = 10;
export const KICK_SECONDS = 0.38;
export const KICK_ACTIVE_START = 0.13;
export const KICK_ACTIVE_END = 0.23;
export const KICK_RANGE = 58;
export const KICK_STAMINA_COST = 15;
export const KICK_DAMAGE = 3;
export const KICK_KNOCKBACK = 58;
export const KICK_STUN_SECONDS = 0.3;

export const GUARD_BREAK_SECONDS = 0.52;
export const GUARD_BREAK_ACTIVE_START = 0.22;
export const GUARD_BREAK_ACTIVE_END = 0.34;
export const GUARD_BREAK_STAMINA_COST = 30;
export const GUARD_BREAK_GUARD_STUN_SECONDS = 5;
export const GUARD_BREAK_KNOCKBACK = 34;

export const DEFAULT_HITSTOP_SECONDS = 0.055;
export const HEAVY_HITSTOP_SECONDS = 0.08;
export const STATE_SYNC_INTERVAL_FRAMES = 12;
export const MAX_DELTA_SECONDS = 1 / 30;
export const DEFAULT_REMOTE_WEAPON = "longsword";

export const CURRENT_SEASON_ID = "season-1";
export const CURRENT_SEASON_NUMBER = 1;
export const CURRENT_SEASON_NAME = "Test Season";
export const RANK_BASE_SCORE = 1000;
export const RANK_WIN_SCORE = 25;
export const RANK_LOSS_SCORE = 25;
export const LEADERBOARD_LIMIT = 10;
