/*
 * Stages the Silero-VAD runtime assets into public/vad/.
 *
 * @ricky0123/vad-web loads three things at runtime by URL, not by import:
 * its AudioWorklet bundle, the ONNX model weights, and (through
 * onnxruntime-web) the WASM runtime. Their defaults point at a CDN — which
 * is not an option here: the app has to work offline and behind a private
 * tunnel. So they are served from our own origin instead.
 *
 * Copied at pre-dev / pre-build time rather than committed, so the bytes in
 * public/vad/ can never drift from the installed package version, and 40 MB
 * of binaries stay out of git. public/vad/ is gitignored.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "public", "vad");

const vadDist = join(root, "node_modules", "@ricky0123", "vad-web", "dist");
const ortDist = join(root, "node_modules", "onnxruntime-web", "dist");

const ASSETS = [
  // Resolved as `baseAssetPath + "vad.worklet.bundle.min.js"`.
  [vadDist, "vad.worklet.bundle.min.js"],
  // Resolved as `baseAssetPath + "silero_vad_v5.onnx"` (model: "v5").
  [vadDist, "silero_vad_v5.onnx"],
  // Resolved against ort.env.wasm.wasmPaths. Both files are staged because
  // which one is fetched depends on whether the bundler picked ORT's
  // "bundle" build (glue inlined, .wasm only) or the extern build (.mjs
  // glue fetched too) — that is a bundler-resolution detail, not ours.
  [ortDist, "ort-wasm-simd-threaded.wasm"],
  [ortDist, "ort-wasm-simd-threaded.mjs"],
];

mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const [from, name] of ASSETS) {
  const src = join(from, name);
  const dest = join(outDir, name);
  try {
    const srcStat = statSync(src);
    let fresh = false;
    try {
      const destStat = statSync(dest);
      fresh = destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs;
    } catch {
      // Not staged yet.
    }
    if (!fresh) {
      copyFileSync(src, dest);
      copied += 1;
    }
  } catch (error) {
    console.error(`[vad-assets] missing ${src} — run npm install first`);
    throw error;
  }
}

console.log(
  `[vad-assets] ${ASSETS.length} asset(s) staged in public/vad/ (${copied} copied, ${ASSETS.length - copied} already current)`
);
