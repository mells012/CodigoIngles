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
 *
 * Data source: fetched from the REST API at API_BASE_URL.
 * Run the server (server/index.js) before opening the game locally.
 */

"use strict";

/* ============================================================
   Supabase configuration
   Values come from supabase-config.js — load that file before this one.
   ============================================================ */
const SUPABASE_URL      = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
const SUPABASE_HEADERS  = {
  "apikey":        SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type":  "application/json",
};

/* ============================================================
   Game mode
   Two pages share this script:
   - "rules"    (default): question = rule keyword (e.g. "Months"),
                           hint reveals the example sentence.
   - "examples":           question = example sentence with a blank
                           (e.g. "We are moving ___ May."),
                           hint reveals the rule keyword.
   Set window.GAME_MODE = "examples" in the HTML before loading this file.
   ============================================================ */
const GAME_MODE = window.GAME_MODE === "examples" ? "examples" : "rules";

// Identifier sent with every saved score so each exercise has its own leaderboard.
// Set window.EXERCISE_NAME in the HTML before loading this file.
const EXERCISE_NAME = typeof window.EXERCISE_NAME === "string" ? window.EXERCISE_NAME.trim() : "";

// Human-readable labels for each exercise identifier.
const EXERCISE_LABELS = {
  "preposiciones-reglas": "Preposiciones · Reglas",
  "preposiciones-ejemplos": "Preposiciones · Ejemplos",
};

function exerciseLabel(id) {
  return EXERCISE_LABELS[id] || id || "—";
}

function formatDate(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Which question field carries the blank to fill, and which is the revealed rule.
const FIELD =
  GAME_MODE === "examples"
    ? { question: "hint", rule: "sentence" }
    : { question: "sentence", rule: "hint" };

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
  saveScore: document.getElementById("save-score"),
  playerName: document.getElementById("player-name"),
  btnSaveScore: document.getElementById("btn-save-score"),
  saveStatus: document.getElementById("save-status"),
  leaderboard: document.getElementById("leaderboard"),
  leaderboardList: document.getElementById("leaderboard-list"),
};

/** Chip element lookup by preposition key */
const CHIP_EL = { IN: DOM.chipIn, ON: DOM.chipOn, AT: DOM.chipAt };

/* ============================================================
   Game state
   ============================================================ */
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

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getEndEmoji(pct) {
  if (pct >= 90) return "🏆";
  if (pct >= 70) return "🎉";
  if (pct >= 50) return "👍";
  return "💪";
}

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
    void DOM.streakStat.offsetWidth;
    DOM.streakStat.classList.add("streak-pop");
  }
}

function showFeedback(correct) {
  DOM.feedback.className = `feedback show ${correct ? "ok" : "err"}`;
  DOM.feedback.innerHTML = `<span class="feedback-title">${correct ? "Correcto" : "Incorrecto"}</span>`;
}

function resetChips() {
  Object.values(CHIP_EL).forEach((el) =>
    el.classList.remove("used", "dragging"),
  );
}

/* ============================================================
   Game flow
   ============================================================ */

function startGame() {
  const questions = window.QUESTIONS;
  if (!questions || !questions.length) {
    DOM.sentenceText.textContent = "⚠️ No hay preguntas definidas para este ejercicio.";
    return;
  }

  state.queue = shuffleArray(questions);
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

function loadQuestion() {
  if (state.answered >= state.queue.length) {
    showEndScreen();
    return;
  }

  state.current = state.queue[state.answered];
  state.answerState = null;

  DOM.sentenceText.innerHTML = buildSentenceHTML(state.current[FIELD.question]);

  DOM.categoryBadge.textContent = state.current.category;
  DOM.feedback.className = "feedback";
  DOM.feedback.textContent = "";
  DOM.hintBox.className = "hint-box";
  DOM.hintBox.textContent = "";
  DOM.gameCard.className = "game-card";
  DOM.nextBtn.hidden = true;

  resetChips();

  const chipColors = shuffleArray(["chip-in", "chip-on", "chip-at"]);
  [DOM.chipIn, DOM.chipOn, DOM.chipAt].forEach((chip, i) => {
    chip.classList.add(chipColors[i]);
  });

  updateStats(false);
  attachDropZoneListeners();
}

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

function advanceQuestion() {
  if (state.answerState !== "correct") return;
  state.answered++;
  loadQuestion();
}

function skipQuestion() {
  state.streak = 0;
  state.answerState = null;
  state.answered++;
  updateStats(false);
  loadQuestion();
}

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

function showHint() {
  DOM.hintBox.innerHTML = `<strong>💡 Regla:</strong> ${state.current[FIELD.rule]}`;
  DOM.hintBox.classList.add("show");
}

function showEndScreen() {
  DOM.gameCard.hidden = true;
  DOM.endScreen.hidden = false;

  const pct = Math.round((state.answeredCorrectly / state.queue.length) * 100);
  const emoji = getEndEmoji(pct);

  DOM.endTitle.textContent = `${emoji} ${pct}%`;
  DOM.endScore.innerHTML = `Respondiste correctamente <strong>${state.answeredCorrectly}</strong> de <strong>${state.queue.length}</strong> oraciones<br>
     Puntuación final: <strong>${state.score} pts</strong>`;

  DOM.progFill.style.width = "100%";

  // Save-score + leaderboard are optional UI (only on pages that include them).
  if (DOM.saveScore) {
    // Reset the save UI so the player can record this game's score.
    DOM.saveScore.hidden = false;
    DOM.btnSaveScore.disabled = false;
    DOM.playerName.disabled = false;
    DOM.playerName.value = "";
    DOM.saveStatus.textContent = "";
    DOM.saveStatus.className = "save-status";
    DOM.leaderboard.hidden = true;

    // Show the existing leaderboard right away (does not require saving first).
    loadLeaderboard();
  }
}

/* ============================================================
   Scores (backend)
   ============================================================ */

/** Save the just-finished game to Supabase under the typed player name. */
async function saveScore() {
  const player = DOM.playerName.value.trim();
  if (!player) {
    DOM.saveStatus.textContent = "Escribe tu nombre primero.";
    DOM.saveStatus.className = "save-status err";
    DOM.playerName.focus();
    return;
  }

  DOM.btnSaveScore.disabled = true;
  DOM.saveStatus.textContent = "Guardando…";
  DOM.saveStatus.className = "save-status";

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
      method: "POST",
      headers: { ...SUPABASE_HEADERS, "Prefer": "return=minimal" },
      body: JSON.stringify({
        player,
        score: state.score,
        correct: state.answeredCorrectly,
        total: state.queue.length,
        exercise: EXERCISE_NAME,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    DOM.saveStatus.textContent = "¡Puntaje guardado! ✅";
    DOM.saveStatus.className = "save-status ok";
    DOM.playerName.disabled = true;
    await loadLeaderboard();
  } catch (err) {
    console.error(err);
    DOM.saveStatus.textContent = "No se pudo guardar. ¿Está configurado Supabase?";
    DOM.saveStatus.className = "save-status err";
    DOM.btnSaveScore.disabled = false;
  }
}

/** Fetch the top scores from Supabase and render the leaderboard list. */
async function loadLeaderboard() {
  try {
    const params = new URLSearchParams({
      select: "player,score,correct,total,played_at,exercise",
      exercise: `eq.${EXERCISE_NAME}`,
      order: "score.desc,played_at.asc",
      limit: "10",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scores?${params}`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const scores = await res.json();
    if (!scores.length) {
      DOM.leaderboard.hidden = true;
      return;
    }

    DOM.leaderboardList.innerHTML = scores
      .map(
        (s) =>
          `<li>
            <div class="lb-main">
              <span class="lb-name">${escapeHTML(s.player)}</span>
              <span class="lb-score">${s.score} pts</span>
            </div>
            <div class="lb-meta">
              <span class="lb-exercise">${escapeHTML(exerciseLabel(s.exercise))}</span>
              <span class="lb-date">${formatDate(s.played_at)}</span>
            </div>
          </li>`,
      )
      .join("");
    DOM.leaderboard.hidden = false;
  } catch (err) {
    // Server unreachable — hide the leaderboard instead of showing an error.
    console.warn("Leaderboard unavailable:", err);
    DOM.leaderboard.hidden = true;
  }
}

/**
 * Escape user-supplied text before inserting it as HTML (prevents injection).
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   Drag-and-drop (mouse)
   ============================================================ */

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

function moveTouchGhost(ghost, touch) {
  ghost.style.top = `${touch.clientY - 27}px`;
  ghost.style.left = `${touch.clientX - 43}px`;
}

function isTouchInside(touch, el) {
  const r = el.getBoundingClientRect();
  return (
    touch.clientX >= r.left &&
    touch.clientX <= r.right &&
    touch.clientY >= r.top &&
    touch.clientY <= r.bottom
  );
}

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
  // Save-score UI is optional (only present on pages that include it).
  DOM.btnSaveScore?.addEventListener("click", saveScore);
  DOM.playerName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveScore();
  });
}

/* ============================================================
   Bootstrap
   ============================================================ */
function init() {
  initChipDragListeners();
  initChipTouchListeners();
  initKeyboardShortcuts();
  initButtonListeners();
  startGame(); // async: fetches questions, then starts the game
}

init();
