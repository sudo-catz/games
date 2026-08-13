// shared music engine: 6 tracks, soft-partial/piano voices, swing, drums, vinyl, recycle
// used by both flappy.html and tetris.html
(() => {
'use strict';
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx) startMusic();
}
function click() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, t0);
  g.gain.setValueAtTime(0.07, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
  osc.connect(g); g.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + 0.09);
}
// ---------- music (live soft-partials scheduler, robust clock) ----------
let musicOn = localStorage.getItem('flappy-music') !== 'off';
let recycle = localStorage.getItem('flappy-recycle') === 'on';
let loopsInTrack = 0;
let musicGain = null, musicTimer = null, musicStep = 0, musicNext = 0, noiseBuf = null;
let musicLoop = 0;                              // alternate arrangement each pass
let trackStartAt = 0;                            // audioCtx time when current track began
let myTabId = Math.random().toString(36).slice(2);
try { localStorage.setItem('flappy-tab', myTabId); } catch (e) {}
const MIDI = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TRACKS = [
  { // Meadow: Am7 Fmaj7 Cmaj7 G | Am7 Fmaj7 G C
    name: 'Meadow', bpm: 76, steps: 8, loops: 4,
    melody: [
      76,0,0,0,72,0,74,0,  72,0,0,0,69,0,72,0,  71,0,0,0,67,0,69,0,  74,0,0,0,71,0,69,0,
      76,0,0,0,72,0,71,0,  72,0,0,0,69,0,67,0,  74,0,0,0,71,0,72,0,  72,0,0,0,0,0,0,0
    ],
    arp: [
      45,57,60,64,45,67,64,60,  41,53,57,60,41,64,60,57,
      48,60,64,67,48,71,67,64,  43,55,59,62,43,67,62,59,
      45,57,60,64,45,67,64,60,  41,53,57,60,41,64,60,57,
      43,62,59,55,43,67,59,55,  48,67,64,60,48,64,60,0
    ],
    bass: [
      45,0,0,0,45,0,0,0,  41,0,0,0,41,0,0,0,  48,0,0,0,48,0,0,0,  43,0,0,0,43,0,0,0,
      45,0,0,0,45,0,0,0,  41,0,0,0,41,0,0,0,  43,0,0,0,43,0,0,0,  48,0,0,0,48,0,0,0
    ],
    pads: [
      [57,60,64], [53,57,64], [60,64,67], [55,59,62],
      [57,60,64], [53,57,64], [55,59,62], [48,60,64]
    ]
  },
  { // Sunrise: D Bm G A | Bm G A D
    name: 'Sunrise', bpm: 84, steps: 8, loops: 4,
    melody: [
      78,0,0,0,74,0,76,0,  74,0,0,0,71,0,69,0,  74,0,0,0,71,0,67,0,  76,0,0,0,73,0,71,0,
      74,0,0,0,71,0,69,0,  71,0,0,0,67,0,69,0,  73,0,0,0,69,0,71,0,  74,0,0,0,0,0,0,0
    ],
    arp: [
      50,57,62,66,50,69,66,62,  47,54,59,62,47,66,62,59,
      43,55,59,62,43,67,62,59,  45,57,61,64,45,69,64,61,
      47,54,62,66,47,69,66,62,  43,59,62,67,43,71,67,62,
      45,57,64,69,45,73,69,64,  50,62,66,69,50,66,62,57
    ],
    bass: [
      50,0,0,0,50,0,0,0,  47,0,0,0,47,0,0,0,  43,0,0,0,43,0,0,0,  45,0,0,0,45,0,0,0,
      47,0,0,0,47,0,0,0,  43,0,0,0,43,0,0,0,  45,0,0,0,45,0,0,0,  50,0,0,0,50,0,0,0
    ],
    pads: [
      [57,62,66], [54,59,62], [55,59,62], [57,61,64],
      [54,59,62], [55,59,62], [57,61,64], [50,62,66]
    ]
  },
  { // Nocturne: original A-minor waltz, 3/4 (6 steps/bar)
    name: 'Nocturne', bpm: 100, steps: 6, piano: true, loops: 2,
    melody: [
      69,72,76,72,71,72,  74,77,76,74,72,69,  71,76,80,76,74,71,  69,72,76,81,79,76,
      77,81,79,77,76,72,  79,83,81,79,77,74,  72,76,79,76,74,72,  71,80,76,71,74,76,
      76,79,84,79,76,74,  74,79,83,79,74,72,  72,76,81,76,72,71,  69,72,77,72,69,67,
      74,77,81,77,74,72,  76,80,83,80,76,77,  81,79,77,76,74,72,  71,76,0,0,0,0,
      69,72,76,72,71,72,  74,77,76,74,72,69,  71,76,80,76,74,71,  69,72,76,81,79,76,
      77,81,79,77,76,72,  76,80,76,71,74,0,    81,76,72,76,69,72,  69,0,0,0,0,0
    ],
    arp: [
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0
    ],
    bass: [
      45,0,0,0,0,0,  50,0,0,0,0,0,  40,0,0,0,0,0,  45,0,0,0,0,0,
      41,0,0,0,0,0,  43,0,0,0,0,0,  48,0,0,0,0,0,  40,0,0,0,0,0,
      48,0,0,0,0,0,  43,0,0,0,0,0,  45,0,0,0,0,0,  41,0,0,0,0,0,
      50,0,0,0,0,0,  40,0,0,0,0,0,  45,0,0,0,0,0,  40,0,0,0,0,0,
      45,0,0,0,0,0,  50,0,0,0,0,0,  40,0,0,0,0,0,  45,0,0,0,0,0,
      41,0,0,0,0,0,  40,0,0,0,0,0,  45,0,0,0,0,0,  45,0,0,0,0,0
    ],
    chords: [
      [57,60,64], [57,62,65], [56,62,65], [57,60,64],
      [53,57,60], [55,59,62], [55,60,64], [56,62,65],
      [55,60,64], [55,59,62], [57,60,64], [53,57,60],
      [57,62,65], [56,62,65], [57,60,64], [56,62,65],
      [57,60,64], [57,62,65], [56,62,65], [57,60,64],
      [53,57,60], [56,62,65], [57,60,64], [57,60,64]
    ],
    pads: []
  },
  { // Umbra: moody D-minor nocturne, 3/4, chromatic A7b9 leans
    name: 'Umbra', bpm: 62, steps: 6, piano: true, loops: 1,
    melody: [
      74,72,69,65,64,65,  67,69,70,69,67,65,  69,73,76,73,74,73,  74,77,76,74,72,69,
      70,74,72,70,69,67,  67,70,74,70,69,70,  73,76,74,73,70,69,  74,0,0,0,0,0,
      77,76,74,72,69,72,  74,72,70,69,67,69,  67,69,70,74,72,70,  76,74,73,69,71,69,
      74,72,69,65,64,65,  67,70,69,67,65,64,  73,74,73,70,69,67,  74,77,76,74,72,69,
      74,72,69,65,64,65,  67,69,70,69,67,65,  69,73,76,73,74,73,  74,77,76,74,72,69,
      70,74,72,70,69,67,  73,76,74,73,70,69,  77,74,72,69,65,69,  74,0,0,0,0,0
    ],
    arp: [
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0,
      0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0
    ],
    bass: [
      50,0,0,0,0,0,  43,0,0,0,0,0,  45,0,0,0,0,0,  50,0,0,0,0,0,
      46,0,0,0,0,0,  43,0,0,0,0,0,  45,0,0,0,0,0,  50,0,0,0,0,0,
      41,0,0,0,0,0,  46,0,0,0,0,0,  43,0,0,0,0,0,  45,0,0,0,0,0,
      50,0,0,0,0,0,  43,0,0,0,0,0,  45,0,0,0,0,0,  50,0,0,0,0,0,
      50,0,0,0,0,0,  43,0,0,0,0,0,  45,0,0,0,0,0,  50,0,0,0,0,0,
      46,0,0,0,0,0,  45,0,0,0,0,0,  50,0,0,0,0,0,  50,0,0,0,0,0
    ],
    chords: [
      [53,57,62], [55,58,62], [56,61,64], [53,57,62],
      [53,58,62], [55,58,62], [56,61,64], [53,57,62],
      [53,57,60], [53,58,62], [55,58,62], [56,61,64],
      [53,57,62], [55,58,62], [56,61,64], [53,57,62],
      [53,57,62], [55,58,62], [56,61,64], [53,57,62],
      [53,58,62], [56,61,64], [53,57,62], [53,57,62]
    ],
    pads: []
  },
  { // Rainy: original lofi hip-hop, jazzy maj7/min7, swung boom-bap, vinyl dust
    name: 'Rainy', bpm: 74, steps: 8, swing: 0.2, vinyl: true, loops: 4,
    melody: [
      72,0,0,74,0,0,72,0,  71,0,0,74,0,0,71,0,  69,0,0,72,0,0,69,0,  65,0,0,69,0,0,65,0,
      67,0,0,71,0,0,67,0,  64,0,0,67,0,0,72,0,  69,0,0,0,72,0,0,0,    67,0,0,0,0,0,0,0
    ],
    arp: [
      0,65,0,69,0,64,0,60,  0,67,0,64,0,62,0,59,  0,67,0,64,0,60,0,57,  0,65,0,62,0,60,0,57,
      0,65,0,62,0,59,0,55,  0,64,0,60,0,59,0,55,  0,67,0,64,0,60,0,57,  0,65,0,62,0,59,0,55
    ],
    bass: [
      41,0,0,0,0,0,0,0,  40,0,0,0,0,0,0,0,  45,0,0,0,0,0,0,0,  50,0,0,0,0,0,0,0,
      43,0,0,0,0,0,0,0,  48,0,0,0,0,0,0,0,  45,0,0,0,0,0,0,0,  43,0,0,0,0,0,0,0
    ],
    pads: [
      [53,57,60,64], [52,55,59,62], [57,60,64,67], [53,57,60,62],
      [55,59,62,65], [55,59,60,64], [57,60,64,67], [55,59,62,65]
    ],
    drums: [
      'k','h','s','h','k','h','s','h',  'k','h','s','h','k','h','s','h',
      'k','h','s','h','k','h','s','h',  'k','h','s','h','k','h','s','h',
      'k','h','s','h','k','h','s','h',  'k','h','s','h','k','h','s','h',
      'k','h','s','h','k','h','s','h',  'k','h','s','h','k','h','s','h'
    ]
  },
  { // Velvet: jazz trio, ii-V-I with backdoor turnaround, walking bass, swung ride
    name: 'Velvet', bpm: 126, steps: 8, swing: 0.28, piano: true, vinyl: true, loops: 3,
    melody: [
      74,72,69,72,74,76,74,72,  71,69,67,69,71,74,71,69,  72,71,67,71,72,76,74,72,  67,69,71,72,74,0,0,0,
      72,70,67,70,72,74,72,70,  69,68,65,68,69,72,69,68,  70,69,65,69,70,74,72,70,  73,71,69,71,73,76,73,0,
      72,73,76,73,72,69,67,0,   65,67,69,67,65,62,60,62,  64,62,60,62,64,67,65,0,   64,0,67,0,64,0,60,0,
      64,68,71,68,64,62,59,0,   60,64,67,64,60,57,55,57,  59,57,54,57,59,62,60,0,   59,60,62,64,65,67,69,0
    ],
    arp: [
      0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0
    ],
    bass: [
      50,0,53,0,57,0,60,0,  43,0,47,0,50,0,53,0,  48,0,52,0,55,0,59,0,  48,0,52,0,55,0,57,0,
      48,0,51,0,55,0,58,0,  41,0,45,0,48,0,51,0,  46,0,50,0,53,0,57,0,  45,0,49,0,52,0,55,0,
      57,0,61,0,64,0,61,0,  50,0,53,0,57,0,60,0,  55,0,59,0,62,0,59,0,  48,0,52,0,55,0,60,0,
      52,0,56,0,59,0,56,0,  57,0,60,0,64,0,60,0,  50,0,54,0,57,0,54,0,  55,0,59,0,62,0,65,0
    ],
    chords: [
      [53,57,60,62], [53,59,62,65], [52,55,59,60], [55,59,60,64],
      [51,55,58,60], [53,57,60,63], [53,57,60,62], [52,56,60,62],
      [57,61,64,67], [53,57,60,62], [55,59,62,65], [55,60,64,69],
      [52,56,59,62], [57,60,64,67], [50,54,57,60], [55,59,62,65]
    ],
    drums: [
      'k','h','c','h','f','h','c','h',  'k','h','c','h','f','h','c','h',
      'k','h','c','h','f','h','c','h',  'k','h','c','h','f','h','c','h',
      'k','h','c','h','f','h','c','h',  'k','h','c','h','f','h','c','h',
      'k','h','c','h','f','h','c','h',  'k','h','c','h','f','h','c','h',
      'k','h','c','h','f','h','c','h',  'k','h','c','h','f','h','c','h',
      'k','h','c','h','f','h','c','h',  'k','h','c','h','f','h','c','h',
      'k','h','c','h','f','h','c','h',  'k','h','c','h','f','h','c','h',
      'k','h','c','h','f','h','c','h',  'k','h','s','h','f','f','s','h'
    ],
    pads: []
  },
  { // Infinity: generative — harmony evolves per pass, melody never repeats
    name: 'Infinity', bpm: 88, steps: 8, swing: 0.12, gen: true, reverb: 0.18
  },
  { // Solo: dark nocturne — slow violin over soft pads and bass
    name: 'Solo', bpm: 60, steps: 8, gen: true, jazz: true, reverb: 0.5
  },
  { // Harp: generative ballad — sparse plucked harp over soft pads and bass
    name: 'Harp', bpm: 68, steps: 8, gen: true, pno: true, reverb: 0.35
  },
  { // Valse: generative waltz — flute over oom-pah-pah bass, Bb major, 3/4
    name: 'Valse', bpm: 96, steps: 6, gen: true, wtz: true, reverb: 0.3
  },
  { name: 'Mirage', bpm: 58, steps: 10, gen: true, box: true, loops: 3, reverb: 0.45 }
];
let trackIdx = Math.max(0, TRACKS.findIndex(t => t.name === localStorage.getItem('flappy-track')));
const stepDur = () => 60 / TRACKS[trackIdx].bpm / 2;   // 8th note
// soft pluck voice: staggered sine partials (kalimba-style)
const PARTIALS = [
  { mult: 1, amp: 0.62, dec: 1.6 },
  { mult: 2, amp: 0.27, dec: 0.9 },
  { mult: 3, amp: 0.10, dec: 0.5 },
  { mult: 4, amp: 0.04, dec: 0.3 }
];
// piano: fuller harmonic stack, faster decays, hammer click on attack
const PIANO_PARTIALS = [
  { mult: 1, amp: 0.55, dec: 1.1 },
  { mult: 2, amp: 0.24, dec: 0.75 },
  { mult: 3, amp: 0.12, dec: 0.55 },
  { mult: 4, amp: 0.06, dec: 0.35 },
  { mult: 5, amp: 0.035, dec: 0.25 },
  { mult: 6, amp: 0.02, dec: 0.18 }
];
// upright bass: dark, thumpy, quick decay
const BASS_PARTIALS = [
  { mult: 1, amp: 0.65, dec: 0.55 },
  { mult: 2, amp: 0.20, dec: 0.30 },
  { mult: 3, amp: 0.07, dec: 0.18 },
  { mult: 4.01, amp: 0.03, dec: 0.12 }
];
// Rhodes: bell-like tine stack
const HARP_PARTIALS = [
  { mult: 1, amp: 0.55, dec: 1.5 },
  { mult: 2, amp: 0.22, dec: 1.0 },
  { mult: 3, amp: 0.10, dec: 0.6 },
  { mult: 4, amp: 0.05, dec: 0.4 },
  { mult: 5.01, amp: 0.03, dec: 0.3 },
  { mult: 6.02, amp: 0.02, dec: 0.25 }
];
const liveNotes = new Set();
function trackLive(osc, g) {
  liveNotes.add(g);
  osc.onended = () => liveNotes.delete(g);
}
function pluck(midi, t, vol, dur, parts = PARTIALS) {
  const f = MIDI(midi);
  const piano = parts === PIANO_PARTIALS;
  if (piano && noiseBuf) {
    // hammer transient: 4ms filtered noise click
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    const hg = audioCtx.createGain();
    hg.gain.setValueAtTime(vol * 0.05, t);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    src.connect(lp); lp.connect(hg); hg.connect(musicGain);
    src.start(t); src.stop(t + 0.025);
  }
  for (const p of parts) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f * p.mult;
    const a = vol * p.amp;
    const d = Math.max(0.15, dur * p.dec);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + (piano ? 0.002 : 0.004));
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    osc.connect(g); g.connect(musicGain);
    trackLive(osc, g);
    osc.start(t); osc.stop(t + d + 0.05);
  }
}
function harpNote(midi, t, vol, dur) {
  const f = MIDI(midi);
  // string snap: bright 12ms pluck transient
  if (noiseBuf) {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.2;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    src.connect(bp); bp.connect(g); g.connect(musicGain);
    src.start(t); src.stop(t + 0.015);
  }
  // string stiffness: upper partials slightly sharp, pitch blooms into tune
  const det = [0, 0.004, 0.012, 0.02, 0.03, 0.045];
  for (let i = 0; i < HARP_PARTIALS.length; i++) {
    const p = HARP_PARTIALS[i];
    const m = p.mult + det[i];
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * m * 0.996, t);
    osc.frequency.exponentialRampToValueAtTime(f * m, t + 0.025);
    const a = vol * p.amp;
    const d = Math.max(0.15, dur * p.dec);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    osc.connect(g); g.connect(musicGain);
    trackLive(osc, g);
    osc.start(t); osc.stop(t + d + 0.1);
  }
}
function padNote(midi, t, vol, dur) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = MIDI(midi);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.4);
  g.gain.setValueAtTime(vol, t + dur - 0.4);
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g); g.connect(musicGain);
  trackLive(osc, g);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function shaker(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 8000;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.008, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(hp); hp.connect(g); g.connect(musicGain);
  trackLive(src, g);
  src.start(t); src.stop(t + 0.05);
}
function mKick(t) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, t);
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(g); g.connect(musicGain);
  trackLive(osc, g);
  osc.start(t); osc.stop(t + 0.18);
}
function mSnare(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1900;
  bp.Q.value = 0.8;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.09, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(bp); bp.connect(g); g.connect(musicGain);
  trackLive(src, g);
  src.start(t); src.stop(t + 0.1);
  const osc = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.07);
  g2.gain.setValueAtTime(0.08, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g2); g2.connect(musicGain);
  trackLive(osc, g2);
  osc.start(t); osc.stop(t + 0.09);
}
function mChick(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(hp); hp.connect(g); g.connect(musicGain);
  trackLive(src, g);
  src.start(t); src.stop(t + 0.04);
}
function mFeather(t) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);
  g.gain.setValueAtTime(0.10, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g); g.connect(musicGain);
  trackLive(osc, g);
  osc.start(t); osc.stop(t + 0.14);
}
function mCrackle(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.018, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
  src.connect(hp); hp.connect(g); g.connect(musicGain);
  src.start(t); src.stop(t + 0.02);
}
function mRide(t, vel) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 8200; bp.Q.value = 0.8;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 6500;
  const g = audioCtx.createGain();
  const v = vel || 0.5;
  g.gain.setValueAtTime(0.045 * v, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.28);
  src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(musicGain);
  src.start(t); src.stop(t + 0.3);
}
function mBrush(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  src.connect(bp); bp.connect(g); g.connect(musicGain);
  src.start(t); src.stop(t + 0.18);
}
function hornNote(midi, t, vol, dur) {
  const f = MIDI(midi);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
  g.gain.setTargetAtTime(0, t + dur, 0.12);
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 1.5;
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + 0.09);
  lp.frequency.setTargetAtTime(1500, t + dur * 0.6, 0.2);
  const o1 = audioCtx.createOscillator();
  o1.type = 'sawtooth'; o1.frequency.value = f;
  const o2 = audioCtx.createOscillator();
  o2.type = 'sawtooth'; o2.frequency.value = f * 1.004;
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 5.2;
  const lfoG = audioCtx.createGain();
  lfoG.gain.setValueAtTime(0, t);
  lfoG.gain.linearRampToValueAtTime(f * 0.008, t + 0.25);
  lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
  const nsrc = audioCtx.createBufferSource();
  nsrc.buffer = noiseBuf;
  const nbp = audioCtx.createBiquadFilter();
  nbp.type = 'bandpass'; nbp.frequency.value = 3000; nbp.Q.value = 1;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.02, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  nsrc.connect(nbp); nbp.connect(ng); ng.connect(g);
  o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musicGain);
  o1.start(t); o2.start(t); lfo.start(t); nsrc.start(t);
  o1.stop(t + dur + 0.3); o2.stop(t + dur + 0.3); lfo.stop(t + dur + 0.3); nsrc.stop(t + 0.06);
  trackLive(o1, g);
}
function stringNote(midi, t, vol, dur, viola) {
  const f = MIDI(midi);
  const g = audioCtx.createGain();
  // bowing envelope: pressure bite, sustain, quick release
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.045);
  g.gain.setValueAtTime(vol * 0.92, t + Math.max(0.12, dur - 0.08));
  g.gain.setTargetAtTime(0, t + dur, 0.03);
  // wooden body: three resonant peaks (violin brighter, viola darker)
  const peaks = viola ? [300, 650, 1100] : [400, 900, 1600];
  const f1 = audioCtx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = peaks[0]; f1.Q.value = 2.2; f1.gain.value = 4;
  const f2 = audioCtx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = peaks[1]; f2.Q.value = 2.4; f2.gain.value = 3;
  const f3 = audioCtx.createBiquadFilter(); f3.type = 'peaking'; f3.frequency.value = peaks[2]; f3.Q.value = 2.6; f3.gain.value = 2;
  const o1 = audioCtx.createOscillator();
  o1.type = 'sawtooth'; o1.frequency.value = f;
  const o2 = audioCtx.createOscillator();
  o2.type = 'sawtooth'; o2.frequency.value = f * 1.002;
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.7;
  lp.frequency.value = Math.min(6000, f * 8);
  // vibrato fades in after the attack: pitch + slight amplitude undulation
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = viola ? 5.2 : 6.1;
  const lfoG = audioCtx.createGain();
  lfoG.gain.setValueAtTime(0, t);
  lfoG.gain.linearRampToValueAtTime(f * 0.007, t + 0.3);
  lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
  const lfo2 = audioCtx.createOscillator();
  lfo2.frequency.value = viola ? 5.2 : 6.1;
  const lfo2G = audioCtx.createGain();
  lfo2G.gain.value = vol * 0.06;
  const vibG = audioCtx.createGain();
  vibG.gain.value = 1;
  lfo2.connect(lfo2G); lfo2G.connect(vibG.gain);
  // bow noise: rosin grit on attack, quiet hiss while sustaining
  const nsrc = audioCtx.createBufferSource();
  nsrc.buffer = noiseBuf; nsrc.loop = true;
  const nbp = audioCtx.createBiquadFilter();
  nbp.type = 'bandpass';
  nbp.frequency.value = viola ? 2200 : 3200; nbp.Q.value = 0.8;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.02, t);
  ng.gain.exponentialRampToValueAtTime(0.004, t + 0.09);
  ng.gain.setTargetAtTime(0, t + dur, 0.05);
  nsrc.connect(nbp); nbp.connect(ng); ng.connect(g);
  o1.connect(lp); o2.connect(lp); lp.connect(f1);
  f1.connect(f2); f2.connect(f3); f3.connect(vibG); vibG.connect(g); g.connect(musicGain);
  o1.start(t); o2.start(t); lfo.start(t); lfo2.start(t); nsrc.start(t);
  const stop = t + dur + 0.25;
  o1.stop(stop); o2.stop(stop); lfo.stop(stop); lfo2.stop(stop); nsrc.stop(stop);
  trackLive(o1, g);
  if (!viola) lastVin = { g, src: null, midi, endT: t + dur, rateBase: 0 };
}
// real sampled strings (VSCO2 CE, CC0) with performance technique:
// legato slurs (pitch glide, no re-attack), grace notes, dynamic swells
const sampBuf = { violin: {}, viola: {} };
let lastVin = null;                              // { g, src, midi, endT, rateBase }
function cutVin(t) {
  if (lastVin) {
    try {
      lastVin.g.gain.cancelScheduledValues(t);
      lastVin.g.gain.setTargetAtTime(0, t, 0.03);
      if (lastVin.src) lastVin.src.stop(t + 0.2);
    } catch (e) {}
    lastVin = null;
  }
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}
function sampPreload() {
  if (!window.STRING_SAMPLES) return;
  for (const inst of ['violin', 'viola']) {
    for (const k in window.STRING_SAMPLES[inst]) {
      (async () => {
        try {
          sampBuf[inst][k] = await audioCtx.decodeAudioData(b64ToBuf(window.STRING_SAMPLES[inst][k]));
        } catch (e) {}
      })();
    }
  }
}
function sampleString(inst, midi, t, vol, dur, forceAttack) {
  const bank = window.STRING_SAMPLES && window.STRING_SAMPLES[inst];
  if (!bank || !audioCtx) return false;
  const vin = inst === 'violin';
  // grace-note ornament before fresh attacks
  if (vin && !forceAttack && Math.random() < 0.22) {
    sampleString('violin', midi - 1, t - 0.1, vol * 0.5, 0.12, true);
  }
  // slur: glide into the new pitch when close — no re-bow
  const prev = vin ? lastVin : null;
  if (prev && prev.src && !forceAttack && Math.abs(midi - prev.midi) <= 2 && prev.endT >= t - 0.05 && Math.random() < 0.55) {
    const rate = prev.rateBase * Math.pow(2, midi / 12);
    prev.src.playbackRate.cancelScheduledValues(t);
    prev.src.playbackRate.setTargetAtTime(rate, t, 0.07);
    prev.g.gain.cancelScheduledValues(t);
    prev.g.gain.setTargetAtTime(prev.g.gain.value, t, 0.02);
    prev.g.gain.setTargetAtTime(0, t + dur, 0.08);
    prev.src.stop(t + dur + 0.4);
    prev.midi = midi; prev.endT = t + dur;
    return true;
  }
  let best = null, bd = 1e9;
  for (const k in bank) { const d = Math.abs(+k - midi); if (d < bd) { bd = d; best = +k; } }
  const buf = sampBuf[inst][best];
  if (!buf) return false;                        // not decoded yet; synth fallback
  if (vin) cutVin(t);                            // re-bow: new attack
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (midi - best) / 12);
  const g = audioCtx.createGain();
  const swell = dur > 0.9 && Math.random() < 0.5;   // bow-pressure crescendo
  if (swell) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.55, t + 0.06);
    g.gain.linearRampToValueAtTime(vol * 1.05, t + dur * 0.75);
    g.gain.setTargetAtTime(0, t + dur, 0.08);
  } else {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol, t + Math.max(0.08, dur - 0.2));
    g.gain.setTargetAtTime(0, t + dur, 0.06);
  }
  src.connect(g); g.connect(musicGain);
  src.start(t); src.stop(t + dur + 0.4);
  trackLive(src, g);
  if (vin) lastVin = { g, src, midi, endT: t + dur, rateBase: Math.pow(2, -best / 12) };
  return true;
}
function fluteNote(midi, t, vol, dur, swell) {
  const f = MIDI(midi);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  if (swell) {
    g.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.05);
    g.gain.linearRampToValueAtTime(vol, t + dur);   // crest exactly on the next downbeat
  } else {
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  }
  g.gain.setTargetAtTime(0, t + dur, 0.15);
  const o1 = audioCtx.createOscillator();
  o1.type = 'sine'; o1.frequency.value = f;
  const o2 = audioCtx.createOscillator();
  o2.type = 'sine'; o2.frequency.value = f * 2;
  const g2 = audioCtx.createGain();
  g2.gain.value = 0.12;
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 5.8;
  const lfoG = audioCtx.createGain();
  lfoG.gain.setValueAtTime(0, t);
  lfoG.gain.linearRampToValueAtTime(f * 0.004, t + 0.2);
  lfo.connect(lfoG); lfoG.connect(o1.frequency);
  const nsrc = audioCtx.createBufferSource();
  nsrc.buffer = noiseBuf;
  const nbp = audioCtx.createBiquadFilter();
  nbp.type = 'highpass'; nbp.frequency.value = 4000;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.012, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  nsrc.connect(nbp); nbp.connect(ng); ng.connect(g);
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicGain);
  o1.start(t); o2.start(t); lfo.start(t); nsrc.start(t);
  o1.stop(t + dur + 0.3); o2.stop(t + dur + 0.3); lfo.stop(t + dur + 0.3); nsrc.stop(t + 0.08);
  trackLive(o1, g);
}
function boxNote(midi, t, vol, dur) {
  const f = MIDI(midi);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);   // instant strike
  g.gain.setTargetAtTime(0, t + dur, 0.4);               // long shimmering ring
  const mk = (fr, v, det) => {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.value = fr * (1 + det);
    const og = audioCtx.createGain();
    og.gain.value = v;
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + dur + 1.2);
    return o;
  };
  const o1 = mk(f, 0.55, 0);
  mk(f, 0.20, 0.0012);      // shimmer detune pair
  mk(f * 2, 0.10, 0.0008);
  mk(f * 4, 0.12, 0.0004);  // bright strike partial
  mk(f * 3.993, 0.025, 0);  // inharmonic twinkle
  if (noiseBuf) {
    const nsrc = audioCtx.createBufferSource();
    nsrc.buffer = noiseBuf;
    const nbp = audioCtx.createBiquadFilter();
    nbp.type = 'highpass'; nbp.frequency.value = 5000;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(vol * 0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    nsrc.connect(nbp); nbp.connect(ng); ng.connect(g);
    nsrc.start(t); nsrc.stop(t + 0.04);
  }
  trackLive(o1, g);
}
let notesScheduled = 0;
// ---------- generative engine: Infinity + Jazz ----------
// harmony evolves: each 8-bar pass may substitute chords (relative minor / tritone sub);
// melody walks the scale over the chosen chords, resolves to chord tones
const INF_CH_OPTS = [
  { ch: [55,59,62,66], root: 43, subs: [{ ch: [52,55,59,62], root: 40 }] },                              // Gmaj7 -> Em7
  { ch: [52,55,59,62], root: 40, subs: [{ ch: [52,55,59,60], root: 36 }] },                              // Em7 -> Cmaj7
  { ch: [57,60,64,67], root: 45, subs: [{ ch: [52,55,59,60], root: 36 }, { ch: [54,57,60,62], root: 42 }] }, // Am7 -> Cmaj7 / F#m7b5
  { ch: [50,54,57,60], root: 38, subs: [{ ch: [56,60,63,66], root: 44 }] },                              // D7 -> Ab7 tritone
  { ch: [52,55,59,60], root: 36, subs: [{ ch: [57,60,64,67], root: 45 }] },                              // Cmaj7 -> Am7
  { ch: [54,57,59,62], root: 35, subs: [{ ch: [55,59,62,66], root: 43 }] },                              // Bm7 -> Gmaj7
  { ch: [57,60,64,67], root: 45, subs: [{ ch: [52,55,59,60], root: 36 }] },                              // Am7 -> Cmaj7
  { ch: [50,54,57,60], root: 38, subs: [{ ch: [56,60,63,66], root: 44 }] }                               // D7 -> Ab7 tritone
];
const INF_SCALE = [55,57,59,60,62,64,66,67,69,71,72,74,76];
const INF_RHYTHMS = [
  [1,0,1,0,1,0,1,0], [1,0,0,1,0,1,0,0], [1,0,1,0,0,1,0,1],
  [0,1,1,0,1,0,1,0], [1,0,0,0,1,0,1,0], [1,1,0,1,0,0,1,0]
];
// solo violin: dark A-minor nocturne with evolving substitutions
const JAZZ_CH_OPTS = [
  { ch: [57,60,64,67], root: 45, subs: [{ ch: [53,57,60,65], root: 41 }] },                              // Am -> Fmaj7
  { ch: [53,57,60,65], root: 41, subs: [{ ch: [50,53,57,60], root: 38 }] },                              // Fmaj7 -> Dm7
  { ch: [50,53,57,60], root: 38, subs: [{ ch: [47,50,53,57], root: 35 }] },                              // Dm7 -> Bm7b5
  { ch: [52,56,59,62], root: 40, subs: [{ ch: [46,50,53,56], root: 34 }] },                              // E7 -> Bb7 tritone
  { ch: [57,60,64,67], root: 45, subs: [{ ch: [48,52,55,59], root: 36 }] },                              // Am -> Cmaj7
  { ch: [53,57,60,65], root: 41, subs: [{ ch: [50,53,57,60], root: 38 }] },                              // Fmaj7 -> Dm7
  { ch: [47,50,53,57], root: 35, subs: [{ ch: [52,56,59,62], root: 40 }] },                              // Bm7b5 -> E7
  { ch: [52,56,59,62], root: 40, subs: [{ ch: [46,50,53,56], root: 34 }] }                               // E7 -> Bb7 tritone
];
const JZ_SCALE = [57,59,60,62,64,65,67,69,71,72,74,76,77];
// Mirage: sparse night piece — 5/4, ten eighths per bar
const MI_CH_OPTS = [
  { ch: [52,55,59,62], root: 40, subs: [{ ch: [55,59,62,66], root: 43 }] },                              // Em7 -> Gmaj7
  { ch: [60,64,67,71], root: 48, subs: [{ ch: [57,60,64,67], root: 45 }] },                              // Cmaj7 -> Am7
  { ch: [57,60,64,67], root: 45, subs: [{ ch: [53,57,60,64], root: 41 }] },                              // Am7 -> Fmaj7
  { ch: [59,63,66,69], root: 47, subs: [{ ch: [53,57,60,63], root: 41 }] },                              // B7 -> F7 tritone
  { ch: [52,55,59,62], root: 40, subs: [{ ch: [55,59,62,66], root: 43 }] },                              // Em7 -> Gmaj7
  { ch: [55,59,62,66], root: 43, subs: [{ ch: [52,55,59,62], root: 40 }] },                              // Gmaj7 -> Em7
  { ch: [54,57,60,64], root: 42, subs: [{ ch: [60,64,67,71], root: 48 }] },                              // F#m7b5 -> Cmaj7
  { ch: [59,63,66,69], root: 47, subs: [{ ch: [53,57,60,63], root: 41 }] }                               // B7 -> F7 tritone
];
const MI_SCALE = [52,54,55,57,59,60,62,63,64,66,67,69,71,72,74,75,76];
const MI_RHYTHMS = [
  [1,0,0,0,0,0,0,0,0,0], [1,0,0,0,0,0,0,0,1,0], [0,0,0,0,1,0,0,0,0,0], [1,0,0,0,0,0,0,0,0,1], [0,0,0,0,0,0,0,0,1,0], [1,0,0,0,1,0,0,0,1,0]
];
const JZ_RHYTHMS = [
  [1,0,0,0,0,0,0,0], [1,0,0,0,1,0,0,0], [0,0,0,0,1,0,0,0], [1,0,0,0,0,0,1,0]
];
// harp piece: warm D-minor/F-major progression with evolving substitutions
const HARP_CH_OPTS = [
  { ch: [50,53,57,60], root: 38, subs: [{ ch: [53,57,60,65], root: 41 }] },                              // Dm7 -> Fmaj7
  { ch: [46,50,53,57], root: 34, subs: [{ ch: [43,46,50,53], root: 43 }] },                              // Bbmaj7 -> Gm7
  { ch: [53,57,60,64], root: 41, subs: [{ ch: [50,53,57,60], root: 38 }] },                              // Fmaj7 -> Dm7
  { ch: [48,52,55,58], root: 36, subs: [{ ch: [42,46,49,52], root: 42 }] },                              // C7 -> Gb7 tritone
  { ch: [50,53,55,58], root: 43, subs: [{ ch: [46,50,53,57], root: 34 }] },                              // Gm7 -> Bbmaj7
  { ch: [45,48,52,55], root: 45, subs: [{ ch: [53,57,60,64], root: 41 }] },                              // Am7 -> Fmaj7
  { ch: [46,50,53,57], root: 34, subs: [{ ch: [50,53,55,58], root: 43 }] },                              // Bbmaj7 -> Gm7
  { ch: [48,52,55,58], root: 36, subs: [{ ch: [42,46,49,52], root: 42 }] }                               // C7 -> Gb7 tritone
];
const HARP_SCALE = [53,55,57,58,60,62,64,65,67,69,70,72,74,76,77];
const HARP_RHYTHMS = [
  [1,0,0,0,0,0,0,0], [1,0,0,0,1,0,0,0], [0,0,0,0,1,0,0,0], [1,0,0,0,0,0,1,0]
];
// waltz: Bb major in 3/4, six eighths per bar
const VALSE_CH_OPTS = [
  { ch: [50,53,58,62], root: 46, subs: [{ ch: [50,53,55,58], root: 43 }] },                              // Bb -> Gm
  { ch: [50,53,55,58], root: 43, subs: [{ ch: [46,50,53,58], root: 46 }] },                              // Gm -> Bb
  { ch: [51,55,58,62], root: 39, subs: [{ ch: [48,51,55,60], root: 36 }] },                              // Eb -> Cm
  { ch: [53,57,60,63], root: 41, subs: [{ ch: [47,51,54,57], root: 35 }] },                              // F7 -> B7 tritone
  { ch: [50,53,58,62], root: 46, subs: [{ ch: [50,53,55,58], root: 43 }] },                              // Bb -> Gm
  { ch: [51,55,58,62], root: 39, subs: [{ ch: [48,51,55,60], root: 36 }] },                              // Eb -> Cm
  { ch: [50,53,55,58], root: 43, subs: [{ ch: [46,50,53,58], root: 46 }] },                              // Gm -> Bb
  { ch: [53,57,60,63], root: 41, subs: [{ ch: [47,51,54,57], root: 35 }] }                               // F7 -> B7 tritone
];
const VALSE_SCALE = [55,57,58,60,62,63,65,67,69,70,72,74,75,77];
const VALSE_RHYTHMS = [
  [1,0,0,0,1,0], [1,0,0,0,0,0], [0,0,0,0,1,0], [1,0,0,1,0,0], [1,0,0,0,0,1], [0,0,0,0,0,1]
];
let infSeed = 1, infMel = [], infBars = 0, infLast = 72, infPrevRhythm = null;
let infPasses = [], infPassN = 0;
function infReset() {
  infMel = []; infBars = 0; infLast = 72; infPrevRhythm = null;
  infPasses = []; infPassN = 0;
  if (window.crypto && crypto.getRandomValues) { infSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1; }
  else infSeed = ((Date.now() & 0xFFFF) ^ ((performance.now() * 1000) & 0xFFFF)) + 1;
}
function infRnd() { infSeed = (infSeed * 1664525 + 1013904223) >>> 0; return infSeed / 4294967296; }
const infStyle = () => {
  const tr = TRACKS[trackIdx];
  if (tr && tr.box) return 'box';
  if (tr && tr.wtz) return 'waltz';
  if (tr && tr.pno) return 'harp';
  if (tr && tr.jazz) return 'jazz';
  return 'inf';
};
const infJazz = () => infStyle() === 'jazz';
function nearestIn(scale, p) {
  let best = scale[0];
  for (const s of scale) if (Math.abs(s - p) < Math.abs(best - p)) best = s;
  return best;
}
function infNewPass() {
  const OPTS = { jazz: JAZZ_CH_OPTS, harp: HARP_CH_OPTS, waltz: VALSE_CH_OPTS, box: MI_CH_OPTS }[infStyle()] || INF_CH_OPTS;
  for (let s = 0; s < 8; s++) {
    const opt = OPTS[s];
    const pick = (infRnd() < 0.3 && opt.subs.length) ? opt.subs[Math.floor(infRnd() * opt.subs.length)] : opt;
    infPasses.push({ ch: pick.ch, root: pick.root });
  }
  infPassN++;
}
function infCh(bar) {
  const pass = Math.floor(bar / 8);
  while (infPassN <= pass) infNewPass();
  return infPasses[bar];
}
function infBar(bar) {
  const st = infStyle();
  const BL = TRACKS[trackIdx].steps || 8;
  const scale = st === 'jazz' ? JZ_SCALE : st === 'harp' ? HARP_SCALE : st === 'waltz' ? VALSE_SCALE : st === 'box' ? MI_SCALE : INF_SCALE;
  const rhythms = st === 'jazz' ? JZ_RHYTHMS : st === 'harp' ? HARP_RHYTHMS : st === 'waltz' ? VALSE_RHYTHMS : st === 'box' ? MI_RHYTHMS : INF_RHYTHMS;
  const hi = st === 'jazz' ? 79 : 76;
  const ch = infCh(bar).ch;
  const slot = bar % 8;
  const phrased = st === 'waltz' || st === 'box';
  const TON = st === 'waltz' ? [58, 70] : [64, 76];
  let rhythm = (infPrevRhythm && infRnd() < 0.35) ? infPrevRhythm : rhythms[Math.floor(infRnd() * rhythms.length)];
  if (phrased && slot === 4 && infRnd() < 0.6) rhythm = st === 'box' ? [0,0,0,0,0,0,0,0,0,1] : [0,0,0,0,0,1];   // pickup launches phrase B
  infPrevRhythm = rhythm;
  const notes = new Array(BL).fill(0);
  for (let i = 0; i < BL; i++) {
    if (!rhythm[i]) continue;
    const strong = (i === 0 || i === 4 || (BL === 10 && i === 8));
    let p, crestLeap = false;
    if (strong) {
      if (phrased) {   // phrase shape: crest on bar 3, settle on bar 7, mild climb in phrase A
        if (slot === 3) { crestLeap = infRnd() < 0.5; p = nearestIn(scale, ch[2 + Math.floor(infRnd() * 2)] + (crestLeap ? 12 : 0)); if (infRnd() < 0.15) { crestLeap = false; p = ch[Math.floor(infRnd() * ch.length)]; } }
        else if (slot === 7) { p = ch[Math.floor(infRnd() * 2)]; if (infRnd() < 0.15) p = ch[Math.floor(infRnd() * ch.length)]; }
        else if (slot < 4) { p = ch[2 + Math.floor(infRnd() * (ch.length - 2))]; if (infRnd() < 0.25) p = ch[Math.floor(infRnd() * ch.length)]; }
        else p = ch[Math.floor(infRnd() * ch.length)];
      } else p = ch[Math.floor(infRnd() * ch.length)];
    } else if (infRnd() < 0.5) {
      const dir = (phrased && slot === 3 && infRnd() < 0.75) ? 1 : (phrased && slot < 4 && infRnd() < 0.68) ? 1 : (infRnd() < 0.5 ? -1 : 1);
      const steps = 1 + Math.floor(infRnd() * 2);
      p = nearestIn(scale, infLast + dir * steps * 2);      // stepwise motion
    } else p = ch[Math.floor(infRnd() * ch.length)];
    if (!crestLeap && Math.abs(p - infLast) > 5) p = nearestIn(scale, infLast + (p > infLast ? 2 : -2));
    if (p > hi) p = nearestIn(scale, p - 7);
    if (p < 55) p = nearestIn(scale, p + 7);
    infLast = p;
    notes[i] = p;
  }
  if (infRnd() < 0.7) {
    const ct = ch.filter(x => x >= 55);
    let end = ct[Math.floor(infRnd() * ct.length)];
    if (Math.abs(end - infLast) > 5) end = nearestIn(scale, infLast + (end > infLast ? 2 : -2));
    notes[BL - 1] = end;
  }
  if (phrased) {   // 4-bar question / 4-bar answer
    if (slot === 3) {     // question: end unresolved on a non-tonic chord tone
      const ct = ch.filter(x => x >= 55 && !TON.includes(x));
      if (ct.length) {
        let end = ct[Math.floor(infRnd() * ct.length)];
        if (Math.abs(end - infLast) > 5) end = nearestIn(scale, infLast + (end > infLast ? 2 : -2));
        notes[BL - 1] = end;
      }
    } else if (slot === 7) {   // answer: land on the tonic
      notes[BL - 1] = Math.abs(infLast - TON[0]) < Math.abs(infLast - TON[1]) ? TON[0] : TON[1];
    }
  }
  return notes;
}
function infMelAt(i) {
  const BL = TRACKS[trackIdx].steps || 8;
  const bar = Math.floor(i / BL);
  while (infBars <= bar) { infMel = infMel.concat(infBar(infBars)); infBars++; }
  return infMel[i];
}
function infBassAt(i) {
  const st = infStyle();
  const BL = TRACKS[trackIdx].steps || 8;
  const bar = Math.floor(i / BL);
  const root = infCh(bar).root;
  if (st === 'box') return (i % BL === 0) ? root : 0;      // root alone at each bar
  if (st === 'waltz') {                                   // oom-pah-pah: root / fifth / octave
    const s = i % BL;
    if (s === 0) return root;
    if (s === 2) return root + 7;
    if (s === 4) return root + 12;
    return 0;
  }
  if (!infJazz()) {
    if (i % BL === 0) return root;
    if (i % BL === 4) return infRnd() < 0.5 ? root + 7 : root + 12;
    return 0;
  }
  // gentle half-note bass: root on 1, fifth/octave on 3
  const s = i % BL;
  if (s === 0) return root;
  if (s === 4) return infRnd() < 0.5 ? root + 7 : root + 12;
  return 0;
}
function jazzComp(i) {
  const bar = Math.floor(i / 8);
  const s = i % 8;
  if ((s === 3 || s === 7) && infRnd() < 0.45) return infCh(bar).ch;   // sparse piano stabs
  return null;
}
function violaAt(i) {
  const s = i % 8;
  if (s !== 0 && s !== 4) return null;
  const ch = infCh(Math.floor(i / 8)).ch;
  return { m: ch[1 + Math.floor(infRnd() * 2)], dur: stepDur() * 3.6 };   // held 3rd/5th
}
function harpAt(i) {
  const s = i % 8;
  if (s >= 4) return 0;
  const up = infCh(Math.floor(i / 8)).ch.map(x => x + 12);
  return up[s];                                                   // rising arpeggio
}
function saxFillAt(i) {
  const bar = Math.floor(i / 8);
  const s = i % 8;
  if (bar % 4 !== 3) return 0;
  const ch = infCh(bar).ch;
  if (s === 5) return ch[3];                                     // phrase-end answering lick
  if (s === 6) return ch[2];
  if (s === 7) return infCh(bar + 1).root + 12;
  return 0;
}
function infDrumAt(i) {
  const jz = infJazz();
  const s = i % 8;
  if (!jz) {
    if (s === 0) return 'k';
    if (s === 2 || s === 6) return 'h';
    if (s === 7 && Math.floor(i / 8) % 4 === 3) return 'f';
    return 0;
  }
  if (s === 0 || s === 4) return 'f';
  if (s === 2 || s === 6) return 'b';
  if (s === 7 && Math.floor(i / 8) % 2 === 1) return 'R';
  return 'r';
}
function scheduleStep(i, t) {
  notesScheduled++;
  const tr = TRACKS[trackIdx];
  const gen = !!tr.gen;
  const jz = !!tr.jazz;
  const spb = tr.steps || 8;
  const bar = Math.floor(i / spb);
  const piano = !!tr.piano;
  const parts = piano ? PIANO_PARTIALS : PARTIALS;
  const brk = gen && Math.floor(bar / 8) % 4 === 3;   // every 4th pass: breakdown
  const arc = tr.wtz ? 0.85 + 0.15 * Math.min(1, (bar % 8) / 3) : 1;   // phrase A swells in, phrase B full
  if (tr.swing && i % 2 === 1) t += stepDur() * tr.swing;   // swung offbeats
  const b = gen ? infBassAt(i) : tr.bass[i];
  if (b) {
    if (tr.wtz) {   // boom(1) - soft(2) - pah(3) hierarchy
      const s = i % spb;
      pluck(b, t, s === 0 ? 0.34 : s === 2 ? 0.16 : 0.24, s === 0 ? 1.1 : 0.35, parts);
    } else if (tr.box) pluck(b, t, 0.17, 3.0, parts);   // distant root under the silence
    else pluck(b, t, jz ? 0.30 : 0.32, jz ? 1.6 : (piano ? 2.4 : 1.5), jz ? BASS_PARTIALS : parts);
  }
  const a = gen ? 0 : tr.arp[i];
  if (a) pluck(a, t, 0.07, 1.0, parts);
  const m = gen ? infMelAt(i) : tr.melody[i];
  if (m && !brk && (musicLoop % 2 === 0 || gen)) {
    if (jz) { if (!sampleString('violin', m, t, 0.5, 2.6)) { cutVin(t); stringNote(m, t, 0.12, 2.6, false); } }
    else if (tr.pno) harpNote(m, t, 0.13, 2.4);
    else if (tr.wtz) fluteNote(m, t, (i % spb === 4 ? 0.13 : 0.12) * arc, i % spb === 4 ? 0.55 : 1.6, i % spb === 4);   // beat-3 notes lift into the downbeat
    else if (tr.box) boxNote(m, t, 0.21, 2.8);
    else pluck(m, t, 0.16, 1.3, parts);
  }
  if (jz) {
  } else if (tr.pno) {
    const AP = [0, 1, 2, 3, 2, 1, 0, 1];
    if (i % 2 === 0) harpNote(infCh(bar).ch[AP[i % 8]], t, 0.06 * (brk ? 0.5 : 1), 1.5);   // sparse arp bed
  } else if (tr.wtz) {
    // soft chord on beat 3 completes the oom-pah-pah
    const ch = infCh(bar).ch;
    if (ch && i % spb === 4) {
      for (const tone of ch.slice(0, 3)) pluck(tone, t, 0.10 * arc * (brk ? 0.5 : 1), 0.5, parts);
    }
  } else if (tr.box) {
    // slow turning mechanism: soft chord-tone stream on the quarter grid
    const AP = [0, 1, 2, 3, 2, 1, 0, 2, 3, 1];
    if (i % 2 === 0 && bar % 8 !== 3) boxNote(infCh(bar).ch[AP[i % 10]], t, 0.11 * (brk ? 0.5 : 1), 1.2);   // mechanism holds its breath at the crest
  } else if (!tr.box) {
    const ch = gen ? infCh(bar).ch : (tr.chords && tr.chords[bar]);
    if (ch && (i % spb === 2 || i % spb === 4)) {
      for (const tone of ch) pluck(tone, t, 0.13 * (brk ? 0.5 : 1), 1.2, parts);
    }
  }
  if (true) {
    const padtones = gen ? infCh(bar).ch.slice(0, 3) : (tr.pads && tr.pads[bar]);
    if (i % spb === 0 && (musicLoop % 2 === 0 || gen) && padtones && padtones.length) {
      const dur = stepDur() * spb;
      const pv = (tr.vinyl ? 0.035 : 0.026) * (jz ? 0.8 : 1) * (brk ? 0.6 : 1) * (tr.wtz ? arc : 1) * (tr.box ? 1.2 : 1);
      for (const tone of padtones) padNote(tone, t, pv, dur);
    }
  }
  if (tr.drums) {
    const dr = tr.drums[i];
    if (dr === 'k') mKick(t);
    else if (dr === 'f') mFeather(t);
    else if (dr === 'c') mChick(t);
    else if (dr === 's') mSnare(t);
    else if (dr === 'h') shaker(t);
  } else if (gen && !jz && !tr.pno && !tr.wtz && !tr.box) {
    const dr = infDrumAt(i);
    if (dr === 'k') mKick(t);
    else if (dr === 'f') mFeather(t);
    else if (dr === 'h') shaker(t);
  } else if (!piano && !jz && !tr.wtz && !tr.box) {
    shaker(t);
  }
  if (tr.vinyl && Math.random() < 0.05) mCrackle(t);   // dusty pops
}
let vinylGain = null, reverbWet = null;
function startMusic() {
  if (musicTimer || !audioCtx) return;
  musicGain = audioCtx.createGain();
  musicGain.gain.value = musicOn ? 0.9 : 0;
  musicGain.connect(audioCtx.destination);
  // room reverb: synthesized impulse response, wet level per track
  const imp = audioCtx.createBuffer(2, Math.floor(audioCtx.sampleRate * 2.2), audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = imp.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6);
  }
  const conv = audioCtx.createConvolver();
  conv.buffer = imp;
  reverbWet = audioCtx.createGain();
  reverbWet.gain.value = TRACKS[trackIdx].reverb || 0.15;
  musicGain.connect(conv); conv.connect(reverbWet); reverbWet.connect(audioCtx.destination);
  noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.005, audioCtx.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // vinyl dust: looping low hiss, audible only on vinyl tracks
  const hissBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
  {
    const d = hissBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
  }
  const hiss = audioCtx.createBufferSource();
  hiss.buffer = hissBuf; hiss.loop = true;
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3200;
  vinylGain = audioCtx.createGain();
  vinylGain.gain.value = TRACKS[trackIdx].vinyl ? 0.010 : 0;
  hiss.connect(lp); lp.connect(vinylGain); vinylGain.connect(musicGain);
  hiss.start();
  sampPreload();
  musicNext = audioCtx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    const tr = TRACKS[trackIdx];
    // generative tracks: advance after ~100s instead of looping
    if (tr.gen && recycle && audioCtx.currentTime - (trackStartAt || 0) > 100) {
      selectTrack(TRACKS[(trackIdx + 1) % TRACKS.length].name);
      return;
    }
    // 1s lookahead: ample buffer; when behind, SKIP stale steps (never burst)
    while (musicNext < audioCtx.currentTime + 2.0) {
      if (musicNext >= audioCtx.currentTime - 0.01) scheduleStep(musicStep, musicNext);
      if (tr.gen) { musicStep++; }
      else {
        musicStep = (musicStep + 1) % tr.melody.length;
        if (musicStep === 0) onLoopWrap();
      }
      musicNext += stepDur();
    }
  }, 200);
}
function onLoopWrap() {
  musicLoop++;
  loopsInTrack++;
  const target = TRACKS[trackIdx].loops || 2;
  if (recycle && loopsInTrack >= target) {
    selectTrack(TRACKS[(trackIdx + 1) % TRACKS.length].name);
  }
}
function toggleRecycle() {
  recycle = !recycle;
  localStorage.setItem('flappy-recycle', recycle ? 'on' : 'off');
  click();
}
function selectTrack(name) {
  const idx = TRACKS.findIndex(t => t.name === name);
  if (idx < 0 || idx === trackIdx) return;
  trackIdx = idx;
  localStorage.setItem('flappy-track', name);
  musicStep = 0; musicLoop = 0; loopsInTrack = 0;
  trackStartAt = audioCtx ? audioCtx.currentTime : 0;
  if (TRACKS[trackIdx].gen) infReset();
  if (audioCtx) {
    musicNext = audioCtx.currentTime + 0.1;
    // kill all pending/sounding notes so tracks don't overlap
    const now = audioCtx.currentTime;
    for (const g of liveNotes) {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.03);
    }
    liveNotes.clear();
  }
  if (vinylGain && audioCtx) {
    vinylGain.gain.setTargetAtTime(TRACKS[trackIdx].vinyl ? 0.010 : 0, audioCtx.currentTime, 0.2);
  }
  if (reverbWet && audioCtx) {
    reverbWet.gain.setTargetAtTime(TRACKS[trackIdx].reverb || 0.15, audioCtx.currentTime, 0.4);
  }
  click();
}
function cycleTrack() {
  selectTrack(TRACKS[(trackIdx + 1) % TRACKS.length].name);
}
function toggleMusic() {
  musicOn = !musicOn;
  localStorage.setItem('flappy-music', musicOn ? 'on' : 'off');
  if (musicGain && audioCtx) {
    musicGain.gain.setTargetAtTime(musicOn ? 0.9 : 0, audioCtx.currentTime, 0.08);
  }
}
// pause in background tabs; re-claim playback when visible (mutes older tabs)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    try { localStorage.setItem('flappy-tab', myTabId); } catch (e) {}
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (musicGain && audioCtx) {
      musicGain.gain.setTargetAtTime(musicOn ? 0.9 : 0, audioCtx.currentTime, 0.3);
    }
  }
});
window.addEventListener('storage', (e) => {
  if (e.key === 'flappy-tab' && e.newValue !== myTabId) {
    if (musicGain && audioCtx) musicGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
  }
});

window.Music = {
  init: initAudio,
  tracks: TRACKS,
  trackName: () => TRACKS[trackIdx].name,
  trackIdx: () => trackIdx,
  selectTrack,
  cycleTrack,
  toggleMute: toggleMusic,
  toggleRecycle,
  state: () => ({ on: musicOn, recycle, running: !!musicTimer, trackName: TRACKS[trackIdx].name, loops: loopsInTrack, genBars: infBars, genPasses: infPassN, notes: notesScheduled, sampled: Object.keys(sampBuf.violin).length + Object.keys(sampBuf.viola).length }),
};
})();
