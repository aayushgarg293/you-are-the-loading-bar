// Prints the bounding box of every separate part on a sheet, to help write the
// regions in tools/sheets/<name>.json.   node tools/probe-sheet.mjs <image> [minAlpha]
import sharp from 'sharp';

const [file, minAlphaArg] = process.argv.slice(2);
const minAlpha = Number(minAlphaArg ?? 40);
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

const hist = [0, 0, 0, 0];
for (let i = 3; i < data.length; i += 4) hist[data[i] === 0 ? 0 : data[i] < 128 ? 1 : data[i] < 255 ? 2 : 3]++;
console.log(`${W}x${H}  alpha: clear ${hist[0]}, faint ${hist[1]}, strong ${hist[2]}, solid ${hist[3]}`);

const label = new Int32Array(W * H);
const boxes = [];
for (let s = 0; s < W * H; s++) {
  if (label[s] || data[s * 4 + 3] < minAlpha) continue;
  let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  const stack = [s];
  label[s] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    n++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      if (!label[q] && data[q * 4 + 3] >= minAlpha) { label[q] = 1; stack.push(q); }
    }
  }
  if (n > 60) boxes.push({ x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n });
}
boxes.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
for (const b of boxes) console.log(`[${b.x0}, ${b.y0}, ${b.x1}, ${b.y1}]  ${b.w}x${b.h}  (${b.n}px)`);
