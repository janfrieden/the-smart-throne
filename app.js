const STORAGE_KEY = "smart_throne_last_index";
const LONG_PRESS_MS = 900;
const SLIDES_URL = "./slides.json";

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {"TEXT_QUOTE"|"IMAGE_ONLY"|"RIDDLE"|"VOCABULARY"} type
 * @property {string|null} category
 * @property {string|null} title
 * @property {string|null} content
 * @property {string|null} subContent
  * @property {string|null} imagePath
  * @property {number} duration
 * @property {number|null} revealDelay
 */

/** @type {Slide[]} */
const staticSlides = [
  {
    id: "quote-1",
    type: "TEXT_QUOTE",
    category: "Motivation",
    title: "Zitat",
    content: "Wer aufhört besser zu werden, hat aufgehört gut zu sein.",
    subContent: "Philip Rosenthal",
    imagePath: null,
    duration: 20,
    revealDelay: null
  },
  {
    id: "riddle-1",
    type: "RIDDLE",
    category: "Brain Gym",
    title: "Rätsel",
    content: "Was wird nass, während es trocknet?",
    subContent: "Ein Handtuch.",
    imagePath: null,
    duration: 20,
    revealDelay: 10
  },
  {
    id: "vocab-1",
    type: "VOCABULARY",
    category: "English",
    title: "Vokabel",
    content: "to thrive",
    subContent: "gedeihen",
    imagePath: null,
    duration: 20,
    revealDelay: 8
  }
];

/** @type {Slide[]} */
let baseSlides = [...staticSlides];
let slides = [...baseSlides];
let currentIndex = 0;
let elapsedMs = 0;
let activeDurationMs = 20000;
let showAnswer = false;
let timerHandle = null;
let clockHandle = null;

const ui = {
  slideType: document.getElementById("slide-type"),
  clock: document.getElementById("clock"),
  title: document.getElementById("title"),
  content: document.getElementById("content"),
  subContent: document.getElementById("sub-content"),
  imageLayer: document.getElementById("image-layer"),
  progressFill: document.getElementById("progress-fill"),
  adminHotspot: document.getElementById("admin-hotspot"),
  adminPanel: document.getElementById("admin-panel"),
  importButton: document.getElementById("import-button"),
  resetButton: document.getElementById("reset-button"),
  closeAdmin: document.getElementById("close-admin"),
  folderInput: document.getElementById("folder-input")
};

function sanitizeType(rawType) {
  const t = String(rawType || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  if (["TEXT_QUOTE", "IMAGE_ONLY", "RIDDLE", "VOCABULARY"].includes(t)) {
    return t;
  }
  return "IMAGE_ONLY";
}

function parseDuration(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 20;
}

function parseReveal(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getLastIndex() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function saveLastIndex(index) {
  localStorage.setItem(STORAGE_KEY, String(index));
}

function updateClock() {
  const now = new Date();
  ui.clock.textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function renderSlide(slide) {
  ui.slideType.textContent = slide.category || slide.type;
  ui.title.textContent = slide.title || "";
  ui.title.classList.toggle("hidden", !slide.title);
  ui.content.textContent = slide.content || "";

  if (slide.imagePath) {
    ui.imageLayer.style.backgroundImage = `url("${slide.imagePath}")`;
    ui.imageLayer.classList.remove("hidden");
  } else {
    ui.imageLayer.style.backgroundImage = "";
    ui.imageLayer.classList.add("hidden");
  }

  const hasSub = !!slide.subContent;
  const shouldReveal = slide.revealDelay !== null && slide.type === "RIDDLE";
  const showSubText = hasSub && (!shouldReveal || showAnswer);
  ui.subContent.textContent = slide.subContent || "";
  ui.subContent.classList.toggle("hidden", !showSubText);
}

function nextSlide() {
  if (!slides.length) return;
  currentIndex = (currentIndex + 1) % slides.length;
  saveLastIndex(currentIndex);
  startSlide();
}

function tick() {
  const slide = slides[currentIndex];
  elapsedMs += 100;
  const revealAtMs = slide.revealDelay !== null ? slide.revealDelay * 1000 : null;

  if (revealAtMs !== null && !showAnswer && elapsedMs >= revealAtMs) {
    showAnswer = true;
    renderSlide(slide);
  }

  const progressPercent = Math.min(100, (elapsedMs / activeDurationMs) * 100);
  ui.progressFill.style.width = `${progressPercent}%`;

  if (elapsedMs >= activeDurationMs) {
    nextSlide();
  }
}

function startSlide() {
  clearInterval(timerHandle);
  const slide = slides[currentIndex];
  elapsedMs = 0;
  showAnswer = false;
  activeDurationMs = parseDuration(slide.duration) * 1000;
  ui.progressFill.style.width = "0%";
  renderSlide(slide);
  timerHandle = setInterval(tick, 100);
}

function parseImageFileToSlide(file) {
  const extensionless = file.name.replace(/\.[^.]+$/, "");
  const match = extensionless.match(/^(.+)_([0-9]+)_([0-9]+)_(.+)$/);
  if (!match) return null;

  const [, rawType, rawDuration, rawReveal, rawTitle] = match;
  const type = sanitizeType(rawType);
  const duration = parseDuration(rawDuration);
  const revealDelay = parseReveal(rawReveal);
  const title = rawTitle.replace(/[_-]+/g, " ").trim();
  const imagePath = URL.createObjectURL(file);

  return {
    id: `auto-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    category: "AutoImport",
    title: title || "Auto-Import",
    content: null,
    subContent: null,
    imagePath,
    duration,
    revealDelay
  };
}

function mergeAutoImportedSlides(importedSlides) {
  if (!importedSlides.length) return;
  slides = [...baseSlides, ...importedSlides];
  if (currentIndex >= slides.length) {
    currentIndex = 0;
  }
  startSlide();
}

function normalizeSlide(raw, index) {
  const type = sanitizeType(raw.type);
  const revealDelay = parseReveal(raw.reveal_delay ?? raw.revealDelay);
  const answer = raw.answer ? String(raw.answer) : null;
  const subContent = raw.sub_content ?? raw.subContent ?? answer ?? raw.caption ?? null;
  const content = raw.content ?? raw.caption ?? null;

  return {
    id: String(raw.id || `json-${index}`),
    type,
    category: raw.category ? String(raw.category) : null,
    title: raw.title ? String(raw.title) : null,
    content: content ? String(content) : null,
    subContent: subContent ? String(subContent) : null,
    imagePath: raw.image_path ? String(raw.image_path) : raw.imagePath ? String(raw.imagePath) : null,
    duration: parseDuration(raw.duration),
    revealDelay: type === "RIDDLE" ? revealDelay : null
  };
}

async function loadSlidesFromJson() {
  try {
    const response = await fetch(SLIDES_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const rawSlides = Array.isArray(data?.slides) ? data.slides : [];
    const normalized = rawSlides.map(normalizeSlide).filter((slide) => slide.content || slide.imagePath);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

async function openDirectoryPickerImport() {
  if (!window.showDirectoryPicker) {
    ui.folderInput.click();
    return;
  }

  try {
    const dirHandle = await window.showDirectoryPicker();
    /** @type {Slide[]} */
    const imported = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== "file") continue;
      if (!entry.name.match(/\.(png|jpe?g|webp|gif)$/i)) continue;
      const file = await entry.getFile();
      const slide = parseImageFileToSlide(file);
      if (slide) imported.push(slide);
    }
    mergeAutoImportedSlides(imported);
  } catch {
    // User canceled or browser denied access.
  }
}

function setupAdminLongPress() {
  let pressTimer = null;

  const startPress = () => {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      ui.adminPanel.classList.remove("hidden");
      ui.adminPanel.setAttribute("aria-hidden", "false");
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    clearTimeout(pressTimer);
  };

  ui.adminHotspot.addEventListener("mousedown", startPress);
  ui.adminHotspot.addEventListener("touchstart", startPress, { passive: true });
  ui.adminHotspot.addEventListener("mouseup", endPress);
  ui.adminHotspot.addEventListener("mouseleave", endPress);
  ui.adminHotspot.addEventListener("touchend", endPress);
}

function setupAdminActions() {
  ui.importButton.addEventListener("click", openDirectoryPickerImport);
  ui.closeAdmin.addEventListener("click", () => {
    ui.adminPanel.classList.add("hidden");
    ui.adminPanel.setAttribute("aria-hidden", "true");
  });
  ui.resetButton.addEventListener("click", () => {
    currentIndex = 0;
    saveLastIndex(currentIndex);
    startSlide();
  });
  ui.folderInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    const imported = files.map(parseImageFileToSlide).filter(Boolean);
    mergeAutoImportedSlides(imported);
    ui.folderInput.value = "";
  });
}

async function init() {
  const jsonSlides = await loadSlidesFromJson();
  if (jsonSlides && jsonSlides.length) {
    baseSlides = jsonSlides;
    slides = [...baseSlides];
  }

  updateClock();
  clearInterval(clockHandle);
  clockHandle = setInterval(updateClock, 1000);

  currentIndex = getLastIndex();
  if (currentIndex >= slides.length) {
    currentIndex = 0;
  }

  setupAdminLongPress();
  setupAdminActions();
  startSlide();
}

init();
