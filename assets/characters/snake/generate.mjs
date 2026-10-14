#!/usr/bin/env node
/** DeskPet Snake asset generator (PRD §13).
 *
 * Menggambar pixel-art ular 32x32 (diskala 4x -> 128px/frame) secara prosedural,
 * lalu menulis strips PNG per animasi + preview + snake.svg (vector master).
 *
 * Body memakai HEX TOKEN YANG SAMA dengan basis kucing (LAVENDER_SOURCE di
 * palettes.ts) sehingga sistem recolor/palette yang sudah ada langsung jalan
 * untuk ular tanpa perubahan kode recolor.
 *
 * Preview ASCII:  node generate.mjs --preview
 * Tulis file:     node generate.mjs --write <outDir>
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

// ---- token warna (sinkron dengan LAVENDER_SOURCE + warna terkunci kucing) ----
const C = {
  outline: "#2B2353",
  main: "#8E82EB",
  light: "#C3BBFF",
  shadow: "#5C50B8",
  belly: "#EBE6FF",
  eyeDark: "#22223A",
  shine: "#FFFFFF",
  tongue: "#D95C69",
  blush: "#EB7D96",
  amber: "#E9A23B",
};
const W = 32, H = 32;

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// ---- grid ----
function newGrid() { return Array.from({ length: H }, () => new Array(W).fill(null)); }
function px(g, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  g[y][x] = c;
}
function rect(g, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, c);
}
/** blob ber-outline: kotak outline + isi inset 1px */
function blob(g, x, y, w, h, fill, oc = C.outline) {
  rect(g, x, y, w, h, oc);
  rect(g, x + 1, y + 1, w - 2, h - 2, fill);
}
function bitmap(g, ox, oy, rows, c) {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => { if (ch === "#") px(g, ox + i, oy + j, c); });
  });
}

// ---- ikon kecil ----
const ICON = {
  heart: [".##.##", "#######", "#######", ".#####.", "..###..", "...#..."],
  heartSm: [".#.#.", "#####", "#####", ".###.", "..#.."],
  z: ["#####", "...#.", "..#..", ".#...", "#####"],
  excl: [".#.", ".#.", ".#.", "...", ".#."],
  note: ["..###", "..#.#", "..#..", ".##..", ".##..", "....."],
  clock: [".#####.", "#.....#", "#..#..#", "#..##.#", "#.....#", ".#####."],
};

// ---- pose dasar ular ----
// params: {dx, dy, headDX, headDY, neckH, coilW, eye, tongue, mouth, squash}
// eye: "open" | "blink" | "happy" | "closed" | "wide"
function drawSnake(g, p = {}) {
  const dx = p.dx || 0, dy = p.dy || 0;
  const squash = p.squash || 0; // +melebar/-memendek
  const coilW = 21 + squash * 2, coilH = 8 - squash;
  const cx = 5 - squash + dx, cy = 21 + dy + (squash > 0 ? 1 : 0);

  // ekor kiri (melengkung ke atas)
  const tailLift = p.tailLift || 0;
  blob(g, cx - 3, cy + 1 - tailLift, 4, 5, C.main);
  rect(g, cx - 2, cy + 2 - tailLift, 2, 2, C.light);

  // gulungan badan
  blob(g, cx, cy, coilW, coilH, C.main);
  rect(g, cx + 2, cy + 1, coilW - 4, 1, C.light);          // highlight atas
  rect(g, cx + 1, cy + coilH - 2, coilW - 2, 1, C.shadow); // bayangan bawah
  rect(g, cx + 8, cy + 2, 6, Math.max(2, coilH - 4), C.belly); // perut depan
  // totol punggung
  for (let i = 0; i < 3; i++) px(g, cx + 4 + i * 5, cy + 1, C.shadow);

  // leher + kepala (kanan)
  const neckH = p.neckH ?? 5;
  const hx = cx + coilW - 9 + (p.headDX || 0);
  const hy = cy - neckH - 6 + (p.headDY || 0);
  blob(g, hx + 2, hy + 6, 5, neckH + 1, C.main);            // leher
  blob(g, hx, hy, 10, 8, C.main);                          // kepala
  rect(g, hx + 1, hy + 1, 8, 2, C.light);                  // highlight kepala
  rect(g, hx + 2, hy + 6, 6, 1, C.belly);                  // dagu/perut
  px(g, hx + 1, hy + 4, C.blush); px(g, hx + 2, hy + 4, C.blush); // pipi

  // mata (samping, besar)
  const ex = hx + 3, ey = hy + 2;
  const eye = p.eye || "open";
  if (eye === "open") {
    rect(g, ex, ey, 3, 4, C.eyeDark);
    px(g, ex, ey, C.shine); px(g, ex + 1, ey + 1, C.shine);
  } else if (eye === "wide") {
    rect(g, ex - 1, ey - 1, 4, 5, C.eyeDark);
    px(g, ex - 1, ey - 1, C.shine); px(g, ex, ey, C.shine);
  } else if (eye === "blink" || eye === "closed") {
    rect(g, ex, ey + 1, 3, 1, C.eyeDark);
  } else if (eye === "happy") {
    px(g, ex, ey, C.eyeDark); px(g, ex + 2, ey, C.eyeDark);
    rect(g, ex, ey + 1, 3, 1, C.eyeDark);
    px(g, ex, ey, C.shine);
  }

  // mulut (speak)
  if (p.mouth === "open") rect(g, hx + 7, hy + 5, 3, 2, C.eyeDark);
  else if (p.mouth === "half") rect(g, hx + 7, hy + 6, 3, 1, C.eyeDark);

  // lidah dari moncong kanan
  if (p.tongue) {
    const tx = hx + 10, ty = hy + 5;
    rect(g, tx, ty, 2, 1, C.tongue);
    if (p.tongue === "long") {
      rect(g, tx + 2, ty, 2, 1, C.tongue);
      px(g, tx + 4, ty - 1, C.tongue); px(g, tx + 4, ty + 1, C.tongue);
    } else {
      px(g, tx + 2, ty, C.tongue);
    }
  }
  return { hx, hy };
}

// LIFT (grid rows; 1 row = 4 source px): body digeser ke atas agar gap
// bubble-atas vs badge-bawah seimbang (idle T=40/B=13 -> ~T32/B21).
// Ikon digambar TERPISAH setelah body sehingga posisi ikon (margin atas)
// tidak ikut bergeser.
const LIFT = 2;
function framesIdle() {
  return [
    { headDY: 0 },
    { headDY: 0, tongue: true },
    { headDY: -1, eye: "blink" },
    { headDY: 0 },
  ];
}
function framesWalk() {
  // slither: gulungan bergelombang kiri-kanan, kepala mengimbangi
  const dxs = [0, 1, 1, 0, -1, -1];
  return dxs.map((d, i) => ({
    dx: d, headDX: -d, headDY: i % 2 === 0 ? 0 : -1,
    tailLift: i % 3 === 0 ? 1 : 0,
    tongue: i === 2 || i === 5 ? true : false,
  }));
}
function framesDragged() {
  return [
    { dy: -1, neckH: 8, headDY: -2, eye: "wide", tongue: "long", dx: -1 },
    { dy: -1, neckH: 8, headDY: -2, eye: "wide", tongue: "long", dx: 1 },
  ];
}
function framesJump() {
  return [
    { squash: 1, headDY: 1 },                       // jongkok
    { dy: -2, neckH: 7, headDY: -1 },               // naik
    { dy: -2, neckH: 8, headDY: -2, tongue: "long", eye: "wide" }, // puncak (dibatasi agar muat setelah LIFT)
    { squash: 1, headDY: 1, eye: "blink" },         // mendarat
  ];
}
function framesSleep() {
  const zs = [
    [{ x: 5, y: 8, k: "z" }],
    [{ x: 5, y: 8, k: "z" }, { x: 9, y: 4, k: "z" }],
    [{ x: 9, y: 4, k: "z" }, { x: 13, y: 1, k: "z" }],
    [{ x: 5, y: 8, k: "z" }, { x: 13, y: 1, k: "z" }],
  ];
  return [0, 1, 2, 3].map((i) => ({
    eye: "closed", headDX: -1, headDY: 1, squash: 1, dy: i % 2,
    icons: zs[i],
  }));
}
function framesReact() {
  const hearts = [[], [{ x: 4, y: 9, k: "heartSm" }], [{ x: 4, y: 9, k: "heartSm" }, { x: 10, y: 5, k: "heart" }], [{ x: 10, y: 5, k: "heart" }]];
  const bounce = [{ squash: 1 }, { dy: -2 }, { dy: -3, neckH: 7 }, { dy: -1 }];
  return bounce.map((b, i) => ({ ...b, eye: "happy", tongue: i === 2 ? true : false, icons: hearts[i] }));
}
function framesSpeak() {
  const mouths = ["open", "half", "open", "half"];
  return mouths.map((m, i) => ({
    mouth: m, headDY: i % 2 === 0 ? 0 : -1,
    icons: i < 2 ? [{ x: 3, y: 8 - i, k: "note" }] : [],
  }));
}
function framesAttention() {
  return [0, 1, 2, 3].map((i) => ({
    neckH: 8, headDY: -2, eye: "wide", dy: i % 2 === 0 ? 0 : -1,
    icons: [{ x: 23, y: 0 + (i % 2), k: "excl" }],
  }));
}
function framesReminder() {
  return [0, 1, 2, 3].map((i) => ({
    neckH: 7, headDY: -1, eye: i === 2 ? "blink" : "open", tongue: i === 1,
    icons: [{ x: 2, y: 6 + (i % 2), k: "clock" }],
  }));
}

const ANIMATIONS = {
  idle: framesIdle(), walk: framesWalk(), dragged: framesDragged(),
  jump: framesJump(), sleep: framesSleep(), react: framesReact(),
  speak: framesSpeak(), attention: framesAttention(), reminder: framesReminder(),
};

function renderFrame(params) {
  const g = newGrid();
  // Body diangkat LIFT; ikon tetap di koordinat asli (pakai margin atas frame).
  const { dx, dy, ...rest } = params;
  drawSnake(g, { ...rest, dx, dy: (dy || 0) - LIFT });
  for (const ic of params.icons || []) {
    const c = ic.k === "heart" || ic.k === "heartSm" ? C.blush
      : ic.k === "excl" ? C.amber : ic.k === "clock" ? C.amber : C.shine;
    bitmap(g, ic.x, ic.y, ICON[ic.k], c);
  }
  return g;
}

// ---- PNG encoder (RGBA, filter 0, zlib bawaan node) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba[y]).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// grid 32x32 -> RGBA 128x128 (skala 4x)
function gridToRgba(g, scale = 4) {
  const S = 32 * scale;
  const rows = [];
  for (let y = 0; y < S; y++) {
    const row = Buffer.alloc(S * 4);
    for (let x = 0; x < S; x++) {
      const c = g[Math.floor(y / scale)][Math.floor(x / scale)];
      const o = x * 4;
      if (!c) { row[o + 3] = 0; continue; }
      const [r, gg, b] = hexRgb(c);
      row[o] = r; row[o + 1] = gg; row[o + 2] = b; row[o + 3] = 255;
    }
    rows.push(row);
  }
  return { S, rows };
}
function stripPNG(frames) {
  const rendered = frames.map((f) => gridToRgba(renderFrame(f)));
  const S = rendered[0].S, n = rendered.length;
  const rows = [];
  for (let y = 0; y < S; y++) rows.push(Buffer.concat(rendered.map((r) => r.rows[y])));
  return encodePNG(S * n, S, rows);
}

// ---- SVG master (dari idle frame 0) ----
const CLASS_OF = {
  [C.outline]: "outline", [C.main]: "body-main", [C.light]: "body-light",
  [C.shadow]: "body-shadow", [C.belly]: "belly", [C.eyeDark]: "eye-dark",
  [C.shine]: "eye-shine", [C.tongue]: "tongue", [C.blush]: "blush", [C.amber]: "bell",
};
function buildSVG() {
  const g = renderFrame(ANIMATIONS.idle[0]);
  const byClass = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = g[y][x];
    if (!c) continue;
    const cls = CLASS_OF[c] || "body-main";
    (byClass[cls] = byClass[cls] || []).push(`    <rect x="${x * 4}" y="${y * 4}" width="4" height="4" class="${cls}" />`);
  }
  const css = [
    ".outline { fill: #2B2353; }", ".body-main { fill: #8E82EB; }",
    ".body-light { fill: #C3BBFF; }", ".body-shadow { fill: #5C50B8; }",
    ".belly { fill: #EBE6FF; }", ".eye-dark { fill: #22223A; }",
    ".eye-shine { fill: #FFFFFF; }", ".tongue { fill: #D95C69; }",
    ".blush { fill: #EB7D96; }", ".bell { fill: #E9A23B; }",
  ].join("\n      ");
  const groups = Object.entries(byClass)
    .map(([cls, rs]) => `  <g id="${cls}">\n${rs.join("\n")}\n  </g>`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" shape-rendering="crispEdges">\n  <!-- DeskPet Snake Vector Source (PRD §13), Lavender base palette -->\n  <defs>\n    <style>\n      ${css}\n    </style>\n  </defs>\n\n${groups}\n</svg>\n`;
}

// ---- ASCII preview ----
const GLYPH = { [C.outline]: "#", [C.main]: "o", [C.light]: "+", [C.shadow]: "=", [C.belly]: ".", [C.eyeDark]: "E", [C.shine]: "*", [C.tongue]: "Y", [C.blush]: "v", [C.amber]: "!" };
function ascii(g) {
  return g.map((row) => row.map((c) => (c ? GLYPH[c] || "?" : " ")).join("")).join("\n");
}

// ---- main ----
const args = process.argv.slice(2);
if (args.includes("--preview")) {
  for (const [name, frs] of Object.entries(ANIMATIONS)) {
    console.log(`=== ${name} (${frs.length} frames) ===`);
    frs.forEach((f, i) => console.log(`--- frame ${i} ---\n${ascii(renderFrame(f))}`));
  }
} else if (args.includes("--write")) {
  const out = args[args.indexOf("--write") + 1];
  if (!out) { console.error("usage: --write <outDir>"); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  for (const [name, frs] of Object.entries(ANIMATIONS)) {
    fs.writeFileSync(path.join(out, `${name}.png`), stripPNG(frs));
    console.log("wrote", `${name}.png`, `(${(frs.length * 128)}x128)`);
  }
  fs.writeFileSync(path.join(out, "preview.png"), encodePNG(128, 128, gridToRgba(renderFrame(ANIMATIONS.idle[0])).rows));
  fs.writeFileSync(path.join(out, "snake.svg"), buildSVG());
  console.log("wrote preview.png + snake.svg");
} else {
  console.error("usage: node generate.mjs --preview | --write <outDir>");
  process.exit(1);
}
