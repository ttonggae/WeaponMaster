# WeaponMaster

WeaponMaster is a browser-based 1v1 medieval duel prototype built with Vite, TypeScript, and HTML Canvas 2D. The MVP focuses on slow, readable weapon commitment, stamina pressure, visible-weapon hit detection, Firebase-assisted matchmaking/friendly rooms, and manual WebRTC P2P setup.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173/`.

On Windows PowerShell, if `npm` is blocked by script execution policy, use:

```bash
npm.cmd install
npm.cmd run dev
```

You can also double-click `start-dev.cmd` from the project folder.

Do not preview the source `index.html` directly with VSCode HTML preview or Live Server. The browser cannot execute `/src/main.ts` until Vite transforms it, so direct static preview commonly shows a blank white screen. Use the Vite dev server URL instead.

## Build

```bash
npm run build
```

After building, static preview extensions should open `dist/index.html`, not the source `index.html`.

## GitHub Pages Deploy

This project includes `.github/workflows/deploy.yml`. Push the repository to the `main` branch, then set the repository Pages source to GitHub Actions.

First push:

```bash
git init
git branch -M main
git add .
git commit -m "Initial WeaponMaster MVP"
git remote add origin https://github.com/YOUR_NAME/WeaponMaster.git
git push -u origin main
```

In GitHub:

1. Open the repository.
2. Go to `Settings > Pages`.
3. Set `Build and deployment > Source` to `GitHub Actions`.
4. Go to `Settings > Secrets and variables > Actions > Variables`.
5. Add the `VITE_FIREBASE_*` repository variables from `.env` if online matchmaking/friendly rooms should work on the deployed site.

For a project page like `https://YOUR_NAME.github.io/WeaponMaster/`, the workflow sets `VITE_BASE_PATH` to `/<repo-name>/`. If this is deployed as a user page repository named `YOUR_NAME.github.io`, change `VITE_BASE_PATH` in the workflow to `/`.

Firebase console also needs the deployed domain in `Authentication > Settings > Authorized domains`, for example `YOUR_NAME.github.io`.

## Controls

Player:

- Aim weapon: mouse movement
- Move: `A` / `D`
- Attack sequence: left click
- Guard: hold right click
- Parry: `R`
- Feint during charge: `Q`
- Kick: `F`
- Guard break: `E`

## Current MVP

- Main menu only lets each player choose their own weapon.
- Online matchmaking, friendly room, and manual P2P duel entry points.
- Wide arena with a smooth player-focused camera and separated world/screen coordinates.
- Longsword, spear, and axe weapon data with mouse-driven weapon posture.
- Health, stamina, charge, attack, guard, parry, feint, kick, stun, hitstop, camera shake, and impact effects.
- `WeaponPoseSystem` calculates fixed-length weapon pose data shared by character posing, weapon rendering, and hit detection.
- Hit, guard, and parry checks use the same blade/tip/head strike zones that are drawn on screen.
- Manual WebRTC DataChannel panel with offer/answer copy flow, input messages, and periodic state checksum/core-state exchange.
- Firebase anonymous auth, friendly room code, matchmaking queue, and WebRTC signaling scaffolding. Combat input/state still uses WebRTC DataChannel.

## Design Notes

The game intentionally keeps the characters as simple rigid parts: head, torso, two arms, and two legs. There are no elbow or knee joints. Mouse aim drives the weapon angle with weapon-specific follow speed so the weapon feels weighted without hiding the true hit shape.

Left click starts a fixed attack sequence: charge, attack, recovery, then idle. Holding left click does not hold charge. Feint is only valid during the short charge window before the attack becomes active.

Mouse distance does not change weapon length. The mouse only defines the target direction. `WeaponPoseSystem` normalizes the hand-to-mouse direction and applies the weapon's fixed `length`, so the rendered weapon and its hit data stay the same size at any mouse distance. Longsword uses the blade as its strike zone, spear emphasizes the spearhead, and axe emphasizes the axe head.

Longsword attacks are selected internally from weapon angle, not UI lanes. High weapon angle produces a downward cut, middle angle produces a thrust that uses the tip/front blade as the strike zone, and low angle produces an upward cut.

The camera keeps the old zoom feel by preserving the logical viewport size and moving over a larger world. Mouse input is converted through `CameraSystem.screenToWorld()` before weapon direction is calculated, and combat remains in world coordinates.

The first networking version is not server-authoritative. Both clients simulate from exchanged inputs and send periodic core-state snapshots for drift checks. This cannot fully prevent cheating, but the code keeps state comparison and correction isolated so a later authoritative relay, Firebase rank layer, or rollback system can be added without rewriting core combat.

Manual WebRTC uses no signaling server. It is enough for local testing and some direct peer cases, but NAT traversal may require a later signaling/STUN/TURN layer.

Firebase is required for Online Matchmaking and Friendly Match. Manual P2P offer/answer still works without Firebase. To enable matchmaking/signaling, create a `.env` file using `.env.example` and provide:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase is used only for anonymous login, queue/room metadata, and WebRTC offer/answer/ICE exchange. It is not a combat authority server.

Firebase console requirements:

1. Enable `Authentication > Sign-in method > Anonymous`.
2. Create a Firestore database for `matchQueue`, `matchRooms`, and `friendlyRooms`.
3. Keep API keys in `.env`; do not hardcode Firebase config into source files.

If the browser console shows `identitytoolkit.googleapis.com/.../accounts:signUp` with HTTP 400, Anonymous Auth is usually disabled for the Firebase project. Enable it in the Firebase console, then refresh the Vite page.

## Verification

```bash
npm install
npm run dev
npm run build
```

For browser verification:

1. Confirm the menu shows only `Your Weapon`.
2. Open Online Matchmaking, Friendly Match, and P2P Duel and confirm each button shows only its own panel.
3. Connect two browser sessions through Friendly Match or manual P2P.
4. Confirm both fighters render after connection.
5. Move left/right and verify the camera follows without zooming out.
6. Move the mouse and verify the weapon follows in world coordinates.
7. Attack with the drawn weapon and confirm visible weapon contact drives hit, guard, parry, kick, and clash effects.

## Future Structure

The folder layout leaves room for Firebase ranking, maps, additional weapons, armor/equipment, matchmaking, replay, spectator mode, and rollback netcode.
