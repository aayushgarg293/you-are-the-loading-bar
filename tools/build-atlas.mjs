// Turns an AI-generated parts sheet into a game-ready texture atlas.
//
//   node tools/build-atlas.mjs            builds every sheet in tools/sheets
//   node tools/build-atlas.mjs worker     builds only tools/sheets/worker.json
//
// For each sheet it: removes the flat background, cuts out each named part,
// shrinks it, packs all parts into one image, and writes the atlas JSON that
// Phaser reads (public/assets/<name>.webp + <name>.json).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SHEETS_DIR = 'tools/sheets';
const OUT_DIR = 'public/assets';
const PADDING = 2; // transparent gap between parts so they don't bleed into each other
const OUTLINE = [22, 30, 60]; // the navy outline colour, used for soft edges
const LIGHT = 150; // brightness above which a pixel can count as background

const luminance = (data, i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

// How see-through a light pixel should be: pure background -> 0, outline navy -> 255.
function edgeAlpha(lum, bgLum) {
  const outlineLum = luminance(OUTLINE, 0);
  const t = (bgLum - lum) / (bgLum - outlineLum);
  return Math.round(255 * Math.min(1, Math.max(0, t)));
}

// Flood-fills inwards from the image border through light pixels and makes them
// transparent. The thick navy outline around every part stops the fill, so white
// gloves and sleeves inside an outline are left alone.
function removeBackground(data, width, height) {
  const bgLum = luminance(data, 0);
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    const lum = luminance(data, p * 4);
    if (lum < LIGHT) continue;
    seen[p] = 1;
    data[p * 4] = OUTLINE[0];
    data[p * 4 + 1] = OUTLINE[1];
    data[p * 4 + 2] = OUTLINE[2];
    data[p * 4 + 3] = edgeAlpha(lum, bgLum);
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
  return bgLum;
}

// Removes a flat colour around a picture inside one part: floods in from the
// part's own edges through every pixel close to the corner colour. Used to
// lift an emblem off the surface it was painted on.
function dropBackground(pixels, width, height, tolerance = 90) {
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  // The background colour is the typical (median) colour along the edges.
  const median = (channel) => stack.map((p) => pixels[p * 4 + channel]).sort((a, b) => a - b)[stack.length >> 1];
  const bg = [median(0), median(1), median(2)];
  const near = (i) => Math.hypot(pixels[i] - bg[0], pixels[i + 1] - bg[1], pixels[i + 2] - bg[2]) < tolerance;
  const clear = [];
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !near(p * 4)) continue;
    seen[p] = 1;
    clear.push(p);
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
  for (const p of clear) pixels[p * 4 + 3] = 0;
}

// Keeps only the disc that fits inside the part (for things that spin).
function cropToCircle(pixels, width, height) {
  const cx = (width - 1) / 2, cy = (height - 1) / 2, radius = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = radius - Math.hypot(x - cx, y - cy);
      const i = (y * width + x) * 4 + 3;
      pixels[i] = Math.round(pixels[i] * Math.min(1, Math.max(0, edge)));
    }
  }
}

// Smallest box inside `region` that holds every visible pixel.
function trimmedBox(data, width, [rx0, ry0, rx1, ry1]) {
  let x0 = rx1, y0 = ry1, x1 = rx0, y1 = ry0;
  for (let y = ry0; y <= ry1; y++) {
    for (let x = rx0; x <= rx1; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) return null;
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

// A plain picture (e.g. a background): just resize and compress it.
async function buildImage(name, sheet) {
  const out = path.join(OUT_DIR, `${name}.webp`);
  await sharp(sheet.source).resize(sheet.width, sheet.height, { fit: 'cover' }).webp({ quality: sheet.quality ?? 88 }).toFile(out);
  console.log(`${name}: image -> ${out} (${sheet.width}x${sheet.height})`);
}

async function buildSheet(name) {
  const sheet = JSON.parse(await readFile(path.join(SHEETS_DIR, `${name}.json`), 'utf8'));
  if (sheet.type === 'image') return buildImage(name, sheet);
  const { data, info } = await sharp(sheet.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Sheets that already come with a transparent background skip the cut-out step.
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) { hasAlpha = true; break; }
  }
  const bgLum = hasAlpha ? 255 : removeBackground(data, width, height);
  // Image generators export "transparent" sheets with nearly-solid (253/255) and
  // nearly-clear (1/255) pixels. Snap those so parts are fully opaque inside.
  if (hasAlpha) {
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] >= 245) data[i] = 255;
      else if (data[i] <= 6) data[i] = 0;
    }
  }

  const parts = [];
  for (const [partName, part] of Object.entries(sheet.parts)) {
    const box = trimmedBox(data, width, part.region);
    if (!box) throw new Error(`${name}: part "${partName}" is empty, check its region`);

    const pixels = Buffer.alloc(box.width * box.height * 4);
    for (let y = 0; y < box.height; y++) {
      const from = ((box.top + y) * width + box.left) * 4;
      data.copy(pixels, y * box.width * 4, from, from + box.width * 4);
    }
    // "linesOnly" parts keep just their dark lines (used for spiral eyes, where
    // the generator filled one spiral with white and left the other open).
    if (part.linesOnly) {
      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = edgeAlpha(luminance(pixels, i), bgLum);
        pixels[i + 3] = Math.min(pixels[i + 3], alpha);
      }
    }

    if (part.dropBackground) dropBackground(pixels, box.width, box.height);
    if (part.circle) cropToCircle(pixels, box.width, box.height);

    const w = Math.max(1, Math.round(box.width * sheet.scale));
    const h = Math.max(1, Math.round(box.height * sheet.scale));
    const image = await sharp(pixels, { raw: { width: box.width, height: box.height, channels: 4 } })
      .resize(w, h, { fit: 'fill' })
      .png()
      .toBuffer();
    parts.push({ name: partName, image, w, h });
  }

  // Shelf packing: tallest parts first, placed left to right in rows.
  const atlasWidth = sheet.atlasWidth ?? 512;
  parts.sort((a, b) => b.h - a.h);
  let x = PADDING, y = PADDING, rowHeight = 0;
  for (const part of parts) {
    if (x + part.w + PADDING > atlasWidth) {
      x = PADDING;
      y += rowHeight + PADDING;
      rowHeight = 0;
    }
    part.x = x;
    part.y = y;
    x += part.w + PADDING;
    rowHeight = Math.max(rowHeight, part.h);
  }
  const atlasHeight = y + rowHeight + PADDING;

  const outImage = path.join(OUT_DIR, `${name}.webp`);
  await sharp({ create: { width: atlasWidth, height: atlasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts.map((p) => ({ input: p.image, left: p.x, top: p.y })))
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(outImage);

  const frames = {};
  for (const p of parts) {
    frames[p.name] = {
      frame: { x: p.x, y: p.y, w: p.w, h: p.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
      sourceSize: { w: p.w, h: p.h },
    };
  }
  const meta = { image: `${name}.webp`, format: 'RGBA8888', size: { w: atlasWidth, h: atlasHeight }, scale: '1' };
  await writeFile(path.join(OUT_DIR, `${name}.json`), JSON.stringify({ frames, meta }, null, 2));

  console.log(`${name}: ${parts.length} parts -> ${outImage} (${atlasWidth}x${atlasHeight})`);
  for (const p of parts) console.log(`  ${p.name.padEnd(12)} ${p.w}x${p.h}`);
}

const requested = process.argv.slice(2);
const names = requested.length
  ? requested
  : (await readdir(SHEETS_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
for (const name of names) await buildSheet(name);
