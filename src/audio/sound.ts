// All of the game's sound, made in code. There are no audio files: every
// effect is built from two raw ingredients the browser can generate itself,
// a pitched tone and a burst of hiss (noise), shaped by how loud they are
// over time and how their pitch slides. That is how early game consoles made
// sound, which suits the pixel look and adds nothing to the download.

let context: AudioContext | undefined;
let master: GainNode | undefined;
let muted = false;

try {
  muted = window.localStorage.getItem('loading-bar-muted') === '1';
} catch {
  // Storage unavailable: start unmuted.
}

// Phaser already owns an audio context and unlocks it on the player's first
// click (browsers forbid sound before that), so we borrow it.
export function setAudioContext(audio: AudioContext) {
  context = audio;
  master = audio.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(audio.destination);
}

// Wakes the audio up. Browsers only allow this inside a click handler, so
// the START button calls it; the promise resolves once sound can play.
export function unlockAudio() {
  return context && context.state !== 'running' ? context.resume() : Promise.resolve();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  try {
    window.localStorage.setItem('loading-bar-muted', muted ? '1' : '0');
  } catch {
    // Not remembered next time; still muted for now.
  }
  return muted;
}

// Sound may only be scheduled once the context is running, otherwise
// everything asked for before the first click would play at once after it.
const ready = () => context !== undefined && master !== undefined && context.state === 'running';

interface Tone {
  freq: number; // pitch in hertz at the start ...
  to?: number; // ... and at the end, if it slides
  dur: number; // seconds
  type?: OscillatorType; // square = classic chip sound, triangle = soft, sawtooth = buzzy, sine = pure
  vol?: number;
  delay?: number; // seconds from now
}

function tone({ freq, to, dur, type = 'square', vol = 0.18, delay = 0 }: Tone) {
  if (!ready()) return;
  const start = context!.currentTime + delay;
  const oscillator = context!.createOscillator();
  const gain = context!.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, start);
  if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + dur);
  // A fast fade in and a fade out, so the tone does not click on and off.
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  oscillator.connect(gain).connect(master!);
  oscillator.start(start);
  oscillator.stop(start + dur + 0.02);
}

interface Noise {
  dur: number;
  vol?: number;
  delay?: number;
  filter?: BiquadFilterType; // lowpass = thud, highpass = hiss, bandpass = whoosh
  freq?: number; // where the filter sits ...
  to?: number; // ... and where it sweeps to
}

let hiss: AudioBuffer | undefined;

function noise({ dur, vol = 0.2, delay = 0, filter = 'lowpass', freq = 1000, to }: Noise) {
  if (!ready()) return;
  if (!hiss) {
    // One second of random numbers = white noise, made once and reused.
    hiss = context!.createBuffer(1, context!.sampleRate, context!.sampleRate);
    const samples = hiss.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const start = context!.currentTime + delay;
  const source = context!.createBufferSource();
  source.buffer = hiss;
  source.loop = true;
  const shaper = context!.createBiquadFilter();
  shaper.type = filter;
  shaper.frequency.setValueAtTime(freq, start);
  if (to) shaper.frequency.exponentialRampToValueAtTime(to, start + dur);
  const gain = context!.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  source.connect(shaper).connect(gain).connect(master!);
  source.start(start);
  source.stop(start + dur + 0.02);
}

// Plays notes one after another. Notes are named by their distance in
// semitones from the A above middle C (so 0 = A, 3 = C, 7 = E, 12 = the next A).
const pitch = (semitones: number) => 440 * Math.pow(2, semitones / 12);
function tune(notes: number[], step: number, options: Partial<Tone> = {}) {
  notes.forEach((note, i) => tone({ freq: pitch(note), dur: step * 1.6, ...options, delay: i * step + (options.delay ?? 0) }));
}

// ---- The effects, by name ----

export const sfx = {
  // Interface
  click: () => tone({ freq: 660, to: 990, dur: 0.07 }),
  pop: () => tone({ freq: 320, to: 760, dur: 0.09, type: 'triangle', vol: 0.25 }),
  blip: () => tone({ freq: 880, dur: 0.06, type: 'triangle', vol: 0.2 }),
  tick: () => tone({ freq: 1400, dur: 0.025, type: 'square', vol: 0.08 }),
  star: (n: number) => tone({ freq: pitch(3 + n * 2), dur: 0.12, type: 'triangle', vol: 0.22 }),
  start: () => tune([3, 7, 10, 15], 0.09),

  // Main screen
  error: () => {
    tone({ freq: 196, dur: 0.16, type: 'sawtooth', vol: 0.2 });
    tone({ freq: 147, dur: 0.3, type: 'sawtooth', vol: 0.2, delay: 0.17 });
  },
  solved: () => tune([3, 7, 10, 15, 19], 0.07, { type: 'triangle', vol: 0.22 }),
  complete: () => tune([3, 3, 3, 7, 10, 7, 10, 15, 19, 22], 0.11, { vol: 0.2 }),

  // Minigames in general
  win: () => tune([10, 15, 19, 22], 0.08),
  ouch: () => tone({ freq: 180, to: 80, dur: 0.18, type: 'sawtooth', vol: 0.22 }),
  refresh: () => tone({ freq: 440, to: 55, dur: 0.6, type: 'sawtooth', vol: 0.22 }),
  glitch: () => noise({ dur: 0.04, vol: 0.06, filter: 'highpass', freq: 3000 }),

  // Particular minigames
  crunch: () => {
    noise({ dur: 0.05, vol: 0.25, filter: 'bandpass', freq: 1800 });
    noise({ dur: 0.06, vol: 0.2, filter: 'bandpass', freq: 1300, delay: 0.08 });
  },
  wake: () => tune([15, 22], 0.06, { type: 'triangle', vol: 0.22 }),
  turn: () => tone({ freq: 520, dur: 0.04, type: 'square', vol: 0.12 }),
  zap: () => tone({ freq: 900, to: 120, dur: 0.16, type: 'square', vol: 0.16 }),
  whoosh: () => noise({ dur: 0.12, vol: 0.14, filter: 'bandpass', freq: 500, to: 2400 }),
  thump: () => {
    noise({ dur: 0.1, vol: 0.3, freq: 220 });
    tone({ freq: 110, to: 60, dur: 0.12, type: 'sine', vol: 0.3 });
  },
  meow: () => {
    tone({ freq: 620, to: 980, dur: 0.14, type: 'sine', vol: 0.2 });
    tone({ freq: 980, to: 520, dur: 0.22, type: 'sine', vol: 0.2, delay: 0.14 });
  },
  roundPass: () => tune([15, 22], 0.07),
  crash: () => {
    noise({ dur: 0.9, vol: 0.3, filter: 'lowpass', freq: 3000, to: 200 });
    tone({ freq: 110, to: 40, dur: 0.9, type: 'sawtooth', vol: 0.25 });
  },

  // Cutscenes
  creak: () => tone({ freq: 170, to: 260, dur: 0.45, type: 'sawtooth', vol: 0.07 }),
  step: () => noise({ dur: 0.06, vol: 0.16, freq: 300 }),
  yawn: () => tone({ freq: 420, to: 190, dur: 0.9, type: 'sine', vol: 0.14 }),
  clink: () => tone({ freq: 2100, dur: 0.08, type: 'triangle', vol: 0.14 }),
  slide: () => noise({ dur: 0.7, vol: 0.1, filter: 'bandpass', freq: 900, to: 300 }),
  slurp: () => [0, 0.16, 0.32, 0.5].forEach((delay) => noise({ dur: 0.12, vol: 0.12, filter: 'bandpass', freq: 600, to: 1500, delay })),
  sigh: () => noise({ dur: 0.7, vol: 0.07, filter: 'bandpass', freq: 1200, to: 500 }),
  boot: () => {
    tone({ freq: 1200, dur: 0.05, vol: 0.12 });
    tune([3, 10, 15], 0.12, { type: 'triangle', vol: 0.18, delay: 0.15 });
    tone({ freq: 70, dur: 1.0, type: 'sawtooth', vol: 0.06, delay: 0.25 }); // the fan
  },
  sadTrombone: () => [10, 9, 8, 7].forEach((note, i) => tone({ freq: pitch(note - 12), to: pitch(note - 12.6), dur: i === 3 ? 0.7 : 0.26, type: 'sawtooth', vol: 0.16, delay: i * 0.28 })),
  drum: () => {
    tone({ freq: 140, to: 50, dur: 0.2, type: 'sine', vol: 0.4 });
    noise({ dur: 0.05, vol: 0.12, freq: 800 });
  },
  growl: () => tone({ freq: 95, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.18 }),
  clockSpin: () => {
    for (let i = 0; i < 26; i++) tone({ freq: 1500, dur: 0.02, vol: 0.07, delay: i * 0.09 });
  },
  rattle: () => {
    for (let i = 0; i < 12; i++) noise({ dur: 0.05, vol: 0.2, filter: 'bandpass', freq: 500 + (i % 3) * 300, delay: i * 0.1 });
  },
  dive: () => {
    noise({ dur: 0.9, vol: 0.2, filter: 'bandpass', freq: 300, to: 5000 });
    tone({ freq: 110, to: 1760, dur: 0.9, type: 'sawtooth', vol: 0.1 });
  },
  pullOut: () => {
    noise({ dur: 1.1, vol: 0.18, filter: 'bandpass', freq: 5000, to: 300 });
    tone({ freq: 1760, to: 110, dur: 1.1, type: 'sawtooth', vol: 0.08 });
  },
  gasp: () => noise({ dur: 0.25, vol: 0.12, filter: 'bandpass', freq: 500, to: 2500 }),
  cheer: () => tune([3, 7, 10, 15, 10, 15, 19], 0.08),
  // A shout that swells for exactly as long as the ending lets it live.
  shout: (seconds: number) => {
    tone({ freq: 300, to: 240, dur: seconds, type: 'sawtooth', vol: 0.3 });
    tone({ freq: 604, to: 470, dur: seconds, type: 'square', vol: 0.1 });
  },
};

// ---- Music: short loops played by a tiny step sequencer ----

interface Loop {
  tempo: number; // steps per second
  lead: (number | null)[]; // one entry per step: a note, or null for a rest
  bass: (number | null)[];
}

const LOOPS: Record<string, Loop> = {
  // Cheerful and steady: the line is running.
  work: {
    tempo: 7,
    lead: [3, null, 7, null, 10, null, 7, null, 5, null, 8, null, 12, null, 8, null, 3, null, 7, null, 10, 12, 15, null, 14, null, 10, null, 7, null, 5, null],
    bass: [-21, null, null, -21, null, null, -21, null, -19, null, null, -19, null, null, -19, null, -21, null, null, -21, null, null, -21, null, -14, null, null, -14, null, -16, null, -17],
  },
  // Faster and in a minor key: a minigame against the clock.
  hurry: {
    tempo: 9,
    lead: [0, null, 3, 0, 7, null, 3, null, 0, null, 3, 0, 8, null, 7, null, -2, null, 2, -2, 5, null, 2, null, -2, null, 2, 5, 7, 5, 3, 2],
    bass: [-24, null, -24, null, -24, null, -24, null, -24, null, -24, null, -24, null, -24, null, -26, null, -26, null, -26, null, -26, null, -26, null, -26, null, -19, null, -19, null],
  },
  // Our own stand-in for the famous song, for when the real video cannot play.
  dance: {
    tempo: 8,
    lead: [3, 5, 8, 5, 12, null, 12, null, 10, null, null, null, 3, 5, 8, 5, 10, null, 10, null, 8, null, 7, 5, 3, 5, 8, 5, 8, null, 10, null],
    bass: [-21, null, -9, null, -21, null, -9, null, -16, null, -4, null, -16, null, -4, null, -19, null, -7, null, -19, null, -7, null, -14, null, -2, null, -14, null, -2, null],
  },
};

let playing: { name: string; timer: number } | undefined;

export const music = {
  play(name: keyof typeof LOOPS) {
    if (playing?.name === name) return;
    music.stop();
    const loop = LOOPS[name];
    let step = 0;
    // Each tick plays one step. setInterval is not perfectly steady, which
    // gives the loop a slightly wobbly, home-made feel.
    const timer = window.setInterval(() => {
      const lead = loop.lead[step % loop.lead.length];
      const bass = loop.bass[step % loop.bass.length];
      if (lead !== null) tone({ freq: pitch(lead), dur: 0.16, type: 'square', vol: 0.07 });
      if (bass !== null) tone({ freq: pitch(bass), dur: 0.22, type: 'triangle', vol: 0.16 });
      if (step % 4 === 2) noise({ dur: 0.03, vol: 0.04, filter: 'highpass', freq: 5000 });
      step++;
    }, 1000 / loop.tempo);
    playing = { name, timer };
  },
  stop() {
    if (playing) window.clearInterval(playing.timer);
    playing = undefined;
  },
};
