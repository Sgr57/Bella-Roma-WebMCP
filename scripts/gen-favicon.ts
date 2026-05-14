/**
 * Generate favicon variants from public/brand/mark.webp.
 *
 *   npx tsx scripts/gen-favicon.ts
 *
 * No API call — purely sharp resizing. Idempotent.
 *
 * Output:
 *   public/favicon.png            (32x32  — modern browser tabs)
 *   public/favicon-192.png        (192x192 — Android home screen)
 *   public/apple-touch-icon.png   (180x180 — iOS home screen)
 */
import sharp from "sharp";

const SRC = "public/brand/mark.webp";

interface Variant { name: string; size: number; outPath: string; pad: number; }

const VARIANTS: Variant[] = [
  { name: "favicon",          size: 32,  outPath: "public/favicon.png",          pad: 2 },
  { name: "favicon-192",      size: 192, outPath: "public/favicon-192.png",      pad: 8 },
  { name: "apple-touch-icon", size: 180, outPath: "public/apple-touch-icon.png", pad: 6 },
];

async function main() {
  // Trim transparent padding from the source so the emblem fills the canvas.
  // Sharp .trim() uses the top-left pixel as the reference (here fully transparent).
  const trimmed = await sharp(SRC).trim({ threshold: 1 }).toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();
  process.stdout.write(`▶ source ${SRC} trimmed to ${trimmedMeta.width}x${trimmedMeta.height}\n`);

  for (const v of VARIANTS) {
    const target = v.size - v.pad * 2;
    const resized = await sharp(trimmed)
      .resize(target, target, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: v.pad, bottom: v.pad, left: v.pad, right: v.pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await sharp(resized).toFile(v.outPath);
    process.stdout.write(`  ✓ ${v.name.padEnd(20)} ${v.size}x${v.size}  →  ${v.outPath}\n`);
  }
  process.stdout.write(`\n● done\n`);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
