/**
 * Preposition Rules — Game Logic
 *
 * Good-practice notes applied:
 *  - All DOM queries cached at init time (no repeated getElementById in loops)
 *  - State isolated in a plain object (`state`)
 *  - No inline event handlers in HTML (all listeners added here via addEventListener)
 *  - Pure functions where possible (buildSentenceHTML, getEndEmoji, shuffleArray)
 *  - `hidden` attribute used for show/hide instead of `display:none` on inline styles
 *  - Touch ghost uses class, not a long inline style string
 *  - Keyboard shortcut isolated in one handler
 *  - Descriptive variable / function names
 */

"use strict";

/* ============================================================
   Data
   ============================================================ */

/** @type {Array<{sentence: string, answer: 'IN'|'ON'|'AT', category: string, hint: string}>} */
const QUESTIONS = [
  // --- Time: IN ---
  {
    sentence: "Months",
    answer: "IN",
    category: "⏱ Tiempo",
    hint: "We are moving ___ May.",
  },
  {
    sentence: "Years",
    answer: "IN",
    category: "⏱ Tiempo",
    hint: "They got married ___ 1975.",
  },
  {
    sentence: "Centuries and decades",
    answer: "IN",
    category: "⏱ Tiempo",
    hint: "Internet was invented ___ the 20th century.",
  },
  {
    sentence: "Seasons",
    answer: "IN",
    category: "⏱ Tiempo",
    hint: "___ summer, we love having lunch in the garden.",
  },
  {
    sentence: "Morning",
    answer: "IN",
    category: "⏱ Tiempo",
    hint: "I always have a shower ___ the morning.",
  },
  {
    sentence: "Afternoon",
    answer: "IN",
    category: "⏱ Tiempo",
    hint: "We'll go to the cinema ___ the afternoon.",
  },
  {
    sentence: "Evening",
    answer: "IN",
    category: "⏱ Tiempo",
    hint: "We usually meet ___ the evening.",
  },

  // --- Place: IN ---
  {
    sentence: "Cities, countries, and continents",
    answer: "IN",
    category: "📍 Lugar",
    hint: "People drive on the left ___ the UK.",
  },
  {
    sentence: "Parts of a country, region, or city",
    answer: "IN",
    category: "📍 Lugar",
    hint: "The weather is wet ___ the north of Spain.",
  },
  {
    sentence: "Car and taxi",
    answer: "IN",
    category: "📍 Lugar",
    hint: "Dad is waiting for you ___ the car.",
  },
  {
    sentence: "Enclosed spaces or defined areas",
    answer: "IN",
    category: "📍 Lugar",
    hint: "Your brother is ___ the kitchen.",
  },

  // --- Time: ON ---
  {
    sentence: "Days of the week",
    answer: "ON",
    category: "⏱ Tiempo",
    hint: "___ Wednesdays we wear pink.",
  },
  {
    sentence: "Specific dates",
    answer: "ON",
    category: "⏱ Tiempo",
    hint: "Her birthday party is ___ September 4th.",
  },
  {
    sentence: "Part of a specific day",
    answer: "ON",
    category: "⏱ Tiempo",
    hint: "___ Tuesday mornings I go to the gym.",
  },
  {
    sentence: "Special days with 'day'",
    answer: "ON",
    category: "⏱ Tiempo",
    hint: "The family gets together ___ Christmas Day.",
  },

  // --- Place: ON ---
  {
    sentence: "Streets",
    answer: "ON",
    category: "📍 Lugar",
    hint: "The shop is ___ Victoria Street.",
  },
  {
    sentence: "Parts of a room",
    answer: "ON",
    category: "📍 Lugar",
    hint: "Your dirty clothes are ___ the floor.",
  },
  {
    sentence: "Floors of a building",
    answer: "ON",
    category: "📍 Lugar",
    hint: "I live ___ the 2nd floor.",
  },
  {
    sentence: "Transportation (except car and taxi)",
    answer: "ON",
    category: "📍 Lugar",
    hint: "They served terrible food ___ the plane.",
  },

  // --- Time: AT ---
  {
    sentence: "Clock times",
    answer: "AT",
    category: "⏱ Tiempo",
    hint: "Lessons start ___ 8:30.",
  },
  {
    sentence: "Meal times",
    answer: "AT",
    category: "⏱ Tiempo",
    hint: "Let's meet ___ lunchtime.",
  },
  {
    sentence: "Weekend",
    answer: "AT",
    category: "⏱ Tiempo",
    hint: "He will be working ___ the weekend.",
  },
  {
    sentence: "Special holidays without 'day'",
    answer: "AT",
    category: "⏱ Tiempo",
    hint: "We'll be in Spain ___ Christmas.",
  },
  {
    sentence: "Specific parts of the day",
    answer: "AT",
    category: "⏱ Tiempo",
    hint: "Owls go hunting ___ night.",
  },

  // --- Place: AT ---
  {
    sentence: "Addresses",
    answer: "AT",
    category: "📍 Lugar",
    hint: "Sherlock Holmes lives ___ 221B Baker Street.",
  },
  {
    sentence: "Specific places in a town or city",
    answer: "AT",
    category: "📍 Lugar",
    hint: "She studies ___ Oxford University.",
  },
  {
    sentence: "Home",
    answer: "AT",
    category: "📍 Lugar",
    hint: "I'm ___ home waiting for the delivery man.",
  },
];

/* ============================================================
   DOM references (cached once)
   ============================================================ */
const DOM = {
  scoreNum: document.getElementById("score-num"),
  streakNum: document.getElementById("streak-num"),
  progressNum: document.getElementById("progress-num"),
  streakStat: document.getElementById("streak-stat"),
  progFill: document.getElementById("prog-fill"),
  progressBar: document.querySelector(".progress-bar-wrap"),
  categoryBadge: document.getElementById("category-badge"),
  gameCard: document.getElementById("game-card"),
  sentenceText: document.getElementById("sentence-text"),
  chips: document.getElementById("chips"),
  chipIn: document.getElementById("chip-in"),
  chipOn: document.getElementById("chip-on"),
  chipAt: document.getElementById("chip-at"),
  feedback: document.getElementById("feedback"),
  hintBox: document.getElementById("hint-box"),
  nextBtn: document.getElementById("next-btn"),
  endScreen: document.getElementById("end-screen"),
  endTitle: document.getElementById("end-title"),
  endScore: document.getElementById("end-score"),
  btnHint: document.getElementById("btn-hint"),
  btnClear: document.getElementById("btn-clear"),
  btnSkip: document.getElementById("btn-skip"),
  btnRestart: document.getElementById("btn-restart"),
};

/** Chip element lookup by preposition key */
const CHIP_EL = { IN: DOM.chipIn, ON: DOM.chipOn, AT: DOM.chipAt };

/* ============================================================
   Game state
   ============================================================ */
/** @type {{ queue: typeof QUESTIONS, current: typeof QUESTIONS[0]|null, score: number, streak: number, answered: number, answeredCorrectly: number, answerState: 'correct'|'wrong'|null, dragging: string|null, touchChip: string|null, touchGhost: HTMLElement|null }} */
const state = {
  queue: [],
  current: null,
  score: 0,
  streak: 0,
  answered: 0,
  answeredCorrectly: 0,
  answerState: null, // 'correct' | 'wrong' | null
  dragging: null,
  touchChip: null,
  touchGhost: null,
};

/* ============================================================
   Pure helpers
   ============================================================ */

/**
 * Shallow-shuffle an array (Fisher-Yates).
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Return a result emoji based on percentage.
 * @param {number} pct
 * @returns {string}
 */
function getEndEmoji(pct) {
  if (pct >= 90) return "🏆";
  if (pct >= 70) return "🎉";
  if (pct >= 50) return "👍";
  return "💪";
}

/**
 * Build the sentence HTML inserting a drop-zone span where ___ appears.
 * If the sentence has no ___, the drop-zone is appended at the end.
 * @param {string} sentence
 * @returns {string}
 */
function buildSentenceHTML(sentence) {
  const dropZone =
    '<span class="drop-zone" id="drop-zone" aria-label="Zona de respuesta"></span>';
  return sentence.includes("___")
    ? sentence.replace("___", dropZone)
    : sentence + " " + dropZone;
}

/* ============================================================
   Rendering helpers
   ============================================================ */

/** Update the three stat counters and progress bar. */
function updateStats(animateStreak) {
  DOM.scoreNum.textContent = state.score;
  DOM.streakNum.textContent = state.streak;

  const current = Math.min(state.answered + 1, state.queue.length);
  DOM.progressNum.textContent = `${current}/${state.queue.length}`;

  const pct = (state.answered / state.queue.length) * 100;
  DOM.progFill.style.width = pct + "%";
  DOM.progressBar.setAttribute("aria-valuenow", Math.round(pct));

  if (animateStreak && state.streak > 0) {
    DOM.streakStat.classList.remove("streak-pop");
    // Force reflow so re-adding the class re-triggers the animation
    void DOM.streakStat.offsetWidth;
    DOM.streakStat.classList.add("streak-pop");
  }
}

/**
 * Show inline feedback beneath the card.
 * @param {boolean} correct
 */
function showFeedback(correct) {
  DOM.feedback.className = `feedback show ${correct ? "ok" : "err"}`;
  DOM.feedback.innerHTML = `<span class="feedback-title">${correct ? "Correcto" : "Incorrecto"}</span>`;
}

/** Reset chip visual state (used / dragging classes). */
function resetChips() {
  Object.values(CHIP_EL).forEach((el) =>
    el.classList.remove("used", "dragging"),
  );
}

/* ============================================================
   Game flow
   ============================================================ */

/** Initialise / restart a full game. */
function startGame() {
  state.queue = shuffleArray(QUESTIONS);
  state.score = 0;
  state.streak = 0;
  state.answered = 0;
  state.answeredCorrectly = 0;
  state.answerState = null;

  DOM.endScreen.hidden = true;
  DOM.gameCard.hidden = false;

  updateStats(false);
  loadQuestion();
}

/** Load the current question into the card. */
function loadQuestion() {
  if (state.answered >= state.queue.length) {
    showEndScreen();
    return;
  }

  state.current = state.queue[state.answered];
  state.answerState = null;

  // Render sentence
  DOM.sentenceText.innerHTML = buildSentenceHTML(state.current.sentence);

  // Reset UI state
  DOM.categoryBadge.textContent = state.current.category;
  DOM.feedback.className = "feedback";
  DOM.feedback.textContent = "";
  DOM.hintBox.className = "hint-box";
  DOM.hintBox.textContent = "";
  DOM.gameCard.className = "game-card";
  DOM.nextBtn.hidden = true;

  resetChips();

  // Colores aleatorios únicos para cada chip
  const chipColors = shuffleArray(["chip-in", "chip-on", "chip-at"]);
  [DOM.chipIn, DOM.chipOn, DOM.chipAt].forEach((chip, i) => {
    chip.classList.add(chipColors[i]);
  });

  updateStats(false);

  // Attach drop events to the freshly created drop zone
  attachDropZoneListeners();
}

/** Attach dragover / dragleave / drop to the current drop zone element. */
function attachDropZoneListeners() {
  const dz = document.getElementById("drop-zone");
  if (!dz) return;

  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!state.answerState) dz.classList.add("drag-over");
  });

  dz.addEventListener("dragleave", () => {
    dz.classList.remove("drag-over");
  });

  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag-over");
    processAnswer(state.dragging);
  });
}

/**
 * Evaluate the player's chosen preposition.
 * @param {string|null} prep  - 'IN' | 'ON' | 'AT'
 */
function processAnswer(prep) {
  if (!prep || !state.current || state.answerState) return;

  const dz = document.getElementById("drop-zone");
  if (!dz) return;

  const prepLower = prep.toLowerCase();
  dz.textContent = prep;
  dz.classList.add("filled", `filled-${prepLower}`);
  CHIP_EL[prep].classList.add("used");

  const correct = prep === state.current.answer;

  if (correct) {
    state.answerState = "correct";
    state.score += state.streak >= 3 ? 2 : 1;
    state.streak++;
    state.answeredCorrectly++;
    showFeedback(true);
    DOM.gameCard.classList.add("correct");
    DOM.nextBtn.hidden = false;
    updateStats(true);
  } else {
    state.answerState = "wrong";
    state.streak = 0;
    showFeedback(false);
    DOM.gameCard.classList.add("wrong");
    updateStats(false);
  }
}

/** Advance to the next question (only callable after a correct answer). */
function advanceQuestion() {
  if (state.answerState !== "correct") return;
  state.answered++;
  loadQuestion();
}

/** Skip the current question (resets streak). */
function skipQuestion() {
  state.streak = 0;
  state.answerState = null;
  state.answered++;
  updateStats(false);
  loadQuestion();
}

/** Clear the drop zone so the player can try again. */
function clearDrop() {
  if (state.answerState === "correct") return;

  const dz = document.getElementById("drop-zone");
  if (!dz) return;

  state.answerState = null;
  dz.textContent = "";
  dz.className = "drop-zone";
  DOM.feedback.className = "feedback";
  DOM.feedback.textContent = "";
  DOM.gameCard.className = "game-card";
  DOM.nextBtn.hidden = true;

  resetChips();
}

/** Show the hint for the current question. */
function showHint() {
  DOM.hintBox.innerHTML = `<strong>💡 Regla:</strong> ${state.current.hint}`;
  DOM.hintBox.classList.add("show");
}

/** Render the end-of-game summary screen. */
function showEndScreen() {
  DOM.gameCard.hidden = true;
  DOM.endScreen.hidden = false;

  const pct = Math.round((state.answeredCorrectly / state.queue.length) * 100);
  const emoji = getEndEmoji(pct);

  DOM.endTitle.textContent = `${emoji} ${pct}%`;
  DOM.endScore.innerHTML = `Respondiste correctamente <strong>${state.answeredCorrectly}</strong> de <strong>${state.queue.length}</strong> oraciones<br>
     Puntuación final: <strong>${state.score} pts</strong>`;

  DOM.progFill.style.width = "100%";
}

/* ============================================================
   Drag-and-drop (mouse)
   ============================================================ */

/** Set up drag events on each chip element. */
function initChipDragListeners() {
  Object.entries(CHIP_EL).forEach(([prep, el]) => {
    el.setAttribute("draggable", "true");

    el.addEventListener("dragstart", (e) => {
      state.dragging = prep;
      e.dataTransfer.setData("text/plain", prep);
      el.classList.add("dragging");
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
    });
  });
}

/* ============================================================
   Touch drag-and-drop (mobile)
   ============================================================ */

/**
 * Create a floating ghost element that follows the finger.
 * @param {HTMLElement} source  - chip element being dragged
 * @param {Touch} touch
 */
function createTouchGhost(source, touch) {
  const ghost = source.cloneNode(true);
  ghost.classList.add("dragging");
  ghost.style.position = "fixed";
  ghost.style.zIndex = "9999";
  ghost.style.pointerEvents = "none";
  ghost.style.width = "86px";
  ghost.style.top = `${touch.clientY - 27}px`;
  ghost.style.left = `${touch.clientX - 43}px`;
  document.body.appendChild(ghost);
  return ghost;
}

/** Move the ghost to follow a touch point. */
function moveTouchGhost(ghost, touch) {
  ghost.style.top = `${touch.clientY - 27}px`;
  ghost.style.left = `${touch.clientX - 43}px`;
}

/** Check whether a touch point is inside an element's bounding rect. */
function isTouchInside(touch, el) {
  const r = el.getBoundingClientRect();
  return (
    touch.clientX >= r.left &&
    touch.clientX <= r.right &&
    touch.clientY >= r.top &&
    touch.clientY <= r.bottom
  );
}

/** Set up touch events on each chip element. */
function initChipTouchListeners() {
  Object.entries(CHIP_EL).forEach(([prep, el]) => {
    el.addEventListener(
      "touchstart",
      (e) => {
        if (state.answerState) return;
        state.touchChip = prep;
        state.touchGhost = createTouchGhost(el, e.touches[0]);
      },
      { passive: true },
    );

    el.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        if (!state.touchGhost || state.answerState) return;

        const touch = e.touches[0];
        moveTouchGhost(state.touchGhost, touch);

        const dz = document.getElementById("drop-zone");
        if (dz) dz.classList.toggle("drag-over", isTouchInside(touch, dz));
      },
      { passive: false },
    );

    el.addEventListener("touchend", (e) => {
      if (state.touchGhost) {
        state.touchGhost.remove();
        state.touchGhost = null;
      }

      if (state.answerState) return;

      const touch = e.changedTouches[0];
      const dz = document.getElementById("drop-zone");

      if (dz) {
        dz.classList.remove("drag-over");
        if (isTouchInside(touch, dz)) {
          processAnswer(state.touchChip);
        }
      }

      state.touchChip = null;
    });
  });
}

/* ============================================================
   Keyboard shortcuts
   ============================================================ */

/** Allow 'i', 'o', 'a' keys to select a preposition. */
function initKeyboardShortcuts() {
  const KEY_MAP = { i: "IN", o: "ON", a: "AT" };

  document.addEventListener("keydown", (e) => {
    if (state.answerState) return;
    const prep = KEY_MAP[e.key.toLowerCase()];
    if (prep) processAnswer(prep);
  });
}

/* ============================================================
   Button listeners
   ============================================================ */
function initButtonListeners() {
  DOM.btnHint.addEventListener("click", showHint);
  DOM.btnClear.addEventListener("click", clearDrop);
  DOM.btnSkip.addEventListener("click", skipQuestion);
  DOM.nextBtn.addEventListener("click", advanceQuestion);
  DOM.btnRestart.addEventListener("click", startGame);
}

/* ============================================================
   Bootstrap
   ============================================================ */
function init() {
  initChipDragListeners();
  initChipTouchListeners();
  initKeyboardShortcuts();
  initButtonListeners();
  startGame();
}

init();
