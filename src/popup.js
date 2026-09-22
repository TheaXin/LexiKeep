const DEFAULT_SETTINGS = {
  enabledLists: ["starter"]
};

function setStatus(message, kind = "") {
  const node = document.getElementById("status");
  node.textContent = message || "";
  node.className = kind ? `status ${kind}` : "status";
}

function queryActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]);
}

async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ type: "get-settings" });
  const active = new Set(settings.enabledLists || DEFAULT_SETTINGS.enabledLists);
  document.querySelectorAll('input[name="list"]').forEach((input) => {
    input.checked = active.has(input.value);
  });

  const meta = await chrome.runtime.sendMessage({ type: "get-dictionary-meta" });
  setStatus(`当前词库共 ${meta.entryCount} 个词条。`);
}

async function saveSettings() {
  const enabledLists = Array.from(document.querySelectorAll('input[name="list"]:checked')).map(
    (input) => input.value
  );
  return chrome.runtime.sendMessage({
    type: "save-settings",
    payload: {
      enabledLists
    }
  });
}

async function sendMessageToPage(type) {
  await saveSettings();
  const tab = await queryActiveTab();
  if (!tab?.id) {
    setStatus("没有找到当前标签页。", "error");
    return;
  }

  try {
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type });
    } catch (_error) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
      response = await chrome.tabs.sendMessage(tab.id, { type });
    }
    if (!response?.ok) {
      throw new Error(response?.error || "页面未响应");
    }
    const message = type === "translate-page"
      ? `翻译完成，共处理 ${response.count || 0} 个文本块。`
      : "已恢复原页。";
    setStatus(message, "success");
  } catch (error) {
    const url = tab.url || "";
    const isFilePage = url.startsWith("file://");
    if (isFilePage) {
      setStatus("这是本地文件页。请到扩展详情打开“允许访问文件网址”后再试。", "error");
      return;
    }
    const restricted = /^(chrome|edge|about|view-source):/.test(url);
    setStatus(restricted ? "浏览器内部页面不允许扩展翻译。" : `翻译失败：${error.message}`, "error");
    console.error("LexiKeep sendMessage error:", error);
  }
}

document.getElementById("translatePage").addEventListener("click", () => {
  setStatus("正在尝试连接当前页面...");
  sendMessageToPage("translate-page");
});

document.getElementById("restorePage").addEventListener("click", () => {
  setStatus("正在尝试恢复页面...");
  sendMessageToPage("restore-page");
});

document.getElementById("openDictionary").addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("src/dictionary.html") });
});

document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("change", () => {
    saveSettings();
  });
});

loadSettings().catch((error) => setStatus(`初始化失败：${error.message}`, "error"));
