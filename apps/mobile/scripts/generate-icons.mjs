// One-shot script to generate the Ilaaka brand-hex app icons + splash mark.
// Run: node scripts/generate-icons.mjs
//
// Source of truth for the brand mark is the polygon used in the website's
// `.hex-tile` mask (apps/landing/app/globals.css):
//   viewBox 0 0 60 52, points "30,1 58,16 58,38 30,52 2,38 2,16"
// Same shape is used for the favicon at apps/landing/app/icon.svg.
//
// Outputs (apps/mobile/assets/images/):
//   icon.png                       1024x1024 — ink bg + cream hex (universal; iOS rounds)
//   android-icon-foreground.png    1024x1024 — cream hex on transparent, sized to safe zone
//   android-icon-background.png    1024x1024 — solid ink
//   android-icon-monochrome.png    1024x1024 — white hex silhouette on transparent (themed icons)
//   splash-icon.png                1024x1024 — cream hex on transparent (splash bg comes from app.json)
//   favicon.png                    64x64     — ink bg + cream hex

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'images');

// Brand colours — match apps/landing/app/globals.css semantic tokens
// (--color-canvas / --color-fg in dark theme).
const INK = '#08070a';
const CREAM = '#f8f1e3';
const WHITE = '#ffffff';

// Brand hex polygon — exact same coords as the marketing site's .hex-tile.
// Bounding box: x ∈ [2,58], y ∈ [1,52] → width 56, height 51, centre (30, 26.5).
const HEX_POINTS = '30,1 58,16 58,38 30,52 2,38 2,16';
const HEX_W = 56;
const HEX_H = 51;
const HEX_CX = 30;
const HEX_CY = 26.5;

/**
 * Return an SVG group that places the brand hex centred on a square canvas,
 * sized so its visual width is `widthFrac` of the canvas.
 */
function hexMark(canvasSize, color, widthFrac) {
  const targetW = canvasSize * widthFrac;
  const s = targetW / HEX_W;
  const tx = canvasSize / 2 - HEX_CX * s;
  const ty = canvasSize / 2 - HEX_CY * s;
  return `<g transform="translate(${tx},${ty}) scale(${s})">
    <polygon points="${HEX_POINTS}" fill="${color}"/>
  </g>`;
}

function svgUniversalIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${INK}"/>
    ${hexMark(size, CREAM, 0.56)}
  </svg>`;
}

function svgAdaptiveForeground(size) {
  /* Adaptive icon: outer 33% can get clipped by any mask shape. The hex
     sits in the inner ~62% so a circle, squircle, or teardrop mask all
     leave it intact. */
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${hexMark(size, CREAM, 0.42)}
  </svg>`;
}

function svgAdaptiveBackground(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${INK}"/>
  </svg>`;
}

function svgMonochrome(size) {
  /* Android 13+ themed icons: white silhouette on transparent. Android
     recolours the white pixels to the user's accent. Same safe-zone rule
     as the foreground. */
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${hexMark(size, WHITE, 0.42)}
  </svg>`;
}

function svgSplashMark(size) {
  /* Splash icon — transparent canvas with the hex centered. expo-splash-screen
     paints the backgroundColor (set in app.json) and renders this image at
     imageWidth, contain-fitted. The hex fills most of the canvas so it lands
     visually large at imageWidth=240. */
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${hexMark(size, CREAM, 0.85)}
  </svg>`;
}

function svgFavicon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${INK}"/>
    ${hexMark(size, CREAM, 0.6)}
  </svg>`;
}

async function svgToPng(svg, outPath) {
  const buf = Buffer.from(svg, 'utf8');
  await sharp(buf, { density: 300 }).png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`✓ ${outPath}`);
}

async function main() {
  await svgToPng(svgUniversalIcon(1024), resolve(OUT, 'icon.png'));
  await svgToPng(svgAdaptiveForeground(1024), resolve(OUT, 'android-icon-foreground.png'));
  await svgToPng(svgAdaptiveBackground(1024), resolve(OUT, 'android-icon-background.png'));
  await svgToPng(svgMonochrome(1024), resolve(OUT, 'android-icon-monochrome.png'));
  await svgToPng(svgSplashMark(1024), resolve(OUT, 'splash-icon.png'));
  await svgToPng(svgFavicon(64), resolve(OUT, 'favicon.png'));

  console.log('\nDone. Rebuild with `npx eas build` (or `npx expo prebuild --clean`) to bake the new icons in.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
