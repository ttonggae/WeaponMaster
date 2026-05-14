# WeaponMaster Agent Guide

## Project Structure

- `index.html`: Canvas and UI root.
- `src/main.ts`: Browser entry point.
- `src/style.css`: Global layout and menu styles.
- `src/game/Game.ts`: Main loop, mode switching, and P2P input routing.
- `src/game/constants.ts`: Named gameplay and render constants. Avoid unexplained magic numbers elsewhere.
- `src/game/types.ts`: Shared gameplay, geometry, input, weapon, effect, and network-facing types.
- `src/game/state/`: Duel and player state containers.
- `src/game/combat/`: Combat orchestration plus stamina, guard, parry, and hitbox systems.
- `src/game/arena/`: Arena data and movement bounds.
- `src/game/camera/`: World/screen camera transform and follow logic.
- `src/game/weapons/`: Weapon definitions and per-weapon tuning.
- `src/game/weapons/WeaponPoseSystem.ts`: Shared fixed-length weapon pose calculation for rendering, character posing, and hit detection.
- `src/game/input/`: Keyboard state and configurable keybinds.
- `src/game/render/`: Canvas renderers. `WeaponRenderer` owns the weapon segment calculation used by hit detection.
- `src/game/net/`: WebRTC DataChannel, message types, and state sync.
- `src/game/firebase/`: Firebase anonymous auth, matchmaking, friendly rooms, and signaling.
- `src/game/ui/`: DOM menu, weapon selection, and connection panel.

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

- The menu only exposes the local player's own weapon selection.
- Online Matchmaking, Friendly Match, and P2P Duel each open only their own panel.
- Both fighters are visible.
- Longsword, spear, and axe can be selected.
- The arena is wider than the viewport and the camera follows the local player smoothly.
- Mouse aim remains accurate after the camera moves.
- Mouse movement changes the visible weapon pose.
- Left click starts charge and automatically releases into attack.
- Health and stamina change correctly.
- Attack, guard, parry, feint, guard break, guard impact, and kick work.
- Hit, guard, parry, and weapon clash effects are visually distinct.
- P2P panel can create an offer, create an answer from a pasted offer, and accept a pasted answer.
- Firebase env missing should not break the menu or manual P2P panel.

## Coding Rules

- Keep TypeScript `strict` clean.
- Keep gameplay logic, rendering, input, network, weapon data, combat rules, and UI separated.
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

- MVP uses WebRTC DataChannel with manual offer/answer copy.
- Firebase may be used for anonymous auth, matchmaking queue, friendly room code, and WebRTC signaling only.
- Firebase must not be treated as a combat authority server.
- Firebase config must come from environment variables or local config, never hardcoded secrets.
- There is no full server authority in the MVP.
- Each peer simulates from local and remote input snapshots.
- Peers exchange periodic checksums and compact core-state snapshots.
- Large drift may be corrected for the remote-controlled player.
- Perfect cheat prevention is not possible in this architecture; keep validation and checksums explicit so future server authority or rollback can be added.

## Forbidden

- Do not collapse the project into a single giant file.
- Do not scatter temporary hardcoding through core systems.
- Do not use unexplained magic numbers.
- Do not let rendered weapon position and hit detection diverge.
- Do not turn the game into a fast, light arcade fighter.
- Do not introduce complex jointed character animation for the MVP.
- Do not make P2P work by destabilizing core combat.

## Done Criteria

- `npm install` succeeds.
- `npm run dev` starts Vite.
- `npm run build` succeeds.
- Two characters render on screen.
- Wide arena and smooth camera are active.
- Only the local player's weapon selection is exposed in the menu.
- Longsword, spear, and axe work.
- Mouse-driven weapon posture is visible and responsive.
- Health and stamina work.
- Attack, guard, parry, feint, guard break, guard impact, and kick work.
- Visible weapon geometry drives hit detection.
- Friendly room and matchmaking Firebase structures exist and fail gracefully without config.
- Manual WebRTC P2P UI exists.
- Code is separated by responsibility.
- README documents run steps and controls.
