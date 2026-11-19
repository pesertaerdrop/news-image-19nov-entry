// news-image-20261119 — front page for Thursday 19 November 2026.
//
// This program is the entry's builder: it takes the finished front page
// image that lives in this repo as entry.png and places an exact copy of
// it where the grader expects it, at /output/entry.png. Before copying
// it sanity-checks the image, because a corrupt or oversized file would
// be rejected by the competition gate anyway — better to fail here, loudly,
// than to hand the grader something it cannot accept.
//
// Local runs (outside the grader container) can point the output
// somewhere else with MAKEFUN_OUTPUT_DIR, e.g.:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1024 * 1024; // the gate allows at most 1 MiB
const MAX_SIDE = 1024; // and at most 1024 pixels on either side
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR_MIN_LENGTH = 33; // 8-byte signature + 25 bytes of IHDR chunk

// Resolve the image next to this script, wherever the repo is checked out.
const here = dirname(fileURLToPath(import.meta.url));
const inputPath = resolve(here, 'entry.png');
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const outputPath = join(outputDir, 'entry.png');

if (!existsSync(inputPath)) {
  throw new Error(`cannot build entry: ${inputPath} is missing`);
}

const image = readFileSync(inputPath);

// A real PNG always opens with its fixed 8-byte magic signature.
const magicOk =
  image.length >= PNG_MAGIC.length &&
  PNG_MAGIC.every((byte, index) => image[index] === byte);
if (!magicOk) {
  throw new Error('entry.png failed its PNG signature check — refusing to ship it');
}

// The gate also caps the file at 1 MiB.
if (image.length > MAX_BYTES) {
  throw new Error(
    `entry.png is ${image.length} bytes, above the ${MAX_BYTES}-byte limit`,
  );
}

// Width and height sit in the IHDR chunk, as big-endian 32-bit values
// at offsets 16 and 20. A file too short to hold them is not a usable PNG.
if (image.length < IHDR_MIN_LENGTH) {
  throw new Error(
    `entry.png is only ${image.length} bytes — too short to hold an IHDR chunk`,
  );
}

// The first chunk of every PNG must be IHDR (its four type bytes sit
// right after the 8-byte signature and the 4-byte chunk length). If
// those bytes say something else, the offsets below would be meaningless.
const firstChunkType = image.subarray(12, 16).toString('latin1');
if (firstChunkType !== 'IHDR') {
  throw new Error(
    `entry.png's first chunk is "${firstChunkType}", not IHDR — refusing to ship it`,
  );
}
const pixelWidth = image.readUInt32BE(16);
const pixelHeight = image.readUInt32BE(20);
if (pixelWidth > MAX_SIDE || pixelHeight > MAX_SIDE) {
  throw new Error(
    `entry.png is ${pixelWidth}x${pixelHeight}px, above the ${MAX_SIDE}x${MAX_SIDE} limit`,
  );
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(inputPath, outputPath);

const shipped = statSync(outputPath);
console.log(
  `wrote ${outputPath} — ${pixelWidth}x${pixelHeight}px, ${shipped.size} bytes`,
);
