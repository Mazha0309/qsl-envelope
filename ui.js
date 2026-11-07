function renderEdit() {
  const face = state.editFace;
  const { w, h } = faceBox(face);
  let inner = "";
  if (face === "front") inner = frontHTML(true, true);
  else if (face === "flap") inner = flapStripes(true) + flapDesign(true);
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
  const ppm = 96 / 25.4;
  const n = Math.max(1, root.querySelectorAll(".sheet").length);
  const availW = Math.max(80, slot.clientWidth - 24);
  const availH = Math.max(80, slot.clientHeight - 24);
  const scaleW = availW / (210 * ppm);
  const scaleH = availH / (297 * ppm);
  const scale = Math.min(1, scaleW, n === 1 ? scaleH : scaleW);
  root.style.setProperty("--sheet-scale", String(scale));
  slot.style.minHeight = "";
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
  $("face-tabs").hidden = state.view !== "edit";
  $("edit-hint").textContent = state.view === "sheet"
    ? "缩放 100%，边距选「无」。每张纸一只。"
    : "拖动放置，圆点改大小";
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
