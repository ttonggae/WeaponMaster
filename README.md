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
- Current season display: `Season 1: Test Season`.
- Base score: `1000`.
- Win: `+25`.
- Loss: `-25`.
- Personal score storage: `rankScores/{seasonId}/players/{uid}`.
- Leaderboard storage: `rankings/{seasonId}/players/{uid}`.
- Leaderboard: top 10 ranked records for the current season.
- Entries below rank 10 are removed from the public leaderboard collection, while personal scores stay saved.

To reset for a new season, change `CURRENT_SEASON_ID` to a new value such as `season-2`. The old season stays in Firestore under its own path unless manually deleted.

Rank writes are client-side in this MVP, so they are not cheat-proof. The rank service is isolated so a later Cloud Functions validator or server-authoritative result service can replace direct client writes.

## Current MVP

- Main menu has exactly three modes: Ranked Match, Casual Match, Friendly Match.
- Main menu displays the active season number and concept name.
- Main menu canvas background is a procedural forge with furnace glow, anvil, tools, and sparks.
- Main menu sound uses short Web Audio crackles and hammer strikes after the first browser input gesture.
- Sound volume is controlled from the bottom-left Settings panel; 50% equals three times the original MVP output.
- Main menu places the title/season at top-left, Season Top 10 plus personal score at top-right, and match controls at bottom-center.
- Loadout opens from a button above match controls and shows a centered equipment box with four columns: character/stats, equipment category, item selection, and selected item details/equip action.
- Loadout currently supports weapon selection; usable gear, armor, and passive categories are visible but locked for future updates.
- UI text uses wrapping, truncation, and minimum-width guards so labels do not spill outside their boxes.
- Ranked/Casual show a centered matchmaking overlay while searching.
- Friendly room code UI opens in the center of the screen.
- Matchmaking UI is hidden once WebRTC connects and the duel begins.
- The matchmaking cancel action is removed as soon as an opponent is accepted and the duel scene starts.
- Matchmaking ignores stale rooms from older browser sessions, separates queue watchers from signaling watchers, and only enters the duel after the WebRTC DataChannel is connected on that client.
- Current player score and Season Top 10 leaderboard are shown on the main menu when Firebase is configured.
- Google sign-in replaces anonymous auth to avoid confusing player identity.
- Wide arena with a smooth player-focused camera and separated world/screen coordinates.
- Longsword, spear, and axe weapon data with mouse-driven weapon posture.
- Health, stamina, charge, attack, guard, parry, feint, kick, stun, hitstop, camera shake, and impact effects.
- Parry counters an incoming attack for 1.5x the defender weapon damage.
- Feint cancels charge directly back to idle, with pose blending but no recovery lockout.
- Guard break uses the weapon grip/shaft as its visible strike data. It only affects guarding opponents, causing a 5 second breakable stun that ends early if the stunned player is hit.
- In-game action transitions and hit, guard, parry, clash, kick, and dust effects trigger matching procedural sound effects.
- In-game action and impact sounds are boosted 1.5x above the shared Settings volume so combat reads more clearly than menu ambience.
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

Left click starts a fixed attack sequence: charge, attack, recovery, then idle. Holding left click does not hold charge. Feint is only valid during the short charge window before the attack becomes active, and a successful feint returns directly to idle so the player can act again immediately.

Guard break is not a universal damage tool. The move reverses the weapon posture and drives the grip or shaft end forward; its `strikeZone` is the same handle segment drawn by the renderer. If it connects against a guarding opponent, it causes a 5 second stun that is cancelled immediately by the next incoming hit. If the opponent is not guarding, the move has no combat effect beyond its stamina cost and recovery.

Parry is an active counter, not only a block. If the defender's visible parry weapon intersects the incoming attack sweep during the parry window, the attacker takes 1.5x the defender weapon damage and their attack is interrupted.

Mouse distance does not change weapon length. The mouse only defines the target direction. `WeaponPoseSystem` normalizes the hand-to-mouse direction and applies the weapon's fixed `length`, so the rendered weapon and its hit data stay the same size at any mouse distance. Longsword uses the blade as its strike zone, spear emphasizes the spearhead, and axe emphasizes the axe head.

The first networking version is not server-authoritative. Both clients simulate from exchanged inputs and send periodic core-state snapshots for drift checks. This cannot fully prevent cheating, but the code keeps state comparison and correction isolated so later server authority or rollback can be added without rewriting core combat.
Online matching uses the per-browser session id stored in queue and room documents to avoid accepting stale rooms from previous tabs or reloads. Matching is session-based instead of blocking same Google account ids, which keeps two local test windows from waiting forever. The queue query still checks 16 candidates, but it filters by match type in Firestore first so those 16 are relevant to the selected mode. ICE candidates are queued until each peer has a remote description, because Firebase snapshot timing can deliver candidates before the SDP step completes.

Audio is generated through Web Audio rather than external files. Browsers block autoplay before a user gesture, so sound starts after the first click/key press. Menu audio stops whenever the main menu is hidden. In-game audio also listens to action state changes, so swings, guard posture, parry, kick, and guard break have cues even before a hit occurs.
The bottom-left Settings panel stores sound volume locally. The slider is tuned so the default 50% setting is the louder baseline requested for current testing, while 100% leaves headroom for noisy environments. Combat cues apply an additional 1.5x layer over that shared volume; menu ambience does not.

## Verification

```bash
npm install
npm run dev
npm run build
```

Browser checks:

1. Confirm the menu shows only `Ranked Match`, `Casual Match`, and `Friendly Match`.
2. Confirm the menu shows `Season 1: Test Season` over the forge background.
3. Confirm title/season are top-left, Top 10 plus personal score are top-right, and match controls are bottom-center.
4. Open Loadout and confirm the columns read left-to-right as character/stats, equipment category, selected category item choices, and selected item details/equip action.
5. Select Weapon, then Longsword/Spear/Axe, and confirm the character weapon preview and stats update before pressing Equip.
6. Click locked usable gear/armor/passive categories and confirm they show descriptions and a disabled Locked button.
7. Resize the browser and confirm UI text stays inside its panels/buttons.
8. Click once on the page and confirm forge crackle/hammer sound plays only while the main menu is visible, without a steady buzz.
9. Open the bottom-left Settings panel and confirm the Sound slider changes menu and combat volume.
10. Press Ranked or Casual and confirm the centered matchmaking overlay appears immediately.
11. Press Friendly and confirm the room-code panel appears centered.
12. Connect two browser sessions through ranked/casual matchmaking or friendly room code.
13. Confirm the matchmaking cancel button disappears once an opponent is accepted and the duel scene starts.
14. Confirm the connection panel/overlay hides after WebRTC connects.
15. Confirm neither client enters the duel scene until its WebRTC DataChannel reaches connected state.
16. Confirm Google auth creates a 1000 point score for a new player and shows it in the menu.
17. Finish a ranked duel and confirm the personal score and Season Top 10 can update.
18. Verify attack, guard, parry, guard break, kick, hit, guard, and clash events produce audible in-game cues.

## Future Structure

The folder layout leaves room for Firebase rank seasons, maps, additional weapons, armor/equipment, richer matchmaking, replay, spectator mode, Cloud Functions validation, and rollback netcode.
