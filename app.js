"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const KEY = "namefinder_v1";

const defaults = {
  records: [],
  favorites: [],
  settings: {
    discordEndpoint: "",
    minecraftEndpoint: ""
  }
};

function loadDB() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      records: Array.isArray(saved.records) ? saved.records : [],
      favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
      settings: { ...defaults.settings, ...(saved.settings || {}) }
    };
  } catch {
    return structuredClone(defaults);
  }
}

let db = loadDB();
let platform = "discord";
let length = 2;
let job = null;
let scanTimer = null;
let toastTimer = null;

function saveDB() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function getCharset() {
  return $('input[name="charset"]:checked')?.value || "letters";
}

function getEndpoint(p) {
  return p === "discord"
    ? db.settings.discordEndpoint
    : db.settings.minecraftEndpoint;
}

function minLen(p) {
  return p === "minecraft" ? 3 : 2;
}

function maxLen() {
  return 16;
}

function makeName(len, charset) {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const underscore = "_";

  let pool = letters;

  if (charset === "mixed") pool = letters + digits;
  if (charset === "full") pool = letters + digits + underscore;

  let output = "";

  for (let i = 0; i < len; i++) {
    output += pool[Math.floor(Math.random() * pool.length)];
  }

  return output;
}

function makeQueue(p, len, amount, charset) {
  const old = db.records
    .filter((r) => r.platform === p && r.length === len)
    .sort((a, b) => String(a.checkedAt).localeCompare(String(b.checkedAt)));

  const historyItems = old.slice(0, amount).map((r) => r.name);
  const remaining = Math.max(0, amount - historyItems.length);
  const used = new Set(old.map((r) => r.name));

  const alphabetSize =
    charset === "letters" ? 26 :
    charset === "mixed" ? 36 :
    charset === "full" ? 37 : 26;

  const maxSpace = alphabetSize ** len;
  const target = Math.min(remaining, Math.max(0, maxSpace - used.size));
  const newItems = [];

  let attempts = 0;
  const maxAttempts = target * 30 + 200;

  while (newItems.length < target && attempts < maxAttempts) {
    attempts++;
    const name = makeName(len, charset);

    if (!used.has(name)) {
      used.add(name);
      newItems.push(name);
    }
  }

  return { historyItems, newItems };
}

async function checkName(name, p) {
  if (p === "minecraft") {
    try {
      const response = await fetch(
        "/.netlify/functions/minecraft-check",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: name })
        }
      );

      if (!response.ok) return "unknown";

      const data = await response.json();

      if (data.status === "taken" || data.available === false) {
        return "taken";
      }

      if (data.status === "free" && data.available === true) {
        return "free";
      }

      return "unknown";
    } catch {
      return "unknown";
    }
  }

  const endpoint = getEndpoint(p);
  if (!endpoint) return "unknown";

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return "unknown";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name, platform: p }),
        signal: controller.signal
      });

      if (!response.ok) return "unknown";

      const data = await response.json();

      if (data.available === true) return "free";
      if (data.available === false) return "taken";

      return "unknown";
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "unknown";
  }
}

function recordResult(name, p, len, status) {
  const checkedAt = new Date().toISOString();

  const existing = db.records.find(
    (r) => r.platform === p && r.name === name
  );

  if (existing) {
    existing.status = status;
    existing.length = len;
    existing.checkedAt = checkedAt;
  } else {
    db.records.push({
      name,
      platform: p,
      length: len,
      status,
      checkedAt
    });
  }

  saveDB();
  renderAll();
}

function getFavoriteKey(item) {
  return `${item.platform}:${item.name}`;
}

function isFavorite(record) {
  return db.favorites.some((f) => {
    if (typeof f === "string") {
      return f === getFavoriteKey(record) || f === record.name;
    }
    return f.platform === record.platform && f.name === record.name;
  });
}

function toggleFavorite(record) {
  const index = db.favorites.findIndex((f) => {
    if (typeof f === "string") {
      return f === getFavoriteKey(record) || f === record.name;
    }
    return f.platform === record.platform && f.name === record.name;
  });

  if (index >= 0) {
    db.favorites.splice(index, 1);
    toast("Usunięto z ulubionych");
  } else {
    db.favorites.push({
      name: record.name,
      platform: record.platform,
      length: record.length,
      status: record.status,
      checkedAt: record.checkedAt
    });
    toast("Dodano do ulubionych");
  }

  saveDB();
  renderAll();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function statusLabel(status) {
  if (status === "free") return "Wolna";
  if (status === "taken") return "Zajęta";
  return "Niewiadomo";
}

function renderRecord(record) {
  const favorite = isFavorite(record);

  return `
    <div class="result-item">
      <div class="result-main">
        <strong>${escapeHTML(record.name)}</strong>
        <small>${record.platform === "minecraft" ? "Minecraft" : "Discord"} · ${record.length} znaków</small>
      </div>
      <span class="result-status ${escapeHTML(record.status || "unknown")}">
        ${statusLabel(record.status)}
      </span>
      <button class="favorite-btn" data-favorite="${escapeHTML(record.platform)}:${escapeHTML(record.name)}" aria-label="Ulubione">
        ${favorite ? "★" : "☆"}
      </button>
    </div>
  `;
}

function renderList(element, records, emptyText) {
  if (!element) return;

  if (!records.length) {
    element.classList.add("empty-state");
    element.textContent = emptyText;
    return;
  }

  element.classList.remove("empty-state");
  element.innerHTML = records.map(renderRecord).join("");
}

function renderRecent() {
  const recent = [...db.records]
    .sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)))
    .slice(0, 5);

  renderList($("#recentResults"), recent, "Wyniki pojawią się tutaj po skanowaniu.");
}

function renderResults() {
  let records = [...db.records];

  const status = $("#resultStatus")?.value || "all";
  const sort = $("#resultSort")?.value || "recent";

  if (status !== "all") {
    records = records.filter((r) => r.status === status);
  }

  if (sort === "name") {
    records.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "free") {
    const order = { free: 0, taken: 1, unknown: 2 };
    records.sort((a, b) => order[a.status] - order[b.status]);
  } else {
    records.sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)));
  }

  $("#resultTotal").textContent = `${records.length} wyników`;
  renderList($("#allResults"), records, "Brak wyników.");
}

function renderFavorites() {
  const platformFilter = $("#favoritePlatform")?.value || "all";
  const lengthFilter = $("#favoriteLength")?.value || "all";

  let favorites = db.favorites.map((f) => {
    if (typeof f === "string") {
      const [p, ...parts] = f.split(":");
      const name = parts.join(":");
      return db.records.find((r) => r.platform === p && r.name === name) ||
        db.records.find((r) => r.name === name) ||
        { name, platform: p || "discord", length: name.length, status: "unknown" };
    }
    return f;
  });

  if (platformFilter !== "all") {
    favorites = favorites.filter((f) => f.platform === platformFilter);
  }

  if (lengthFilter !== "all") {
    favorites = favorites.filter((f) => String(f.length) === lengthFilter);
  }

  renderList($("#favoriteList"), favorites, "Nie masz jeszcze ulubionych.");
}

function renderHistory() {
  const platformFilter = $("#historyPlatform")?.value || "all";
  const lengthFilter = $("#historyLength")?.value || "all";

  let records = [...db.records];

  if (platformFilter !== "all") {
    records = records.filter((r) => r.platform === platformFilter);
  }

  if (lengthFilter !== "all") {
    records = records.filter((r) => String(r.length) === lengthFilter);
  }

  records.sort((a, b) => String(b.checkedAt).localeCompare(String(a.checkedAt)));

  $("#historyTotal").textContent = `${records.length} nazw`;
  renderList($("#historyList"), records, "Historia jest pusta.");
}

function fillLengthFilters() {
  for (const id of ["favoriteLength", "historyLength"]) {
    const select = $("#" + id);
    if (!select) continue;

    const current = select.value;
    select.innerHTML = '<option value="all">Każda długość</option>';

    for (let i = 2; i <= 16; i++) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `${i} znaków`;
      select.appendChild(option);
    }

    select.value = current || "all";
  }
}

function renderAll() {
  renderRecent();
  renderResults();
  renderFavorites();
  renderHistory();
  fillLengthFilters();
}

function renderLengths() {
  const grid = $("#lengthGrid");
  if (!grid) return;

  const minimum = minLen(platform);
  const current = Math.max(minimum, Math.min(16, length));

  length = current;
  $("#lengthHint").textContent = `${minimum}–16 znaków`;

  grid.innerHTML = "";

  for (let i = minimum; i <= 16; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `length-option ${i === length ? "selected" : ""}`;
    button.textContent = i;
    button.addEventListener("click", () => {
      length = i;
      renderLengths();
    });
    grid.appendChild(button);
  }
}

function setPlatform(nextPlatform) {
  if (!["discord", "minecraft"].includes(nextPlatform)) return;

  platform = nextPlatform;

  $$("#platforms [data-platform]").forEach((button) => {
    button.classList.toggle(
      "selected",
      button.dataset.platform === platform
    );
  });

  if (platform === "minecraft" && length < 3) length = 3;

  renderLengths();
}

function setView(viewId) {
  $$(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  $$(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });

  if (viewId === "settingsView") {
    $("#discordEndpoint").value = db.settings.discordEndpoint || "";
    $("#minecraftEndpoint").value = db.settings.minecraftEndpoint || "";
  }
}

function updateProgress() {
  if (!job) return;

  const total = job.items.length;
  const checked = job.index;
  const percent = total ? Math.round((checked / total) * 100) : 0;

  $("#progressText").textContent = `${checked} / ${total}`;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;

  $("#checkedCount").textContent = checked;
  $("#freeCount").textContent = job.free;
  $("#takenCount").textContent = job.taken;
  $("#unknownCount").textContent = job.unknown;

  $("#historyProgress").textContent =
    `${Math.min(checked, job.historyCount)} / ${job.historyCount}`;

  $("#newProgress").textContent =
    `${Math.max(0, checked - job.historyCount)} / ${job.newCount}`;
}

function finishScan(message) {
  clearTimeout(scanTimer);
  scanTimer = null;

  if (job) {
    job.running = false;
    job.paused = false;
  }

  $("#scanState").textContent = "ZAKOŃCZONO";
  $("#scanState").className = "status-pill";
  $("#currentName").textContent = message || "Skanowanie zakończone.";
  $("#pauseBtn").textContent = "Ⅱ Pauza";

  renderAll();
}

async function runNext() {
  if (!job || !job.running || job.paused) return;

  if (job.index >= job.items.length) {
    finishScan("Skanowanie zakończone.");
    toast("Skanowanie zakończone");
    return;
  }

  const item = job.items[job.index];

  $("#currentName").textContent = item.name;

  const status = await checkName(item.name, job.platform);

  if (!job || !job.running) return;

  recordResult(item.name, job.platform, job.length, status);

  if (status === "free") job.free++;
  else if (status === "taken") job.taken++;
  else job.unknown++;

  job.index++;
  updateProgress();

  const delay = job.platform === "minecraft" ? 1250 : 500;

  if (job.running && !job.paused) {
    scanTimer = setTimeout(runNext, delay);
  }
}

function startScan() {
  if (job?.running) {
    toast("Skanowanie już trwa");
    return;
  }

  const amount = Number($("#amount").value);
  const charset = getCharset();
  const queue = makeQueue(platform, length, amount, charset);

  const items = [
    ...queue.historyItems.map((name) => ({ name, source: "history" })),
    ...queue.newItems.map((name) => ({ name, source: "new" }))
  ];

  if (!items.length) {
    toast("Brak nowych nazw do sprawdzenia");
    return;
  }

  job = {
    platform,
    length,
    items,
    index: 0,
    free: 0,
    taken: 0,
    unknown: 0,
    historyCount: queue.historyItems.length,
    newCount: queue.newItems.length,
    running: true,
    paused: false
  };

  $("#scanPanel").classList.remove("hidden");
  $("#scanTitle").textContent =
    `Skanowanie ${platform === "minecraft" ? "Minecraft" : "Discord"}`;

  $("#scanState").textContent = "W TRAKCIE";
  $("#scanState").className = "status-pill running";
  $("#pauseBtn").textContent = "Ⅱ Pauza";

  updateProgress();
  runNext();
}

function pauseScan() {
  if (!job?.running) return;

  job.paused = !job.paused;

  if (job.paused) {
    clearTimeout(scanTimer);
    $("#pauseBtn").textContent = "▶ Wznów";
    $("#scanState").textContent = "PAUZA";
    $("#scanState").className = "status-pill";
  } else {
    $("#pauseBtn").textContent = "Ⅱ Pauza";
    $("#scanState").textContent = "W TRAKCIE";
    $("#scanState").className = "status-pill running";
    runNext();
  }
}

function stopScan() {
  if (!job?.running) return;
  finishScan("Skanowanie zatrzymane przez użytkownika.");
  toast("Skanowanie zatrzymane");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCSV(records, filename) {
  const rows = [
    ["Nazwa", "Platforma", "Długość", "Status", "Data"],
    ...records.map((r) => [
      r.name,
      r.platform,
      r.length,
      statusLabel(r.status),
      r.checkedAt || ""
    ])
  ];

  const csv = "\uFEFF" + rows
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");

  downloadFile(filename, csv, "text/csv;charset=utf-8");
}

function bindEvents() {
  $("#platforms").addEventListener("click", (event) => {
    const button = event.target.closest("[data-platform]");
    if (button) setPlatform(button.dataset.platform);
  });

  $("#amount").addEventListener("input", () => {
    $("#amountLabel").textContent = $("#amount").value;
  });

  $("#startBtn").addEventListener("click", startScan);
  $("#pauseBtn").addEventListener("click", pauseScan);
  $("#stopBtn").addEventListener("click", stopScan);

  $("#settingsBtn").addEventListener("click", () => setView("settingsView"));

  $$("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $$("[data-go]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.go + "View"));
  });

  $("#resultStatus").addEventListener("change", renderResults);
  $("#resultSort").addEventListener("change", renderResults);
  $("#favoritePlatform").addEventListener("change", renderFavorites);
  $("#favoriteLength").addEventListener("change", renderFavorites);
  $("#historyPlatform").addEventListener("change", renderHistory);
  $("#historyLength").addEventListener("change", renderHistory);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-favorite]");
    if (!button) return;

    const [p, ...parts] = button.dataset.favorite.split(":");
    const name = parts.join(":");

    const record = db.records.find(
      (r) => r.platform === p && r.name === name
    );

    if (record) toggleFavorite(record);
  });

  $("#saveSettings").addEventListener("click", () => {
    db.settings.discordEndpoint = $("#discordEndpoint").value.trim();
    db.settings.minecraftEndpoint = $("#minecraftEndpoint").value.trim();
    saveDB();
    toast("Ustawienia zapisane");
  });

  $("#exportResults").addEventListener("click", () => {
    exportCSV(db.records, "name-finder-wyniki.csv");
  });

  $("#exportFavorites").addEventListener("click", () => {
    const favorites = db.favorites.map((f) => {
      if (typeof f !== "string") return f;

      const [p, ...parts] = f.split(":");
      const name = parts.join(":");

      return db.records.find(
        (r) => r.platform === p && r.name === name
      ) || { name, platform: p, length: name.length, status: "unknown" };
    });

    exportCSV(favorites, "name-finder-ulubione.csv");
  });

  $("#clearHistory").addEventListener("click", () => {
    if (!confirm("Czy na pewno wyczyścić całą historię?")) return;

    db.records = [];
    saveDB();
    renderAll();
    toast("Historia wyczyszczona");
  });

  $("#backupData").addEventListener("click", () => {
    downloadFile(
      "name-finder-backup.json",
      JSON.stringify(db, null, 2),
      "application/json"
    );
  });

  $("#resetData").addEventListener("click", () => {
    if (!confirm("Usunąć wszystkie wyniki, ulubione i ustawienia?")) return;

    if (job?.running) stopScan();

    db = structuredClone(defaults);
    saveDB();
    renderAll();

    $("#discordEndpoint").value = "";
    $("#minecraftEndpoint").value = "";

    toast("Dane aplikacji usunięte");
  });
}

function init() {
  $("#amountLabel").textContent = $("#amount").value;

  fillLengthFilters();
  renderLengths();
  renderAll();
  bindEvents();

  setPlatform("discord");
  setView("scanView");
}

init();
