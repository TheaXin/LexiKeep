const DEFAULT_SETTINGS = Object.freeze({
  enabledLists: ["starter"],
  maxNodes: 600,
  maxProtectedWordsPerNode: 2
});

const MAX_SEGMENTS = 600;
const MAX_SEGMENT_LENGTH = 450;
const MAX_CACHE_ENTRIES = 1000;
const CONCURRENCY = 3;
const translationCache = new Map();
let dictionaryPayloadPromise;

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function sanitizeSettings(value = {}) {
  const lists = Array.isArray(value.enabledLists)
    ? value.enabledLists.filter((item) => typeof item === "string").slice(0, 20)
    : DEFAULT_SETTINGS.enabledLists;
  return {
    enabledLists: lists,
    maxNodes: clampNumber(value.maxNodes, 50, 1200, DEFAULT_SETTINGS.maxNodes),
    maxProtectedWordsPerNode: clampNumber(
      value.maxProtectedWordsPerNode,
      0,
      8,
      DEFAULT_SETTINGS.maxProtectedWordsPerNode
    )
  };
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return sanitizeSettings(stored);
}

async function saveSettings(nextSettings) {
  const settings = sanitizeSettings({ ...(await getSettings()), ...nextSettings });
  await chrome.storage.sync.set(settings);
  return settings;
}

async function loadDictionaryPayload() {
  if (!dictionaryPayloadPromise) {
    dictionaryPayloadPromise = fetch(chrome.runtime.getURL("assets/dictionary.json")).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(`Dictionary request failed (${response.status})`);
        }
        return response.json();
      }
    );
  }
  return dictionaryPayloadPromise;
}

function readCached(text) {
  if (!translationCache.has(text)) {
    return undefined;
  }
  const value = translationCache.get(text);
  translationCache.delete(text);
  translationCache.set(text, value);
  return value;
}

function writeCache(text, translated) {
  translationCache.set(text, translated);
  if (translationCache.size > MAX_CACHE_ENTRIES) {
    translationCache.delete(translationCache.keys().next().value);
  }
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

async function translateText(text, attempt = 0) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return text;
  }
  if (trimmed.length > MAX_SEGMENT_LENGTH) {
    throw new Error("Text segment is too long");
  }

  const cached = readCached(trimmed);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("langpair", "en|zh-CN");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation service returned ${response.status}`);
    }
    const payload = await response.json();
    if (Number(payload?.responseStatus || 200) >= 400) {
      throw new Error(payload?.responseDetails || "Translation service rejected the request");
    }
    const translated = decodeHtmlEntities(payload?.responseData?.translatedText || trimmed);
    writeCache(trimmed, translated);
    return translated;
  } catch (error) {
    if (attempt >= 2) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    return translateText(trimmed, attempt + 1);
  }
}

async function translateSegments(items) {
  const source = Array.isArray(items)
    ? items.slice(0, MAX_SEGMENTS).map((item) => String(item || "").slice(0, MAX_SEGMENT_LENGTH))
    : [];
  const results = new Array(source.length);
  let cursor = 0;

  async function worker() {
    while (cursor < source.length) {
      const index = cursor++;
      try {
        results[index] = await translateText(source[index]);
      } catch (error) {
        console.warn("Translation failed:", error);
        results[index] = source[index];
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, source.length) }, worker));
  return results;
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(null);
  if (!Object.keys(stored).length) {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (type === "get-settings") {
    getSettings().then(sendResponse).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (type === "save-settings") {
    saveSettings(message.payload).then(sendResponse).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (type === "translate-segments" && sender.tab) {
    translateSegments(message.items)
      .then((translated) => sendResponse({ translated }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (type === "get-dictionary-meta") {
    loadDictionaryPayload()
      .then(({ entryCount, stats, sources }) => sendResponse({ entryCount, stats, sources }))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  return false;
});
