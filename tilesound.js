/*
 * Tile Drop music and sound effects, made in the browser (no audio files).
 *
 * Music: "Neon Stack", an original 8-bit loop in A minor that speeds up a
 * little each level. Effects: a soft thud when a piece lands, a chime for
 * clearing lines (bigger for 4 at once), and a short game-over tune.
 * Sound can be switched off; the choice is remembered on this device.
 * Web audio follows the iPhone's silent switch.
 */
(function (root) {
  "use strict";

  const SOUND_KEY = "dailyGameHubTileSound";

  const BPM = 140;

  // Each bar is 16 steps (16th notes): a note like "E5", "-" holds the
  // last note, "." is a rest. Drums: k = kick, s = snare, h = hi-hat.
  const LEAD = [
    "E5 - . E5 C5 - D5 - E5 - A4 - C5 - B4 -",
    "A4 - - - C5 - F5 - E5 - D5 - C5 - A4 -",
    "G4 - C5 - E5 - G5 - - - E5 - D5 - C5 -",
    "D5 - - B4 - G4 B4 - D5 - G5 - F5 - D5 -"
  ];

  const BASS = [
    "A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .",
    "F2 . F3 . F2 . F3 . F2 . F3 . F2 . F3 .",
    "C3 . C2 . C3 . C2 . C3 . C2 . C3 . C2 .",
    "G2 . G3 . G2 . G3 . G2 . G3 . B2 . D3 ."
  ];

  const DRUMS =
    "k . h . s . h . k . k h s . h h".split(" ");

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };


  function freq(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name);

    if (!m) {
      return null;
    }

    const midi =
      12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);

    return 440 * Math.pow(2, (midi - 69) / 12);
  }


  // "E5 - . C5" -> one entry per step: { f, steps } where a note starts.
  function parse(bars) {
    const tokens = bars.join(" ").trim().split(/\s+/);
    const events = new Array(tokens.length).fill(null);
    let last = -1;

    tokens.forEach((token, i) => {
      if (token === "-") {
        if (last >= 0) {
          events[last].steps += 1;
        }
        return;
      }

      if (token === ".") {
        last = -1;
        return;
      }

      events[i] = { f: freq(token), steps: 1 };
      last = i;
    });

    return events;
  }

  const leadEvents = parse(LEAD);
  const bassEvents = parse(BASS);


  // Music tempo for a game level: about 3% faster a level, up to 35%.
  function speedFor(level) {
    return Math.min(1.35, 1 + (Math.max(1, level) - 1) * 0.03);
  }


  function isOn() {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch (error) {
      return true;
    }
  }


  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let speed = 1;
  let playing = false;


  function setup() {
    if (ctx) {
      return true;
    }

    const AudioCtx =
      root.AudioContext || root.webkitAudioContext;

    if (!AudioCtx) {
      return false;
    }

    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);

    const data =
      noiseBuffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    return true;
  }


  function tone(type, f, start, dur, vol, cutoff) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    let out = osc;

    osc.type = type;
    osc.frequency.value = f;

    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      osc.connect(filter);
      out = filter;
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    gain.gain.setValueAtTime(vol, start + Math.max(0.02, dur - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    out.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }


  function noise(start, dur, vol, highpass) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    src.buffer = noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(start);
    src.stop(start + dur + 0.02);
  }


  function kick(start) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(45, start + 0.12);
    gain.gain.setValueAtTime(0.9, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + 0.18);
  }


  // Queue the next bit of music a little ahead of time.
  function schedule() {
    while (nextTime < ctx.currentTime + 0.12) {
      const i = step % leadEvents.length;
      const len = 60 / (BPM * speed) / 4;
      const lead = leadEvents[i];
      const bass = bassEvents[i];
      const drum = DRUMS[i % DRUMS.length];

      if (lead) {
        tone("square", lead.f, nextTime, lead.steps * len * 0.95, 0.13, 3800);
      }

      if (bass) {
        tone("triangle", bass.f, nextTime, bass.steps * len * 0.9, 0.38);
      }

      if (drum === "k") {
        kick(nextTime);
      } else if (drum === "s") {
        noise(nextTime, 0.14, 0.28, 1200);
      } else if (drum === "h") {
        noise(nextTime, 0.04, 0.1, 7000);
      }

      nextTime += len;
      step += 1;
    }
  }


  // Start (or continue) the music. Call from a tap, so the browser allows it.
  function startMusic(level = 1) {
    speed = speedFor(level);

    if (!isOn() || playing || !setup()) {
      return;
    }

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    playing = true;
    nextTime = ctx.currentTime + 0.06;
    schedule();
    timer = setInterval(schedule, 25);
  }


  function stopMusic(restart) {
    clearInterval(timer);
    timer = null;
    playing = false;

    if (restart) {
      step = 0;
    }
  }


  function setLevel(level) {
    speed = speedFor(level);
  }


  function effect(play) {
    if (!isOn() || !setup()) {
      return;
    }

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    play(ctx.currentTime + 0.01);
  }


  // A soft thud when a piece lands.
  function landed() {
    effect(t => tone("triangle", 110, t, 0.07, 0.35));
  }


  // A chime for clearing lines; a bigger one for 4 at once.
  function cleared(count) {
    const notes =
      count >= 4 ? ["C6", "E6", "G6", "C7", "E7"] : ["E6", "G6", "C7"].slice(0, Math.max(2, count + 1));

    effect(t => {
      notes.forEach((note, i) => tone("square", freq(note), t + i * 0.06, 0.09, 0.14, 6000));
    });
  }


  function gameOver() {
    stopMusic(true);
    effect(t => {
      ["E5", "C5", "A4", "E4"].forEach((note, i) => tone("square", freq(note), t + i * 0.16, 0.18, 0.14, 3000));
    });
  }


  // Turn sound on or off (remembered). Returns the new setting.
  function toggle(level = 1) {
    const on =
      !isOn();

    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch (error) {}

    if (!on) {
      stopMusic();
    }

    return on;
  }


  root.TileSound = {
    isOn,
    toggle,
    startMusic,
    stopMusic,
    setLevel,
    landed,
    cleared,
    gameOver,
    speedFor,
    get playing() {
      return playing;
    },
    parts: { leadEvents, bassEvents, DRUMS }
  };
})(typeof window !== "undefined" ? window : globalThis);
