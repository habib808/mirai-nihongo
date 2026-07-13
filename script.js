const STORAGE_KEY = "irodori_vocab_progress_v1";
const PAGE_SIZE = 60;

const state = {
  words: [],
  filtered: [],
  visibleCount: PAGE_SIZE,
  filters: {
    search: "",
    lesson: "all",
    type: "all",
    jlpt: "all",
    status: "all",
    favoriteOnly: false,
  },
  activeTab: "cards",
  progress: null,
  flashIndex: 0,
  flashBackVisible: false,
  writingIndex: 0,
  quiz: {
    active: false,
    mode: "multiple",
    questions: [],
    index: 0,
    score: 0,
    locked: false,
    startedAt: null,
    timer: null,
  },
  deferredInstallPrompt: null,
};

const defaultSettings = {
  showFurigana: true,
  showRomaji: true,
  showEnglish: true,
  showBangla: true,
  largeFont: false,
  compactCards: false,
  darkMode: true,
  dailyGoal: 20,
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  loadProgress();
  bindEvents();
  applySettings();
  initWritingCanvas();

  try {
    state.words = await loadWords();
    state.words = state.words.map((word) => ({ ...word, id: Number(word.id) }));
    populateFilters();
    applyFilters();
    renderAll();
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    showToast("Could not load vocabulary data. Use a local server or keep assets/words-data.js beside index.html.");
  }
}

function cacheElements() {
  const ids = [
    "searchInput",
    "favoriteOnlyButton",
    "themeToggle",
    "installButton",
    "statsGrid",
    "todayGoalText",
    "goalProgressBar",
    "quickTotal",
    "quickBestScore",
    "lessonList",
    "clearLessonButton",
    "lessonFilter",
    "typeFilter",
    "jlptFilter",
    "statusFilter",
    "exportButton",
    "printButton",
    "cardsView",
    "cardsHeading",
    "resultCount",
    "cardsGrid",
    "loadMoreButton",
    "flashcardsView",
    "flashcard",
    "flashcardFront",
    "flashcardBack",
    "flashcardCounter",
    "prevFlashcard",
    "flipFlashcard",
    "nextFlashcard",
    "shuffleFlashcards",
    "quizView",
    "quizTimer",
    "quizMode",
    "quizLength",
    "startQuiz",
    "quizCard",
    "writingView",
    "writingCounter",
    "writingPrompt",
    "writingAnswer",
    "revealWriting",
    "nextWriting",
    "writingCanvas",
    "clearCanvas",
    "settingsView",
    "settingsGrid",
    "dailyGoalInput",
    "resetFilters",
    "resetProgress",
    "printArea",
    "toast",
  ];
  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
  els.tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
  els.views = {
    cards: els.cardsView,
    flashcards: els.flashcardsView,
    quiz: els.quizView,
    writing: els.writingView,
    settings: els.settingsView,
  };
}

async function loadWords() {
  if (Array.isArray(window.IRODORI_WORDS) && window.IRODORI_WORDS.length) {
    return window.IRODORI_WORDS;
  }
  const response = await fetch("words.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`words.json failed: ${response.status}`);
  }
  return response.json();
}

function loadProgress() {
  const fallback = {
    favorites: new Set(),
    learned: new Set(),
    review: new Set(),
    quizHistory: [],
    todayLearned: [],
    lastStudyDate: "",
    streak: 0,
    settings: { ...defaultSettings },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.progress = {
      favorites: new Set(saved.favorites || []),
      learned: new Set(saved.learned || []),
      review: new Set(saved.review || []),
      quizHistory: saved.quizHistory || [],
      todayLearned: saved.todayLearned || [],
      lastStudyDate: saved.lastStudyDate || "",
      streak: Number(saved.streak || 0),
      settings: { ...defaultSettings, ...(saved.settings || {}) },
    };
  } catch {
    state.progress = fallback;
  }
  if (!state.progress) {
    state.progress = fallback;
  }
  refreshDailyWindow();
}

function saveProgress() {
  const payload = {
    favorites: Array.from(state.progress.favorites),
    learned: Array.from(state.progress.learned),
    review: Array.from(state.progress.review),
    quizHistory: state.progress.quizHistory.slice(-30),
    todayLearned: state.progress.todayLearned,
    lastStudyDate: state.progress.lastStudyDate,
    streak: state.progress.streak,
    settings: state.progress.settings,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function refreshDailyWindow() {
  const today = getDateKey();
  if (!state.progress.lastStudyDate) {
    state.progress.lastStudyDate = today;
    state.progress.todayLearned = [];
    saveProgress();
    return;
  }
  if (state.progress.lastStudyDate !== today) {
    state.progress.todayLearned = [];
    saveProgress();
  }
}

function recordLearningActivity(id) {
  const today = getDateKey();
  if (state.progress.lastStudyDate !== today) {
    state.progress.streak = isYesterday(state.progress.lastStudyDate, today) ? state.progress.streak + 1 : 1;
    state.progress.lastStudyDate = today;
    state.progress.todayLearned = [];
  } else if (state.progress.streak === 0) {
    state.progress.streak = 1;
  }
  if (!state.progress.todayLearned.includes(id)) {
    state.progress.todayLearned.push(id);
  }
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isYesterday(previousKey, todayKey) {
  if (!previousKey) return false;
  const previous = new Date(`${previousKey}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  return today - previous === 86400000;
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.filters.search = els.searchInput.value.trim();
    resetVisibleAndRender();
  });
  els.favoriteOnlyButton.addEventListener("click", () => {
    state.filters.favoriteOnly = !state.filters.favoriteOnly;
    els.favoriteOnlyButton.setAttribute("aria-pressed", String(state.filters.favoriteOnly));
    resetVisibleAndRender();
  });
  els.themeToggle.addEventListener("click", () => {
    state.progress.settings.darkMode = !state.progress.settings.darkMode;
    saveProgress();
    applySettings();
  });
  els.lessonFilter.addEventListener("change", () => {
    state.filters.lesson = els.lessonFilter.value;
    resetVisibleAndRender();
  });
  els.typeFilter.addEventListener("change", () => {
    state.filters.type = els.typeFilter.value;
    resetVisibleAndRender();
  });
  els.jlptFilter.addEventListener("change", () => {
    state.filters.jlpt = els.jlptFilter.value;
    resetVisibleAndRender();
  });
  els.statusFilter.addEventListener("change", () => {
    state.filters.status = els.statusFilter.value;
    resetVisibleAndRender();
  });
  els.clearLessonButton.addEventListener("click", () => {
    state.filters.lesson = "all";
    els.lessonFilter.value = "all";
    resetVisibleAndRender();
  });
  els.cardsGrid.addEventListener("click", handleCardAction);
  els.loadMoreButton.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    renderCards();
  });
  els.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  els.prevFlashcard.addEventListener("click", () => moveFlashcard(-1));
  els.nextFlashcard.addEventListener("click", () => moveFlashcard(1));
  els.flipFlashcard.addEventListener("click", flipFlashcard);
  els.flashcard.addEventListener("click", flipFlashcard);
  els.shuffleFlashcards.addEventListener("click", () => {
    shuffleArray(state.filtered);
    state.flashIndex = 0;
    state.flashBackVisible = false;
    renderFlashcard();
  });
  els.startQuiz.addEventListener("click", startQuiz);
  els.quizCard.addEventListener("click", handleQuizClick);
  els.revealWriting.addEventListener("click", revealWriting);
  els.nextWriting.addEventListener("click", () => moveWriting(1));
  els.clearCanvas.addEventListener("click", clearWritingCanvas);
  els.exportButton.addEventListener("click", exportPdf);
  els.printButton.addEventListener("click", printWords);
  els.settingsGrid.addEventListener("change", handleSettingChange);
  els.dailyGoalInput.addEventListener("input", () => {
    const nextGoal = Math.max(1, Math.min(200, Number(els.dailyGoalInput.value || 20)));
    state.progress.settings.dailyGoal = nextGoal;
    saveProgress();
    renderStats();
  });
  els.resetFilters.addEventListener("click", resetFilters);
  els.resetProgress.addEventListener("click", resetProgress);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });
  els.installButton.addEventListener("click", installApp);
  document.addEventListener("keydown", handleKeyboard);
}

function populateFilters() {
  const lessonMap = getLessonMap();
  els.lessonFilter.innerHTML = `<option value="all">All lessons</option>${Array.from(lessonMap.values())
    .map((lesson) => `<option value="${lesson.lesson}">Lesson ${lesson.lesson}: ${escapeHtml(lesson.title)}</option>`)
    .join("")}`;
  const types = Array.from(new Set(state.words.map((word) => word.type))).sort();
  els.typeFilter.innerHTML = `<option value="all">All types</option>${types
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
    .join("")}`;
}

function getLessonMap() {
  const lessons = new Map();
  state.words.forEach((word) => {
    if (!lessons.has(word.lesson)) {
      lessons.set(word.lesson, {
        lesson: word.lesson,
        title: word.lessonTitle || `Lesson ${word.lesson}`,
        words: [],
      });
    }
    lessons.get(word.lesson).words.push(word);
  });
  return new Map(Array.from(lessons.entries()).sort((a, b) => Number(a[0]) - Number(b[0])));
}

function applyFilters() {
  const term = normalizeSearch(state.filters.search);
  state.filtered = state.words.filter((word) => {
    if (state.filters.lesson !== "all" && String(word.lesson) !== state.filters.lesson) return false;
    if (state.filters.type !== "all" && word.type !== state.filters.type) return false;
    if (state.filters.jlpt !== "all" && word.jlpt !== state.filters.jlpt) return false;
    if (state.filters.favoriteOnly && !state.progress.favorites.has(word.id)) return false;
    if (state.filters.status === "learned" && !state.progress.learned.has(word.id)) return false;
    if (state.filters.status === "unlearned" && state.progress.learned.has(word.id)) return false;
    if (state.filters.status === "review" && !state.progress.review.has(word.id)) return false;
    if (state.filters.status === "favorite" && !state.progress.favorites.has(word.id)) return false;
    if (!term) return true;
    return [
      word.word,
      word.furigana,
      word.romaji,
      word.bangla,
      word.english,
      word.lessonTitle,
      word.section,
      word.type,
    ]
      .map(normalizeSearch)
      .some((value) => value.includes(term));
  });
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function renderAll() {
  renderStats();
  renderLessonSidebar();
  renderCards();
  renderFlashcard();
  renderWriting();
  renderSettings();
}

function renderStats() {
  const total = state.words.length;
  const learned = state.progress.learned.size;
  const favorites = state.progress.favorites.size;
  const review = state.progress.review.size;
  const bestScore = getBestQuizScore();
  const stats = [
    ["Total", total],
    ["Learned", learned],
    ["Favorites", favorites],
    ["Streak", `${state.progress.streak} days`],
  ];
  els.statsGrid.innerHTML = stats
    .map(([label, value]) => `<div class="stat-card"><span class="panel-label">${label}</span><strong>${value}</strong></div>`)
    .join("");
  els.quickTotal.textContent = `${total} words`;
  els.quickBestScore.textContent = bestScore ? `${bestScore}% best` : "No score yet";
  const goal = Number(state.progress.settings.dailyGoal || 20);
  const today = state.progress.todayLearned.length;
  els.todayGoalText.textContent = `${today} / ${goal} learned`;
  els.goalProgressBar.style.width = `${Math.min(100, Math.round((today / goal) * 100))}%`;
  els.resultCount.textContent = `${state.filtered.length} results`;
  void review;
}

function getBestQuizScore() {
  if (!state.progress.quizHistory.length) return 0;
  return Math.max(...state.progress.quizHistory.map((quiz) => quiz.percent || 0));
}

function renderLessonSidebar() {
  const lessonMap = getLessonMap();
  els.lessonList.innerHTML = Array.from(lessonMap.values())
    .map((lesson) => {
      const learned = lesson.words.filter((word) => state.progress.learned.has(word.id)).length;
      const percent = Math.round((learned / lesson.words.length) * 100);
      const active = state.filters.lesson === String(lesson.lesson);
      return `
        <button class="lesson-button${active ? " active" : ""}" type="button" data-lesson="${lesson.lesson}">
          <strong>Lesson ${lesson.lesson}</strong>
          <small>${escapeHtml(lesson.title)}</small>
          <small>${lesson.words.length} words · ${percent}% complete</small>
          <span class="mini-progress" aria-hidden="true"><span style="width:${percent}%"></span></span>
        </button>
      `;
    })
    .join("");
  els.lessonList.querySelectorAll(".lesson-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.lesson = button.dataset.lesson;
      els.lessonFilter.value = state.filters.lesson;
      resetVisibleAndRender();
    });
  });
}

function renderCards() {
  const visible = state.filtered.slice(0, state.visibleCount);
  els.cardsGrid.innerHTML = visible.map(renderCard).join("");
  els.loadMoreButton.hidden = state.visibleCount >= state.filtered.length;
  els.resultCount.textContent = `${state.filtered.length} results`;
  const lessonLabel = state.filters.lesson === "all" ? "All words" : `Lesson ${state.filters.lesson}`;
  els.cardsHeading.textContent = lessonLabel;
}

function renderCard(word) {
  const favorite = state.progress.favorites.has(word.id);
  const learned = state.progress.learned.has(word.id);
  const review = state.progress.review.has(word.id);
  const settings = state.progress.settings;
  return `
    <article class="word-card" data-id="${word.id}">
      <div class="card-top">
        <div>
          <p class="panel-label">Lesson ${word.lesson}</p>
          <h3 class="jp-word">${escapeHtml(stripMarkers(word.word))}</h3>
        </div>
        <button class="mini-button${favorite ? " active" : ""}" type="button" data-action="favorite" aria-pressed="${favorite}" title="Favorite">★</button>
      </div>
      <div class="reading-row">
        ${settings.showFurigana ? `<div class="furigana"><span>Furigana</span><strong>${escapeHtml(word.furigana)}</strong></div>` : ""}
        ${settings.showRomaji ? `<div class="romaji"><span>Romaji</span><strong>${escapeHtml(word.romaji)}</strong></div>` : ""}
      </div>
      <div class="meaning-row">
        ${settings.showBangla ? `<div><span>Bangla</span><strong>${escapeHtml(word.bangla)}</strong></div>` : ""}
        ${settings.showEnglish ? `<div><span>English</span><strong>${escapeHtml(word.english)}</strong></div>` : ""}
      </div>
      <div class="badge-row">
        <span class="badge type">${escapeHtml(word.type)}</span>
        <span class="badge">${escapeHtml(word.jlpt)}</span>
        <span class="badge">${escapeHtml(word.difficulty)}</span>
        ${learned ? `<span class="badge learned">Learned</span>` : ""}
        ${review ? `<span class="badge review">Review</span>` : ""}
      </div>
      <div class="example-row">
        <span>Accent</span>
        <strong>${escapeHtml(word.accent || "Available in reading")}</strong>
        <span>Example</span>
        <strong class="example-jp">${escapeHtml(word.exampleSentence || "")}</strong>
        <span>${escapeHtml(word.banglaExampleTranslation || "")}</span>
      </div>
      ${word.verb ? renderVerbPanel(word.verb) : ""}
      <div class="card-actions">
        <button class="mini-button${learned ? " active" : ""}" type="button" data-action="learned">${learned ? "Learned" : "Mark Learned"}</button>
        <button class="mini-button${review ? " active" : ""}" type="button" data-action="review">${review ? "In Review" : "Review"}</button>
        <button class="mini-button" type="button" data-action="audio">Audio</button>
      </div>
    </article>
  `;
}

function renderVerbPanel(verb) {
  return `
    <div class="verb-panel">
      <span class="panel-label">Verb Card</span>
      <div class="verb-grid">
        <div><span>Dictionary</span><strong>${escapeHtml(verb.dictionaryForm)}</strong></div>
        <div><span>Masu</span><strong>${escapeHtml(verb.masuForm)}</strong></div>
        <div><span>Te</span><strong>${escapeHtml(verb.teForm)}</strong></div>
        <div><span>Past</span><strong>${escapeHtml(verb.pastForm)}</strong></div>
      </div>
    </div>
  `;
}

function handleCardAction(event) {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest("[data-id]");
  if (!button || !card) return;
  const id = Number(card.dataset.id);
  const word = state.words.find((item) => item.id === id);
  if (!word) return;
  const action = button.dataset.action;
  if (action === "favorite") toggleSet(state.progress.favorites, id);
  if (action === "review") toggleSet(state.progress.review, id);
  if (action === "learned") {
    toggleSet(state.progress.learned, id);
    if (state.progress.learned.has(id)) {
      state.progress.review.delete(id);
      recordLearningActivity(id);
    }
  }
  if (action === "audio") {
    speakJapanese(word.word);
    return;
  }
  saveProgress();
  renderAll();
}

function toggleSet(set, value) {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
}

function renderFlashcard() {
  const deck = getActiveDeck();
  if (!deck.length) {
    els.flashcardFront.innerHTML = `<div>No cards match the current filters.</div>`;
    els.flashcardBack.hidden = true;
    els.flashcardCounter.textContent = "0 / 0";
    return;
  }
  state.flashIndex = clampIndex(state.flashIndex, deck.length);
  const word = deck[state.flashIndex];
  els.flashcardCounter.textContent = `${state.flashIndex + 1} / ${deck.length}`;
  els.flashcardFront.innerHTML = `
    <span class="panel-label">Front</span>
    <strong class="flash-jp">${escapeHtml(stripMarkers(word.word))}</strong>
  `;
  els.flashcardBack.innerHTML = `
    <span class="panel-label">Back</span>
    <strong>${escapeHtml(word.furigana)}</strong>
    <span>${escapeHtml(word.romaji)}</span>
    <p class="flash-meaning">${escapeHtml(word.bangla)} · ${escapeHtml(word.english)}</p>
  `;
  els.flashcardBack.hidden = !state.flashBackVisible;
  els.flashcardFront.hidden = state.flashBackVisible;
  els.flipFlashcard.textContent = state.flashBackVisible ? "Hide" : "Reveal";
}

function getActiveDeck() {
  return state.filtered.length ? state.filtered : state.words;
}

function flipFlashcard() {
  state.flashBackVisible = !state.flashBackVisible;
  renderFlashcard();
}

function moveFlashcard(delta) {
  const deck = getActiveDeck();
  if (!deck.length) return;
  state.flashIndex = (state.flashIndex + delta + deck.length) % deck.length;
  state.flashBackVisible = false;
  renderFlashcard();
}

function startQuiz() {
  const source = getQuizSource();
  if (source.length < 4) {
    showToast("Use at least four words for quiz mode.");
    return;
  }
  stopQuizTimer();
  const length = Math.max(5, Math.min(50, Number(els.quizLength.value || 10)));
  const questions = sample(source, Math.min(length, source.length)).map((word) => buildQuizQuestion(word, source));
  state.quiz = {
    active: true,
    mode: els.quizMode.value,
    questions,
    index: 0,
    score: 0,
    locked: false,
    startedAt: Date.now(),
    timer: window.setInterval(renderQuizTimer, 1000),
  };
  renderQuizTimer();
  renderQuizQuestion();
}

function getQuizSource() {
  if (els.quizMode.value === "lesson" && state.filters.lesson === "all") {
    return state.words.filter((word) => word.lesson === 1);
  }
  return state.filtered.length ? state.filtered : state.words;
}

function buildQuizQuestion(word, source) {
  const selectedMode = els.quizMode.value === "random" ? sample(["multiple", "typing", "meaning", "japanese"], 1)[0] : els.quizMode.value;
  const mode = selectedMode === "lesson" ? "meaning" : selectedMode;
  if (mode === "typing") {
    return {
      word,
      mode,
      prompt: `Type the romaji for ${stripMarkers(word.word)}`,
      correct: normalizeAnswer(word.romaji.split("/")[0]),
      displayAnswer: word.romaji,
    };
  }
  if (mode === "japanese") {
    return {
      word,
      mode,
      prompt: `Choose the Japanese for: ${word.english}`,
      correct: stripMarkers(word.word),
      options: buildOptions(word, source, "word").map(stripMarkers),
    };
  }
  return {
    word,
    mode,
    prompt: `Choose the meaning of ${stripMarkers(word.word)}`,
    correct: word.english,
    options: buildOptions(word, source, "english"),
  };
}

function buildOptions(word, source, key) {
  const others = sample(source.filter((item) => item.id !== word.id), 3).map((item) => item[key]);
  return shuffleArray([word[key], ...others]);
}

function renderQuizQuestion() {
  const quiz = state.quiz;
  if (!quiz.active) {
    els.quizCard.innerHTML = `<p>Choose a mode and start a quiz.</p>`;
    return;
  }
  if (quiz.index >= quiz.questions.length) {
    finishQuiz();
    return;
  }
  const question = quiz.questions[quiz.index];
  const progress = `${quiz.index + 1} / ${quiz.questions.length}`;
  if (question.mode === "typing") {
    els.quizCard.innerHTML = `
      <span class="panel-label">Question ${progress}</span>
      <div class="quiz-question">${escapeHtml(question.prompt)}</div>
      <input class="typing-answer" id="typingAnswer" type="text" autocomplete="off">
      <div class="action-row">
        <button class="primary-button" type="button" data-quiz-action="checkTyping">Check</button>
        <button class="ghost-button" type="button" data-quiz-action="skip">Skip</button>
      </div>
    `;
    document.getElementById("typingAnswer").focus();
    return;
  }
  els.quizCard.innerHTML = `
    <span class="panel-label">Question ${progress}</span>
    <div class="quiz-question">${escapeHtml(question.prompt)}</div>
    <div class="quiz-options">
      ${question.options
        .map((option) => `<button class="quiz-option" type="button" data-answer="${escapeAttribute(option)}">${escapeHtml(option)}</button>`)
        .join("")}
    </div>
  `;
}

function handleQuizClick(event) {
  const actionButton = event.target.closest("[data-quiz-action]");
  if (actionButton) {
    const action = actionButton.dataset.quizAction;
    if (action === "checkTyping") checkTypingAnswer();
    if (action === "skip") nextQuizQuestion(false);
    if (action === "next") nextQuizQuestion();
    return;
  }
  const option = event.target.closest(".quiz-option");
  if (!option || state.quiz.locked) return;
  const question = state.quiz.questions[state.quiz.index];
  const selected = option.dataset.answer;
  const correct = selected === question.correct;
  state.quiz.locked = true;
  if (correct) state.quiz.score += 1;
  els.quizCard.querySelectorAll(".quiz-option").forEach((button) => {
    if (button.dataset.answer === question.correct) button.classList.add("correct");
    if (button === option && !correct) button.classList.add("wrong");
    button.disabled = true;
  });
  els.quizCard.insertAdjacentHTML(
    "beforeend",
    `<div class="action-row"><strong>${correct ? "Correct" : `Answer: ${escapeHtml(question.correct)}`}</strong><button class="primary-button" type="button" data-quiz-action="next">Next</button></div>`,
  );
}

function checkTypingAnswer() {
  if (state.quiz.locked) return;
  const input = document.getElementById("typingAnswer");
  const question = state.quiz.questions[state.quiz.index];
  const correct = normalizeAnswer(input.value) === question.correct;
  state.quiz.locked = true;
  if (correct) state.quiz.score += 1;
  input.disabled = true;
  els.quizCard.insertAdjacentHTML(
    "beforeend",
    `<div class="action-row"><strong>${correct ? "Correct" : `Answer: ${escapeHtml(question.displayAnswer)}`}</strong><button class="primary-button" type="button" data-quiz-action="next">Next</button></div>`,
  );
}

function nextQuizQuestion() {
  state.quiz.index += 1;
  state.quiz.locked = false;
  renderQuizQuestion();
}

function finishQuiz() {
  stopQuizTimer();
  const total = state.quiz.questions.length;
  const percent = Math.round((state.quiz.score / total) * 100);
  state.progress.quizHistory.push({
    mode: state.quiz.mode,
    score: state.quiz.score,
    total,
    percent,
    date: new Date().toISOString(),
  });
  saveProgress();
  els.quizCard.innerHTML = `
    <span class="panel-label">Quiz complete</span>
    <div class="quiz-question">${state.quiz.score} / ${total} correct</div>
    <p>${percent}% score</p>
    <button class="primary-button" type="button" id="restartQuiz">Restart</button>
  `;
  document.getElementById("restartQuiz").addEventListener("click", startQuiz);
  state.quiz.active = false;
  renderStats();
}

function renderQuizTimer() {
  if (!state.quiz.startedAt) {
    els.quizTimer.textContent = "00:00";
    return;
  }
  const elapsed = Math.floor((Date.now() - state.quiz.startedAt) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  els.quizTimer.textContent = `${minutes}:${seconds}`;
}

function stopQuizTimer() {
  if (state.quiz.timer) {
    clearInterval(state.quiz.timer);
  }
  state.quiz.timer = null;
}

function renderWriting() {
  const deck = getActiveDeck();
  if (!deck.length) {
    els.writingPrompt.textContent = "No words match the current filters.";
    els.writingAnswer.hidden = true;
    els.writingCounter.textContent = "0 / 0";
    return;
  }
  state.writingIndex = clampIndex(state.writingIndex, deck.length);
  const word = deck[state.writingIndex];
  els.writingCounter.textContent = `${state.writingIndex + 1} / ${deck.length}`;
  els.writingPrompt.textContent = stripMarkers(word.word);
  els.writingAnswer.innerHTML = `
    <strong>${escapeHtml(word.furigana)} · ${escapeHtml(word.romaji)}</strong>
    <span>${escapeHtml(word.bangla)} · ${escapeHtml(word.english)}</span>
  `;
  els.writingAnswer.hidden = true;
  els.revealWriting.textContent = "Reveal";
}

function revealWriting() {
  els.writingAnswer.hidden = !els.writingAnswer.hidden;
  els.revealWriting.textContent = els.writingAnswer.hidden ? "Reveal" : "Hide";
}

function moveWriting(delta) {
  const deck = getActiveDeck();
  if (!deck.length) return;
  state.writingIndex = (state.writingIndex + delta + deck.length) % deck.length;
  renderWriting();
  clearWritingCanvas();
}

function initWritingCanvas() {
  const canvas = els.writingCanvas;
  const ctx = canvas.getContext("2d");
  let drawing = false;

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const point = pointerPosition(event);
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--primary").trim() || "#0f766e";
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  });
  canvas.addEventListener("pointerup", () => {
    drawing = false;
  });
  canvas.addEventListener("pointercancel", () => {
    drawing = false;
  });
  clearWritingCanvas();
}

function clearWritingCanvas() {
  const canvas = els.writingCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--line").trim() || "#dce5ea";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += canvas.width / 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += canvas.height / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.restore();
}

function renderSettings() {
  Object.entries(defaultSettings).forEach(([key]) => {
    const input = els.settingsGrid.querySelector(`[data-setting="${key}"]`);
    if (input) input.checked = Boolean(state.progress.settings[key]);
  });
  els.dailyGoalInput.value = state.progress.settings.dailyGoal;
}

function handleSettingChange(event) {
  const input = event.target.closest("[data-setting]");
  if (!input) return;
  state.progress.settings[input.dataset.setting] = input.checked;
  saveProgress();
  applySettings();
  renderAll();
}

function applySettings() {
  const settings = state.progress.settings;
  document.body.classList.toggle("dark", settings.darkMode);
  document.body.classList.toggle("large-japanese", settings.largeFont);
  document.body.classList.toggle("compact-cards", settings.compactCards);
  els.themeToggle.classList.toggle("active", settings.darkMode);
  els.themeToggle.setAttribute("aria-pressed", String(settings.darkMode));
  clearWritingCanvas();
}

function switchTab(tab) {
  if (!els.views[tab]) return;
  state.activeTab = tab;
  Object.entries(els.views).forEach(([key, view]) => {
    view.classList.toggle("active", key === tab);
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  if (tab === "flashcards") renderFlashcard();
  if (tab === "writing") renderWriting();
  if (tab === "quiz" && !state.quiz.active) renderQuizQuestion();
}

function resetVisibleAndRender() {
  state.visibleCount = PAGE_SIZE;
  applyFilters();
  state.flashIndex = 0;
  state.writingIndex = 0;
  renderAll();
}

function resetFilters() {
  state.filters = {
    search: "",
    lesson: "all",
    type: "all",
    jlpt: "all",
    status: "all",
    favoriteOnly: false,
  };
  els.searchInput.value = "";
  els.lessonFilter.value = "all";
  els.typeFilter.value = "all";
  els.jlptFilter.value = "all";
  els.statusFilter.value = "all";
  els.favoriteOnlyButton.setAttribute("aria-pressed", "false");
  resetVisibleAndRender();
}

function resetProgress() {
  const confirmed = window.confirm("Reset favorites, learned words, review list, quiz scores, and streak?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  loadProgress();
  applySettings();
  renderAll();
  showToast("Progress reset.");
}

function speakJapanese(text) {
  if (!("speechSynthesis" in window)) {
    showToast("Audio is not available in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(stripMarkers(text));
  utterance.lang = "ja-JP";
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
}

function buildPrintArea() {
  const lessonMap = new Map();
  state.filtered.forEach((word) => {
    if (!lessonMap.has(word.lesson)) {
      lessonMap.set(word.lesson, {
        title: word.lessonTitle,
        words: [],
      });
    }
    lessonMap.get(word.lesson).words.push(word);
  });
  els.printArea.innerHTML = `
    <h1 class="print-title">Irodori Vocabulary Studio</h1>
    ${Array.from(lessonMap.entries())
      .map(
        ([lesson, group]) => `
          <section class="print-lesson">
            <h2>Lesson ${lesson}: ${escapeHtml(group.title)}</h2>
            <div class="print-grid">
              ${group.words
                .map(
                  (word) => `
                    <div class="print-item">
                      <strong>${escapeHtml(stripMarkers(word.word))}</strong>
                      <span>${escapeHtml(word.romaji)}</span><br>
                      <span>${escapeHtml(word.bangla)}</span><br>
                      <span>${escapeHtml(word.english)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>
        `,
      )
      .join("")}
  `;
}

function exportPdf() {
  buildPrintArea();
  const filename = `irodori-vocabulary-${getDateKey()}.pdf`;
  if (typeof window.html2pdf === "function") {
    window
      .html2pdf()
      .set({
        margin: [12, 10, 12, 10],
        filename,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(els.printArea)
      .save();
    return;
  }
  printWords();
}

function printWords() {
  buildPrintArea();
  window.print();
}

function handleKeyboard(event) {
  if (event.target.matches("input, textarea, select")) return;
  if (event.key === "/") {
    event.preventDefault();
    els.searchInput.focus();
  }
  if (state.activeTab === "flashcards" && event.key === " ") {
    event.preventDefault();
    flipFlashcard();
  }
  if (state.activeTab === "flashcards" && event.key.toLowerCase() === "n") {
    moveFlashcard(1);
  }
  if (event.key === "Escape") {
    resetFilters();
  }
}

function installApp() {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  state.deferredInstallPrompt.userChoice.finally(() => {
    state.deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("service-worker.js").catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}

function sample(items, count) {
  return shuffleArray([...items]).slice(0, count);
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function clampIndex(index, length) {
  if (!length) return 0;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

function normalizeAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function stripMarkers(value) {
  return String(value || "").replace(/［[123]］/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2800);
}
