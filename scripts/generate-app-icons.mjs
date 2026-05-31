// Generates the PWA / favicon assets from the new brand logomark (mirrors
// src/components/nav/AppIcon.tsx, squircled on black). Run: `node scripts/generate-app-icons.mjs`.
// Re-run whenever the logomark or section colors change.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

// Section accents (keep in sync with src/lib/design-tokens.ts `section`).
const C = { plans: '#7aa7ff', recipes: '#e8a86b', shop: '#6fcf97', pantry: '#c79bff' };

// AppIcon squircled mark, 64-unit viewBox rendered into a 512px canvas.
const svg = `<svg width="512" height="512" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="64" height="64" rx="16" fill="#000000"/>
  <rect x="12" y="12" width="32" height="5" rx="1" fill="${C.plans}"/>
  <rect x="16" y="20" width="36" height="5" rx="1" fill="${C.recipes}"/>
  <rect x="12" y="28" width="26" height="5" rx="1" fill="${C.shop}"/>
  <rect x="18" y="36" width="32" height="5" rx="1" fill="${C.pantry}"/>
  <path d="M 8 47 L 56 47 Q 56 56 32 56 Q 8 56 8 47 Z" fill="#3a3d44"/>
  <rect x="8" y="47" width="48" height="1.5" fill="rgba(255,255,255,0.20)"/>
</svg>`;

const svgBuf = Buffer.from(svg);

async function png(size, outPath) {
  const data = await sharp(svgBuf).resize(size, size).png().toBuffer();
  await writeFile(path.join(root, outPath), data);
  return data;
}

// Wrap a PNG buffer in a single-image .ico container (PNG-in-ICO; supported since Vista).
function buildIco(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8); // size of image data
  entry.writeUInt32LE(6 + 16, 12); // offset to image data
  return Buffer.concat([header, entry, pngBuf]);
}

await writeFile(path.join(root, 'public/icon0.svg'), svg);
await png(192, 'public/web-app-manifest-192x192.png');
await png(512, 'public/web-app-manifest-512x512.png');
await png(180, 'src/app/apple-icon.png');
await png(96, 'src/app/icon1.png');

const fav = await sharp(svgBuf).resize(32, 32).png().toBuffer();
await writeFile(path.join(root, 'src/app/favicon.ico'), buildIco(fav, 32));

console.log('Generated app icons from the new logomark.');
