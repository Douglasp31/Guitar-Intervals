// Guitar Fretboard Intervals App
// - 22 frets (plus open string position)
// - Standard tuning (low to high): E A D G B E
// - Click a note to show intervals relative to it; highlight root in yellow

(function () {
  /**
   * Musical data
   */
  const NOTE_ORDER = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  // Interval names by semitone distance (0..11)
  const INTERVAL_BY_STEPS = [
    "U",
    "m2",
    "M2",
    "m3",
    "M3",
    "P4",
    "TT",
    "P5",
    "m6",
    "M6",
    "m7",
    "M7",
  ];

  // Standard tuning string notes from bottom to top: E, A, D, G, B, E
  const STRINGS_LOW_TO_HIGH = ["E", "A", "D", "G", "B", "E"]; // low to high

  // UI constants
  const FRET_COUNT = 22; // not including open string (we still render open position cell)

  // DOM
  const boardEl = document.getElementById("fretboard");
  const fretNumberEl = document.getElementById("fret-numbers");
  const markerEl = document.getElementById("fret-markers");
  const fretNumberBottomEl = document.getElementById("fret-numbers-bottom");
  const markerBottomEl = document.getElementById("fret-markers-bottom");

  // Set CSS variables so CSS grid knows dimensions
  document.documentElement.style.setProperty("--fret-count", String(FRET_COUNT));

  // Build fret number header (0..22) using explicit grid-column placement for perfect alignment
  function renderFretNumbers(targetEl) {
    let html = '';
    html += `<div style="grid-column:1"></div>`; // label spacer
    html += `<div style=\"grid-column:2\">0</div>`; // nut
    for (let f = 1; f <= FRET_COUNT; f += 1) {
      const col = 2 + f; // offset by label + nut
      html += `<div style=\"grid-column:${col}\">${f}</div>`;
    }
    targetEl.innerHTML = html;
  }

  // Build fret markers row with explicit column placement
  function renderFretMarkers(targetEl) {
    const singleDotFrets = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
    let html = '';
    // empty columns are implicit; only place dots where needed
    for (let f = 1; f <= FRET_COUNT; f += 1) {
      const col = 2 + f; // grid column matching the fret number
      if (singleDotFrets.has(f)) {
        html += `<div class=\"dot\" style=\"grid-column:${col}\" aria-hidden=\"true\"></div>`;
      } else if (f === 12) {
        html += `<div class=\"double\" style=\"grid-column:${col}\" aria-hidden=\"true\"><div class=\"dot\"></div><div class=\"dot\"></div></div>`;
      }
    }
    targetEl.innerHTML = html;
  }

  renderFretNumbers(fretNumberEl);
  renderFretMarkers(markerEl);
  // Bottom duplicates
  if (fretNumberBottomEl) renderFretNumbers(fretNumberBottomEl);
  if (markerBottomEl) renderFretMarkers(markerBottomEl);

  // Helper: get note name n semitones above base
  function noteUp(baseNote, semitoneSteps) {
    const baseIndex = NOTE_ORDER.indexOf(baseNote);
    const idx = (baseIndex + semitoneSteps) % 12;
    return NOTE_ORDER[idx];
  }

  // Build fretboard grid rows (strings)
  function buildBoard() {
    // Nut element is inserted once and spans all rows
    const nutDiv = `<div class="nut" aria-hidden="true"></div>`;

    // For display, strings are visually top to bottom high to low; but the user asked bottom to top listing E A D G B E.
    // We'll render from top to bottom in the requested visual order: bottom string is first in the data, but in grid we add rows top to bottom.
    // To meet the request "from bottom to top E, A, D, G, B, E" we must place the low E at the bottom visually.
    // We'll therefore iterate from high to low so the last (low E) ends up bottom.
    const stringsTopToBottom = [...STRINGS_LOW_TO_HIGH].reverse();

    // Start the grid content with per-string rows
    let html = nutDiv; // place nut first

    stringsTopToBottom.forEach((openNote, rowIndex) => {
      // Row label
      html += `<div class="string-label cell">${openNote}</div>`;

      // Open string + 22 frets => we need FRET_COUNT cells beyond the nut column; each cell will contain a note circle
      for (let fret = 1; fret <= FRET_COUNT; fret += 1) {
        // Fret number 'fret' corresponds to semitone steps from open string = fret
        const stepsFromOpen = fret; // because 1st fret = +1 semitone
        const noteName = noteUp(openNote, stepsFromOpen);
        const id = `${openNote}-${fret}`;
        const sharpClass = noteName.includes('#') ? ' sharp' : '';
        html += `<div class=\"cell\" data-string=\"${openNote}\" data-fret=\"${fret}\">
          <button class=\"note${sharpClass}\" data-note=\"${noteName}\" data-open=\"${openNote}\" data-fret=\"${fret}\" aria-label=\"${noteName} at fret ${fret} on ${openNote} string\">
            <span class="interval ghost">${noteName}</span>
            <span class="letter ghost">${noteName}</span>
          </button>
        </div>`;
      }
    });

    boardEl.innerHTML = html;
  }

  buildBoard();

  // Handle clicks to compute and display intervals
  let activeRoot = null; // { letter: string }

  function clearIntervals() {
    activeRoot = null;
    const notes = boardEl.querySelectorAll(".note");
    notes.forEach((btn) => {
      btn.classList.remove("root");
      const intervalEl = btn.querySelector(".interval");
      const letterEl = btn.querySelector(".letter");
      const letter = btn.getAttribute("data-note");
      if (intervalEl) intervalEl.textContent = ""; // no interval when not selected
      if (letterEl) letterEl.textContent = letter || "";
      btn.querySelectorAll(".ghost").forEach((g) => g.classList.remove("ghost"));
      // When inactive, both texts visible but we just show the note letter only
      if (intervalEl) intervalEl.classList.add("ghost");
    });
  }

  function showIntervals(rootLetter) {
    const notes = boardEl.querySelectorAll(".note");
    notes.forEach((btn) => {
      const noteLetter = btn.getAttribute("data-note");
      // Ensure style class for sharps remains if DOM was re-rendered/changed
      if (noteLetter && noteLetter.includes('#')) {
        btn.classList.add('sharp');
      } else {
        btn.classList.remove('sharp');
      }
      const intervalSteps =
        (NOTE_ORDER.indexOf(noteLetter) - NOTE_ORDER.indexOf(rootLetter) + 12) % 12;
      const intervalName = INTERVAL_BY_STEPS[intervalSteps];

      const intervalEl = btn.querySelector(".interval");
      const letterEl = btn.querySelector(".letter");
      if (intervalEl) intervalEl.textContent = intervalName;
      if (letterEl) letterEl.textContent = noteLetter || "";

      btn.classList.toggle("root", intervalSteps === 0);

      // Ensure both parts are visible
      intervalEl && intervalEl.classList.remove("ghost");
      letterEl && letterEl.classList.remove("ghost");
    });
  }

  // Click delegation
  boardEl.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".note");
    if (!btn) return;
    const note = btn.getAttribute("data-note");
    if (!note) return;

    if (activeRoot === note) {
      clearIntervals();
    } else {
      activeRoot = note;
      showIntervals(note);
    }
  });

  // Keyboard clear
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearIntervals();
  });

  // Initialize default view: labels only (note letters), no intervals highlighted
  clearIntervals();
})();



// Guitar Major Triads App (second instance)
(function () {
  /**
   * Musical data
   */
  const NOTE_ORDER = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  // Standard tuning string notes from bottom to top: E, A, D, G, B, E
  const STRINGS_LOW_TO_HIGH = ["E", "A", "D", "G", "B", "E"]; // low to high

  // UI constants
  const FRET_COUNT = 22;

  // DOM for second instance
  const boardEl = document.getElementById("fretboard-2");
  const fretNumberEl = document.getElementById("fret-numbers-2");
  const markerEl = document.getElementById("fret-markers-2");
  const fretNumberBottomEl = document.getElementById("fret-numbers-bottom-2");
  const markerBottomEl = document.getElementById("fret-markers-bottom-2");
  if (!boardEl) return;

  // Ensure CSS var is set (global)
  document.documentElement.style.setProperty("--fret-count", String(FRET_COUNT));

  function renderFretNumbers(targetEl) {
    if (!targetEl) return;
    let html = '';
    html += `<div style="grid-column:1"></div>`; // label spacer
    html += `<div style=\"grid-column:2\">0</div>`; // nut
    for (let f = 1; f <= FRET_COUNT; f += 1) {
      const col = 2 + f;
      html += `<div style=\"grid-column:${col}\">${f}</div>`;
    }
    targetEl.innerHTML = html;
  }

  function renderFretMarkers(targetEl) {
    if (!targetEl) return;
    const singleDotFrets = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
    let html = '';
    for (let f = 1; f <= FRET_COUNT; f += 1) {
      const col = 2 + f;
      if (singleDotFrets.has(f)) {
        html += `<div class=\"dot\" style=\"grid-column:${col}\" aria-hidden=\"true\"></div>`;
      } else if (f === 12) {
        html += `<div class=\"double\" style=\"grid-column:${col}\" aria-hidden=\"true\"><div class=\"dot\"></div><div class=\"dot\"></div></div>`;
      }
    }
    targetEl.innerHTML = html;
  }

  function noteUp(baseNote, semitoneSteps) {
    const baseIndex = NOTE_ORDER.indexOf(baseNote);
    const idx = (baseIndex + semitoneSteps) % 12;
    return NOTE_ORDER[idx];
  }

  function buildBoard() {
    const nutDiv = `<div class=\"nut\" aria-hidden=\"true\"></div>`;
    const stringsTopToBottom = [...STRINGS_LOW_TO_HIGH].reverse();
    let html = nutDiv;
    stringsTopToBottom.forEach((openNote) => {
      html += `<div class=\"string-label cell\">${openNote}</div>`;
      for (let fret = 1; fret <= FRET_COUNT; fret += 1) {
        const stepsFromOpen = fret;
        const noteName = noteUp(openNote, stepsFromOpen);
        const sharpClass = noteName.includes('#') ? ' sharp' : '';
        html += `<div class=\"cell\" data-string=\"${openNote}\" data-fret=\"${fret}\">\n          <button class=\"note${sharpClass}\" data-note=\"${noteName}\" data-open=\"${openNote}\" data-fret=\"${fret}\" aria-label=\"${noteName} at fret ${fret} on ${openNote} string\">\n            <span class=\"interval ghost\"></span>\n            <span class=\"letter\">${noteName}</span>\n          </button>\n        </div>`;
      }
    });
    boardEl.innerHTML = html;
  }

  renderFretNumbers(fretNumberEl);
  renderFretMarkers(markerEl);
  if (fretNumberBottomEl) renderFretNumbers(fretNumberBottomEl);
  if (markerBottomEl) renderFretMarkers(markerBottomEl);
  buildBoard();

  let activeRoot = null;

  function clearTriad() {
    activeRoot = null;
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      btn.classList.remove('root');
      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');
      const letter = btn.getAttribute('data-note');
      if (intervalEl) intervalEl.textContent = '';
      if (letterEl) letterEl.textContent = letter || '';
      intervalEl && intervalEl.classList.add('ghost');
      letterEl && letterEl.classList.remove('ghost');
    });
  }

  function showMajorTriad(rootLetter) {
    const triadSet = new Set([0, 4, 7]); // R, M3, P5
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      const noteLetter = btn.getAttribute('data-note');
      if (!noteLetter) return;
      // keep sharp styling consistent
      if (noteLetter.includes('#')) {
        btn.classList.add('sharp');
      } else {
        btn.classList.remove('sharp');
      }
      const intervalSteps = (NOTE_ORDER.indexOf(noteLetter) - NOTE_ORDER.indexOf(rootLetter) + 12) % 12;
      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');
      if (triadSet.has(intervalSteps)) {
        const label = intervalSteps === 0 ? 'R' : intervalSteps === 4 ? '3' : '5';
        if (intervalEl) intervalEl.textContent = label;
        if (letterEl) letterEl.textContent = noteLetter || '';
        intervalEl && intervalEl.classList.remove('ghost');
        letterEl && letterEl.classList.remove('ghost');
        btn.classList.toggle('root', intervalSteps === 0);
      } else {
        if (intervalEl) intervalEl.textContent = '';
        if (letterEl) letterEl.textContent = noteLetter || '';
        intervalEl && intervalEl.classList.add('ghost');
        letterEl && letterEl.classList.add('ghost');
        btn.classList.remove('root');
      }
    });
  }

  boardEl.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.note');
    if (!btn) return;
    const note = btn.getAttribute('data-note');
    if (!note) return;
    if (activeRoot === note) {
      clearTriad();
    } else {
      activeRoot = note;
      showMajorTriad(note);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearTriad();
  });

  clearTriad();
})();


// Guitar Minor Triads App (third instance)
(function () {
  /**
   * Musical data
   */
  const NOTE_ORDER = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  // Standard tuning string notes from bottom to top: E, A, D, G, B, E
  const STRINGS_LOW_TO_HIGH = ["E", "A", "D", "G", "B", "E"]; // low to high

  // UI constants
  const FRET_COUNT = 22;

  // DOM for third instance
  const boardEl = document.getElementById("fretboard-3");
  const fretNumberEl = document.getElementById("fret-numbers-3");
  const markerEl = document.getElementById("fret-markers-3");
  const fretNumberBottomEl = document.getElementById("fret-numbers-bottom-3");
  const markerBottomEl = document.getElementById("fret-markers-bottom-3");
  if (!boardEl) return;

  document.documentElement.style.setProperty("--fret-count", String(FRET_COUNT));

  function renderFretNumbers(targetEl) {
    if (!targetEl) return;
    let html = '';
    html += `<div style=\"grid-column:1\"></div>`; // label spacer
    html += `<div style=\"grid-column:2\">0</div>`; // nut
    for (let f = 1; f <= FRET_COUNT; f += 1) {
      const col = 2 + f;
      html += `<div style=\"grid-column:${col}\">${f}</div>`;
    }
    targetEl.innerHTML = html;
  }

  function renderFretMarkers(targetEl) {
    if (!targetEl) return;
    const singleDotFrets = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
    let html = '';
    for (let f = 1; f <= FRET_COUNT; f += 1) {
      const col = 2 + f;
      if (singleDotFrets.has(f)) {
        html += `<div class=\"dot\" style=\"grid-column:${col}\" aria-hidden=\"true\"></div>`;
      } else if (f === 12) {
        html += `<div class=\"double\" style=\"grid-column:${col}\" aria-hidden=\"true\"><div class=\"dot\"></div><div class=\"dot\"></div></div>`;
      }
    }
    targetEl.innerHTML = html;
  }

  function noteUp(baseNote, semitoneSteps) {
    const NOTE_ORDER_LOCAL = NOTE_ORDER;
    const baseIndex = NOTE_ORDER_LOCAL.indexOf(baseNote);
    const idx = (baseIndex + semitoneSteps) % 12;
    return NOTE_ORDER_LOCAL[idx];
  }

  function buildBoard() {
    const nutDiv = `<div class=\"nut\" aria-hidden=\"true\"></div>`;
    const stringsTopToBottom = [...STRINGS_LOW_TO_HIGH].reverse();
    let html = nutDiv;
    stringsTopToBottom.forEach((openNote) => {
      html += `<div class=\"string-label cell\">${openNote}</div>`;
      for (let fret = 1; fret <= FRET_COUNT; fret += 1) {
        const stepsFromOpen = fret;
        const noteName = noteUp(openNote, stepsFromOpen);
        const sharpClass = noteName.includes('#') ? ' sharp' : '';
        html += `<div class=\"cell\" data-string=\"${openNote}\" data-fret=\"${fret}\">\n          <button class=\"note${sharpClass}\" data-note=\"${noteName}\" data-open=\"${openNote}\" data-fret=\"${fret}\" aria-label=\"${noteName} at fret ${fret} on ${openNote} string\">\n            <span class=\"interval ghost\"></span>\n            <span class=\"letter\">${noteName}</span>\n          </button>\n        </div>`;
      }
    });
    boardEl.innerHTML = html;
  }

  renderFretNumbers(fretNumberEl);
  renderFretMarkers(markerEl);
  if (fretNumberBottomEl) renderFretNumbers(fretNumberBottomEl);
  if (markerBottomEl) renderFretMarkers(markerBottomEl);
  buildBoard();

  let activeRoot = null;

  function clearTriad() {
    activeRoot = null;
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      btn.classList.remove('root');
      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');
      const letter = btn.getAttribute('data-note');
      if (intervalEl) intervalEl.textContent = '';
      if (letterEl) letterEl.textContent = letter || '';
      intervalEl && intervalEl.classList.add('ghost');
      letterEl && letterEl.classList.remove('ghost');
    });
  }

  function showMinorTriad(rootLetter) {
    const triadSet = new Set([0, 3, 7]); // R, m3, P5
    const notes = boardEl.querySelectorAll('.note');
    notes.forEach((btn) => {
      const noteLetter = btn.getAttribute('data-note');
      if (!noteLetter) return;
      if (noteLetter.includes('#')) {
        btn.classList.add('sharp');
      } else {
        btn.classList.remove('sharp');
      }
      const intervalSteps = (NOTE_ORDER.indexOf(noteLetter) - NOTE_ORDER.indexOf(rootLetter) + 12) % 12;
      const intervalEl = btn.querySelector('.interval');
      const letterEl = btn.querySelector('.letter');
      if (triadSet.has(intervalSteps)) {
        const label = intervalSteps === 0 ? 'R' : intervalSteps === 3 ? 'b3' : '5';
        if (intervalEl) intervalEl.textContent = label;
        if (letterEl) letterEl.textContent = noteLetter || '';
        intervalEl && intervalEl.classList.remove('ghost');
        letterEl && letterEl.classList.remove('ghost');
        btn.classList.toggle('root', intervalSteps === 0);
      } else {
        if (intervalEl) intervalEl.textContent = '';
        if (letterEl) letterEl.textContent = noteLetter || '';
        intervalEl && intervalEl.classList.add('ghost');
        letterEl && letterEl.classList.add('ghost');
        btn.classList.remove('root');
      }
    });
  }

  boardEl.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.note');
    if (!btn) return;
    const note = btn.getAttribute('data-note');
    if (!note) return;
    if (activeRoot === note) {
      clearTriad();
    } else {
      activeRoot = note;
      showMinorTriad(note);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearTriad();
  });

  clearTriad();
})();