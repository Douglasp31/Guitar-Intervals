// Guitar Fretboard Intervals App
// - 22 frets (plus open string position)
// - Standard tuning (low to high): E A D G B E
// - Click a note to show intervals relative to it; highlight root in yellow

// ============================================
// Shared Audio Module (Web Audio API)
// ============================================
const GuitarAudio = (function () {
  let audioCtx = null;

  // Map string letter to base frequency (strings from low to high)
  const STRING_BASE_FREQ = {
    'E-low': 82.41,
    'A': 110.00,
    'D': 146.83,
    'G': 196.00,
    'B': 246.94,
    'E-high': 329.63
  };

  // Initialize audio context on first user interaction
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Calculate frequency for a given string and fret
  // Each fret = 1 semitone = multiply by 2^(1/12)
  function getFrequency(stringName, fret, stringIndex) {
    let baseFreq;

    // Handle E strings (need to differentiate low vs high)
    if (stringName === 'E') {
      // stringIndex 0 = high E (top of visual fretboard), stringIndex 5 = low E (bottom)
      // In our reversed array: index 0 = E-high, index 5 = E-low
      baseFreq = stringIndex === 0 ? STRING_BASE_FREQ['E-high'] : STRING_BASE_FREQ['E-low'];
    } else {
      baseFreq = STRING_BASE_FREQ[stringName];
    }

    // Calculate frequency: base * 2^(fret/12)
    return baseFreq * Math.pow(2, fret / 12);
  }

  // Play a note with a guitar-like envelope
  function playNote(stringName, fret, stringIndex) {
    const ctx = initAudio();
    const frequency = getFrequency(stringName, fret, stringIndex);

    // Create oscillator for the fundamental tone
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Use triangle wave for a softer, more guitar-like tone
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Create a pluck-like envelope (quick attack, gradual decay)
    const now = ctx.currentTime;
    const attackTime = 0.01;
    const decayTime = 0.3;
    const sustainLevel = 0.3;
    const releaseTime = 0.8;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime + releaseTime);

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play the note
    oscillator.start(now);
    oscillator.stop(now + attackTime + decayTime + releaseTime + 0.1);
  }

  // Play a frequency directly (for triad playback)
  function playFrequency(frequency, delay) {
    const ctx = initAudio();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;

    const startTime = ctx.currentTime + (delay || 0);
    const attackTime = 0.01;
    const decayTime = 0.3;
    const sustainLevel = 0.25;
    const releaseTime = 1.0;

    // Set initial gain to 0, then schedule the envelope
    gainNode.gain.value = 0;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.4, startTime + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime + decayTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + decayTime + releaseTime);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + attackTime + decayTime + releaseTime + 0.1);
  }

  // Play a triad (3 notes) with slight strum delay
  // rootFrequency: the actual frequency of the root note clicked
  // intervals: array of semitone offsets from root, e.g., [0, 4, 7] for major triad
  function playTriad(rootFrequency, intervals) {
    initAudio();

    // Play each note of the triad with slight delay for strum effect
    intervals.forEach((semitones, index) => {
      const freq = rootFrequency * Math.pow(2, semitones / 12);
      const delay = index * 0.08; // 80ms between each note for strum effect
      playFrequency(freq, delay);
    });
  }

  return {
    playNote: playNote,
    playTriad: playTriad,
    getFrequency: getFrequency,
    initAudio: initAudio
  };
})();

// ============================================
// Shared Constants and Utilities
// ============================================
const FretboardCore = (function () {
  const NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const INTERVAL_BY_STEPS = ["U", "m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7"];
  const STRINGS_LOW_TO_HIGH = ["E", "A", "D", "G", "B", "E"];
  const FRET_COUNT = 22;
  const SINGLE_DOT_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);

  // Helper: get note name n semitones above base
  function noteUp(baseNote, semitoneSteps) {
    const baseIndex = NOTE_ORDER.indexOf(baseNote);
    const idx = (baseIndex + semitoneSteps) % 12;
    return NOTE_ORDER[idx];
  }

  // Calculate interval steps between two notes
  function getIntervalSteps(noteLetter, rootLetter) {
    return (NOTE_ORDER.indexOf(noteLetter) - NOTE_ORDER.indexOf(rootLetter) + 12) % 12;
  }

  // Build fret number header
  function renderFretNumbers(targetEl) {
    if (!targetEl) return;
    let html = '<div style="grid-column:1"></div><div style="grid-column:2"></div>';
    for (let f = 0; f <= FRET_COUNT; f++) {
      html += `<div style="grid-column:${3 + f}">${f}</div>`;
    }
    targetEl.innerHTML = html;
  }

  // Build fret markers row
  function renderFretMarkers(targetEl) {
    if (!targetEl) return;
    let html = '';
    for (let f = 0; f <= FRET_COUNT; f++) {
      const col = 3 + f;
      if (SINGLE_DOT_FRETS.has(f)) {
        html += `<div class="dot" style="grid-column:${col}" aria-hidden="true"></div>`;
      } else if (f === 12) {
        html += `<div class="double" style="grid-column:${col}" aria-hidden="true"><div class="dot"></div><div class="dot"></div></div>`;
      }
    }
    targetEl.innerHTML = html;
  }

  // Build fretboard HTML
  function buildBoardHTML(showIntervalOnInit) {
    const stringsTopToBottom = [...STRINGS_LOW_TO_HIGH].reverse();
    let html = '<div class="nut" aria-hidden="true"></div>';

    stringsTopToBottom.forEach((openNote, rowIndex) => {
      html += `<div class="string-label cell">${openNote}</div>`;
      for (let fret = 0; fret <= FRET_COUNT; fret++) {
        const noteName = noteUp(openNote, fret);
        const sharpClass = noteName.includes('#') ? ' sharp' : '';
        const intervalClass = showIntervalOnInit ? '' : ' ghost';
        html += `<div class="cell" data-string="${openNote}" data-fret="${fret}">
          <button class="note${sharpClass}" data-note="${noteName}" data-open="${openNote}" data-fret="${fret}" data-string-index="${rowIndex}" aria-label="${noteName} at fret ${fret} on ${openNote} string">
            <span class="interval${intervalClass}"></span>
            <span class="letter">${noteName}</span>
          </button>
        </div>`;
      }
    });

    return html;
  }

  return {
    NOTE_ORDER,
    INTERVAL_BY_STEPS,
    STRINGS_LOW_TO_HIGH,
    FRET_COUNT,
    noteUp,
    getIntervalSteps,
    renderFretNumbers,
    renderFretMarkers,
    buildBoardHTML
  };
})();

// ============================================
// Fretboard Factory
// ============================================
function createFretboard(config) {
  const {
    boardId,
    fretNumbersId,
    markersId,
    fretNumbersBottomId,
    markersBottomId,
    mode // 'intervals' | 'major-triad' | 'minor-triad'
  } = config;

  const boardEl = document.getElementById(boardId);
  const fretNumberEl = document.getElementById(fretNumbersId);
  const markerEl = document.getElementById(markersId);
  const fretNumberBottomEl = document.getElementById(fretNumbersBottomId);
  const markerBottomEl = document.getElementById(markersBottomId);

  if (!boardEl) return null;

  // Set CSS variable for grid dimensions
  document.documentElement.style.setProperty("--fret-count", String(FretboardCore.FRET_COUNT + 1));

  // Render chrome elements
  FretboardCore.renderFretNumbers(fretNumberEl);
  FretboardCore.renderFretMarkers(markerEl);
  if (fretNumberBottomEl) FretboardCore.renderFretNumbers(fretNumberBottomEl);
  if (markerBottomEl) FretboardCore.renderFretMarkers(markerBottomEl);

  // Build the fretboard
  boardEl.innerHTML = FretboardCore.buildBoardHTML(false);

  let activeRoot = null;

  // Mode-specific configuration
  const modeConfig = {
    'intervals': {
      triadIntervals: null,
      getLabel: (steps) => FretboardCore.INTERVAL_BY_STEPS[steps],
      playSound: (btn) => {
        const openString = btn.getAttribute('data-open');
        const fret = parseInt(btn.getAttribute('data-fret'), 10);
        const stringIndex = parseInt(btn.getAttribute('data-string-index'), 10);
        GuitarAudio.playNote(openString, fret, stringIndex);
      }
    },
    'major-triad': {
      triadIntervals: [0, 4, 7],
      triadLabels: { 0: 'R', 4: '3', 7: '5' },
      getLabel: function(steps) { return this.triadLabels[steps] || null; },
      playSound: (btn) => {
        const openString = btn.getAttribute('data-open');
        const fret = parseInt(btn.getAttribute('data-fret'), 10);
        const stringIndex = parseInt(btn.getAttribute('data-string-index'), 10);
        const rootFreq = GuitarAudio.getFrequency(openString, fret, stringIndex);
        GuitarAudio.playTriad(rootFreq, [0, 4, 7]);
      }
    },
    'minor-triad': {
      triadIntervals: [0, 3, 7],
      triadLabels: { 0: 'R', 3: 'b3', 7: '5' },
      getLabel: function(steps) { return this.triadLabels[steps] || null; },
      playSound: (btn) => {
        const openString = btn.getAttribute('data-open');
        const fret = parseInt(btn.getAttribute('data-fret'), 10);
        const stringIndex = parseInt(btn.getAttribute('data-string-index'), 10);
        const rootFreq = GuitarAudio.getFrequency(openString, fret, stringIndex);
        GuitarAudio.playTriad(rootFreq, [0, 3, 7]);
      }
    }
  };

  const currentMode = modeConfig[mode] || modeConfig['intervals'];

  function clear() {
    activeRoot = null;
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      btn.classList.remove('root');
      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');
      const letter = btn.getAttribute('data-note');
      if (intervalEl) {
        intervalEl.textContent = '';
        intervalEl.classList.add('ghost');
      }
      if (letterEl) {
        letterEl.textContent = letter || '';
        letterEl.classList.remove('ghost');
      }
    });
  }

  function show(rootLetter) {
    const notes = boardEl.querySelectorAll('.note');
    const triadSet = currentMode.triadIntervals ? new Set(currentMode.triadIntervals) : null;

    notes.forEach((btn) => {
      const noteLetter = btn.getAttribute('data-note');
      if (!noteLetter) return;

      // Maintain sharp styling
      btn.classList.toggle('sharp', noteLetter.includes('#'));

      const intervalSteps = FretboardCore.getIntervalSteps(noteLetter, rootLetter);
      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');

      // Check if this note should be shown (all for intervals, only triad notes for triads)
      const shouldShow = !triadSet || triadSet.has(intervalSteps);

      if (shouldShow) {
        const label = currentMode.getLabel(intervalSteps);
        if (intervalEl) {
          intervalEl.textContent = label || '';
          intervalEl.classList.remove('ghost');
        }
        if (letterEl) {
          letterEl.textContent = noteLetter;
          letterEl.classList.remove('ghost');
        }
        btn.classList.toggle('root', intervalSteps === 0);
      } else {
        // Ghost non-triad notes
        if (intervalEl) {
          intervalEl.textContent = '';
          intervalEl.classList.add('ghost');
        }
        if (letterEl) {
          letterEl.textContent = noteLetter;
          letterEl.classList.add('ghost');
        }
        btn.classList.remove('root');
      }
    });
  }

  // Click handler
  boardEl.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.note');
    if (!btn) return;
    const note = btn.getAttribute('data-note');
    if (!note) return;

    if (activeRoot === note) {
      clear();
    } else {
      activeRoot = note;
      show(note);
      currentMode.playSound(btn);
    }
  });

  // Initialize
  clear();

  // Return clear function for global escape handler
  return { clear };
}

// ============================================
// Initialize All Fretboards
// ============================================
(function () {
  const fretboards = [
    createFretboard({
      boardId: 'fretboard',
      fretNumbersId: 'fret-numbers',
      markersId: 'fret-markers',
      fretNumbersBottomId: 'fret-numbers-bottom',
      markersBottomId: 'fret-markers-bottom',
      mode: 'intervals'
    }),
    createFretboard({
      boardId: 'fretboard-2',
      fretNumbersId: 'fret-numbers-2',
      markersId: 'fret-markers-2',
      fretNumbersBottomId: 'fret-numbers-bottom-2',
      markersBottomId: 'fret-markers-bottom-2',
      mode: 'major-triad'
    }),
    createFretboard({
      boardId: 'fretboard-3',
      fretNumbersId: 'fret-numbers-3',
      markersId: 'fret-markers-3',
      fretNumbersBottomId: 'fret-numbers-bottom-3',
      markersBottomId: 'fret-markers-bottom-3',
      mode: 'minor-triad'
    })
  ].filter(Boolean);

  // Single global escape handler for all fretboards
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fretboards.forEach((fb) => fb.clear());
    }
  });
})();
