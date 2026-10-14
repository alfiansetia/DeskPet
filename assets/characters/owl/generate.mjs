#!/usr/bin/env node
/** DeskPet Owl asset generator (PRD §13).
 *
 * Burung hantu pixel-art 32x32 (diskala 4x -> 128px/frame): badan bulat,
 * jambul telinga (ear tufts), mata BESAR ganda dengan lingkaran terang,
 * paruh kecil oranye, sayap samping, kaki kecil.
 * Menulis strips PNG per animasi + preview + owl.svg (vector master).
 *
 * Body memakai HEX TOKEN YANG SAMA dengan basis kucing/ular/kodok
 * (LAVENDER_SOURCE) sehingga palette yang sudah ada langsung jalan tanpa
 * perubahan kode recolor. Paruh + kaki memakai amber terkunci (#E9A23B)
 * dan TIDAK memakai token recolor.
 *
 * Preview ASCII:  node generate.mjs --preview
 * Tulis file:     node generate.mjs --write <outDir>
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

// ---- token warna (sinkron dengan LAVENDER_SOURCE + warna terkunci) ----
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
  if (w <= 0 || h <= 0) return;
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

// ---- mata besar owl (6x7: cincin terang + pupil gelap) ----
function drawOwlEye(g, ex, ey, eye) {
  if (eye === "blink" || eye === "closed") {
    rect(g, ex, ey + 3, 6, 1, C.eyeDark);
    return;
  }
  if (eye === "happy") {
    // mata ^ ^ : dua arc kecil
    px(g, ex, ey + 2, C.eyeDark); px(g, ex + 1, ey + 1, C.eyeDark); px(g, ex + 2, ey, C.eyeDark);
    px(g, ex + 3, ey, C.eyeDark); px(g, ex + 4, ey + 1, C.eyeDark); px(g, ex + 5, ey + 2, C.eyeDark);
    rect(g, ex, ey + 3, 6, 1, C.eyeDark);
    return;
  }
  // open / wide: blob putih + pupil gelap + shine
  blob(g, ex, ey, 6, 7, C.shine);
  if (eye === "wide") {
    rect(g, ex + 1, ey + 1, 4, 5, C.eyeDark);
    rect(g, ex + 1, ey + 1, 2, 2, C.shine);
  } else {
    rect(g, ex + 2, ey + 2, 3, 3, C.eyeDark);
    px(g, ex + 2, ey + 2, C.shine); px(g, ex + 3, ey + 3, C.shine);
  }
}

// ---- pose dasar owl ----
// params: {dx, dy, headDX, headDY, squash, stretch, eye, beak, wing}
// beak: "closed" | "half" | "open" ; wing: "fold" | "mid" | "up" | "spread"
function drawOwl(g, p = {}) {
  const dx = p.dx || 0, dy = p.dy || 0;
  const sq = p.squash || 0, st = p.stretch || 0;
  const eye = p.eye || "open";
  const beak = p.beak || "closed";
  const wing = p.wing || "fold";
  const hdx = p.headDX || 0, hdy = p.headDY || 0;

  // badan bulat
  const bw = 18 + sq * 2, bh = 14 - sq + st;
  const bx = 7 - sq + dx, by = 13 + dy + (sq > 0 ? 1 : 0) - (st > 0 ? 1 : 0);

  // jambul telinga (ear tufts): dua segitiga di atas badan
  const tlx = bx + 1, trx = bx + bw - 5, ty = by - 3 - (st > 0 ? 1 : 0);
  for (const [tx] of [[tlx], [trx]]) {
    rect(g, tx, ty, 4, 4, C.outline);
    rect(g, tx + 1, ty + 1, 2, 2, C.main);
    px(g, tx + 1, ty, C.outline); px(g, tx + 2, ty, C.outline);
    px(g, tx + 1, ty - 1, C.outline);
    px(g, tx + 1, ty + 1, C.light);
  }

  // sayap samping (di belakang badan)
  if (wing === "spread") {
    // terbentang penuh ke samping
    blob(g, bx - 6, by + 3, 7, 5, C.main);
    blob(g, bx + bw - 1, by + 3, 7, 5, C.main);
    rect(g, bx - 5, by + 4, 2, 2, C.light);
    rect(g, bx + bw + 1, by + 4, 2, 2, C.light);
    rect(g, bx - 6, by + 6, 7, 1, C.shadow);
    rect(g, bx + bw - 1, by + 6, 7, 1, C.shadow);
  } else if (wing === "up") {
    // terangkat ke atas (kepakan)
    blob(g, bx - 3, by - 1, 4, 7, C.main);
    blob(g, bx + bw - 1, by - 1, 4, 7, C.main);
    rect(g, bx - 2, by, 1, 2, C.light);
    rect(g, bx + bw + 1, by, 1, 2, C.light);
  } else if (wing === "mid") {
    // posisi tengah kepakan
    blob(g, bx - 4, by + 1, 5, 6, C.main);
    blob(g, bx + bw - 1, by + 1, 5, 6, C.main);
    rect(g, bx - 3, by + 2, 1, 2, C.light);
    rect(g, bx + bw + 1, by + 2, 1, 2, C.light);
  } else {
    // fold: rapat di sisi badan
    blob(g, bx - 2, by + 4, 4, 7, C.main);
    blob(g, bx + bw - 2, by + 4, 4, 7, C.main);
    rect(g, bx - 1, by + 5, 1, 3, C.light);
    rect(g, bx + bw - 1, by + 5, 1, 3, C.light);
    rect(g, bx - 2, by + 9, 4, 1, C.shadow);
    rect(g, bx + bw - 2, by + 9, 4, 1, C.shadow);
  }

  // badan + shading + perut + garis bulu
  blob(g, bx, by, bw, bh, C.main);
  rect(g, bx + 2, by + 1, bw - 4, 1, C.light);
  rect(g, bx + 1, by + bh - 2, bw - 2, 1, C.shadow);
  rect(g, bx + 5, by + 8, bw - 10, bh - 9, C.belly);
  // scallop bulu di atas perut
  for (let i = 0; i < 3; i++) {
    px(g, bx + 6 + i * 4, by + 7, C.shadow);
    px(g, bx + 5 + i * 4, by + 8, C.shadow);
    px(g, bx + 7 + i * 4, by + 8, C.shadow);
  }

  // kaki kecil (amber terkunci) di bawah badan
  for (const fx of [bx + 4, bx + bw - 8]) {
    rect(g, fx, by + bh - 1, 4, 2, C.outline);
    rect(g, fx, by + bh - 1, 4, 1, C.amber);
    px(g, fx, by + bh, C.amber); px(g, fx + 3, by + bh, C.amber);
  }

  // mata BESAR ganda (ikut headDX/headDY untuk tilt/nod)
  const elx = bx + 2 + hdx, erx = bx + bw - 8 + hdx;
  const eyy = by + 1 + hdy;
  drawOwlEye(g, elx, eyy, eye);
  drawOwlEye(g, erx, eyy, eye);

  // paruh kecil (amber terkunci, bukan token recolor)
  const cx = bx + Math.floor(bw / 2) + hdx, bey = eyy + 7;
  if (beak === "open") {
    rect(g, cx - 2, bey, 5, 5, C.outline);
    rect(g, cx - 1, bey + 1, 3, 2, C.amber);
    rect(g, cx - 1, bey + 3, 3, 1, C.eyeDark);
  } else if (beak === "half") {
    rect(g, cx - 2, bey, 5, 4, C.outline);
    rect(g, cx - 1, bey + 1, 3, 2, C.amber);
    rect(g, cx - 1, bey + 2, 3, 1, C.eyeDark);
  } else {
    rect(g, cx - 2, bey, 5, 3, C.outline);
    rect(g, cx - 1, bey + 1, 3, 1, C.amber);
    px(g, cx, bey + 1, C.shine);
  }

  // blush pipi di bawah mata luar
  px(g, elx - 1, eyy + 7, C.blush); px(g, elx, eyy + 7, C.blush);
  px(g, erx + 5, eyy + 7, C.blush); px(g, erx + 6, eyy + 7, C.blush);
}

// ---- definisi animasi ----
// LIFT (grid rows; 1 row = 4 source px): body digeser ke atas agar gap
// bubble-atas vs badge-bawah seimbang (idle T=40/B=15 -> ~T32/B23).
// Ikon digambar TERPISAH setelah body sehingga posisi ikon (margin atas)
// tidak ikut bergeser.
const LIFT = 2;
function framesIdle() {
  return [
    {},
    { dy: 1 },
    { eye: "blink" },
    { headDX: 1 },
  ];
}
function framesWalk() {
  // kepak terbang / hop-fly: sayap naik-turun, badan melayang
  return [
    { squash: 1, dy: 1, wing: "fold" },
    { dy: -1, stretch: 1, wing: "up" },
    { dy: -3, stretch: 1, wing: "spread", eye: "wide" },
    { dy: -3, stretch: 1, wing: "mid" },
    { dy: -1, wing: "up" },
    { squash: 1, dy: 1, wing: "fold", eye: "blink" },
  ];
}
function framesDragged() {
  return [
    { dy: -1, stretch: 2, headDY: -1, eye: "wide", wing: "spread", dx: -1 },
    { dy: -1, stretch: 2, headDY: -1, eye: "wide", wing: "spread", dx: 1 },
  ];
}
function framesJump() {
  return [
    { squash: 1, dy: 1, wing: "fold" },
    { dy: -2, stretch: 1, wing: "up" },
    { dy: -4, stretch: 2, wing: "spread", eye: "wide", beak: "open" },
    { squash: 1, dy: 1, wing: "fold", eye: "blink" },
  ];
}
function framesSleep() {
  const zs = [
    [{ x: 4, y: 9, k: "z" }],
    [{ x: 4, y: 9, k: "z" }, { x: 8, y: 5, k: "z" }],
    [{ x: 8, y: 5, k: "z" }, { x: 12, y: 1, k: "z" }],
    [{ x: 4, y: 9, k: "z" }, { x: 12, y: 1, k: "z" }],
  ];
  return [0, 1, 2, 3].map((i) => ({
    eye: "closed", squash: 1, dy: 1 + (i % 2), headDY: 1, wing: "fold",
    icons: zs[i],
  }));
}
function framesReact() {
  const hearts = [[], [{ x: 3, y: 9, k: "heartSm" }], [{ x: 3, y: 9, k: "heartSm" }, { x: 24, y: 5, k: "heart" }], [{ x: 24, y: 5, k: "heart" }]];
  const bounce = [
    { squash: 1, dy: 1, wing: "fold" },
    { dy: -2, wing: "up" },
    { dy: -3, wing: "spread" },
    { dy: -1, wing: "mid" },
  ];
  return bounce.map((b, i) => ({ ...b, eye: "happy", beak: i === 2 ? "open" : "closed", icons: hearts[i] }));
}
function framesSpeak() {
  const beaks = ["open", "half", "open", "half"];
  return beaks.map((b, i) => ({
    beak: b, headDY: i % 2 === 0 ? 0 : -1, wing: "fold",
    icons: i < 2 ? [{ x: 26, y: 8 - i, k: "note" }] : [],
  }));
}
function framesAttention() {
  return [0, 1, 2, 3].map((i) => ({
    stretch: 1, headDY: -1, eye: "wide", dy: i % 2 === 0 ? 0 : -1, wing: "mid",
    icons: [{ x: 14, y: 0 + (i % 2), k: "excl" }],
  }));
}
function framesReminder() {
  return [0, 1, 2, 3].map((i) => ({
    headDY: i % 2 === 0 ? 0 : -1, eye: i === 2 ? "blink" : "open", wing: "fold",
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
  drawOwl(g, { ...rest, dx, dy: (dy || 0) - LIFT });
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" shape-rendering="crispEdges">\n  <!-- DeskPet Owl Vector Source (PRD §13), Lavender base palette -->\n  <defs>\n    <style>\n      ${css}\n    </style>\n  </defs>\n\n${groups}\n</svg>\n`;
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
  fs.writeFileSync(path.join(out, "owl.svg"), buildSVG());
  console.log("wrote preview.png + owl.svg");
} else {
  console.error("usage: node generate.mjs --preview | --write <outDir>");
  process.exit(1);
}
