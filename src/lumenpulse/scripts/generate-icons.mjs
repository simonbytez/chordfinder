#!/usr/bin/env node
/**
 * npm run lumenpulse:icons → renders the LumenPulse mark into every PWA icon size.
 * Output: public/flashlights/icons/*.png (committed, so this only needs re-running if the art changes).
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const mark = (size, { padding = 0.12, bg = "#090D16", rounded = true } = {}) => {
  const pad = size * padding;
  const inner = size - pad * 2;
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${inner * 0.5}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 32})">
    <circle cx="16" cy="16" r="13.2" fill="#0E1420" stroke="#F59E0B" stroke-width="1.6"/>
    <path d="M5 17h6l2.5-6 4 11 3-8 1.5 3H27" fill="none" stroke="#F59E0B" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
};

const badge = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <path d="M3 17h7l2.8-7 4.4 12.5 3.3-9 1.8 3.5H29" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

mkdirSync("public/flashlights/icons", { recursive: true });
const jobs = [
  ["icon-192.png", mark(192)],
  ["icon-512.png", mark(512)],
  ["maskable-512.png", mark(512, { padding: 0.22, rounded: false })],
  ["apple-touch-icon.png", mark(180, { padding: 0.1, rounded: false })],
  ["favicon-32.png", mark(32, { padding: 0.04 })],
  ["badge-72.png", badge(72)],
];
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(`public/flashlights/icons/${name}`);
  console.log(`✓ public/flashlights/icons/${name}`);
}
