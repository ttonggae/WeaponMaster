import type { ActionState, WeaponDefinition, WeaponType } from "../types";

export type Language = "en" | "ko";

const LANGUAGE_STORAGE_KEY = "weaponmaster.language";

const STRINGS = {
  en: {
    settings: "Settings",
    sound: "Sound",
    language: "Language",
    english: "English",
    korean: "Korean",
    season: "Season",
    subtitle: "Heavy medieval duels built around commitment, distance, stamina, and visible steel.",
    accountAuto: "Google sign-in is restored automatically after the first login.",
    signInOnce: "Sign in with Google once to save score.",
    signInRetry: "Google sign-in will retry when online mode starts.",
    signedInAs: "Signed in as",
    top10: "Season Top 10",
    loadingRankings: "Loading rankings...",
    noRankRecords: "No ranked records yet.",
    scoreNotSignedIn: "Your Score: not signed in",
    scoreLabel: "Your Score",
    winsShort: "W",
    lossesShort: "L",
    loadout: "Loadout",
    loadoutNote: "Weapon is active now. Armor, gear, and passive slots are locked for later seasons.",
    close: "Close",
    currentStats: "Current Stats",
    equipmentType: "Equipment Type",
    weaponSelection: "Weapon Selection",
    weapon: "Weapon",
    usableGear: "Usable Gear",
    armor: "Armor",
    passive: "Passive",
    locked: "Locked",
    available: "Available",
    future: "Future",
    equipped: "Equipped",
    equip: "Equip",
    rankedMatch: "Ranked Match",
    casualMatch: "Casual Match",
    friendlyMatch: "Friendly Match",
    createRoom: "Create Room",
    joinRoom: "Join Room",
    backToMenu: "Back To Menu",
    friendlyHelp: "Create a room code or join with a 6-character code.",
    roomCodeLabel: "6-character Room Code",
    creatingRoom: "Creating room...",
    joiningRoom: "Joining room...",
    roomCreated: "Room created",
    exchangingOffer: "Exchanging offer",
    exchangingAnswer: "Exchanging answer",
    connectingFirebase: "Connecting to Firebase",
    createRoomFailed: "Failed to create room.",
    joinRoomFailed: "Failed to join room.",
    matching: "Finding match...",
    findingOpponent: "Finding an opponent.",
    findingRanked: "Searching for a ranked opponent.",
    findingCasual: "Searching for a casual opponent.",
    queued: "Queued. Searching for an opponent...",
    matchmakingFailed: "Matchmaking failed",
    matchmakingStartFailed: "Could not start matchmaking.",
    connectingP2P: "Connecting P2P",
    opponentFound: "Opponent found. Exchanging connection data.",
    connectionFailed: "Connection failed",
    connectionTimeout: "Connection timed out after matchmaking. Returning to menu.",
    acceptRoomFailed: "Failed to accept the matched room.",
    cancel: "Cancel",
    onlineDuel: "Online Duel",
    victory: "Victory",
    postDuel: "Reload or return to the menu for another duel.",
    controls: "Controls: Mouse aim, LMB attack, RMB guard, R parry, Q feint, F kick, E break, A/D move",
    remoteSync: "Remote fighter is driven by WebRTC input sync",
    connection: "Connection",
    health: "Health",
    stamina: "Stamina",
    moveSpeed: "Move Speed",
    damage: "Damage",
    staminaCost: "Stamina Cost",
    attackSpeed: "Attack Speed",
    range: "Range",
    guardDamage: "Guard Damage",
    stun: "Stun",
    status: "Status",
    charge: "Charge",
    recovery: "Recovery",
    knockback: "Knockback",
    tracking: "Tracking",
    special: "Special",
    seasonLabel: "Season",
  },
  ko: {
    settings: "설정",
    sound: "사운드",
    language: "언어",
    english: "영어",
    korean: "한국어",
    season: "시즌",
    subtitle: "거리, 기력, 심리전, 보이는 강철의 궤적을 중심으로 한 묵직한 중세 결투.",
    accountAuto: "첫 Google 로그인 이후에는 자동으로 계정이 복구됩니다.",
    signInOnce: "점수 저장을 위해 Google 로그인을 한 번 진행하세요.",
    signInRetry: "온라인 모드 시작 시 Google 로그인을 다시 시도합니다.",
    signedInAs: "로그인",
    top10: "시즌 Top 10",
    loadingRankings: "순위 불러오는 중...",
    noRankRecords: "아직 랭크 기록이 없습니다.",
    scoreNotSignedIn: "내 점수: 로그인 필요",
    scoreLabel: "내 점수",
    winsShort: "승",
    lossesShort: "패",
    loadout: "로드아웃",
    loadoutNote: "현재는 무기만 적용됩니다. 갑옷, 사용 장비, 패시브는 이후 시즌에서 해금됩니다.",
    close: "닫기",
    currentStats: "현재 스탯",
    equipmentType: "장비 항목",
    weaponSelection: "무기 선택",
    weapon: "무기",
    usableGear: "사용 장비",
    armor: "갑옷",
    passive: "패시브",
    locked: "잠김",
    available: "사용 가능",
    future: "추후 업데이트",
    equipped: "장착 중",
    equip: "장착",
    rankedMatch: "랭크 매치",
    casualMatch: "일반 매치",
    friendlyMatch: "친선전",
    createRoom: "방 생성",
    joinRoom: "방 참가",
    backToMenu: "메뉴로 돌아가기",
    friendlyHelp: "방 코드를 만들거나 6자리 코드로 참가하세요.",
    roomCodeLabel: "6자리 방 코드",
    creatingRoom: "방 생성 중...",
    joiningRoom: "방 참가 중...",
    roomCreated: "방 생성됨",
    exchangingOffer: "오퍼 교환 중",
    exchangingAnswer: "응답 교환 중",
    connectingFirebase: "Firebase 연결 중",
    createRoomFailed: "방 생성에 실패했습니다.",
    joinRoomFailed: "방 참가에 실패했습니다.",
    matching: "매칭 잡는 중...",
    findingOpponent: "상대를 찾는 중입니다.",
    findingRanked: "랭크 상대를 찾는 중입니다.",
    findingCasual: "일반 대전 상대를 찾는 중입니다.",
    queued: "대기열에 등록했습니다. 상대를 찾는 중...",
    matchmakingFailed: "매칭 실패",
    matchmakingStartFailed: "매칭을 시작하지 못했습니다.",
    connectingP2P: "P2P 연결 중",
    opponentFound: "상대를 찾았습니다. 연결 정보를 교환합니다.",
    connectionFailed: "연결 실패",
    connectionTimeout: "매칭 후 연결이 10초 안에 완료되지 않아 메뉴로 돌아갑니다.",
    acceptRoomFailed: "매칭된 방을 수락하지 못했습니다.",
    cancel: "취소",
    onlineDuel: "온라인 결투",
    victory: "승리",
    postDuel: "다시 결투하려면 새로고침하거나 메뉴로 돌아가세요.",
    controls: "조작: 마우스 조준, 좌클릭 공격, 우클릭 방어, R 패링, Q 페인트, F 발차기, E 가드 브레이크, A/D 이동",
    remoteSync: "상대 전투원은 WebRTC 입력 동기화로 움직입니다",
    connection: "연결",
    health: "체력",
    stamina: "기력",
    moveSpeed: "이동 속도",
    damage: "공격력",
    staminaCost: "기력 소모",
    attackSpeed: "공격 속도",
    range: "사거리",
    guardDamage: "가드 압박",
    stun: "경직",
    status: "상태",
    charge: "차징",
    recovery: "회복",
    knockback: "넉백",
    tracking: "추적 속도",
    special: "특수 효과",
    seasonLabel: "시즌",
  },
} as const;

const WEAPON_LABELS: Record<WeaponType, Record<Language, string>> = {
  longsword: { en: "Longsword", ko: "롱소드" },
  spear: { en: "Spear", ko: "창" },
  axe: { en: "Axe", ko: "도끼" },
  zweihander: { en: "Zweihander", ko: "츠바이헨더" },
};

const WEAPON_DESCRIPTIONS: Record<WeaponType, Record<Language, string>> = {
  longsword: {
    en: "Balanced dueling weapon with average reach, cost, speed, and flexible cut/thrust motion.",
    ko: "사거리, 소모량, 속도가 균형 잡힌 결투용 무기입니다. 베기와 찌르기를 모두 자연스럽게 씁니다.",
  },
  spear: {
    en: "Long reach pressure weapon. Strong at distance, awkward up close, and focused on tip control.",
    ko: "긴 사거리로 압박하는 무기입니다. 거리를 벌리면 강하지만 근접전에서는 다루기 불편합니다.",
  },
  axe: {
    en: "Heavy power weapon. Slow commitment, high damage, strong guard pressure, and heavy recovery.",
    ko: "느리지만 강력한 파워 무기입니다. 피해량과 가드 압박이 높고 회복 동작이 무겁습니다.",
  },
  zweihander: {
    en: "Long two-handed sword. Slower than a longsword, but it controls more space with heavy blade pressure.",
    ko: "긴 양손검입니다. 롱소드보다 느리지만 넓은 공간을 장악하고 묵직한 검신 압박을 줍니다.",
  },
};

const SPECIAL_LABELS: Record<WeaponDefinition["special"], Record<Language, string>> = {
  balanced: { en: "Balanced", ko: "균형형" },
  spearSpacing: { en: "Parry pushback", ko: "패링 밀쳐내기" },
  axeGuardSlow: { en: "Guard slow", ko: "가드 둔화" },
};

const ACTION_LABELS: Record<ActionState, Record<Language, string>> = {
  idle: { en: "Idle", ko: "대기" },
  charge: { en: "Charge", ko: "차징" },
  attack: { en: "Attack", ko: "공격" },
  recovery: { en: "Recovery", ko: "회복" },
  guard: { en: "Guard", ko: "방어" },
  parry: { en: "Parry", ko: "패링" },
  feint: { en: "Feint", ko: "페인트" },
  kick: { en: "Kick", ko: "발차기" },
  guardBreak: { en: "Guard Break", ko: "가드 브레이크" },
  stunned: { en: "Stunned", ko: "기절" },
};

export type TranslationKey = keyof typeof STRINGS.en;

export function t(language: Language, key: TranslationKey): string {
  return STRINGS[language][key] ?? STRINGS.en[key];
}

export function weaponLabel(weaponType: WeaponType, language: Language): string {
  return WEAPON_LABELS[weaponType][language];
}

export function weaponDescription(weaponType: WeaponType, language: Language): string {
  return WEAPON_DESCRIPTIONS[weaponType][language];
}

export function specialLabel(special: WeaponDefinition["special"], language: Language): string {
  return SPECIAL_LABELS[special][language];
}

export function actionLabel(action: ActionState, language: Language): string {
  return ACTION_LABELS[action][language];
}

export function loadLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "ko" || saved === "en") {
      return saved;
    }
  } catch {
    // Default to English if browser storage is unavailable.
  }
  return "en";
}

export function saveLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selected language still applies for the current session.
  }
}
