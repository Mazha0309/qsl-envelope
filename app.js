const G = {
  ox: 10, oy: 16.5, tab: 15, fw: 160, fh: 115, flap: 34,
  tip: 28, gap: 5,
};

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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function lines(s, n) {
  return String(s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, n);
}

function faceBox(face) {
  return face === "flap" ? { w: G.fw, h: G.flap } : { w: G.fw, h: G.fh };
}

function lockup() {
  if (!state.preset) return "";
  return `<div class="lockup"><img src="icon.png" alt=""><span class="t">CRL <span>Callsign Roll Log</span></span></div>`;
}

function boxes(val, cls) {
  const d = String(val || "").replace(/\D/g, "").slice(0, 6);
  let h = `<div class="boxes${cls ? " " + cls : ""}">`;
  for (let i = 0; i < 6; i++) h += `<i>${d[i] ? esc(d[i]) : ""}</i>`;
  return h + "</div>";
}

let airSeq = 0;
function airBand(edge) {
  if (state.kind !== "air") return "";
  const id = "ab" + (++airSeq);
  const w = G.fw;
  const h = G.fh;
  const b = 3.6;
  const inner = edge === "nobot"
    ? `M${b} ${b}H${w - b}V${h}H${b}Z`
    : edge === "notop"
      ? `M${b} 0H${w - b}V${h - b}H${b}Z`
      : `M${b} ${b}H${w - b}V${h - b}H${b}Z`;
  return `<svg class="airband" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="${id}" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect width="2.3" height="4.6" fill="#c8102e"/>
        <rect x="2.3" width="2.3" height="4.6" fill="#1d4e89"/>
      </pattern>
    </defs>
    <path fill="url(#${id})" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z ${inner}"/>
  </svg>`;
}

function flapStripes(id, pointDown) {
  if (state.kind !== "air") return "";
  const w = G.fw;
  const h = G.flap;
  const t = G.tip;
  const b = 3.6;
  const outer = pointDown ? `M0 0H${w}L${w - t} ${h}H${t}Z` : `M${t} 0H${w - t}L${w} ${h}H0Z`;
  const inner = pointDown
    ? `M${b} 0H${w - b}L${w - t - b} ${h - b}H${t + b}Z`
    : `M${t + b} ${b}H${w - t - b}L${w - b} ${h}H${b}Z`;
  return `<svg class="flap-stripes" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id="${id}" width="4.6" height="4.6" patternUnits="userSpaceOnUse">
        <rect width="2.3" height="4.6" fill="#c8102e"/>
        <rect x="2.3" width="2.3" height="4.6" fill="#1d4e89"/>
      </pattern>
      <mask id="${id}m">
        <path fill="#fff" fill-rule="evenodd" d="${outer} ${inner}"/>
      </mask>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#${id})" mask="url(#${id}m)"/>
  </svg>`;
}

function roleMark(word) {
  return `<span class="role">（${word}）</span>`;
}

function whoHTML(ghost) {
  const mark = state.kind === "domestic" ? roleMark("收") : "";
  if (state.toName) return `<div class="who">${esc(state.toName)}${mark}</div>`;
  if (ghost) return `<div class="who ghost">收件人${mark}</div>`;
  return mark ? `<div class="who">${mark}</div>` : "";
}

function addrHTML(ghost) {
  const addr = lines(state.toAddr, 4);
  if (!addr.length) return ghost ? `<div class="ln ghost">地址</div>` : "";
  return addr.map((t) => `<div class="ln">${esc(t)}</div>`).join("");
}

function countryHTML(ghost) {
  if (state.kind === "domestic") return "";
  const c = state.toCountry.trim();
  if (!c) return ghost ? `<div class="country ghost">国家 / 地区</div>` : "";
  const cjk = /[\u3400-\u9fff]/.test(c);
  return `<div class="country${cjk ? " cjk" : ""}">${esc(cjk ? c : c.toUpperCase())}</div>`;
}

function senderBits() {
  const fromL = lines(state.fromAddr, 3);
  return [
    state.fromName ? `<b>${esc(state.fromName)}</b>` : "",
    ...fromL.map(esc),
    state.fromPhone ? esc((state.kind === "domestic" ? "电话 " : "Tel ") + state.fromPhone) : "",
  ].filter(Boolean);
}

function senderHTML(ghost) {
  const bits = senderBits();
  if (!bits.length) return ghost ? `<div class="sender ghost">寄件人</div>` : `<div class="sender"></div>`;
  return `<div class="sender">${bits.join("<br>")}</div>`;
}

function piecesHTML(face, edit) {
  const html = state.items.filter((it) => it.face === face).map((it) => {
    const on = edit && it.id === state.selected ? " on" : "";
    const handle = edit ? `<i class="hz"></i>` : "";
    if (it.type === "image" && String(it.src || "").startsWith("data:image/")) {
      return `<div class="piece img${on}" data-id="${it.id}" style="left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;height:${it.h}mm"><img src="${it.src}" alt="">${handle}</div>`;
    }
    return `<div class="piece txt${on}" data-id="${it.id}" style="left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;font-size:${it.size || 3.4}mm"><span class="pt">${esc(it.text || "")}</span>${handle}</div>`;
  }).join("");
  return `<div class="pieces">${html}</div>`;
}

function phoneLine(value, ghost) {
  const t = String(value || "").trim();
  const mark = state.kind === "domestic" ? "电话" : "Tel";
  if (t) return `<div class="ln phone">${esc(mark)} ${esc(t)}</div>`;
  return ghost ? `<div class="ln phone ghost">${mark}</div>` : "";
}

function domesticFrom(ghost) {
  const mark = roleMark("寄");
  const fromL = lines(state.fromAddr, 3);
  const phone = state.fromPhone ? `电话 ${state.fromPhone}` : "";
  const named = [
    state.fromName ? `<b>${esc(state.fromName)}${mark}</b>` : "",
    ...fromL.map(esc),
    phone ? esc(phone) : "",
  ].filter(Boolean);
  let who;
  if (named.length) {
    const bits = state.fromName ? named : [mark, ...named];
    who = `<div class="sender">${bits.join("<br>")}</div>`;
  } else who = ghost ? `<div class="sender ghost">寄信人 ${mark}</div>` : `<div class="sender">${mark}</div>`;
  const code = String(state.fromPost || "").replace(/\D/g, "").slice(0, 6);
  const digits = code ? esc(code) : (ghost ? `<span class="ghost">000000</span>` : "");
  return `<div class="dom-from">${who}<div class="post-text">邮政编码 ${digits}</div></div>`;
}

function recvBlock(ghost) {
  return `<div class="recv">${whoHTML(ghost)}${addrHTML(ghost)}${phoneLine(state.toPhone, ghost)}${countryHTML(ghost)}</div>`;
}

function frontHTML(ghost, edit) {
  const kind = state.kind;
  let body = "";
  if (kind === "domestic") {
    body = `<div class="dom-grid"><div class="dom-code">${boxes(state.toPost)}</div><div class="stamp">贴邮票处</div>${recvBlock(ghost)}<div class="dom-bottom">${lockup()}${domesticFrom(ghost)}</div></div>`;
  } else if (kind === "air") {
    body = `<div class="top"><div class="fromcol">${senderHTML(ghost)}</div><div class="stamp">贴邮票处</div></div><div class="intl-lower"><div class="airbadge"><b>PAR AVION</b><small>BY AIR MAIL</small><span>航空</span></div></div>${recvBlock(ghost)}`;
  } else {
    body = `<div class="top"><div class="fromcol">${senderHTML(ghost)}</div><div class="stamp">贴邮票处</div></div><div class="intl-lower"><div class="surf"><b>水陆路</b><small>SURFACE MAIL</small></div></div>${recvBlock(ghost)}`;
  }
  const band = kind === "air" ? airBand("all") : "";
  return `<div class="face kind-${kind === "domestic" ? "dom" : kind}">${band}<div class="front-face">${body}</div>${piecesHTML("front", edit)}</div>`;
}

function flapInner() {
  return `<div class="flap-face">${lockup()}</div>`;
}

function flapDesign(edit) {
  return `${flapInner()}${piecesHTML("flap", edit)}`;
}

function backInner(edge) {
  return `<div class="back-face">${airBand(edge)}<div class="hid"></div><div class="show">${lockup()}</div></div>`;
}

function backDesign(edit, edge) {
  return `<div class="back-wrap">${backInner(edge)}${piecesHTML("back", edit)}</div>`;
}

function renderFaces() {
  $("d-front").innerHTML = frontHTML(true, false);
  $("d-back").innerHTML = backDesign(false, "notop");
  $("d-flap-out").innerHTML = flapStripes("dair") + flapDesign(false);
  document.body.classList.toggle("show-dom", state.kind === "domestic");
  document.body.classList.toggle("show-intl", state.kind !== "domestic");
}

function cutSVG() {
  const x = G.ox + G.tab;
  const r = x + G.fw;
  const top = G.oy;
  const h1 = top + G.flap;
  const h2 = h1 + G.fh;
  const bot = h2 + G.fh;
  const tabTop = h1 + G.gap;
  const tabBot = h2 - G.gap;
  const outerL = G.ox;
  const outerR = r + G.tab;
  const d = [
    `M ${x + G.tip} ${top}`, `L ${r - G.tip} ${top}`, `L ${r} ${h1}`,
    `L ${outerR} ${tabTop}`, `L ${outerR} ${tabBot}`, `L ${r} ${h2}`,
    `L ${r} ${bot}`, `L ${x} ${bot}`, `L ${x} ${h2}`,
    `L ${outerL} ${tabBot}`, `L ${outerL} ${tabTop}`, `L ${x} ${h1}`, "Z",
  ].join(" ");
  const tick = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c4c4c4" stroke-width="0.25"/>`;
  return `<svg class="cuts" viewBox="0 0 210 297">
    <path d="${d}" fill="none" stroke="#6a6a6a" stroke-width="0.22" stroke-linejoin="round"/>
    ${tick(outerL + 1.5, h1, x - 2, h1)}${tick(r + 2, h1, outerR - 1.5, h1)}
    ${tick(outerL + 1.5, h2, x - 2, h2)}${tick(r + 2, h2, outerR - 1.5, h2)}
  </svg>`;
}

function oneSheet(index, total, blank) {
  const x = G.ox + G.tab;
  const h1 = G.oy + G.flap;
  const h2 = h1 + G.fh;
  const tabTop = h1 + G.gap;
  const tabH = G.fh - G.gap * 2;
  const mark = state.mark ? `<div class="tabmark">Mazha0309</div>` : `<div class="glue">胶</div>`;
  const tip = (G.tip / G.fw) * 100;
  const page = total > 1 ? ` 第 ${index + 1} 张，共 ${total} 张。` : "";
  const note = blank ? `手写，地址留空。${page}` : `舌页和背面在这张纸上是倒的，折过去就正了。${page}`;
  return `<div class="sheet">
    <p class="sheet-note">${note}</p>
    <div class="abs" style="left:${x}mm;top:${G.oy}mm;width:${G.fw}mm;height:${G.flap}mm;clip-path:polygon(${tip}% 0, ${100 - tip}% 0, 100% 100%, 0 100%)">
      ${flapStripes("pair" + index)}<div class="spin">${flapDesign(false)}</div>
    </div>
    <div class="abs" style="left:${x}mm;top:${h1}mm;width:${G.fw}mm;height:${G.fh}mm">${frontHTML(false, false)}</div>
    <div class="abs" style="left:${x}mm;top:${h2}mm;width:${G.fw}mm;height:${G.fh}mm"><div class="spin">${backDesign(false, "nobot")}</div></div>
    <div class="abs tab" style="left:${G.ox}mm;top:${tabTop}mm;width:${G.tab}mm;height:${tabH}mm">${mark}</div>
    <div class="abs tab" style="left:${x + G.fw}mm;top:${tabTop}mm;width:${G.tab}mm;height:${tabH}mm">${mark}</div>
    ${cutSVG()}
  </div>`;
}

function withJob(job, fn) {
  const prev = {
    toName: state.toName, toAddr: state.toAddr, toPhone: state.toPhone,
    toPost: state.toPost, toCountry: state.toCountry,
    fromName: state.fromName, fromAddr: state.fromAddr, fromPhone: state.fromPhone, fromPost: state.fromPost,
  };
  const person = job.person || {};
  state.toName = person.name || "";
  state.toAddr = person.addr || "";
  state.toPhone = person.phone || "";
  state.toPost = person.post || "";
  state.toCountry = person.country || "";
  if (job.blank) {
    state.fromName = "";
    state.fromAddr = "";
    state.fromPhone = "";
    state.fromPost = "";
  }
  try { return fn(); }
  finally { Object.assign(state, prev); }
}

function renderPrint() {
  const jobs = printJobs();
  $("print-root").innerHTML = jobs.map((job, i) => withJob(job, () => oneSheet(i, jobs.length, job.blank))).join("");
}

function renderEdit() {
  const face = state.editFace;
  const { w, h } = faceBox(face);
  let inner = "";
  if (face === "front") inner = frontHTML(true, true);
  else if (face === "flap") inner = flapStripes("eair", true) + flapDesign(true);
  else inner = backDesign(true, "notop");
  const tip = (G.tip / G.fw) * 100;
  const clip = face === "flap" ? `clip-path:polygon(0 0,100% 0,${100 - tip}% 100%,${tip}% 100%)` : "";
  $("edit-sheet").innerHTML = `<div class="eface" style="width:${w}mm;height:${h}mm;${clip}">${inner}</div>`;
  document.querySelectorAll("#face-tabs button").forEach((b) => {
    b.classList.toggle("on", b.dataset.face === face);
  });
  fitEdit();
  syncPieceTools();
}

function render() {
  renderFaces();
  renderPrint();
  renderEdit();
  if (state.view === "sheet") fitSheet();
}

function applyRig() {
  const stage = $("stage");
  stage.style.setProperty("--rx", state.rx + "deg");
  stage.style.setProperty("--ry", state.ry + "deg");
  const v = Number($("flap").value);
  stage.style.setProperty("--flap", (8 + v * 1.64) + "deg");
}

function fit() {
  const stage = $("stage");
  if (stage.offsetParent === null) return;
  const ppm = 96 / 25.4;
  const scale = Math.min((stage.clientWidth - 36) / (200 * ppm), (stage.clientHeight - 48) / (200 * ppm));
  stage.style.setProperty("--fit", String(Math.max(0.28, Math.min(scale, 1.15))));
}

function fitSheet() {
  const slot = $("sheet-slot");
  const root = $("print-root");
  if (state.view !== "sheet") return;
  const scale = Math.min(1, (slot.clientWidth - 24) / (210 * 96 / 25.4));
  root.style.setProperty("--sheet-scale", String(scale));
  const n = Math.max(1, root.querySelectorAll(".sheet").length);
  slot.style.minHeight = (297 * 96 / 25.4 * scale * n + 16 * (n - 1) + 24) + "px";
}

function fitEdit() {
  const scroll = $("edit-scroll");
  const sheet = $("edit-sheet");
  const face = sheet.querySelector(".eface");
  if (!face || scroll.clientWidth < 40) return;
  const ppm = 96 / 25.4;
  const { w, h } = faceBox(state.editFace);
  const scale = Math.min((scroll.clientWidth - 36) / (w * ppm), (scroll.clientHeight - 28) / (h * ppm));
  const s = Math.max(0.35, Math.min(scale, 1.35));
  sheet.style.width = (w * ppm) + "px";
  sheet.style.height = (h * ppm) + "px";
  sheet.style.transform = `scale(${s})`;
  sheet.style.margin = `${(h * ppm * (s - 1)) / 2}px ${(w * ppm * (s - 1)) / 2}px`;
}

function placeView() {
  const root = $("print-root");
  const slot = $("sheet-slot");
  const stage = $("stage");
  const bar = document.querySelector(".stage-bar");
  const edit = $("edit-stage");
  if (state.view === "3d") state.view = "edit";
  stage.hidden = true;
  bar.hidden = true;
  edit.hidden = state.view !== "edit";
  slot.hidden = state.view !== "sheet";
  document.querySelectorAll("#views button").forEach((b) => {
    b.classList.toggle("on", b.dataset.view === state.view);
  });
  if (state.view === "sheet") {
    slot.appendChild(root);
    root.classList.add("onscreen");
    fitSheet();
  } else {
    root.classList.remove("onscreen");
    document.body.appendChild(root);
    if (state.view === "edit") fitEdit();
    else fit();
  }
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

function blankCount() {
  const n = $("blank-count") ? Number($("blank-count").value) : book.blanks;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(50, Math.floor(n));
}

function printJobs() {
  const jobs = book.people.filter((p) => p.print).map((p) => ({ person: p, blank: false }));
  const empty = { name: "", addr: "", phone: "", post: "", country: "" };
  for (let i = 0; i < blankCount(); i++) jobs.push({ person: empty, blank: true });
  if (!jobs.length) {
    const cur = openPerson();
    jobs.push(cur ? { person: cur, blank: false } : { person: empty, blank: true });
  }
  return jobs;
}

function printCount() {
  const marked = book.people.filter((p) => p.print).length;
  const blanks = blankCount();
  return marked + blanks || 1;
}

function personLine(p) {
  return [p.phone, String(p.addr || "").split(/\r?\n/).find((x) => x.trim()), p.country].filter(Boolean).join(" · ");
}

function updatePrintLabel() {
  const n = printCount();
  const marked = book.people.filter((p) => p.print).length;
  $("do-print").textContent = n > 1 ? `打印 ${n} 张` : "打印";
  const sum = $("recv-sum");
  if (!sum) return;
  if (!book.people.length) sum.textContent = "还没有";
  else if (!marked) sum.textContent = `存了 ${book.people.length} 人，这次印正在看的这位`;
  else sum.textContent = `存了 ${book.people.length} 人，这次印 ${marked} 人`;
}

function paintPhoneLabels() {
  const mark = state.kind === "domestic" ? "电话" : "Tel";
  $("from-phone-label").textContent = mark;
  $("to-phone-label").textContent = mark;
}

function paintSenderSum() {
  const me = currentMe();
  const which = state.kind === "domestic" ? "国内" : "国际";
  $("sender-title").textContent = `寄件人 · ${which}`;
  const bits = [me.name, me.phone, String(me.addr || "").split(/\r?\n/).find((x) => x.trim())].filter(Boolean);
  $("sender-sum").textContent = bits.length ? bits.join(" · ") : "和另一份分开记";
}

function fillSender() {
  const me = currentMe();
  $("from-name").value = me.name;
  $("from-phone").value = me.phone;
  $("from-addr").value = me.addr;
  $("from-post").value = me.post;
  paintPhoneLabels();
  paintSenderSum();
  applyBookToState();
}

function fillPersonForm(p) {
  $("to-name").value = p ? p.name : "";
  $("to-phone").value = p ? p.phone : "";
  $("to-addr").value = p ? p.addr : "";
  $("to-country").value = p ? p.country : "";
  $("to-post").value = p ? p.post : "";
}

const TICK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8.3 6.4 11.4 12.8 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function paintPeople(fill) {
  const box = $("people");
  const edit = $("person-edit");
  const typing = fill !== true && document.activeElement && document.activeElement.closest && document.activeElement.closest("#person-edit") && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (typing) {
    const p = openPerson();
    const who = p && box.querySelector(`.person[data-id="${CSS.escape(p.id)}"] .who`);
    if (who) {
      who.querySelector("b").textContent = p.name || "未命名";
      who.querySelector("small").textContent = personLine(p) || "补上地址";
    }
    updatePrintLabel();
    return;
  }
  $("editor-hold").appendChild(edit);
  if (!book.people.length) {
    box.innerHTML = `<p class="empty">还没有收件人</p>`;
    edit.hidden = true;
    updatePrintLabel();
    return;
  }
  edit.hidden = false;
  box.innerHTML = book.people.map((p) => `<div class="person${p.id === book.open ? " on" : ""}" data-id="${esc(p.id)}">
      <div class="row">
        <button type="button" class="tick${p.print ? " on" : ""}" data-act="print" aria-pressed="${p.print ? "true" : "false"}" aria-label="这次打印">${TICK}</button>
        <button type="button" class="who" data-act="open"><b>${esc(p.name || "未命名")}</b><small>${esc(personLine(p) || "补上地址")}</small></button>
      </div>
    </div>`).join("");
  const row = box.querySelector(".person.on");
  if (row) row.appendChild(edit);
  if (fill !== false) fillPersonForm(openPerson());
  updatePrintLabel();
}

function onSender() {
  const me = currentMe();
  me.name = $("from-name").value;
  me.phone = $("from-phone").value.trim();
  me.addr = $("from-addr").value;
  me.post = $("from-post").value.replace(/\D/g, "").slice(0, 6);
  applyBookToState();
  saveBook();
  paintSenderSum();
  render();
}

function onPerson() {
  const p = openPerson();
  if (!p) return;
  p.name = $("to-name").value;
  p.phone = $("to-phone").value.trim();
  p.addr = $("to-addr").value;
  p.country = $("to-country").value;
  p.post = $("to-post").value.replace(/\D/g, "").slice(0, 6);
  applyBookToState();
  saveBook();
  paintPeople(false);
  render();
}

function addPerson() {
  const p = blankPerson();
  book.people.push(p);
  book.open = p.id;
  applyBookToState();
  saveBook();
  paintPeople(true);
  render();
  $("to-name").focus();
}

function syncForm() {
  document.querySelectorAll("#form [name]").forEach((el) => {
    if (el.type === "radio") el.checked = el.value === state.kind;
    else if (el.type === "checkbox") el.checked = !!state[el.name];
    else if (el.name in state) el.value = state[el.name] ?? "";
  });
}

function readForm(el) {
  if (!el.name || !(el.name in state)) return;
  const kindChanged = el.name === "kind" && el.value !== state.kind;
  state[el.name] = el.type === "checkbox" ? el.checked : el.value;
  save();
  if (kindChanged) fillSender();
  render();
}

function syncPieceTools() {
  const item = state.items.find((it) => it.id === state.selected);
  const box = $("piece-tools");
  if (!item) { box.hidden = true; return; }
  box.hidden = false;
  const text = item.type === "text";
  $("piece-text-wrap").hidden = !text;
  $("piece-size-wrap").hidden = !text;
  if (text) {
    const area = $("piece-text");
    if (document.activeElement !== area) area.value = item.text || "";
    $("piece-size").value = String(item.size || 3.4);
  }
}

function addText() {
  const face = state.editFace || "front";
  const box = faceBox(face);
  const item = {
    id: uid(), face, type: "text", text: "文字",
    x: Math.max(4, (box.w - 40) / 2),
    y: Math.max(2, (box.h - 8) / 2),
    w: 40, size: 3.6,
  };
  state.items.push(item);
  state.selected = item.id;
  state.view = "edit";
  save();
  render();
  placeView();
  $("piece-text").focus();
  $("piece-text").select();
}

function addImage(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result;
    if (!String(src).startsWith("data:image/")) return;
    const img = new Image();
    img.onload = () => {
      const face = state.editFace || "front";
      const box = faceBox(face);
      let w = Math.min(42, box.w * 0.45);
      let h = w * (img.height / img.width || 1);
      if (h > box.h * 0.55) {
        h = box.h * 0.55;
        w = h * (img.width / img.height || 1);
      }
      const item = {
        id: uid(), face, type: "image", src,
        x: Math.max(2, (box.w - w) / 2),
        y: Math.max(2, (box.h - h) / 2),
        w, h,
      };
      state.items.push(item);
      state.selected = item.id;
      state.view = "edit";
      save();
      render();
      placeView();
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

$("form").addEventListener("input", (e) => readForm(e.target));
$("form").addEventListener("submit", (e) => e.preventDefault());
$("panel-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  document.querySelectorAll("#panel-tabs button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
});
$("sender-toggle").addEventListener("click", () => {
  const card = $("sender-card");
  const open = card.classList.toggle("open");
  $("sender-toggle").setAttribute("aria-expanded", open ? "true" : "false");
});
$("env-pick").addEventListener("change", () => openEnvelope($("env-pick").value));
$("env-new").addEventListener("click", newEnvelope);
$("env-copy").addEventListener("click", copyEnvelope);
$("env-del").addEventListener("click", deleteEnvelope);
$("env-name").addEventListener("input", () => {
  const env = currentEnvelope();
  if (!env) return;
  const typed = $("env-name").value.replace(/\s+/g, " ").trim();
  env.name = (typed || defaultName(env.builtin)).slice(0, 40);
  const opt = [...$("env-pick").options].find((o) => o.value === env.id);
  if (opt) opt.textContent = env.name;
  writeStore();
});
$("env-name").addEventListener("blur", () => {
  const env = currentEnvelope();
  if (!env) return;
  if (!$("env-name").value.trim()) {
    env.name = defaultName(env.builtin);
    $("env-name").value = env.name;
    const opt = [...$("env-pick").options].find((o) => o.value === env.id);
    if (opt) opt.textContent = env.name;
    writeStore();
  }
});

$("add-text").addEventListener("click", addText);
$("add-img-btn").addEventListener("click", () => $("add-img").click());
$("add-img").addEventListener("change", () => {
  const file = $("add-img").files && $("add-img").files[0];
  $("add-img").value = "";
  if (file) addImage(file);
});

$("piece-text").addEventListener("input", () => {
  const item = state.items.find((it) => it.id === state.selected);
  if (!item || item.type !== "text") return;
  item.text = $("piece-text").value;
  const node = document.querySelector(`#edit-sheet .piece[data-id="${item.id}"] .pt`);
  if (node) node.textContent = item.text;
  save();
  renderFaces();
  renderPrint();
});

$("piece-size").addEventListener("input", () => {
  const item = state.items.find((it) => it.id === state.selected);
  if (!item || item.type !== "text") return;
  item.size = Number($("piece-size").value);
  const node = document.querySelector(`#edit-sheet .piece[data-id="${item.id}"]`);
  if (node) node.style.fontSize = item.size + "mm";
  save();
  renderFaces();
  renderPrint();
});

$("piece-del").addEventListener("click", () => {
  if (!state.selected) return;
  state.items = state.items.filter((it) => it.id !== state.selected);
  state.selected = null;
  save();
  render();
});

["from-name", "from-phone", "from-addr", "from-post"].forEach((id) => {
  $(id).addEventListener("input", onSender);
});
["to-name", "to-phone", "to-addr", "to-country", "to-post"].forEach((id) => {
  $(id).addEventListener("input", onPerson);
});
$("person-add").addEventListener("click", addPerson);
function onBlanks() {
  book.blanks = blankCount();
  saveBook();
  updatePrintLabel();
  render();
}
$("blank-count").addEventListener("input", onBlanks);
$("blank-count").addEventListener("blur", () => {
  $("blank-count").value = String(blankCount());
  onBlanks();
});
$("person-all").addEventListener("click", () => {
  book.people.forEach((p) => { p.print = true; });
  saveBook();
  paintPeople(false);
  render();
});
$("person-del").addEventListener("click", () => {
  const cur = openPerson();
  if (!cur) return;
  if (!confirm(`删除收件人「${cur.name || "未命名"}」？`)) return;
  book.people = book.people.filter((p) => p.id !== cur.id);
  book.open = book.people[0] ? book.people[0].id : "";
  applyBookToState();
  saveBook();
  paintPeople(true);
  render();
});
$("people").addEventListener("click", (e) => {
  const row = e.target.closest(".person");
  if (!row) return;
  const id = row.dataset.id;
  const act = e.target.closest("[data-act]");
  if (act && act.dataset.act === "print") {
    const p = book.people.find((x) => x.id === id);
    if (!p) return;
    p.print = !p.print;
    saveBook();
    paintPeople(false);
    render();
    return;
  }
  if (id === book.open) return;
  book.open = id;
  applyBookToState();
  saveBook();
  paintPeople(true);
  render();
});

$("theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("envelope-theme", next);
});

$("views").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.view = b.dataset.view;
  placeView();
});

$("face-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.editFace = b.dataset.face;
  state.selected = null;
  renderEdit();
});

function preparePrint() {
  const root = $("print-root");
  root.classList.remove("onscreen");
  document.body.appendChild(root);
}
$("do-print").addEventListener("click", async () => {
  preparePrint();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  window.print();
});
window.addEventListener("beforeprint", preparePrint);
window.addEventListener("afterprint", placeView);

$("flap").addEventListener("input", applyRig);
$("see-front").addEventListener("click", () => { state.rx = -14; state.ry = -28; applyRig(); });
$("see-back").addEventListener("click", () => { state.rx = -12; state.ry = 162; applyRig(); });

const stage = $("stage");
let spinDrag = null;
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest("input,button,a")) return;
  spinDrag = { x: e.clientX, y: e.clientY, rx: state.rx, ry: state.ry };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!spinDrag) return;
  state.ry = spinDrag.ry + (e.clientX - spinDrag.x) * 0.4;
  state.rx = Math.max(-40, Math.min(40, spinDrag.rx + (e.clientY - spinDrag.y) * -0.25));
  applyRig();
});
stage.addEventListener("pointerup", () => { spinDrag = null; });
stage.addEventListener("pointercancel", () => { spinDrag = null; });

const editStage = $("edit-stage");
let moveDrag = null;
editStage.addEventListener("pointerdown", (e) => {
  const piece = e.target.closest(".piece");
  if (!piece) {
    if (state.selected) {
      state.selected = null;
      syncPieceTools();
      renderEdit();
    }
    return;
  }
  const item = state.items.find((it) => it.id === piece.dataset.id);
  if (!item) return;
  state.selected = item.id;
  syncPieceTools();
  document.querySelectorAll("#edit-sheet .piece").forEach((el) => {
    el.classList.toggle("on", el.dataset.id === item.id);
  });
  const eface = $("edit-sheet").querySelector(".eface");
  const rect = eface.getBoundingClientRect();
  moveDrag = {
    id: item.id,
    mode: e.target.classList.contains("hz") ? "resize" : "move",
    px: e.clientX,
    py: e.clientY,
    x: item.x, y: item.y, w: item.w, h: item.h || 10, size: item.size || 3.4,
    ppm: rect.width / faceBox(item.face).w,
  };
  piece.setPointerCapture(e.pointerId);
  e.preventDefault();
});
editStage.addEventListener("pointermove", (e) => {
  if (!moveDrag) return;
  const item = state.items.find((it) => it.id === moveDrag.id);
  const piece = $("edit-sheet").querySelector(`.piece[data-id="${moveDrag.id}"]`);
  if (!item || !piece) return;
  const dx = (e.clientX - moveDrag.px) / moveDrag.ppm;
  const dy = (e.clientY - moveDrag.py) / moveDrag.ppm;
  const box = faceBox(item.face);
  if (moveDrag.mode === "move") {
    item.x = clamp(moveDrag.x + dx, -6, box.w - 10);
    item.y = clamp(moveDrag.y + dy, -4, box.h - 4);
    piece.style.left = item.x + "mm";
    piece.style.top = item.y + "mm";
  } else if (item.type === "image") {
    const aspect = moveDrag.w / moveDrag.h;
    item.w = clamp(moveDrag.w + dx, 8, box.w);
    item.h = clamp(item.w / aspect, 6, box.h);
    piece.style.width = item.w + "mm";
    piece.style.height = item.h + "mm";
  } else {
    item.w = clamp(moveDrag.w + dx, 12, box.w);
    item.size = clamp(moveDrag.size * (item.w / moveDrag.w), 1.8, 12);
    piece.style.width = item.w + "mm";
    piece.style.fontSize = item.size + "mm";
    $("piece-size").value = String(item.size);
  }
});
function endMove() {
  if (!moveDrag) return;
  moveDrag = null;
  save();
  renderFaces();
  renderPrint();
}
editStage.addEventListener("pointerup", endMove);
editStage.addEventListener("pointercancel", endMove);

window.addEventListener("keydown", (e) => {
  if (e.key !== "Delete" && e.key !== "Backspace") return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || !state.selected) return;
  e.preventDefault();
  state.items = state.items.filter((it) => it.id !== state.selected);
  state.selected = null;
  save();
  render();
});

window.addEventListener("resize", () => { fit(); fitSheet(); fitEdit(); });

const savedTheme = localStorage.getItem("envelope-theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
load();
loadBook();
syncForm();
fillSender();
$("blank-count").value = String(book.blanks || 0);
{
  const me = currentMe();
  if (!me.name && !me.addr && !me.phone) {
    $("sender-card").classList.add("open");
    $("sender-toggle").setAttribute("aria-expanded", "true");
  }
}
paintLibrary();
paintPeople(true);
render();
applyRig();
placeView();
fit();
