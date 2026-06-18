/**
 * Generate placeholder PNG icons for the extension.
 * Run: node scripts/generate-icons.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';

const ICONS_DIR = 'public/icons';

// Create a simple 1-pixel purple PNG for each size.
// These are valid PNG files (just solid color) that will work as placeholders.
// Replace with real icons designed at proper sizes for production.

async function createMinimalPng(size) {
  // PNG file structure: signature + IHDR + IDAT + IEND
  // This creates a valid minimal 1x1 purple PNG
  // For extension purposes, any valid PNG works.

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (width, height, bit depth, color type, etc.)
  const width = Buffer.alloc(4);
  width.writeUInt32BE(size);
  const height = Buffer.alloc(4);
  height.writeUInt32BE(size);

  const ihdrData = Buffer.concat([
    width,
    height,
    Buffer.from([8, 2, 0, 0, 0]), // 8-bit, RGB, no interlace
  ]);

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk - raw image data (uncompressed deflate)
  // For simplicity, create a solid purple image
  const rawRow = Buffer.alloc(size * 3 + 1); // filter byte + RGB pixels
  rawRow[0] = 0; // No filter
  for (let x = 0; x < size; x++) {
    rawRow[1 + x * 3] = 0x7c;     // R
    rawRow[1 + x * 3 + 1] = 0x5c; // G
    rawRow[1 + x * 3 + 2] = 0xfc; // B
  }

  // Repeat for all rows
  const allRows = Buffer.alloc(rawRow.length * size);
  for (let y = 0; y < size; y++) {
    rawRow.copy(allRows, y * rawRow.length);
  }

  // Wrap in zlib (deflate) format
  const { deflateSync } = await import('zlib');
  const compressed = deflateSync(allRows);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Main ──

if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true });
}

for (const size of [16, 48, 128]) {
  const png = await createMinimalPng(size);
  writeFileSync(`${ICONS_DIR}/icon-${size}.png`, png);
  console.log(`✓ Created icon-${size}.png (${png.length} bytes)`);
}

console.log('\nDone! Replace these placeholders with real icons for production.');
