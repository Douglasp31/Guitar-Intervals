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

  // String index to frequency mapping (index 0 = high E, index 5 = low E)
  const STRING_INDEX_FREQ = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41];

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

  // Calculate frequency from string index and fret
  function getFrequencyByIndex(stringIndex, fret) {
    const baseFreq = STRING_INDEX_FREQ[stringIndex];
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

  // Play specific triad notes with strum effect
  // notes: array of {stringIndex, fret} objects
  function playTriadNotes(notes) {
    initAudio();
    // Sort by string index descending (low strings first for strum)
    const sorted = [...notes].sort((a, b) => b.stringIndex - a.stringIndex);
    sorted.forEach((note, index) => {
      const freq = getFrequencyByIndex(note.stringIndex, note.fret);
      const delay = index * 0.08; // 80ms between each note
      playFrequency(freq, delay);
    });
  }

  return {
    playNote: playNote,
    playTriadNotes: playTriadNotes,
    getFrequency: getFrequency,
    getFrequencyByIndex: getFrequencyByIndex,
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

  // Standard triad shapes for each root string position
  // These are closed-voicing triads used by professional guitarists
  // stringIndex: 0=high E, 1=B, 2=G, 3=D, 4=A, 5=low E
  // Each shape defines: notes array with {stringOffset, fretOffset, role}
  // stringOffset: negative = toward high E, positive = toward low E
  // fretOffset: relative to root fret
  //
  // Tuning intervals: E-A=5, A-D=5, D-G=5, G-B=4, B-E=5 semitones
  // Major triad: R=0, M3=4, P5=7 semitones
  // Minor triad: R=0, m3=3, P5=7 semitones

  const MAJOR_TRIAD_SHAPES = {
    5: { // Root on low E (index 5) - uses strings E, A, D
      // G major at fret 3: E/3=G, A/2=B(3), D/0=D(5)
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },   // Root on low E
        { stringOffset: -1, fretOffset: -1, role: '3' }, // M3 on A (1 fret lower)
        { stringOffset: -2, fretOffset: -3, role: '5' }  // P5 on D (3 frets lower)
      ]
    },
    4: { // Root on A (index 4) - uses strings A, D, G
      // C major at fret 3: A/3=C, D/2=E(3), G/0=G(5)
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },   // Root on A
        { stringOffset: -1, fretOffset: -1, role: '3' }, // M3 on D (1 fret lower)
        { stringOffset: -2, fretOffset: -3, role: '5' }  // P5 on G (3 frets lower)
      ]
    },
    3: { // Root on D (index 3) - uses strings D, G, B
      // F major at fret 3: D/3=F, G/2=A(3), B/1=C(5)
      // G-B is M3 (4 semitones), so offset changes
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },   // Root on D
        { stringOffset: -1, fretOffset: -1, role: '3' }, // M3 on G (1 fret lower)
        { stringOffset: -2, fretOffset: -2, role: '5' }  // P5 on B (2 frets lower due to G-B=M3)
      ]
    },
    2: { // Root on G (index 2) - uses strings G, B, high E
      // Bb major at fret 3: G/3=Bb, B/3=D(3), E/1=F(5)
      // G-B is M3, so 3rd is at same fret; B-E is P4
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },   // Root on G
        { stringOffset: -1, fretOffset: 0, role: '3' },  // M3 on B (same fret)
        { stringOffset: -2, fretOffset: -2, role: '5' }  // P5 on high E (2 frets lower)
      ]
    },
    1: { // Root on B (index 1) - uses strings G, B, high E
      // C at fret 1: B/1=C, then need E(3) and G(5)
      // G/0=G(5), E/0=E(3)
      notes: [
        { stringOffset: 1, fretOffset: -1, role: '5' },  // P5 on G (1 fret lower)
        { stringOffset: 0, fretOffset: 0, role: 'R' },   // Root on B
        { stringOffset: -1, fretOffset: -1, role: '3' }  // M3 on high E (1 fret lower)
      ]
    },
    0: { // Root on high E (index 0) - uses strings D, G, B
      // G at fret 3 on high E: need B(3) and D(5)
      // B/0=B(3), D/0=D(5), G/0=G(R octave down)
      notes: [
        { stringOffset: 3, fretOffset: -3, role: '5' },  // P5 on D
        { stringOffset: 2, fretOffset: -3, role: 'R' },  // Root on G (octave down)
        { stringOffset: 1, fretOffset: -3, role: '3' }   // M3 on B
      ]
    }
  };

  const MINOR_TRIAD_SHAPES = {
    5: { // Root on low E (index 5)
      // Gm at fret 3: E/3=G, A/1=Bb(b3), D/0=D(5)
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },    // Root on low E
        { stringOffset: -1, fretOffset: -2, role: 'b3' }, // m3 on A (2 frets lower)
        { stringOffset: -2, fretOffset: -3, role: '5' }   // P5 on D (3 frets lower)
      ]
    },
    4: { // Root on A (index 4)
      // Cm at fret 3: A/3=C, D/1=Eb(b3), G/0=G(5)
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },    // Root on A
        { stringOffset: -1, fretOffset: -2, role: 'b3' }, // m3 on D (2 frets lower)
        { stringOffset: -2, fretOffset: -3, role: '5' }   // P5 on G (3 frets lower)
      ]
    },
    3: { // Root on D (index 3)
      // Fm at fret 3: D/3=F, G/1=Ab(b3), B/1=C(5)
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },    // Root on D
        { stringOffset: -1, fretOffset: -2, role: 'b3' }, // m3 on G (2 frets lower)
        { stringOffset: -2, fretOffset: -2, role: '5' }   // P5 on B (2 frets lower)
      ]
    },
    2: { // Root on G (index 2)
      // Bbm at fret 3: G/3=Bb, B/2=Db(b3), E/1=F(5)
      notes: [
        { stringOffset: 0, fretOffset: 0, role: 'R' },    // Root on G
        { stringOffset: -1, fretOffset: -1, role: 'b3' }, // m3 on B (1 fret lower)
        { stringOffset: -2, fretOffset: -2, role: '5' }   // P5 on high E (2 frets lower)
      ]
    },
    1: { // Root on B (index 1)
      // Cm at fret 1: B/1=C, need Eb(b3) and G(5)
      // G/0=G(5), E/11=Eb(b3)... too far. Use E/0=E then need different approach
      // Actually: G/0=G(5), high E at fret -1 would be Eb but can't be negative
      // Alternative shape for fret 1+
      notes: [
        { stringOffset: 1, fretOffset: -1, role: '5' },   // P5 on G (1 fret lower)
        { stringOffset: 0, fretOffset: 0, role: 'R' },    // Root on B
        { stringOffset: -1, fretOffset: -2, role: 'b3' }  // m3 on high E (2 frets lower)
      ]
    },
    0: { // Root on high E (index 0)
      // Gm at fret 3 on high E: need Bb(b3) and D(5)
      notes: [
        { stringOffset: 3, fretOffset: -3, role: '5' },   // P5 on D
        { stringOffset: 2, fretOffset: -3, role: 'R' },   // Root on G (octave down)
        { stringOffset: 1, fretOffset: -4, role: 'b3' }   // m3 on B
      ]
    }
  };

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

  // Calculate triad shape positions
  function getTriadShapePositions(rootStringIndex, rootFret, triadType) {
    const shapes = triadType === 'major' ? MAJOR_TRIAD_SHAPES : MINOR_TRIAD_SHAPES;
    const shape = shapes[rootStringIndex];
    if (!shape) return null;

    const positions = [];
    for (const note of shape.notes) {
      const stringIndex = rootStringIndex + note.stringOffset;
      const fret = rootFret + note.fretOffset;

      // Validate position is on the fretboard
      if (stringIndex >= 0 && stringIndex <= 5 && fret >= 0 && fret <= FRET_COUNT) {
        positions.push({
          stringIndex: stringIndex,
          fret: fret,
          role: note.role
        });
      }
    }

    return positions;
  }

  return {
    NOTE_ORDER,
    INTERVAL_BY_STEPS,
    STRINGS_LOW_TO_HIGH,
    FRET_COUNT,
    MAJOR_TRIAD_SHAPES,
    MINOR_TRIAD_SHAPES,
    noteUp,
    getIntervalSteps,
    renderFretNumbers,
    renderFretMarkers,
    buildBoardHTML,
    getTriadShapePositions
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
  let activeRootInfo = null; // {stringIndex, fret}

  const isTriadMode = mode === 'major-triad' || mode === 'minor-triad';
  const triadType = mode === 'major-triad' ? 'major' : (mode === 'minor-triad' ? 'minor' : null);

  function clear() {
    activeRoot = null;
    activeRootInfo = null;
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      btn.classList.remove('root', 'triad-shape');
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

  function showIntervals(rootLetter) {
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      const noteLetter = btn.getAttribute('data-note');
      if (!noteLetter) return;

      // Maintain sharp styling
      btn.classList.toggle('sharp', noteLetter.includes('#'));

      const intervalSteps = FretboardCore.getIntervalSteps(noteLetter, rootLetter);
      const intervalName = FretboardCore.INTERVAL_BY_STEPS[intervalSteps];

      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');

      if (intervalEl) {
        intervalEl.textContent = intervalName;
        intervalEl.classList.remove('ghost');
      }
      if (letterEl) {
        letterEl.textContent = noteLetter;
        letterEl.classList.remove('ghost');
      }
      btn.classList.toggle('root', intervalSteps === 0);
    });
  }

  function showTriadShape(rootLetter, rootStringIndex, rootFret) {
    // Get the specific triad shape positions
    const positions = FretboardCore.getTriadShapePositions(rootStringIndex, rootFret, triadType);

    // Ghost all notes first
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      const noteLetter = btn.getAttribute('data-note');
      btn.classList.toggle('sharp', noteLetter && noteLetter.includes('#'));
      btn.classList.remove('root', 'triad-shape');

      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');
      if (intervalEl) {
        intervalEl.textContent = '';
        intervalEl.classList.add('ghost');
      }
      if (letterEl) {
        letterEl.textContent = noteLetter || '';
        letterEl.classList.add('ghost');
      }
    });

    // Highlight the specific triad shape notes
    if (positions) {
      positions.forEach((pos) => {
        const btn = boardEl.querySelector(
          `.note[data-string-index="${pos.stringIndex}"][data-fret="${pos.fret}"]`
        );
        if (btn) {
          const noteLetter = btn.getAttribute('data-note');
          const intervalEl = btn.querySelector('.interval');
          const letterEl = btn.querySelector('.letter');

          btn.classList.add('triad-shape');
          if (pos.role === 'R') {
            btn.classList.add('root');
          }

          if (intervalEl) {
            intervalEl.textContent = pos.role;
            intervalEl.classList.remove('ghost');
          }
          if (letterEl) {
            letterEl.textContent = noteLetter || '';
            letterEl.classList.remove('ghost');
          }
        }
      });
    }

    return positions;
  }

  function playTriadSound(positions) {
    if (positions && positions.length > 0) {
      GuitarAudio.playTriadNotes(positions);
    }
  }

  function playIntervalSound(btn) {
    const openString = btn.getAttribute('data-open');
    const fret = parseInt(btn.getAttribute('data-fret'), 10);
    const stringIndex = parseInt(btn.getAttribute('data-string-index'), 10);
    GuitarAudio.playNote(openString, fret, stringIndex);
  }

  // Click handler
  boardEl.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.note');
    if (!btn) return;
    const note = btn.getAttribute('data-note');
    if (!note) return;

    const fret = parseInt(btn.getAttribute('data-fret'), 10);
    const stringIndex = parseInt(btn.getAttribute('data-string-index'), 10);

    // Check if clicking the same root note to toggle off
    if (activeRoot === note &&
        activeRootInfo &&
        activeRootInfo.stringIndex === stringIndex &&
        activeRootInfo.fret === fret) {
      clear();
    } else {
      activeRoot = note;
      activeRootInfo = { stringIndex, fret };

      if (isTriadMode) {
        const positions = showTriadShape(note, stringIndex, fret);
        playTriadSound(positions);
      } else {
        showIntervals(note);
        playIntervalSound(btn);
      }
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
