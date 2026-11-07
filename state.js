const state = {
  kind: "air",
  toName: "", toAddr: "", toPhone: "", toPost: "", toCountry: "",
  fromName: "", fromAddr: "", fromPhone: "", fromPost: "",
  preset: false, mark: false,
  items: [],
  editFace: "front",
  selected: null,
  view: "edit", rx: -16, ry: -34,
};

const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 8);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function lines(s, n) {
  return String(s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, n);
}

const ADDR = ["toName", "toAddr", "toPost", "toCountry", "fromName", "fromAddr", "fromPost"];
const library = { current: "blank", list: [] };

function defaultName(builtin) {
  if (builtin === "blank") return "空白信封";
  if (builtin === "crl") return "CRL";
  return "未命名";
}

function emptyEnvelope(id, name, builtin) {
  return {
    id, name, builtin: builtin || "",
    kind: "air",
    toName: "", toAddr: "", toPost: "", toCountry: "",
    fromName: "", fromAddr: "", fromPost: "",
    preset: builtin === "crl",
    mark: builtin === "crl",
    items: [],
  };
}

function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((it) => it && it.face && (
    it.type === "text" || (it.type === "image" && String(it.src || "").startsWith("data:image/"))
  ));
}

function envelopeFromRaw(raw) {
  if (!raw || typeof raw !== "object") return null;
  const builtin = raw.builtin === "blank" || raw.builtin === "crl"
    ? raw.builtin
    : (raw.id === "blank" || raw.id === "crl" ? raw.id : "");
  const env = emptyEnvelope(String(raw.id || uid()), String(raw.name || "").trim().slice(0, 40) || defaultName(builtin), builtin);
  env.kind = raw.kind === "surface" || raw.kind === "domestic" ? raw.kind : "air";
  ADDR.forEach((k) => { env[k] = String(raw[k] ?? ""); });
  env.preset = !!raw.preset;
  env.mark = !!raw.mark;
  if (builtin === "blank") { env.preset = false; env.mark = false; }
  if (builtin === "crl") { env.preset = true; env.mark = true; }
  env.items = cleanItems(raw.items);
  return env;
}

function currentEnvelope() {
  return library.list.find((e) => e.id === library.current) || library.list[0];
}

function ensureSeeds() {
  if (!library.list.some((e) => e.builtin === "blank")) library.list.unshift(emptyEnvelope("blank", "空白信封", "blank"));
  if (!library.list.some((e) => e.builtin === "crl")) {
    const at = library.list.findIndex((e) => e.builtin === "blank");
    library.list.splice(at + 1, 0, emptyEnvelope("crl", "CRL", "crl"));
  }
  library.list.forEach((e) => {
    if (e.builtin === "blank") { e.preset = false; e.mark = false; }
    if (e.builtin === "crl") { e.preset = true; e.mark = true; }
    if (!e.name) e.name = defaultName(e.builtin);
  });
  const blank = library.list.find((e) => e.builtin === "blank");
  const crl = library.list.find((e) => e.builtin === "crl");
  const mine = library.list.filter((e) => e !== blank && e !== crl);
  library.list = [blank, crl, ...mine];
}

function snapshot() {
  const env = currentEnvelope();
  if (!env) return;
  env.kind = state.kind === "surface" || state.kind === "domestic" ? state.kind : "air";
  if (env.builtin === "blank") { env.preset = state.preset = false; env.mark = state.mark = false; }
  else if (env.builtin === "crl") { env.preset = state.preset = true; env.mark = state.mark = true; }
  else { env.preset = !!state.preset; env.mark = !!state.mark; }
  env.items = state.items.map((it) => ({ ...it }));
}

function applyEnvelope(env) {
  state.kind = env.kind;
  state.preset = !!env.preset;
  state.mark = !!env.mark;
  state.items = env.items.map((it) => ({ ...it }));
  state.selected = null;
}

function paintLibrary() {
  const pick = $("env-pick");
  const cur = currentEnvelope();
  const option = (e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`;
  const presets = library.list.filter((e) => e.builtin).map(option).join("");
  const mine = library.list.filter((e) => !e.builtin);
  pick.innerHTML = `<optgroup label="预设">${presets}</optgroup>` + (mine.length ? `<optgroup label="我的信封">${mine.map(option).join("")}</optgroup>` : "");
  if (cur) pick.value = cur.id;
  const name = $("env-name");
  if (name && document.activeElement !== name) name.value = cur ? cur.name : "";
  const now = $("env-now-name");
  if (now && cur) now.textContent = cur.name;
  $("env-del").hidden = !cur || !!cur.builtin;
}

function writeStore() {
  const data = { current: library.current, list: library.list };
  try {
    localStorage.setItem("envelope-v2", JSON.stringify(data));
  } catch {
    const slim = {
      current: library.current,
      list: library.list.map((e) => ({ ...e, items: e.items.filter((it) => it.type !== "image") })),
    };
    try { localStorage.setItem("envelope-v2", JSON.stringify(slim)); } catch { /* quota */ }
  }
}

function save() {
  snapshot();
  writeStore();
}

function itemsFromLegacy(data) {
  const items = cleanItems(data && data.items);
  if (!data || Array.isArray(data.items)) return items;
  ["flap", "front", "back"].forEach((face) => {
    const text = data[face + "Text"];
    if (text) items.push({ id: uid(), face, type: "text", text, x: 12, y: face === "flap" ? 8 : 48, w: 46, size: 3.2 });
  });
  return items;
}

function load() {
  library.list = [];
  try {
    const saved = JSON.parse(localStorage.getItem("envelope-v2") || "null");
    if (saved && Array.isArray(saved.list)) {
      const seen = new Set();
      library.list = saved.list.map(envelopeFromRaw).filter((e) => {
        if (!e || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      library.current = saved.current;
    }
  } catch { /* ignore */ }
  if (!library.list.length) {
    try {
      const old = JSON.parse(localStorage.getItem("envelope-v1") || "null");
      const items = itemsFromLegacy(old);
      const worked = old && (items.length || ADDR.some((k) => String(old[k] || "").trim()) || (old.kind && old.kind !== "air"));
      if (worked) {
        const env = emptyEnvelope("e" + uid(), "我的信封", "");
        env.kind = old.kind === "surface" || old.kind === "domestic" ? old.kind : "air";
        ADDR.forEach((k) => { env[k] = String(old[k] || ""); });
        env.preset = old.preset !== false;
        env.mark = old.mark !== false;
        env.items = items;
        library.list.push(env);
        library.current = env.id;
      }
    } catch { /* ignore */ }
  }
  ensureSeeds();
  if (!library.list.some((e) => e.id === library.current)) library.current = "blank";
  applyEnvelope(currentEnvelope());
}

function uniqueName(base) {
  const names = new Set(library.list.map((e) => e.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function openEnvelope(id) {
  if (!library.list.some((e) => e.id === id) || id === library.current) return;
  snapshot();
  library.current = id;
  applyEnvelope(currentEnvelope());
  syncForm();
  fillSender();
  paintLibrary();
  writeStore();
  render();
}

function newEnvelope() {
  snapshot();
  const env = emptyEnvelope("e" + uid(), uniqueName("未命名"), "");
  library.list.push(env);
  library.current = env.id;
  applyEnvelope(env);
  syncForm();
  fillSender();
  paintLibrary();
  writeStore();
  render();
  $("env-name").focus();
  $("env-name").select();
}

function copyEnvelope() {
  snapshot();
  const src = currentEnvelope();
  const env = emptyEnvelope("e" + uid(), uniqueName(src.name + " 副本"), "");
  env.kind = src.kind;
  env.preset = !!src.preset;
  env.mark = !!src.mark;
  env.items = src.items.map((it) => ({ ...it, id: uid() }));
  library.list.push(env);
  library.current = env.id;
  applyEnvelope(env);
  syncForm();
  fillSender();
  paintLibrary();
  writeStore();
  render();
  $("env-name").focus();
  $("env-name").select();
}

function deleteEnvelope() {
  const cur = currentEnvelope();
  if (!cur || cur.builtin) return;
  if (!confirm(`删除「${cur.name}」？删掉就不能恢复。`)) return;
  library.list = library.list.filter((e) => e.id !== cur.id);
  library.current = "blank";
  ensureSeeds();
  applyEnvelope(currentEnvelope());
  syncForm();
  fillSender();
  paintLibrary();
  writeStore();
  render();
}

const book = {
  me: { domestic: { name: "", addr: "", phone: "", post: "" }, intl: { name: "", addr: "", phone: "", post: "" } },
  people: [],
  open: "",
  blanks: 0,
};

function meFrom(raw) {
  return {
    name: String((raw && raw.name) || ""),
    addr: String((raw && raw.addr) || ""),
    phone: String((raw && raw.phone) || ""),
    post: String((raw && raw.post) || "").replace(/\D/g, "").slice(0, 6),
  };
}

function meKey() {
  return state.kind === "domestic" ? "domestic" : "intl";
}

function currentMe() {
  return book.me[meKey()];
}

function blankPerson() {
  return { id: "p" + uid(), name: "", addr: "", phone: "", post: "", country: "", print: true };
}

function personFrom(raw) {
  const p = blankPerson();
  if (raw && raw.id) p.id = String(raw.id);
  p.name = String((raw && raw.name) || "");
  p.addr = String((raw && raw.addr) || "");
  p.phone = String((raw && raw.phone) || "");
  p.post = String((raw && raw.post) || "").replace(/\D/g, "").slice(0, 6);
  p.country = String((raw && raw.country) || "");
  p.print = !raw || raw.print !== false;
  return p;
}

function openPerson() {
  return book.people.find((p) => p.id === book.open) || null;
}

function applyBookToState() {
  const me = currentMe();
  state.fromName = me.name || "";
  state.fromAddr = me.addr || "";
  state.fromPhone = me.phone || "";
  state.fromPost = me.post || "";
  const p = openPerson();
  state.toName = p ? p.name : "";
  state.toAddr = p ? p.addr : "";
  state.toPhone = p ? p.phone : "";
  state.toPost = p ? p.post : "";
  state.toCountry = p ? p.country : "";
}

function saveBook() {
  try { localStorage.setItem("envelope-book-v1", JSON.stringify(book)); } catch { /* quota */ }
}

function loadBook() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("envelope-book-v1") || "null"); } catch { /* ignore */ }
  if (saved && saved.me) {
    if (saved.me.domestic || saved.me.intl) {
      book.me = { domestic: meFrom(saved.me.domestic), intl: meFrom(saved.me.intl) };
    } else {
      const one = meFrom(saved.me);
      book.me = { domestic: { ...one }, intl: { ...one } };
    }
    book.people = Array.isArray(saved.people) ? saved.people.map(personFrom) : [];
    book.open = String(saved.open || "");
    book.blanks = Math.max(0, Math.min(50, Number(saved.blanks) || 0));
  } else {
    const env = currentEnvelope() || {};
    const one = meFrom({ name: env.fromName, addr: env.fromAddr, post: env.fromPost });
    book.me = { domestic: { ...one }, intl: { ...one } };
    if (env.toName || env.toAddr || env.toPost || env.toCountry) {
      const p = personFrom({
        name: env.toName, addr: env.toAddr, post: env.toPost, country: env.toCountry, print: true,
      });
      book.people = [p];
      book.open = p.id;
    }
    saveBook();
  }
  if (book.open && !book.people.some((p) => p.id === book.open)) book.open = book.people[0] ? book.people[0].id : "";
  if (!book.open && book.people[0]) book.open = book.people[0].id;
  applyBookToState();
}
