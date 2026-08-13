# Game Hub

Two arcade games and a procedural music system in a single folder. No assets, no dependencies, no build step — every graphic, effect, and instrument is synthesized at runtime.

**Play: [sudo-catz.github.io/games](https://sudo-catz.github.io/games/)**

## Games

### Flappy Bird
- Difficulty presets (keys **1 / 2 / 3**) with ramping difficulty mid-run
- Parallax sky, particles, medals
- Music menu with all 11 tracks

### Tetris
- Full mechanics: 7-bag randomizer, hold, ghost piece, DAS/ARR, lock delay with move/rotate resets, generous SRS-style kick table
- Level progression, pulsing danger tint, stat panels

## Music

One shared engine (`music.js`) drives both games. Eleven tracks, each with its own tempo, meter, harmony, and character:

| Track | Style |
|---|---|
| Meadow, Sunrise, Nocturne, Umbra, Rainy, Velvet | Composed, looping |
| Infinity, Solo, Harp, Valse, Mirage | Fully generative — never repeat |

The generative engine composes as it plays: crypto-seeded melody walker anchored to chord tones, evolving harmony with relative-minor and tritone substitutions, 4-bar question/answer phrasing, register arcs, breakdowns every fourth pass, and a synthesized convolution reverb bus. Each track lists its own reverb depth.

### Zero assets — with one deliberate exception

Everything is synthesized live: soft-partials plucks, piano, flute, harp, music box, drums, pads, and the reverb impulse. The violin and viola in *Solo* are real: 28 notes from **VSCO 2 Community Edition (CC0)**, embedded as base64 in `strings.js` and decoded with `atob` → `decodeAudioData` (so it works from `file://` where `fetch(data:)` is blocked).

## Controls

| Key | Action |
|---|---|
| **M** | Toggle music (both) |
| **T** | Next track (both) |
| **V** / **C** | Toggle recycle — V in tetris, C in flappy |
| **Space / ↑** | Flap / hard drop |
| **← → ↓** | Tetris movement (↓ soft drop) |
| **X / Z / ↑** | Rotate piece |
| **C / Shift** | Hold piece |
| **P** | Pause (tetris) |
| **R** | Restart (tetris) |
| **1 / 2 / 3** | Difficulty preset (flappy) |

Music and recycle settings sync between games via `localStorage`.

## Run locally

Clone and open `games/index.html` — no server needed. Audio unlocks on the first click or keypress (browser autoplay policy).

```sh
git clone https://github.com/sudo-catz/games.git
```

## Files

```
index.html        game hub
flappy.html       Flappy Bird (self-contained)
tetris.html       Tetris (loads music.js + strings.js)
music.js          shared music engine — window.Music API
strings.js        VSCO 2 CE violin/viola sample bank (base64, CC0)
flappy-bird/      redirect stub for the old path
```

## Tech notes

- The scheduler is a live lookahead loop (robust clock), not offline rendering — instant track switching, notes are killed on change.
- Generative state is an LCG reseeded from `crypto.getRandomValues` per track start; melody bars are memoized so the scheduler stays cheap.
- Debug: append `?debug=1` — `window.Music.state()` (tetris) or `window.__flappy.getState()` (flappy) exposes scheduler state, output peak, and sample-decode counts.
