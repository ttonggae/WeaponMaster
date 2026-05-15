# WeaponMaster

WeaponMaster is a browser-based 1v1 medieval duel prototype built with Vite, TypeScript, and HTML Canvas 2D. The MVP focuses on slow weapon commitment, stamina pressure, visible-weapon hit detection, Firebase-assisted matchmaking, friendly room codes, and WebRTC DataChannel combat sync.

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

In GitHub:

1. Open the repository.
2. Go to `Settings > Pages`.
3. Set `Build and deployment > Source` to `GitHub Actions`.
4. Go to `Settings > Secrets and variables > Actions > Variables`.
5. Add the `VITE_FIREBASE_*` repository variables from `.env` if online modes should work on the deployed site.

For a project page like `https://YOUR_NAME.github.io/WeaponMaster/`, the workflow sets `VITE_BASE_PATH` to `/<repo-name>/`. If this is deployed as a user page repository named `YOUR_NAME.github.io`, change `VITE_BASE_PATH` in the workflow to `/`.

Firebase console also needs the deployed domain in `Authentication > Settings > Authorized domains`, for example `YOUR_NAME.github.io`.

## Controls

- Aim weapon: mouse movement
- Move: `A` / `D`
- Attack sequence: left click
- Guard: hold right click
- Parry: `R`
- Feint during charge: `Q`
- Kick: `F`
- Guard break: `E`

## Game Modes

- `Ranked Match`: starts matchmaking immediately from the main menu. Requires Google sign-in. A completed ranked duel updates the seasonal score.
- `Casual Match`: starts matchmaking immediately from the main menu. Requires Google sign-in for stable identity, but does not change score.
- `Friendly Match`: opens the room-code panel. Create a 6-character code or join a code from another player.

There is no local duel or manual copy/paste P2P entry point in the current UI. Firebase is used for identity, queue/room metadata, and WebRTC signaling. Actual combat input/state sync still uses WebRTC DataChannel.

## Ranking

- Current season id: `CURRENT_SEASON_ID` in `src/game/constants.ts`.
- Base score: `1000`.
- Win: `+25`.
- Loss: `-15`.
- Personal score storage: `rankScores/{seasonId}/players/{uid}`.
- Leaderboard storage: `rankings/{seasonId}/players/{uid}`.
- Leaderboard: top 10 ranked records for the current season.
- Entries below rank 10 are removed from the public leaderboard collection, while personal scores stay saved.

To reset for a new season, change `CURRENT_SEASON_ID` to a new value such as `season-2`. The old season stays in Firestore under its own path unless manually deleted.

Rank writes are client-side in this MVP, so they are not cheat-proof. The rank service is isolated so a later Cloud Functions validator or server-authoritative result service can replace direct client writes.

## Current MVP

- Main menu has exactly three modes: Ranked Match, Casual Match, Friendly Match.
- Ranked/Casual show a centered matchmaking overlay while searching.
- Matchmaking UI is hidden once WebRTC connects and the duel begins.
- Current player score and Season Top 10 leaderboard are shown on the main menu when Firebase is configured.
- Google sign-in replaces anonymous auth to avoid confusing player identity.
- Wide arena with a smooth player-focused camera and separated world/screen coordinates.
- Longsword, spear, and axe weapon data with mouse-driven weapon posture.
- Health, stamina, charge, attack, guard, parry, feint, kick, stun, hitstop, camera shake, and impact effects.
- `WeaponPoseSystem` calculates fixed-length weapon pose data shared by character posing, weapon rendering, and hit detection.
- Hit, guard, and parry checks use the same blade/tip/head strike zones that are drawn on screen.

## Firebase Setup

Create a `.env` file using `.env.example` and provide:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIREBASE_DATABASE_URL=...
```

Required Firebase console setup:

1. `Authentication > Sign-in method`: enable `Google`.
2. `Authentication > Settings > Authorized domains`: add local/deployed domains as needed, for example `localhost` and `ttonggae.github.io`.
3. Create a Cloud Firestore database.
4. Use rules that allow signed-in players to use matchmaking/signaling and allow public leaderboard reads.

MVP Firestore rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function validCandidateCollection(name) {
      return name == "hostCandidates" || name == "guestCandidates";
    }

    match /matchQueue/{queueId} {
      allow read, create, update, delete: if signedIn();
    }

    match /matchRooms/{roomId} {
      allow read, create, update, delete: if signedIn();

      match /{candidateCollection}/{candidateId} {
        allow read, create, update, delete:
          if signedIn() && validCandidateCollection(candidateCollection);
      }
    }

    match /friendlyRooms/{roomId} {
      allow read, create, update, delete: if signedIn();

      match /{candidateCollection}/{candidateId} {
        allow read, create, update, delete:
          if signedIn() && validCandidateCollection(candidateCollection);
      }
    }

    match /rankScores/{seasonId}/players/{uid} {
      allow read, create, update, delete: if signedIn();
    }

    match /rankings/{seasonId}/players/{uid} {
      allow read: if true;
      allow create, update, delete: if signedIn();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The rank write/delete rules are intentionally permissive for the MVP because score updates and top-10 publishing are currently client-side. Tighten this when rank validation moves to Cloud Functions or a trusted server.

## Design Notes

The game intentionally keeps the characters as simple rigid parts: head, torso, two arms, and two legs. There are no elbow or knee joints. Mouse aim drives the weapon angle with weapon-specific follow speed so the weapon feels weighted without hiding the true hit shape.

Left click starts a fixed attack sequence: charge, attack, recovery, then idle. Holding left click does not hold charge. Feint is only valid during the short charge window before the attack becomes active.

Mouse distance does not change weapon length. The mouse only defines the target direction. `WeaponPoseSystem` normalizes the hand-to-mouse direction and applies the weapon's fixed `length`, so the rendered weapon and its hit data stay the same size at any mouse distance. Longsword uses the blade as its strike zone, spear emphasizes the spearhead, and axe emphasizes the axe head.

The first networking version is not server-authoritative. Both clients simulate from exchanged inputs and send periodic core-state snapshots for drift checks. This cannot fully prevent cheating, but the code keeps state comparison and correction isolated so later server authority or rollback can be added without rewriting core combat.

## Verification

```bash
npm install
npm run dev
npm run build
```

Browser checks:

1. Confirm the menu shows only `Ranked Match`, `Casual Match`, and `Friendly Match`.
2. Press Ranked or Casual and confirm the centered matchmaking overlay appears immediately.
3. Press Friendly and confirm only the code panel appears.
4. Connect two browser sessions through ranked/casual matchmaking or friendly room code.
5. Confirm the connection panel/overlay hides after WebRTC connects.
6. Confirm Google auth creates a 1000 point score for a new player and shows it in the menu.
7. Finish a ranked duel and confirm the personal score and Season Top 10 can update.
8. Move the mouse and verify visible weapon contact drives hit, guard, parry, kick, and clash effects.

## Future Structure

The folder layout leaves room for Firebase rank seasons, maps, additional weapons, armor/equipment, richer matchmaking, replay, spectator mode, Cloud Functions validation, and rollback netcode.
