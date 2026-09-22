const LIST_LABELS = {
  starter: "开源示例词库"
};

const state = {
  payload: null,
  selectedLists: new Set(Object.keys(LIST_LABELS)),
  search: "",
  selectedWord: null
};

function escapeHtml(text) {
  return (text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadPayload() {
  const dictionaryUrl =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("assets/dictionary.json")
      : "../assets/dictionary.json";
  const response = await fetch(dictionaryUrl);
  if (!response.ok) {
    throw new Error(`词库加载失败 (${response.status})`);
  }
  state.payload = await response.json();
}

function buildMeta() {
  const meta = document.getElementById("meta");
  const total = state.payload.entryCount;
  const stats = state.payload.stats || {};
  const pills = [`<div class="pill">总词数 ${total.toLocaleString()}</div>`];
  for (const [listId, count] of Object.entries(stats)) {
    pills.push(`<div class="pill">${LIST_LABELS[listId] || listId} ${count.toLocaleString()}</div>`);
  }
  meta.innerHTML = pills.join("");
}

function buildFilters() {
  const container = document.getElementById("filters");
  container.innerHTML = Object.entries(LIST_LABELS)
    .map(([listId, label]) => {
      const checked = state.selectedLists.has(listId) ? "checked" : "";
      return `<label><input type="checkbox" value="${listId}" ${checked}> ${label}</label>`;
    })
    .join("");

  container.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedLists.add(input.value);
      } else {
        state.selectedLists.delete(input.value);
      }
      renderList();
    });
  });
}

function getFilteredEntries() {
  const query = state.search.trim().toLowerCase();
  const entries = Object.values(state.payload.entries);
  return entries
    .filter((entry) => entry.lists.some((listId) => state.selectedLists.has(listId)))
    .filter((entry) => {
      if (!query) {
        return true;
      }
      const haystack = [
        entry.word,
        entry.shortGloss,
        ...(entry.translations || []).map((item) => item.translation),
        ...(entry.phrases || []).map((item) => item.phrase),
        ...(entry.phrases || []).map((item) => item.translation)
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((left, right) => left.word.localeCompare(right.word));
}

function renderList() {
  const list = document.getElementById("entryList");
  const filtered = getFilteredEntries();
  document.getElementById("resultCount").textContent = `当前显示 ${filtered.length.toLocaleString()} 个词条`;
  if (!filtered.length) {
    list.innerHTML = `<div class="entry-item"><p>没有找到符合条件的词条。</p></div>`;
    renderDetail(null);
    return;
  }

  if (!state.selectedWord || !filtered.some((entry) => entry.word === state.selectedWord)) {
    state.selectedWord = filtered[0].word;
  }

  list.innerHTML = filtered
    .map((entry) => {
      const active = entry.word === state.selectedWord ? " active" : "";
      return `
        <article class="entry-item${active}" data-word="${escapeHtml(entry.word)}">
          <h3>${escapeHtml(entry.word)}</h3>
          <p>${escapeHtml(entry.shortGloss || "暂无简要释义")}</p>
        </article>
      `;
    })
    .join("");

  list.querySelectorAll(".entry-item").forEach((item) => {
    item.addEventListener("click", () => {
      state.selectedWord = item.dataset.word;
      renderList();
    });
  });

  renderDetail(state.payload.entries[state.selectedWord]);
}

function renderDetail(entry) {
  const panel = document.getElementById("detailPanel");
  if (!entry) {
    panel.innerHTML = `<div class="detail-empty">从左边选择一个词条，就可以查看它在词库中的详细解释。</div>`;
    return;
  }

  const phonetic = [entry.us ? `US /${entry.us}/` : "", entry.uk ? `UK /${entry.uk}/` : ""]
    .filter(Boolean)
    .join("  ");
  const tags = (entry.lists || [])
    .map((listId) => `<span>${escapeHtml(LIST_LABELS[listId] || listId)}</span>`)
    .join("");
  const translationItems = (entry.translations || [])
    .map((item) => `<li><strong>${escapeHtml(item.type || "")}</strong> ${escapeHtml(item.translation || "")}</li>`)
    .join("");
  const phraseItems = (entry.phrases || [])
    .map((item) => `<li>${escapeHtml(item.phrase || "")} - ${escapeHtml(item.translation || "")}</li>`)
    .join("");
  const sentenceItems = (entry.sentences || [])
    .map(
      (item) =>
        `<li>${escapeHtml(item.sentence || "")}<br><span>${escapeHtml(item.translation || "")}</span></li>`
    )
    .join("");

  panel.innerHTML = `
    <h2>${escapeHtml(entry.word)}</h2>
    <div class="phonetic">${escapeHtml(phonetic || "暂无音标")}</div>
    <div class="tags">${tags}</div>
    <section class="section">
      <h3>释义</h3>
      <ul>${translationItems || "<li>暂无释义</li>"}</ul>
    </section>
    <section class="section">
      <h3>短语</h3>
      <ul>${phraseItems || "<li>暂无短语</li>"}</ul>
    </section>
    <section class="section">
      <h3>例句</h3>
      <ul>${sentenceItems || "<li>暂无例句</li>"}</ul>
    </section>
  `;
}

async function main() {
  await loadPayload();
  buildMeta();
  buildFilters();
  renderList();

  document.getElementById("search").addEventListener("input", (event) => {
    state.search = event.target.value || "";
    renderList();
  });
}

main().catch((error) => {
  document.getElementById("detailPanel").innerHTML = `<div class="detail-empty">${escapeHtml(error.message)}</div>`;
});
