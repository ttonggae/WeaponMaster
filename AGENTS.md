# WeaponMaster Agent Guide

## Project Structure

- `index.html`: Canvas and UI root.
- `src/main.ts`: Browser entry point.
- `src/style.css`: Global layout, menu, connection panel, and matchmaking overlay styles.
- `src/game/Game.ts`: Main loop, mode switching, WebRTC setup, Firebase matchmaking flow, and ranked result routing.
- `src/game/constants.ts`: Named gameplay, rank, and render constants. Avoid unexplained magic numbers elsewhere.
- `src/game/types.ts`: Shared gameplay, geometry, input, weapon, effect, auth, ranking, and network-facing types.
- `src/game/state/`: Duel and player state containers.
- `src/game/audio/`: Procedural Web Audio ambience and effects.
- `src/game/combat/`: Combat orchestration plus stamina, guard, parry, and hitbox systems.
- `src/game/arena/`: Arena data and movement bounds.
- `src/game/camera/`: World/screen camera transform and follow logic.
- `src/game/weapons/`: Weapon definitions, tuning, and shared weapon pose system.
- `src/game/input/`: Keyboard/mouse state and configurable keybinds.
- `src/game/render/`: Canvas renderers. Rendering must consume the same weapon pose data used by hit detection.
- `src/game/net/`: WebRTC DataChannel, message types, signaling types, and state sync.
- `src/game/firebase/`: Firebase app init, Google auth, matchmaking, friendly rooms, signaling, room codes, and rank service.
- `src/game/ui/`: DOM menu, weapon selection, friendly room panel, and matchmaking overlay.
- `src/game/i18n/`: English/Korean UI text, action labels, weapon labels, and local language persistence.

## Run Commands

```bash
npm install
npm run dev
```

## Build Command

```bash
npm run build
```

## Test and Verification

Run these after meaningful changes:

```bash
npm install
npm run dev
npm run build
```

Manual checks:

- The menu exposes exactly three modes: Ranked Match, Casual Match, Friendly Match.
- The menu shows the current season number/name and a procedural forge background.
- Menu title/season must stay top-left, Top 10 plus personal score top-right, and match controls bottom-center.
- Loadout opens as a centered large box from a button above the match controls.
- Loadout columns must read left-to-right as character/stats, equipment category, selected category item choices, and selected item details/equip action.
- UI text must wrap or truncate inside panels/buttons instead of spilling outside boxes.
- Menu audio uses short forge crackle/hammer events without a continuous drone.
- Bottom-left Settings controls global sound volume, with 50% mapped to three times the original MVP output.
- Bottom-left Settings controls English/Korean language mode and must persist the choice locally.
- In-game action and impact sounds apply an extra 1.5x multiplier over the shared Settings volume.
- In-game action changes and impact effects produce matching procedural sound effects.
- Ranked/Casual immediately start matchmaking and show the centered matchmaking overlay.
- Matchmaking cancel must only be available while actively searching, not after a room has been accepted.
- Matchmaking must ignore stale rooms from older sessions and must not enter the duel until WebRTC DataChannel connection is established.
- Friendly Match opens only the 6-character room-code panel.
- Google sign-in starts when entering an online mode.
- Season Top 10 renders when Firebase/Firestore rules are configured.
- The local player's stored score starts at 1000 and is visible after Google auth.
- Matchmaking UI and friendly panel hide after WebRTC connects.
- Both fighters are visible after connection.
- Longsword, spear, axe, and zweihander can be selected for the local player.
- The arena is wider than the viewport and the camera follows the local player smoothly.
- Mouse aim remains accurate after the camera moves.
- Health and stamina change correctly.
- Attack, guard, parry, feint, guard break, guard impact, and kick work.
- Hit, guard, parry, and weapon clash effects are visually distinct.
- Ranked match completion writes one local result and refreshes the leaderboard.

## Coding Rules

- Keep TypeScript `strict` clean.
- Keep gameplay logic, rendering, input, network, weapon data, combat rules, Firebase services, ranking, and UI separated.
- Prefer small modules with explicit data flow over hidden globals.
- Put tunable numbers in `constants.ts` or `weaponData.ts`.
- Use short comments only for non-obvious decisions.
- Do not add external art assets for the MVP.
- Do not add external audio assets for menu ambience unless explicitly requested.
- Do not use a continuous menu oscillator that creates a steady buzzing tone.
- Do not bypass the shared `GameAudio` master volume path for new sounds.
- Do not hardcode new user-facing UI text directly in menus/HUD when it belongs in `src/game/i18n/Localization.ts`.
- Keep characters as head, torso, left/right arm, and left/right leg only. No elbow or knee joint model.

## Combat Hit Rules

- The visible weapon is the source of truth.
- Combat, hit detection, and weapon pose use world coordinates. Only `Renderer`/`CameraSystem` convert to screen coordinates.
- `WeaponPoseSystem` calculates the weapon hand position, direction, fixed length, tip, blade, head, strike zone, block zone, and previous-frame strike data.
- `CharacterRenderer`, `WeaponRenderer`, and `HitboxSystem` must consume that same `WeaponPose` from player state.
- Mouse distance must never shorten or lengthen the weapon; it only determines target direction.
- Weapon damage is active only during the attack active window.
- Weapon sweep uses previous-frame and current-frame weapon positions.
- Guard succeeds when the incoming attack sweep intersects the defender's visible guarding weapon.
- Parry succeeds only during the short parry window when the incoming attack sweep intersects the defender's visible parry weapon, then counters for 1.5x defender weapon damage.
- Feint is allowed only during attack charge and must return directly to idle with smooth pose blending and no recovery lockout.
- Guard break uses the visible weapon grip/shaft strike zone, only affects guarding opponents, applies a 5 second breakable stun, and should start quickly enough to be usable while still being readable.
- Guard break stun must clear immediately when the stunned player is hit by an attack.
- Kick is primarily a spacing/knockback action, not a high-damage tool.
- Kick hit detection must use the rendered extended leg/foot position, not torso center distance.

## Network Sync Rules

- Ranked, casual, and friendly room setup use Firebase for identity, queue/room metadata, and WebRTC signaling.
- Combat input and core state sync must use WebRTC DataChannel first.
- Firebase must not be treated as a combat authority server.
- Firebase config must come from environment variables or local config, never hardcoded secrets.
- Google auth is used instead of anonymous auth for stable player identity.
- There is no full server authority in the MVP.
- Each peer simulates from local and remote input snapshots.
- Peers exchange periodic checksums and compact core-state snapshots.
- Large drift may be corrected for the remote-controlled player.
- Queue watchers and signaling watchers should stay separate so accepting a room cannot trigger repeated match handling.
- Matchmaking uses per-browser session ids for pairing; do not reject a candidate only because the Google uid is the same.
- WebRTC ICE candidates may arrive before SDP remote descriptions; queue them instead of dropping them.
- Perfect cheat prevention is not possible in this architecture; keep validation and checksums explicit so future server authority, Cloud Functions validation, or rollback can be added.

## Ranking Rules

- `CURRENT_SEASON_ID` in `constants.ts` selects the active season.
- `CURRENT_SEASON_NUMBER` and `CURRENT_SEASON_NAME` define the menu-facing season label.
- Ranked wins add 25 score and ranked losses subtract 25 score.
- Personal score is stored under `rankScores/{seasonId}/players/{uid}`.
- Public leaderboard records are stored under `rankings/{seasonId}/players/{uid}`.
- Leaderboard queries only the top 10 records for the active season.
- Records below top 10 may be deleted from `rankings`; do not delete personal score docs for this reason.
- Client-side rank writes are MVP-only and must stay isolated for future trusted validation.

## Forbidden

- Do not collapse the project into a single giant file.
- Do not scatter temporary hardcoding through core systems.
- Do not use unexplained magic numbers.
- Do not let rendered weapon position and hit detection diverge.
- Do not turn the game into a fast, light arcade fighter.
- Do not introduce complex jointed character animation for the MVP.
- Do not make P2P work by destabilizing core combat.
- Do not reintroduce anonymous identity for ranked records.

## Done Criteria

- `npm install` succeeds.
- `npm run dev` starts Vite.
- `npm run build` succeeds.
- Menu shows only Ranked Match, Casual Match, Friendly Match.
- Menu shows active season number/name.
- Menu has procedural forge visuals and menu-only forge event audio.
- Menu positions title/season, Top 10, personal score, loadout, and match controls in their requested areas.
- Loadout supports weapon category item selection and locked future categories with stats/descriptions/equip button state.
- UI text stays inside its panels/buttons across desktop and mobile widths.
- Bottom-left Settings panel can adjust stored global sound volume.
- Bottom-left Settings panel can switch English/Korean UI language.
- In-game action, hit, guard, parry, clash, kick, and dust effects have procedural sound cues.
- Ranked/Casual matchmaking overlay appears in the center immediately after click.
- Friendly room code create/join works.
- Two characters render after connection.
- Wide arena and smooth camera are active.
- Only the local player's weapon selection is exposed in the menu.
- Longsword, spear, axe, and zweihander work.
- Mouse-driven weapon posture is visible and responsive.
- Health and stamina work.
- Attack, guard, parry, feint, guard break, guard impact, and kick work.
- Visible weapon geometry drives hit detection.
- Firebase matchmaking, friendly room, signaling, Google auth, and rank service fail gracefully without config.
- Season Top 10 leaderboard exists.
- Current player score is displayed and persisted from a 1000 point default.
- Code is separated by responsibility.
- README documents run steps, Firebase setup, controls, modes, and ranking.
