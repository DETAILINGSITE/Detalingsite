/**
 * `pnpm model:optimize path/to/source.glb` → public/models/car.glb
 *
 * Uses the gltf-transform CLI (install once: `pnpm add -D @gltf-transform/cli`):
 * prune + dedupe, textures resized to ≤ 2048 and compressed to KTX2 (UASTC/ETC1S),
 * Meshopt geometry compression. Fails if the result is over the 2 MB budget.
 * Also copies the Basis transcoder into public/basis for the KTX2 loader.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input || !fs.existsSync(input)) {
  console.error("Usage: pnpm model:optimize <source.glb>");
  process.exit(1);
}
const out = path.resolve("public/models/car.glb");
const bin = process.platform === "win32" ? "gltf-transform.cmd" : "gltf-transform";
const run = (...args: string[]) => execFileSync(path.resolve("node_modules/.bin", bin), args, { stdio: "inherit" });

run("optimize", input, out, "--compress", "meshopt", "--texture-compress", "ktx2", "--texture-size", "2048", "--simplify", "false");
const mb = fs.statSync(out).size / 1024 / 1024;
console.log(`car.glb: ${mb.toFixed(2)} MB`);

const basisSrc = path.resolve("node_modules/three/examples/jsm/libs/basis");
const basisDst = path.resolve("public/basis");
fs.mkdirSync(basisDst, { recursive: true });
for (const f of ["basis_transcoder.js", "basis_transcoder.wasm"]) fs.copyFileSync(path.join(basisSrc, f), path.join(basisDst, f));

if (mb > 2) {
  console.error("Over the 2 MB budget — reduce texture sizes (--texture-size 1024) or polygon count.");
  process.exit(1);
}
console.log("Done. Update public/models/LICENSE.txt with the model's licence and source.");
