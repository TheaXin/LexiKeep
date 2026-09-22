(function () {
  const WRAPPER_CLASS = "ltp-wrapper";
  const PROTECTED_CLASS = "ltp-protected";
  const DETAIL_BUTTON_CLASS = "ltp-detail-button";
  const CARD_ID = "ltp-note-card";
  const STYLE_ID = "ltp-runtime-style";
  const WORD_PATTERN = /\b[A-Za-z][A-Za-z'-]{1,}\b/g;
  const STOPWORDS = new Set([
    "a", "an", "and", "are", "as", "at", "about", "be", "been", "being", "but", "by",
    "can", "could", "did", "do", "does", "for", "from", "had", "has", "have", "he",
    "her", "hers", "him", "his", "how", "i", "if", "in", "into", "is", "it", "its",
    "me", "more", "most", "my", "of", "on", "or", "our", "ours", "she", "so", "than",
    "that", "the", "their", "them", "there", "these", "they", "this", "those", "to",
    "us", "was", "we", "were", "what", "when", "where", "which", "who", "why", "will",
    "with", "would", "you", "your", "yours"
  ]);
  const EXCLUDED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "CODE",
    "PRE",
    "SVG"
  ]);
  const LAYOUT_SENSITIVE_TAGS = new Set([
    "A",
    "BUTTON",
    "SUMMARY",
    "LABEL",
    "OPTION",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "TH",
    "TD",
    "DT",
    "DD"
  ]);

  const state = {
    sourceDictionary: null,
    activeEntries: new Map(),
    translated: false,
    translating: false
  };

  function uniqueStrings(values, limit) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
      const normalized = (value || "").trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= limit) {
        break;
      }
    }
    return result;
  }

  function escapeHtml(text) {
    return (text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/styles.css");
    document.documentElement.appendChild(link);
  }

  async function getSettings() {
    return chrome.runtime.sendMessage({ type: "get-settings" });
  }

  async function loadDictionary(settings) {
    if (!state.sourceDictionary) {
      const response = await fetch(chrome.runtime.getURL("assets/dictionary.json"));
      if (!response.ok) {
        throw new Error("词库加载失败");
      }
      state.sourceDictionary = await response.json();
    }

    const enabledLists = new Set(settings.enabledLists || []);
    const nextEntries = new Map();
    for (const [word, entry] of Object.entries(state.sourceDictionary.entries)) {
      if (entry.lists.some((listId) => enabledLists.has(listId))) {
        nextEntries.set(word, entry);
      }
    }
    state.activeEntries = nextEntries;
  }

  function isEligibleTextNode(node) {
    if (!node || !node.parentElement) {
      return false;
    }
    if (EXCLUDED_TAGS.has(node.parentElement.tagName)) {
      return false;
    }
    if (node.parentElement.closest(`.${WRAPPER_CLASS}, #${CARD_ID}`)) {
      return false;
    }
    const text = node.nodeValue || "";
    if (text.trim().length < 3 || text.length > 450) {
      return false;
    }
    return /[A-Za-z]/.test(text);
  }

  function collectTextNodes(limit) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (isEligibleTextNode(walker.currentNode) && isVisible(walker.currentNode.parentElement)) {
        nodes.push(walker.currentNode);
        if (nodes.length >= limit) {
          break;
        }
      }
    }
    return nodes;
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function isLayoutSensitiveNode(node) {
    const element = node?.parentElement;
    if (!element) {
      return false;
    }
    if (LAYOUT_SENSITIVE_TAGS.has(element.tagName)) {
      return true;
    }
    if (element.closest("nav, header, footer, menu, aside, [role='navigation'], [role='menu'], [role='tablist'], .menu, .nav, .navbar, .toolbar, .breadcrumb")) {
      return true;
    }
    const textLength = (node.nodeValue || "").trim().length;
    if (textLength <= 28 && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().width < 260) {
      return true;
    }
    return false;
  }

  function prepareSegment(node, settings) {
    const text = node.nodeValue || "";
    const allowProtectedWords = !isLayoutSensitiveNode(node);
    const candidates = [];
    let index = 0;
    text.replace(WORD_PATTERN, (surface) => {
      const key = surface.toLowerCase();
      const entry = state.activeEntries.get(key);
      if (!entry) {
        return surface;
      }
      if (!allowProtectedWords || !shouldProtectWord(surface, entry)) {
        return surface;
      }
      const token = `ZXQKEEP${index}TOKEN`;
      candidates.push({ token, surface, entry, score: scoreEntry(surface, entry) });
      index += 1;
      return token;
    });

    candidates.sort((left, right) => right.score - left.score);
    const selected = new Set(
      candidates
        .slice(0, settings.maxProtectedWordsPerNode || 3)
        .map((item) => `${item.surface.toLowerCase()}::${item.token}`)
    );

    const replacements = [];
    let tokenIndex = 0;
    let maskedText = text.replace(WORD_PATTERN, (surface) => {
      const key = surface.toLowerCase();
      const entry = state.activeEntries.get(key);
      if (!entry || !allowProtectedWords || !shouldProtectWord(surface, entry)) {
        return surface;
      }
      const token = `ZXQKEEP${tokenIndex}TOKEN`;
      tokenIndex += 1;
      if (!selected.has(`${key}::${token}`)) {
        return surface;
      }
      replacements.push({ token, surface, entry });
      return token;
    });

    return { originalText: text, maskedText, replacements, allowProtectedWords };
  }

  function scoreEntry(surface, entry) {
    const lists = new Set(entry.lists || []);
    let score = 0;
    if (lists.has("business")) {
      score += 4;
    }
    if (lists.has("ielts")) {
      score += 3;
    }
    if (lists.has("cet6")) {
      score += 2;
    }
    if (lists.has("cet4")) {
      score += 1;
    }
    if ((entry.sentences || []).length) {
      score += 2;
    }
    if ((entry.phrases || []).length) {
      score += 1;
    }
    if (surface.length >= 8) {
      score += 1;
    }
    return score;
  }

  function shouldProtectWord(surface, entry) {
    const key = surface.toLowerCase();
    if (STOPWORDS.has(key)) {
      return false;
    }
    if (surface.length < 4) {
      return false;
    }
    if ((entry.shortGloss || "").length > 48) {
      return false;
    }
    return true;
  }

  function extractContextTerms(text) {
    return new Set(
      (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((word) => !STOPWORDS.has(word))
    );
  }

  function scoreTranslationCandidate(candidate, entry, contextTerms) {
    let score = 0;
    const normalized = (candidate.translation || "").toLowerCase();
    const pos = (candidate.type || "").toLowerCase();

    if (pos.startsWith("n")) {
      score += 1;
    }
    if (pos.startsWith("v") && contextTerms.has("to")) {
      score += 1;
    }
    if (normalized.includes("人") || normalized.includes("事") || normalized.includes("物")) {
      score -= 0.2;
    }

    for (const phrase of entry.phrases || []) {
      const phraseTerms = extractContextTerms(phrase.phrase || "");
      const overlap = [...phraseTerms].filter((term) => contextTerms.has(term)).length;
      if (overlap > 0 && normalized.includes((phrase.translation || "").slice(0, 2))) {
        score += 4 + overlap;
      } else if (overlap > 0) {
        score += overlap * 1.5;
      }
    }

    for (const sentence of entry.sentences || []) {
      const sentenceTerms = extractContextTerms(sentence.sentence || "");
      const overlap = [...sentenceTerms].filter((term) => contextTerms.has(term)).length;
      if (overlap > 0 && normalized.includes((sentence.translation || "").slice(0, 2))) {
        score += 3 + overlap;
      } else if (overlap > 0) {
        score += overlap;
      }
    }

    return score;
  }

  function chooseContextualGloss(entry, originalText, translatedText) {
    const translations = entry.translations || [];
    if (!translations.length) {
      return entry.shortGloss || "释义";
    }

    const contextTerms = new Set([
      ...extractContextTerms(originalText || ""),
      ...extractContextTerms(translatedText || "")
    ]);

    const ranked = translations
      .map((candidate, index) => ({
        ...candidate,
        index,
        score: scoreTranslationCandidate(candidate, entry, contextTerms)
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index);

    const selected = uniqueStrings(
      ranked.slice(0, 2).map((item) => item.translation),
      2
    );

    return selected.join("；") || entry.shortGloss || "释义";
  }

  function renderProtectedWord(surface, entry, segment, translatedText) {
    const gloss = chooseContextualGloss(entry, segment.originalText, translatedText);
    return (
      `<span class="${PROTECTED_CLASS}" data-word="${escapeHtml(entry.word)}">` +
      `<span class="ltp-word">${escapeHtml(surface)}</span>` +
      `<span class="ltp-inline-translation">(${escapeHtml(gloss)})</span>` +
      `<button class="${DETAIL_BUTTON_CLASS}" type="button" data-word="${escapeHtml(entry.word)}" aria-label="查看 ${escapeHtml(entry.word)} 的完整释义">详</button>` +
      `</span>`
    );
  }

  function renderTranslatedHtml(segment, translatedText) {
    let html = escapeHtml(translatedText || segment.originalText);
    for (const item of segment.replacements) {
      html = html.replace(
        item.token,
        renderProtectedWord(item.surface, item.entry, segment, translatedText)
      );
    }
    return `<span class="ltp-line">${html}</span>`;
  }

  async function requestTranslations(maskedTexts) {
    const response = await chrome.runtime.sendMessage({
      type: "translate-segments",
      items: maskedTexts
    });
    if (response?.error) {
      throw new Error(response.error);
    }
    return response?.translated || maskedTexts;
  }

  function replaceTextNode(node, segment, translatedText, settings) {
    const wrapper = document.createElement("span");
    wrapper.className = WRAPPER_CLASS;
    wrapper.dataset.originalText = segment.originalText;
    wrapper.innerHTML = renderTranslatedHtml(segment, translatedText);
    node.parentNode.replaceChild(wrapper, node);
  }

  async function translatePage() {
    if (state.translating) {
      return { ok: false, error: "翻译正在进行中" };
    }
    state.translating = true;
    try {
    const settings = await getSettings();
    injectStyles();
    await loadDictionary(settings);

    if (state.translated) {
      restorePage();
    }

    const nodes = collectTextNodes(settings.maxNodes || 180);
    const segments = nodes.map((node) => prepareSegment(node, settings));

    for (let start = 0; start < nodes.length; start += 24) {
      const end = start + 24;
      const nodeBatch = nodes.slice(start, end);
      const segmentBatch = segments.slice(start, end);
      const translatedBatch = await requestTranslations(
        segmentBatch.map((segment) => segment.maskedText)
      );
      segmentBatch.forEach((segment, index) => {
        replaceTextNode(nodeBatch[index], segment, translatedBatch[index], settings);
      });
    }

    state.translated = true;
    return { ok: true, count: nodes.length };
    } finally {
      state.translating = false;
    }
  }

  function restorePage() {
    document.querySelectorAll(`.${WRAPPER_CLASS}`).forEach((wrapper) => {
      const originalText = wrapper.dataset.originalText || "";
      wrapper.replaceWith(document.createTextNode(originalText));
    });
    const note = document.getElementById(CARD_ID);
    if (note) {
      note.remove();
    }
    state.translated = false;
  }

  function renderListSection(title, items, renderer) {
    if (!items || !items.length) {
      return "";
    }
    const content = items.map(renderer).join("");
    return `<section class="ltp-section"><h4>${escapeHtml(title)}</h4>${content}</section>`;
  }

  function buildNoteCard(entry) {
    const phonetics = [entry.us ? `US /${entry.us}/` : "", entry.uk ? `UK /${entry.uk}/` : ""]
      .filter(Boolean)
      .join("  ");
    const labels = (entry.lists || []).join(" / ");
    return `
      <div class="ltp-card-header">
        <div>
          <div class="ltp-card-word">${escapeHtml(entry.word)}</div>
          <div class="ltp-card-meta">${escapeHtml(phonetics || labels)}</div>
        </div>
        <button class="ltp-close" type="button" aria-label="Close">×</button>
      </div>
      ${renderListSection("释义", entry.translations, (item) => `<p><strong>${escapeHtml(item.type || "")}</strong> ${escapeHtml(item.translation || "")}</p>`)}
      ${renderListSection("短语", entry.phrases, (item) => `<p>${escapeHtml(item.phrase || "")} - ${escapeHtml(item.translation || "")}</p>`)}
      ${renderListSection("例句", entry.sentences, (item) => `<p>${escapeHtml(item.sentence || "")}<br><span>${escapeHtml(item.translation || "")}</span></p>`)}
      ${labels ? `<footer class="ltp-card-footer">词表来源: ${escapeHtml(labels)}</footer>` : ""}
    `;
  }

  function openNoteCard(target, entry) {
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement("aside");
      card.id = CARD_ID;
      document.body.appendChild(card);
    }
    card.innerHTML = buildNoteCard(entry);
    card.style.display = "block";
    const rect = target.getBoundingClientRect();
    const cardWidth = Math.min(360, window.innerWidth - 24);
    card.style.top = `${Math.max(12, Math.min(window.innerHeight - 180, rect.bottom + 12))}px`;
    card.style.left = `${Math.max(12, Math.min(window.innerWidth - cardWidth - 12, rect.left))}px`;
    card.querySelector(".ltp-close")?.addEventListener("click", () => card.remove());
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(`.${DETAIL_BUTTON_CLASS}`);
    const existingCard = document.getElementById(CARD_ID);
    if (!button) {
      if (existingCard && !existingCard.contains(event.target)) {
        existingCard.remove();
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const entry = state.activeEntries.get((button.dataset.word || "").toLowerCase());
    if (entry) {
      openNoteCard(button, entry);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "translate-page") {
      translatePage()
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "restore-page") {
      restorePage();
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });
})();
