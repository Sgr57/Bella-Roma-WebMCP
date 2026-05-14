/**
 * One-shot recovery: decode the 3 espresso editorial images generated during
 * the API bisect (parked in /tmp/{A,B,C}.json) into the proper output folder.
 * No CF call.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { join } from "node:path";

const SAMPLES = [
  { src: "/tmp/A.json", id: "espresso_A_steps28_with-neg",  meta: { steps: 28, negativePrompt: true  } },
  { src: "/tmp/B.json", id: "espresso_B_steps28_no-neg",    meta: { steps: 28, negativePrompt: false } },
  { src: "/tmp/C.json", id: "espresso_C_steps20_no-neg",    meta: { steps: 20, negativePrompt: false } },
];

const OUT = "public/products/editorial/_samples";
await mkdir(OUT, { recursive: true });

for (const s of SAMPLES) {
  const raw = await readFile(s.src, "utf8");
  const json = JSON.parse(raw) as { result?: { image?: string } };
  const b64 = json.result?.image;
  if (!b64) {
    console.error(`✗ ${s.id}: no result.image in ${s.src}`);
    continue;
  }
  const buf = Buffer.from(b64, "base64");
  const out = join(OUT, `${s.id}.webp`);
  await sharp(buf).resize(512, 512, { fit: "cover" }).webp({ quality: 88 }).toFile(out);
  console.log(`✓ ${s.id}.webp  (${buf.length} → resized)`);
  await writeFile(
    join(OUT, `${s.id}.json`),
    JSON.stringify({ id: s.id, model: "flux-2-dev", subject: "espresso (bisect)", ...s.meta }, null, 2)
  );
}
console.log(`\nDone. See ${OUT}/`);
