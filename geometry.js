const G = {
  ox: 6, oy: 11, tab: 15, fw: 168, fh: 121, flap: 34,
  tip: 29, gap: 5,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const STRIPE = 4.6;
const STRIPE_RED = "#c8102e";
const STRIPE_BLUE = "#1d4e89";

// 裁掉半平面外侧，poly 保持凸多边形
function clipHalf(poly, axis, bound, keep) {
  const val = axis === "x" ? (p) => p[0] : (p) => p[0] - p[1];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const va = val(a);
    const vb = val(b);
    const ina = keep === "le" ? va <= bound + 1e-9 : va >= bound - 1e-9;
    const inb = keep === "le" ? vb <= bound + 1e-9 : vb >= bound - 1e-9;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (bound - va) / (vb - va);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function polyPath(poly) {
  return poly.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") + "Z";
}

// 把凸多边形拼成的环形区域裁成红蓝竖条，axis 为 "x" 时竖条竖直，为 "u" 时倾斜 -45°
function stripePaths(pieces, axis) {
  const eps = 0.02;
  const period = axis === "x" ? STRIPE : STRIPE * Math.SQRT2;
  const half = period / 2;
  const val = axis === "x" ? (p) => p[0] : (p) => p[0] - p[1];
  let lo = Infinity;
  let hi = -Infinity;
  pieces.forEach((poly) => poly.forEach((p) => {
    const v = val(p);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }));
  const red = [];
  const blue = [];
  const k0 = Math.floor(lo / period) - 1;
  const k1 = Math.ceil(hi / period) + 1;
  for (let k = k0; k <= k1; k++) {
    for (let j = 0; j < 2; j++) {
      const a = k * period + j * half;
      const color = j === 0 ? red : blue;
      pieces.forEach((poly) => {
        let p = clipHalf(poly, axis, a - eps, "ge");
        p = clipHalf(p, axis, a + half + eps, "le");
        if (p.length >= 3) color.push(polyPath(p));
      });
    }
  }
  return { red: red.join(""), blue: blue.join("") };
}

function faceBox(face) {
  return face === "flap" ? { w: G.fw, h: G.flap } : { w: G.fw, h: G.fh };
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
