function lockup() {
  if (!state.preset) return "";
  return `<div class="lockup"><img src="logo.svg" alt=""><span class="t">CRL <span>Callsign Roll Log</span></span></div>`;
}

function boxes(val, cls) {
  const d = String(val || "").replace(/\D/g, "").slice(0, 6);
  let h = `<div class="boxes${cls ? " " + cls : ""}">`;
  for (let i = 0; i < 6; i++) h += `<i>${d[i] ? esc(d[i]) : ""}</i>`;
  return h + "</div>";
}

function stripesSVG(pieces, axis) {
  const s = stripePaths(pieces, axis);
  return `<path fill="${STRIPE_RED}" d="${s.red}"/><path fill="${STRIPE_BLUE}" d="${s.blue}"/>`;
}

function airBand(edge) {
  if (state.kind !== "air") return "";
  const w = G.fw;
  const h = G.fh;
  const b = 3.6;
  const pieces = [];
  if (edge !== "notop") pieces.push([[0, 0], [w, 0], [w, b], [0, b]]);
  if (edge !== "nobot") pieces.push([[0, h - b], [w, h - b], [w, h], [0, h]]);
  pieces.push([[0, 0], [b, 0], [b, h], [0, h]], [[w - b, 0], [w, 0], [w, h], [w - b, h]]);
  return `<svg class="airband" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${stripesSVG(pieces, "u")}</svg>`;
}

function flapStripes(pointDown) {
  if (state.kind !== "air") return "";
  const w = G.fw;
  const h = G.flap;
  const t = G.tip;
  const b = 3.6;
  const outL = (y) => t * (1 - y / h);
  const inL = (y) => (pointDown
    ? b + t * (y / (h - b))
    : t + b - t * ((y - b) / (h - b)));
  const pieces = pointDown
    ? [
      [[outL(h - b), h - b], [w - outL(h - b), h - b], [w - t, h], [t, h]],
      [[0, 0], [b, 0], [inL(h - b), h - b], [outL(h - b), h - b]],
      [[w, 0], [w - b, 0], [w - inL(h - b), h - b], [w - outL(h - b), h - b]],
    ]
    : [
      [[outL(0), 0], [w - outL(0), 0], [w - outL(b), b], [outL(b), b]],
      [[outL(b), b], [inL(b), b], [inL(h), h], [outL(h), h]],
      [[w - outL(b), b], [w - inL(b), b], [w - inL(h), h], [w - outL(h), h]],
    ];
  const cream = pointDown
    ? `M0 0H${w}L${w - t} ${h}H${t}Z`
    : `M${t} 0H${w - t}L${w} ${h}H0Z`;
  return `<svg class="flap-stripes" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path fill="#fffdf8" d="${cream}"/>${stripesSVG(pieces, "x")}</svg>`;
}

function roleMark(word) {
  return `<span class="role">（${word}）</span>`;
}

function whoHTML(ghost) {
  const mark = state.kind === "domestic" && state.toName ? roleMark("收") : "";
  if (state.toName) return `<div class="who">${esc(state.toName)}${mark}</div>`;
  if (ghost) return `<div class="who ghost">收件人</div>`;
  return "";
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
  } else who = ghost ? `<div class="sender ghost">寄信人</div>` : `<div class="sender"></div>`;
  const code = String(state.fromPost || "").replace(/\D/g, "").slice(0, 6);
  const digits = code ? esc(code) : "";
  return `<div class="dom-from">${who}<div class="post-text">邮政编码<span class="post-gap">${digits}</span></div></div>`;
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
  $("d-flap-out").innerHTML = flapStripes(false) + flapDesign(false);
  document.body.classList.toggle("show-dom", state.kind === "domestic");
  document.body.classList.toggle("show-intl", state.kind !== "domestic");
}
