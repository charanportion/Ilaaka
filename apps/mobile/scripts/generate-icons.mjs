// One-shot script to generate v0 placeholder app icons + splash from SVG.
// Run: node scripts/generate-icons.mjs
//
// Outputs to apps/mobile/assets/images/:
//   icon.png                       1024x1024 (universal)
//   android-icon-foreground.png    1024x1024 (transparent bg, "I" mark inside safe zone)
//   android-icon-background.png    1024x1024 (solid #7F77DD, paired with foreground)
//   android-icon-monochrome.png    1024x1024 (white "I" on transparent — Android 13 themed icons)
//   splash-icon.png                512x512   (centered on white via expo-splash-screen plugin)
//   favicon.png                    48x48     (web)

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'images');

const BRAND       = '#7F77DD';
const BRAND_DEEP  = '#5B53B5';
const WHITE       = '#FFFFFF';

// Adaptive icon foreground — keep all visible content within the inner 66% safe zone
// to avoid being clipped by Android's circle/squircle masks.
function svgIconForeground(size) {
  const center = size / 2;
  const fontSize = size * 0.55;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <text x="${center}" y="${center}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="${fontSize}" font-weight="800"
          fill="${WHITE}"
          text-anchor="middle"
          dominant-baseline="central">I</text>
  </svg>`;
}

// Solid-color background (paired with foreground in adaptive icon).
function svgBackground(size, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${color}"/>
  </svg>`;
}

// Universal icon — flat brand-coloured square with "I" baked in.
function svgUniversalIcon(size) {
  const center = size / 2;
  const fontSize = size * 0.55;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stop-color="${BRAND}"/>
        <stop offset="100%" stop-color="${BRAND_DEEP}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
    <text x="${center}" y="${center}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="${fontSize}" font-weight="800"
          fill="${WHITE}"
          text-anchor="middle"
          dominant-baseline="central">I</text>
  </svg>`;
}

// Splash mark — single mark on white background; expo-splash-screen handles padding
function svgSplashMark(size) {
  const center = size / 2;
  const fontSize = size * 0.45;
  // Rounded brand square with the I — sits on a white splash backdrop.
  const inset = size * 0.1;
  const rounded = size * 0.18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stop-color="${BRAND}"/>
        <stop offset="100%" stop-color="${BRAND_DEEP}"/>
      </linearGradient>
    </defs>
    <rect x="${inset}" y="${inset}" width="${size - 2 * inset}" height="${size - 2 * inset}"
          rx="${rounded}" ry="${rounded}" fill="url(#g)"/>
    <text x="${center}" y="${center}"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="${fontSize}" font-weight="800"
          fill="${WHITE}"
          text-anchor="middle"
          dominant-baseline="central">I</text>
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

  // Adaptive icon foreground (transparent — overlay onto background)
  await svgToPng(svgIconForeground(1024), resolve(OUT, 'android-icon-foreground.png'));

  // Adaptive icon background — solid brand
  await svgToPng(svgBackground(1024, BRAND), resolve(OUT, 'android-icon-background.png'));

  // Monochrome (Android 13 themed icons): same shape, white on transparent
  await svgToPng(svgIconForeground(1024), resolve(OUT, 'android-icon-monochrome.png'));

  // Splash mark
  await svgToPng(svgSplashMark(512), resolve(OUT, 'splash-icon.png'));

  // Favicon
  await svgToPng(svgUniversalIcon(48), resolve(OUT, 'favicon.png'));

  console.log('\nDone. Run `npx eas build --profile development --platform android` to bake the new icons in.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
