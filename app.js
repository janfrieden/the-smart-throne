const STORAGE_KEY = "smart_throne_last_index";
const WEATHER_SETTINGS_KEY = "smart_throne_weather_settings";
const NEWS_SETTINGS_KEY = "smart_throne_news_settings";
const WIKI_SETTINGS_KEY = "smart_throne_wiki_settings";
const LONG_PRESS_MS = 900;
const SLIDES_URL = "./slides.json";
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const WEATHER_SLIDE_DURATION_SECONDS = 16;
const NEWS_REFRESH_MS = 10 * 60 * 1000;
const NEWS_SLIDE_DURATION_SECONDS = 14;
const WIKI_REFRESH_MS = 60 * 60 * 1000;
const WIKI_SLIDE_DURATION_SECONDS = 14;

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {"TEXT_QUOTE"|"IMAGE_ONLY"|"RIDDLE"|"VOCABULARY"|"WEATHER"|"NEWS"|"WIKI"} type
 * @property {string|null} category
 * @property {string|null} title
 * @property {string|null} content
 * @property {string|null} subContent
 * @property {string|null} imagePath
 * @property {number} duration
 * @property {number|null} revealDelay
 */

/**
 * @typedef {Object} WeatherSettings
 * @property {"auto"|"manual"} mode
 * @property {string} locationQuery
 * @property {number} insertEvery
 */

/**
 * @typedef {Object} WikiSettings
 * @property {number} insertEvery
 */

/**
 * @typedef {Object} NewsSettings
 * @property {string} feedKey
 * @property {number} insertEvery
 */

const HEISE_ATOM_FEEDS = [
  {
    key: "heise-top",
    label: "heise online - Top News",
    url: "https://www.heise.de/rss/heise-atom.xml"
  },
  {
    key: "heise-security",
    label: "heise Security",
    url: "https://www.heise.de/security/rss/news-atom.xml"
  },
  {
    key: "heise-developer",
    label: "heise Developer",
    url: "https://www.heise.de/developer/rss/news-atom.xml"
  }
];

const WEATHER_CODE_LABELS = {
  0: "Klar",
  1: "Meist klar",
  2: "Leicht bewölkt",
  3: "Bewölkt",
  45: "Nebel",
  48: "Reifnebel",
  51: "Leichter Niesel",
  53: "Niesel",
  55: "Starker Niesel",
  56: "Gefrierender Niesel",
  57: "Starker gefrierender Niesel",
  61: "Leichter Regen",
  63: "Regen",
  65: "Starker Regen",
  66: "Gefrierender Regen",
  67: "Starker gefrierender Regen",
  71: "Leichter Schnee",
  73: "Schnee",
  75: "Starker Schneefall",
  77: "Schneekörner",
  80: "Regenschauer",
  81: "Starke Schauer",
  82: "Sehr starke Schauer",
  85: "Schneeschauer",
  86: "Starke Schneeschauer",
  95: "Gewitter",
  96: "Gewitter mit Hagel",
  99: "Starkes Gewitter mit Hagel"
};

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
/** @type {Slide[]} */
let importedSlides = [];
/** @type {Slide[]} */
let slides = [...baseSlides];
let currentIndex = 0;
let elapsedMs = 0;
let activeDurationMs = 20000;
let showAnswer = false;
let timerHandle = null;
let clockHandle = null;
let weatherRefreshHandle = null;
let newsRefreshHandle = null;
let wikiRefreshHandle = null;
let activeSpecialSlideKind = null;
let baseSlidesSinceWeather = 0;
let baseSlidesSinceNews = 0;
let baseSlidesSinceWiki = 0;

/** @type {WeatherSettings} */
let weatherSettings = loadWeatherSettings();
/** @type {NewsSettings} */
let newsSettings = loadNewsSettings();
/** @type {WikiSettings} */
let wikiSettings = loadWikiSettings();
let weatherState = {
  statusText: "Wetter nicht konfiguriert.",
  coords: null,
  locationLabel: null,
  sourceKey: null,
  current: null,
  daily: [],
  timezone: null,
  lastUpdatedAt: 0
};
let newsState = {
  statusText: "News deaktiviert.",
  headlines: [],
  lastUpdatedAt: 0,
  feedKey: null
};
let wikiState = {
  statusText: "Wikipedia deaktiviert.",
  article: null,
  articleDateKey: null,
  lastUpdatedAt: 0
};
let newsRotationIndex = 0;
const buttonFeedbackTimers = new WeakMap();

const ui = {
  app: document.getElementById("app"),
  slideType: document.getElementById("slide-type"),
  weatherNow: document.getElementById("weather-now"),
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
  folderInput: document.getElementById("folder-input"),
  weatherAutoLocation: document.getElementById("weather-auto-location"),
  weatherLocationInput: document.getElementById("weather-location-input"),
  weatherInsertEvery: document.getElementById("weather-insert-every"),
  weatherStatus: document.getElementById("weather-status"),
  newsFeedSelect: document.getElementById("news-feed-select"),
  newsInsertEvery: document.getElementById("news-insert-every"),
  newsStatus: document.getElementById("news-status"),
  wikiInsertEvery: document.getElementById("wiki-insert-every"),
  wikiStatus: document.getElementById("wiki-status"),
  adminApplyButton: document.getElementById("admin-apply-button")
};

async function handleWeatherSaveAction() {
  setWeatherStatus("Wetter-Einstellungen werden gespeichert...");
  readWeatherControlsToState();
  weatherState.coords = null;
  weatherState.sourceKey = null;
  await refreshWeatherData({ forceRelocate: true });
}

async function handleWeatherRefreshAction() {
  setWeatherStatus("Wetter wird manuell aktualisiert...");
  readWeatherControlsToState();
  await refreshWeatherData({ forceRelocate: weatherSettings.mode === "auto" });
}

async function handleAdminApplyAllAction() {
  readWeatherControlsToState();
  readNewsControlsToState();
  readWikiControlsToState();

  weatherState.coords = null;
  weatherState.sourceKey = null;
  newsState.feedKey = null;
  newsRotationIndex = 0;
  baseSlidesSinceWeather = 0;
  baseSlidesSinceNews = 0;
  baseSlidesSinceWiki = 0;

  await handleWeatherSaveAction();
  await refreshNewsData();
  await refreshWikiData();
}

function flashButtonFeedback(button, { label, className, durationMs = 1200 } = {}) {
  if (!button) return;

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent || "";
  }

  const prevTimer = buttonFeedbackTimers.get(button);
  if (prevTimer) clearTimeout(prevTimer);

  button.classList.remove("is-busy", "is-success", "is-error");
  if (className) button.classList.add(className);
  if (label) button.textContent = label;

  const timer = setTimeout(() => {
    button.classList.remove("is-busy", "is-success", "is-error");
    button.textContent = button.dataset.originalLabel || button.textContent;
    buttonFeedbackTimers.delete(button);
  }, durationMs);

  buttonFeedbackTimers.set(button, timer);
}

function sanitizeType(rawType) {
  const t = String(rawType || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  if (["TEXT_QUOTE", "IMAGE_ONLY", "RIDDLE", "VOCABULARY", "WEATHER", "NEWS", "WIKI"].includes(t)) {
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

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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

function defaultWeatherSettings() {
  return {
    mode: "manual",
    locationQuery: "",
    insertEvery: 6
  };
}

function defaultNewsSettings() {
  return {
    feedKey: HEISE_ATOM_FEEDS[0]?.key || "heise-top",
    insertEvery: 0
  };
}

function defaultWikiSettings() {
  return {
    insertEvery: 0
  };
}

function loadWeatherSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WEATHER_SETTINGS_KEY) || "{}");
    return {
      mode: parsed.mode === "auto" ? "auto" : "manual",
      locationQuery: typeof parsed.locationQuery === "string" ? parsed.locationQuery : "",
      insertEvery: clampNumber(parsed.insertEvery, 0, 50, defaultWeatherSettings().insertEvery)
    };
  } catch {
    return defaultWeatherSettings();
  }
}

function loadNewsSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NEWS_SETTINGS_KEY) || "{}");
    const allowedFeedKeys = new Set(HEISE_ATOM_FEEDS.map((feed) => feed.key));
    const defaults = defaultNewsSettings();
    const feedKey = typeof parsed.feedKey === "string" && allowedFeedKeys.has(parsed.feedKey) ? parsed.feedKey : defaults.feedKey;
    return {
      feedKey,
      insertEvery: clampNumber(parsed.insertEvery, 0, 50, defaults.insertEvery)
    };
  } catch {
    return defaultNewsSettings();
  }
}

function loadWikiSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WIKI_SETTINGS_KEY) || "{}");
    return {
      insertEvery: clampNumber(parsed.insertEvery, 0, 50, defaultWikiSettings().insertEvery)
    };
  } catch {
    return defaultWikiSettings();
  }
}

function saveWeatherSettings() {
  localStorage.setItem(WEATHER_SETTINGS_KEY, JSON.stringify(weatherSettings));
}

function saveNewsSettings() {
  localStorage.setItem(NEWS_SETTINGS_KEY, JSON.stringify(newsSettings));
}

function saveWikiSettings() {
  localStorage.setItem(WIKI_SETTINGS_KEY, JSON.stringify(wikiSettings));
}

function setWeatherStatus(text) {
  weatherState.statusText = text;
  if (ui.weatherStatus) {
    ui.weatherStatus.textContent = text;
  }
}

function setNewsStatus(text) {
  newsState.statusText = text;
  if (ui.newsStatus) {
    ui.newsStatus.textContent = text;
  }
}

function setWikiStatus(text) {
  wikiState.statusText = text;
  if (ui.wikiStatus) {
    ui.wikiStatus.textContent = text;
  }
}

function formatTemperature(value) {
  if (!Number.isFinite(value)) return "--°C";
  return `${Math.round(value)}°C`;
}

function updateWeatherBadge() {
  if (!ui.weatherNow) return;
  if (!weatherState.current) {
    ui.weatherNow.textContent = "--°C";
    ui.weatherNow.title = weatherState.statusText || "Wetter nicht verfügbar";
    return;
  }

  const label = getWeatherCodeLabel(weatherState.current.weatherCode);
  const place = weatherState.locationLabel || "Wetter";
  const icon = getWeatherIcon(weatherState.current.weatherCode, weatherState.current.isDay);
  ui.weatherNow.textContent = `${icon} ${formatTemperature(weatherState.current.temperature)}`;
  ui.weatherNow.title = `${place}: ${label}`;
}

function updateClock() {
  const now = new Date();
  ui.clock.textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function getWeatherCodeLabel(code) {
  return WEATHER_CODE_LABELS[Number(code)] || "Wetter";
}

function getWeatherIcon(code, isDay = true) {
  const weatherCode = Number(code);
  const day = isDay !== false;

  if (weatherCode === 0) return day ? "☀️" : "🌙";
  if (weatherCode === 1) return day ? "🌤️" : "🌙";
  if (weatherCode === 2) return day ? "⛅" : "☁️";
  if (weatherCode === 3) return "☁️";
  if ([45, 48].includes(weatherCode)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return "🌨️";
  if ([95, 96, 99].includes(weatherCode)) return "⛈️";
  return "🌡️";
}

function formatDateShort(dateString) {
  try {
    return new Date(`${dateString}T12:00:00`).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    });
  } catch {
    return dateString;
  }
}

function getSelectedNewsFeed() {
  return HEISE_ATOM_FEEDS.find((feed) => feed.key === newsSettings.feedKey) || HEISE_ATOM_FEEDS[0] || null;
}

function truncateText(text, maxLength) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function stripHtmlToText(html) {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = String(html);
  return (temp.textContent || "").replace(/\s+/g, " ").trim();
}

function parseHeiseAtom(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Atom-Feed konnte nicht geparst werden.");
  }

  const entries = Array.from(doc.getElementsByTagNameNS("*", "entry"));
  const getFirstChildByLocalName = (node, localName) =>
    Array.from(node.children || []).find((child) => child.localName === localName) || null;

  return entries
    .map((entry, index) => {
      const title = getFirstChildByLocalName(entry, "title")?.textContent?.trim() || "";
      const summaryRaw =
        getFirstChildByLocalName(entry, "summary")?.textContent ||
        getFirstChildByLocalName(entry, "content")?.textContent ||
        "";
      const summary = stripHtmlToText(summaryRaw);
      const updated =
        getFirstChildByLocalName(entry, "updated")?.textContent?.trim() ||
        getFirstChildByLocalName(entry, "published")?.textContent?.trim() ||
        "";
      const linkEls = Array.from(entry.getElementsByTagNameNS("*", "link"));
      const linkEl =
        linkEls.find((linkNode) => linkNode.getAttribute("rel") === "alternate" && linkNode.getAttribute("href")) ||
        linkEls.find((linkNode) => !!linkNode.getAttribute("href")) ||
        null;
      const link = linkEl?.getAttribute("href") || "";
      if (!title) return null;
      return {
        id: getFirstChildByLocalName(entry, "id")?.textContent?.trim() || `news-${index}`,
        title,
        summary,
        link,
        updated
      };
    })
    .filter(Boolean);
}

async function fetchTextWithFallbacks(urls) {
  let lastError = null;
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Feed konnte nicht geladen werden.");
}

function buildNewsSlide() {
  if (!newsState.headlines.length) return null;

  const feed = getSelectedNewsFeed();
  const headline = newsState.headlines[newsRotationIndex % newsState.headlines.length];
  if (!headline) return null;

  let updatedLabel = "";
  if (headline.updated) {
    const date = new Date(headline.updated);
    if (!Number.isNaN(date.getTime())) {
      updatedLabel = date.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }

  const metaBits = [feed?.label || "heise online", updatedLabel].filter(Boolean);
  const footerBits = [];
  if (headline.link) footerBits.push(headline.link);
  const metaLine = metaBits.join(" · ");
  const footerLine = footerBits.join(" ");

  const subLines = [
    truncateText(headline.summary, 180),
    metaLine,
    footerLine
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `news-${headline.id}-${newsRotationIndex}`,
    type: "NEWS",
    category: "News",
    title: "heise Schlagzeile",
    content: truncateText(headline.title, 220),
    subContent: subLines || null,
    imagePath: null,
    duration: NEWS_SLIDE_DURATION_SECONDS,
    revealDelay: null
  };
}

function buildWikiSlide() {
  const article = wikiState.article;
  if (!article) return null;

  const subLines = [
    article.extract ? truncateText(article.extract, 260) : "",
    article.dateLabel ? `Wikipedia Artikel des Tages · ${article.dateLabel}` : "Wikipedia Artikel des Tages",
    article.url || ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `wiki-${wikiState.articleDateKey || "today"}`,
    type: "WIKI",
    category: "Wikipedia",
    title: "Artikel des Tages",
    content: truncateText(article.title || "Wikipedia", 220),
    subContent: subLines || null,
    imagePath: article.imageUrl || null,
    duration: WIKI_SLIDE_DURATION_SECONDS,
    revealDelay: null
  };
}

function buildWeatherSlide() {
  if (!weatherState.current) return null;

  const dailyLines = [];
  const dailyEntries = weatherState.daily.slice(0, 3);
  for (let i = 0; i < dailyEntries.length; i += 1) {
    const day = dailyEntries[i];
    const prefix = i === 0 ? "Heute" : i === 1 ? "Morgen" : formatDateShort(day.date);
    const min = Number.isFinite(day.tempMin) ? Math.round(day.tempMin) : "--";
    const max = Number.isFinite(day.tempMax) ? Math.round(day.tempMax) : "--";
    dailyLines.push(`${getWeatherIcon(day.weatherCode)} ${prefix}: ${min} bis ${max}°C, ${getWeatherCodeLabel(day.weatherCode)}`);
  }

  const updatedTime = weatherState.lastUpdatedAt
    ? new Date(weatherState.lastUpdatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : null;

  const footer = updatedTime ? `Aktualisiert: ${updatedTime}` : null;
  const details = [...dailyLines, footer].filter(Boolean).join("\n");
  const place = weatherState.locationLabel || "Aktueller Ort";
  const currentIcon = getWeatherIcon(weatherState.current.weatherCode, weatherState.current.isDay);
  const dayNightLabel = weatherState.current.isDay === false ? "Nacht" : "Tag";

  return {
    id: `weather-${weatherState.lastUpdatedAt || 0}`,
    type: "WEATHER",
    category: "Wetter",
    title: `Wetter in ${place}`,
    content: `${currentIcon} ${formatTemperature(weatherState.current.temperature)} · ${getWeatherCodeLabel(weatherState.current.weatherCode)}`,
    subContent: [`${dayNightLabel} · aktuell`, details].filter(Boolean).join("\n"),
    imagePath: null,
    duration: WEATHER_SLIDE_DURATION_SECONDS,
    revealDelay: null
  };
}

function getCurrentSlide() {
  if (activeSpecialSlideKind === "weather") {
    return buildWeatherSlide() || slides[currentIndex] || null;
  }
  if (activeSpecialSlideKind === "news") {
    return buildNewsSlide() || slides[currentIndex] || null;
  }
  if (activeSpecialSlideKind === "wiki") {
    return buildWikiSlide() || slides[currentIndex] || null;
  }
  return slides[currentIndex] || null;
}

function renderSlide(slide) {
  if (!slide) return;

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

function canInsertWeatherSlide() {
  return weatherSettings.insertEvery > 0 && !!weatherState.current;
}

function canInsertNewsSlide() {
  return newsSettings.insertEvery > 0 && newsState.headlines.length > 0;
}

function canInsertWikiSlide() {
  return wikiSettings.insertEvery > 0 && !!wikiState.article;
}

function advanceSlide() {
  if (!slides.length) return;

  if (activeSpecialSlideKind) {
    if (activeSpecialSlideKind === "news" && newsState.headlines.length > 0) {
      newsRotationIndex = (newsRotationIndex + 1) % newsState.headlines.length;
    }
    activeSpecialSlideKind = null;
    currentIndex = (currentIndex + 1) % slides.length;
    saveLastIndex(currentIndex);
    startSlide();
    return;
  }

  baseSlidesSinceWeather += 1;
  baseSlidesSinceNews += 1;
  baseSlidesSinceWiki += 1;

  if (canInsertNewsSlide() && baseSlidesSinceNews >= newsSettings.insertEvery) {
    baseSlidesSinceNews = 0;
    activeSpecialSlideKind = "news";
    startSlide();
    return;
  }

  if (canInsertWikiSlide() && baseSlidesSinceWiki >= wikiSettings.insertEvery) {
    baseSlidesSinceWiki = 0;
    activeSpecialSlideKind = "wiki";
    startSlide();
    return;
  }

  if (canInsertWeatherSlide() && baseSlidesSinceWeather >= weatherSettings.insertEvery) {
    baseSlidesSinceWeather = 0;
    activeSpecialSlideKind = "weather";
    startSlide();
    return;
  }

  currentIndex = (currentIndex + 1) % slides.length;
  saveLastIndex(currentIndex);
  startSlide();
}

function tick() {
  const slide = getCurrentSlide();
  if (!slide) return;

  elapsedMs += 100;
  const revealAtMs = slide.revealDelay !== null ? slide.revealDelay * 1000 : null;

  if (revealAtMs !== null && !showAnswer && elapsedMs >= revealAtMs) {
    showAnswer = true;
    renderSlide(slide);
  }

  const progressPercent = Math.min(100, (elapsedMs / activeDurationMs) * 100);
  ui.progressFill.style.width = `${progressPercent}%`;

  if (elapsedMs >= activeDurationMs) {
    advanceSlide();
  }
}

function startSlide() {
  clearInterval(timerHandle);
  const slide = getCurrentSlide();
  if (!slide) return;

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

function rebuildContentSlides({ restart = true } = {}) {
  slides = [...baseSlides, ...importedSlides];
  if (!slides.length) {
    slides = [...staticSlides];
  }

  if (currentIndex >= slides.length) {
    currentIndex = 0;
  }

  if (restart) {
    activeSpecialSlideKind = null;
    startSlide();
  }
}

function mergeAutoImportedSlides(newImportedSlides) {
  if (!newImportedSlides.length) return;
  importedSlides = [...importedSlides, ...newImportedSlides];
  rebuildContentSlides({ restart: true });
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

function parseCoordinateQuery(query) {
  const match = String(query || "")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function formatLocationLabelFromResult(result) {
  const parts = [result.name, result.admin1, result.country].filter(Boolean);
  return parts.join(", ");
}

async function geocodeLocation(query) {
  const coordsFromQuery = parseCoordinateQuery(query);
  if (coordsFromQuery) {
    return {
      coords: coordsFromQuery,
      label: `${coordsFromQuery.latitude.toFixed(3)}, ${coordsFromQuery.longitude.toFixed(3)}`
    };
  }

  const trimmed = String(query || "").trim();
  if (!trimmed) {
    throw new Error("Bitte einen Ort eingeben.");
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "de");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Ortssuche fehlgeschlagen.");
  }

  const data = await response.json();
  const result = Array.isArray(data?.results) ? data.results[0] : null;
  if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
    throw new Error("Ort nicht gefunden.");
  }

  return {
    coords: { latitude: result.latitude, longitude: result.longitude },
    label: formatLocationLabelFromResult(result) || trimmed
  };
}

async function reverseGeocode(latitude, longitude) {
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("language", "de");
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();
    const result = Array.isArray(data?.results) ? data.results[0] : null;
    if (!result) return null;
    return formatLocationLabelFromResult(result);
  } catch {
    return null;
  }
}

function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation wird vom Browser nicht unterstützt."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 10 * 60 * 1000
    });
  });
}

async function resolveAutoLocation() {
  const position = await getCurrentPositionAsync();
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const label = (await reverseGeocode(latitude, longitude)) || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;

  return {
    coords: { latitude, longitude },
    label
  };
}

async function fetchWeatherForCoords(coords) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coords.latitude));
  url.searchParams.set("longitude", String(coords.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("current_weather", "true");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Wetterdaten konnten nicht geladen werden.");
  }

  const data = await response.json();
  const current = data?.current || {};
  const currentWeather = data?.current_weather || {};
  const daily = data?.daily || {};
  const temperature = Number(current.temperature_2m ?? current.temperature ?? currentWeather.temperature);
  const weatherCode = Number(current.weather_code ?? current.weathercode ?? currentWeather.weathercode ?? currentWeather.weather_code);
  const isDayRaw = current.is_day ?? currentWeather.is_day;
  const isDay = isDayRaw === 0 ? false : isDayRaw === 1 ? true : null;

  if (!Number.isFinite(temperature)) {
    throw new Error("Wetterdaten unvollständig (Temperatur fehlt).");
  }

  weatherState.current = {
    temperature,
    weatherCode,
    isDay
  };

  const times = Array.isArray(daily.time) ? daily.time : [];
  const maxValues = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
  const minValues = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
  const codes = Array.isArray(daily.weather_code) ? daily.weather_code : [];

  weatherState.daily = times.map((date, index) => ({
    date,
    tempMax: Number(maxValues[index]),
    tempMin: Number(minValues[index]),
    weatherCode: Number(codes[index])
  }));
  weatherState.timezone = data?.timezone || null;
  weatherState.lastUpdatedAt = Date.now();
}

async function fetchNewsFeedHeadlines(feed) {
  if (!feed?.url) {
    throw new Error("Kein Feed ausgewählt.");
  }

  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
  const xmlText = await fetchTextWithFallbacks([feed.url, proxyUrl]);
  const headlines = parseHeiseAtom(xmlText).slice(0, 15);
  if (!headlines.length) {
    throw new Error("Keine Headlines im Feed gefunden.");
  }
  return headlines;
}

function formatWikiDateParts(date) {
  return {
    y: String(date.getFullYear()),
    m: String(date.getMonth() + 1).padStart(2, "0"),
    d: String(date.getDate()).padStart(2, "0")
  };
}

function parseWikiFeaturedTfa(data) {
  const tfa = data?.tfa || null;
  if (!tfa) return null;

  const title =
    tfa.titles?.normalized ||
    tfa.titles?.display ||
    tfa.title ||
    "";
  const extract = tfa.extract || tfa.description || "";
  const url =
    tfa.content_urls?.desktop?.page ||
    tfa.content_urls?.mobile?.page ||
    tfa.originalimage?.source ||
    "";
  const imageUrl =
    tfa.originalimage?.source ||
    tfa.thumbnail?.source ||
    null;

  if (!title) return null;

  return {
    title,
    extract,
    url,
    imageUrl
  };
}

async function fetchWikipediaArticleOfTheDay() {
  const candidates = [new Date(), new Date(Date.now() - 24 * 60 * 60 * 1000)];
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const date = candidates[i];
    const { y, m, d } = formatWikiDateParts(date);
    const endpoint = `https://de.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`;

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const article = parseWikiFeaturedTfa(data);
      if (!article) {
        throw new Error("Kein Artikel des Tages gefunden.");
      }

      const dateLabel = date.toLocaleDateString("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });

      return {
        ...article,
        dateKey: `${y}-${m}-${d}`,
        dateLabel
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Wikipedia Artikel des Tages konnte nicht geladen werden.");
}

function applyWeatherLocation(locationResult, sourceKey) {
  weatherState.coords = locationResult.coords;
  weatherState.locationLabel = locationResult.label || weatherState.locationLabel;
  weatherState.sourceKey = sourceKey;
}

async function refreshWeatherData({ forceRelocate = false } = {}) {
  const intervalInfo = weatherSettings.insertEvery > 0 ? `Wetter-Slide alle ${weatherSettings.insertEvery} Slides.` : "Wetter-Slide deaktiviert.";

  try {
    setWeatherStatus("Wetter wird geladen...");

    if (weatherSettings.mode === "auto") {
      const needsLocation = forceRelocate || !weatherState.coords || weatherState.sourceKey !== "auto";
      if (needsLocation) {
        const autoLocation = await resolveAutoLocation();
        applyWeatherLocation(autoLocation, "auto");
      }
    } else {
      const manualQuery = weatherSettings.locationQuery.trim();
      if (!manualQuery) {
        weatherState.current = null;
        updateWeatherBadge();
        setWeatherStatus(`Bitte Ort setzen. ${intervalInfo}`);
        return;
      }

      const sourceKey = `manual:${manualQuery}`;
      const needsLocation = forceRelocate || !weatherState.coords || weatherState.sourceKey !== sourceKey;
      if (needsLocation) {
        const manualLocation = await geocodeLocation(manualQuery);
        applyWeatherLocation(manualLocation, sourceKey);
      }
    }

    if (!weatherState.coords) {
      throw new Error("Keine Koordinaten verfügbar.");
    }

    await fetchWeatherForCoords(weatherState.coords);
    updateWeatherBadge();

    const place = weatherState.locationLabel || "Ort";
    const nowTemp = weatherState.current ? formatTemperature(weatherState.current.temperature) : "--°C";
    setWeatherStatus(`${place}: ${nowTemp}. ${intervalInfo}`);

    if (activeSpecialSlideKind === "weather") {
      startSlide();
    }
  } catch (error) {
    weatherState.current = null;
    updateWeatherBadge();
    setWeatherStatus(`Wetterfehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
  }
}

async function refreshNewsData() {
  const feed = getSelectedNewsFeed();
  const intervalInfo =
    newsSettings.insertEvery > 0
      ? `News-Slide alle ${newsSettings.insertEvery} Slides.`
      : "News-Slide deaktiviert.";

  if (!feed) {
    newsState.headlines = [];
    setNewsStatus(`Kein Feed verfügbar. ${intervalInfo}`);
    return;
  }

  if (newsSettings.insertEvery <= 0) {
    setNewsStatus(`${feed.label}. ${intervalInfo}`);
    return;
  }

  try {
    setNewsStatus("News werden geladen...");
    const headlines = await fetchNewsFeedHeadlines(feed);
    newsState.headlines = headlines;
    newsState.lastUpdatedAt = Date.now();
    newsState.feedKey = feed.key;
    newsRotationIndex = 0;

    setNewsStatus(`${feed.label}: ${headlines.length} Headlines geladen. ${intervalInfo}`);
    if (activeSpecialSlideKind === "news") {
      startSlide();
    }
  } catch (error) {
    newsState.headlines = [];
    setNewsStatus(`Newsfehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
  }
}

async function refreshWikiData() {
  const intervalInfo =
    wikiSettings.insertEvery > 0
      ? `Wikipedia-Slide alle ${wikiSettings.insertEvery} Slides.`
      : "Wikipedia-Slide deaktiviert.";

  if (wikiSettings.insertEvery <= 0) {
    setWikiStatus(`Wikipedia Artikel des Tages. ${intervalInfo}`);
    return;
  }

  try {
    setWikiStatus("Wikipedia Artikel des Tages wird geladen...");
    const article = await fetchWikipediaArticleOfTheDay();
    wikiState.article = article;
    wikiState.articleDateKey = article.dateKey;
    wikiState.lastUpdatedAt = Date.now();

    setWikiStatus(`${article.title}. ${intervalInfo}`);
    if (activeSpecialSlideKind === "wiki") {
      startSlide();
    }
  } catch (error) {
    wikiState.article = null;
    setWikiStatus(`Wikipediafehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
  }
}

function scheduleWeatherRefresh() {
  clearInterval(weatherRefreshHandle);
  weatherRefreshHandle = setInterval(() => {
    refreshWeatherData().catch(() => {
      // Status handling happens inside refreshWeatherData.
    });
  }, WEATHER_REFRESH_MS);
}

function scheduleNewsRefresh() {
  clearInterval(newsRefreshHandle);
  newsRefreshHandle = setInterval(() => {
    refreshNewsData().catch(() => {
      // Status handling happens inside refreshNewsData.
    });
  }, NEWS_REFRESH_MS);
}

function scheduleWikiRefresh() {
  clearInterval(wikiRefreshHandle);
  wikiRefreshHandle = setInterval(() => {
    refreshWikiData().catch(() => {
      // Status handling happens inside refreshWikiData.
    });
  }, WIKI_REFRESH_MS);
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

function syncWeatherControlsFromState() {
  ui.weatherAutoLocation.checked = weatherSettings.mode === "auto";
  ui.weatherLocationInput.value = weatherSettings.locationQuery;
  ui.weatherLocationInput.disabled = weatherSettings.mode === "auto";
  ui.weatherInsertEvery.value = String(weatherSettings.insertEvery);
  setWeatherStatus(weatherState.statusText || "Wetter nicht konfiguriert.");
  updateWeatherBadge();
}

function syncNewsControlsFromState() {
  if (ui.newsFeedSelect) {
    ui.newsFeedSelect.innerHTML = "";
    for (let i = 0; i < HEISE_ATOM_FEEDS.length; i += 1) {
      const feed = HEISE_ATOM_FEEDS[i];
      const option = document.createElement("option");
      option.value = feed.key;
      option.textContent = feed.label;
      if (feed.key === newsSettings.feedKey) option.selected = true;
      ui.newsFeedSelect.appendChild(option);
    }
  }
  if (ui.newsInsertEvery) {
    ui.newsInsertEvery.value = String(newsSettings.insertEvery);
  }
  setNewsStatus(newsState.statusText || "News deaktiviert.");
}

function syncWikiControlsFromState() {
  if (ui.wikiInsertEvery) {
    ui.wikiInsertEvery.value = String(wikiSettings.insertEvery);
  }
  setWikiStatus(wikiState.statusText || "Wikipedia deaktiviert.");
}

function readWeatherControlsToState() {
  weatherSettings = {
    mode: ui.weatherAutoLocation.checked ? "auto" : "manual",
    locationQuery: ui.weatherLocationInput.value.trim(),
    insertEvery: clampNumber(ui.weatherInsertEvery.value, 0, 50, 6)
  };
  ui.weatherInsertEvery.value = String(weatherSettings.insertEvery);
  ui.weatherLocationInput.disabled = weatherSettings.mode === "auto";
  saveWeatherSettings();
}

function readNewsControlsToState() {
  const selectedFeedKey = ui.newsFeedSelect?.value || defaultNewsSettings().feedKey;
  const allowedFeedKeys = new Set(HEISE_ATOM_FEEDS.map((feed) => feed.key));
  newsSettings = {
    feedKey: allowedFeedKeys.has(selectedFeedKey) ? selectedFeedKey : defaultNewsSettings().feedKey,
    insertEvery: clampNumber(ui.newsInsertEvery?.value, 0, 50, 0)
  };
  if (ui.newsInsertEvery) {
    ui.newsInsertEvery.value = String(newsSettings.insertEvery);
  }
  saveNewsSettings();
}

function readWikiControlsToState() {
  wikiSettings = {
    insertEvery: clampNumber(ui.wikiInsertEvery?.value, 0, 50, 0)
  };
  if (ui.wikiInsertEvery) {
    ui.wikiInsertEvery.value = String(wikiSettings.insertEvery);
  }
  saveWikiSettings();
}

function setupAdminLongPress() {
  let pressTimer = null;

  const startPress = () => {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      ui.adminPanel.classList.remove("hidden");
      ui.adminPanel.setAttribute("aria-hidden", "false");
      ui.app?.classList.add("admin-open");
      syncWeatherControlsFromState();
      syncNewsControlsFromState();
      syncWikiControlsFromState();
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
    ui.app?.classList.remove("admin-open");
  });
  ui.resetButton.addEventListener("click", () => {
    currentIndex = 0;
    activeSpecialSlideKind = null;
    baseSlidesSinceWeather = 0;
    baseSlidesSinceNews = 0;
    baseSlidesSinceWiki = 0;
    saveLastIndex(currentIndex);
    startSlide();
  });
  ui.folderInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    const imported = files.map(parseImageFileToSlide).filter(Boolean);
    mergeAutoImportedSlides(imported);
    ui.folderInput.value = "";
  });

  ui.weatherAutoLocation.addEventListener("change", () => {
    ui.weatherLocationInput.disabled = ui.weatherAutoLocation.checked;
  });

  ui.adminApplyButton?.addEventListener("click", async () => {
    flashButtonFeedback(ui.adminApplyButton, {
      label: "Speichert & aktualisiert...",
      className: "is-busy",
      durationMs: 3000
    });

    await handleAdminApplyAllAction();

    const hasWeatherError = String(weatherState.statusText || "").startsWith("Wetterfehler:");
    const hasNewsError = String(newsState.statusText || "").startsWith("Newsfehler:");
    const hasWikiError = String(wikiState.statusText || "").startsWith("Wikipediafehler:");
    const ok = !hasWeatherError && !hasNewsError && !hasWikiError;

    flashButtonFeedback(ui.adminApplyButton, {
      label: ok ? "Gespeichert & aktualisiert" : "Teilweise Fehler",
      className: ok ? "is-success" : "is-error",
      durationMs: 1600
    });
  });
}

async function init() {
  const jsonSlides = await loadSlidesFromJson();
  if (jsonSlides && jsonSlides.length) {
    baseSlides = jsonSlides;
  }

  rebuildContentSlides({ restart: false });

  updateClock();
  clearInterval(clockHandle);
  clockHandle = setInterval(updateClock, 1000);

  currentIndex = getLastIndex();
  if (currentIndex >= slides.length) {
    currentIndex = 0;
  }

  syncWeatherControlsFromState();
  syncNewsControlsFromState();
  syncWikiControlsFromState();
  scheduleWeatherRefresh();
  scheduleNewsRefresh();
  scheduleWikiRefresh();

  setupAdminLongPress();
  setupAdminActions();
  startSlide();

  refreshWeatherData().catch(() => {
    // Status handling happens inside refreshWeatherData.
  });
  refreshNewsData().catch(() => {
    // Status handling happens inside refreshNewsData.
  });
  refreshWikiData().catch(() => {
    // Status handling happens inside refreshWikiData.
  });
}

init();
