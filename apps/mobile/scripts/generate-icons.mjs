// One-shot script to generate monochrome app icons + splash from SVG.
// Run: node scripts/generate-icons.mjs
//
// Outputs to apps/mobile/assets/images/:
//   icon.png                       1024x1024 (universal — black with white "I")
//   android-icon-foreground.png    1024x1024 (transparent bg, white "I" inside safe zone)
//   android-icon-background.png    1024x1024 (solid black, paired with foreground)
//   android-icon-monochrome.png    1024x1024 (white "I" on transparent — Android 13 themed icons)
//   splash-icon.png                512x512   (rounded black square with white "I", on white backdrop)
//   favicon.png                    48x48     (web)

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'images');

// Strict monochrome — matches the app's black/white design system.
const BLACK = '#000000';
const WHITE = '#FFFFFF';

// Geometric "I" mark — drawn as three rectangles (top serif, vertical stem,
// bottom serif) so it's pixel-perfect centered regardless of how an SVG
// renderer handles text-anchor + dominant-baseline. Classic slab-serif I.
function iMark(size, color, opts = {}) {
  const heightFrac = opts.heightFrac ?? 0.55;        // total mark height vs canvas
  const stemWidthFrac = opts.stemWidthFrac ?? 0.13;  // vertical stem width
  const serifWidthFrac = opts.serifWidthFrac ?? 0.42; // horizontal serif width
  const serifHeightFrac = opts.serifHeightFrac ?? 0.085; // serif thickness

  const totalH = size * heightFrac;
  const stemW  = size * stemWidthFrac;
  const serifW = size * serifWidthFrac;
  const serifH = size * serifHeightFrac;

  const cx = size / 2;
  const cy = size / 2;
  const top    = cy - totalH / 2;
  const bottom = cy + totalH / 2;

  // Top serif
  const topX = cx - serifW / 2;
  const topY = top;
  // Stem
  const stemX = cx - stemW / 2;
  const stemY = top;
  const stemH = totalH;
  // Bottom serif
  const botX = cx - serifW / 2;
  const botY = bottom - serifH;

  return `
    <rect x="${topX}"  y="${topY}"  width="${serifW}" height="${serifH}" fill="${color}"/>
    <rect x="${stemX}" y="${stemY}" width="${stemW}"  height="${stemH}"  fill="${color}"/>
    <rect x="${botX}"  y="${botY}"  width="${serifW}" height="${serifH}" fill="${color}"/>
  `;
}

// Adaptive icon foreground — transparent bg, white "I" inside the inner 66%
// safe zone (Android masks the outer ring with circle / squircle / cloverleaf).
function svgIconForeground(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${iMark(size, WHITE)}
  </svg>`;
}

// Solid-color background (paired with foreground in adaptive icon).
function svgBackground(size, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${color}"/>
  </svg>`;
}

// Universal icon — flat black square with the white "I" baked in. iOS will
// mask the corners; the mark sits in the safe zone so it survives any clip.
function svgUniversalIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BLACK}"/>
    ${iMark(size, WHITE)}
  </svg>`;
}

// Splash mark — rounded black square with the "I", sits on the white splash
// backdrop configured in app.json under expo-splash-screen.
function svgSplashMark(size) {
  const inset = size * 0.1;
  const rounded = size * 0.18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="${inset}" y="${inset}" width="${size - 2 * inset}" height="${size - 2 * inset}"
          rx="${rounded}" ry="${rounded}" fill="${BLACK}"/>
    ${iMark(size, WHITE, { heightFrac: 0.45 })}
  </svg>`;
}

async function svgToPng(svg, outPath, opts = {}) {
  const buf = Buffer.from(svg, 'utf8');
  await sharp(buf, { density: 300 }).png(opts).toFile(outPath);
  console.log(`✓ ${outPath}`);
}

async function main() {
  // Universal app icon
  await svgToPng(svgUniversalIcon(1024), resolve(OUT, 'icon.png'));

  // Adaptive icon foreground (transparent — overlays the black background)
  await svgToPng(svgIconForeground(1024), resolve(OUT, 'android-icon-foreground.png'));

  // Adaptive icon background — solid black
  await svgToPng(svgBackground(1024, BLACK), resolve(OUT, 'android-icon-background.png'));

  // Monochrome (Android 13+ themed icons): white "I" on transparent
  await svgToPng(svgIconForeground(1024), resolve(OUT, 'android-icon-monochrome.png'));

  // Splash mark — rounded black square on white backdrop
  await svgToPng(svgSplashMark(512), resolve(OUT, 'splash-icon.png'));

  // Favicon — small flat black with white "I"
  await svgToPng(svgUniversalIcon(48), resolve(OUT, 'favicon.png'));

  console.log('\nDone. Rebuild with `npx eas build` (or `npx expo prebuild --clean`) to bake the new icons in.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
