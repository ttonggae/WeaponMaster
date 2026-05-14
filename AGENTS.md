# WeaponMaster Agent Guide

## Project Structure

- `index.html`: Canvas and UI root.
- `src/main.ts`: Browser entry point.
- `src/style.css`: Global layout, menu, connection panel, and matchmaking overlay styles.
- `src/game/Game.ts`: Main loop, mode switching, WebRTC setup, Firebase matchmaking flow, and ranked result routing.
- `src/game/constants.ts`: Named gameplay, rank, and render constants. Avoid unexplained magic numbers elsewhere.
- `src/game/types.ts`: Shared gameplay, geometry, input, weapon, effect, auth, ranking, and network-facing types.
- `src/game/state/`: Duel and player state containers.
- `src/game/combat/`: Combat orchestration plus stamina, guard, parry, and hitbox systems.
- `src/game/arena/`: Arena data and movement bounds.
- `src/game/camera/`: World/screen camera transform and follow logic.
- `src/game/weapons/`: Weapon definitions, tuning, and shared weapon pose system.
- `src/game/input/`: Keyboard/mouse state and configurable keybinds.
- `src/game/render/`: Canvas renderers. Rendering must consume the same weapon pose data used by hit detection.
- `src/game/net/`: WebRTC DataChannel, message types, signaling types, and state sync.
- `src/game/firebase/`: Firebase app init, Google auth, matchmaking, friendly rooms, signaling, room codes, and rank service.
- `src/game/ui/`: DOM menu, weapon selection, friendly room panel, and matchmaking overlay.

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
- Ranked/Casual immediately start matchmaking and show the centered matchmaking overlay.
- Friendly Match opens only the 6-character room-code panel.
- Google sign-in starts when entering an online mode.
- Season Top 10 renders when Firebase/Firestore rules are configured.
- Matchmaking UI and friendly panel hide after WebRTC connects.
- Both fighters are visible after connection.
- Longsword, spear, and axe can be selected for the local player.
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
- Parry succeeds only during the short parry window when the incoming attack sweep intersects the defender's visible parry weapon.
- Feint is allowed only during attack charge.
- Guard break is slow and stamina-heavy, and is strongest against a guarding opponent.
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
- Perfect cheat prevention is not possible in this architecture; keep validation and checksums explicit so future server authority, Cloud Functions validation, or rollback can be added.

## Ranking Rules

- `CURRENT_SEASON_ID` in `constants.ts` selects the active season.
- Ranked wins add score and ranked losses subtract score.
- Leaderboard queries only the top 10 records for the active season.
- Rank records below top 10 may be deleted after result writes.
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
- Ranked/Casual matchmaking overlay appears in the center immediately after click.
- Friendly room code create/join works.
- Two characters render after connection.
- Wide arena and smooth camera are active.
- Only the local player's weapon selection is exposed in the menu.
- Longsword, spear, and axe work.
- Mouse-driven weapon posture is visible and responsive.
- Health and stamina work.
- Attack, guard, parry, feint, guard break, guard impact, and kick work.
- Visible weapon geometry drives hit detection.
- Firebase matchmaking, friendly room, signaling, Google auth, and rank service fail gracefully without config.
- Season Top 10 leaderboard exists.
- Code is separated by responsibility.
- README documents run steps, Firebase setup, controls, modes, and ranking.
