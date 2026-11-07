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
  $("env-now-name").textContent = env.name;
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
    $("env-now-name").textContent = env.name;
    writeStore();
  }
});
$("env-now").addEventListener("click", () => {
  document.querySelector('#panel-tabs button[data-tab="make"]').click();
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
