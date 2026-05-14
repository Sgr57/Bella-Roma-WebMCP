/**
 * One-shot generator for the Bella Roma brand mark.
 *
 *   npx tsx --env-file-if-exists=tools/imagegen/.env scripts/gen-logo.ts [--force] [--quality medium|high]
 *
 * Output:
 *   public/brand/mark.webp   (transparent, mono navy)
 *   public/brand/mark.json   (sidecar)
 */
import { generateImages } from "../tools/imagegen/src/index.js";
import type { GenQuality } from "../tools/imagegen/src/types.js";

const PROMPT = [
  "A minimalist heraldic emblem on fully TRANSPARENT background — no surface, no card, no paper, no shadow plate, no frame. Each visual element cleanly cut out and floating on transparency.",
  "Single-color flat vector illustration in solid deep navy color hex #051432, uniform crisp stroke weight, no gradients, no fill variations, no shadows, no 3D — clean geometric heraldry style, like an engraved printer's mark.",
  "Composition: a vertically symmetric oval LAUREL WREATH formed by two delicate slender branches with small pointed leaves; the branches ascend from the bottom-left and bottom-right corners of the central area, curve gracefully upward, and meet at the top in a small elegant flourish (two leaf tips touching). The two branches together enclose a clean hollow oval space at the center.",
  "Inside the oval, perfectly centered and at appropriate scale: a single COFFEE BEAN seen from the front view, simplified vector silhouette, with its iconic vertical central groove clearly visible. The bean is solid navy, same color as the wreath.",
  "Style reference: classical Roman heraldic seal, vintage Italian café stamp, old book frontispiece mark. Elegant, refined, premium, NOT cartoonish, NOT overly ornate.",
  "Square 1024x1024 canvas. The entire emblem (wreath + bean) occupies approximately 55-60% of the canvas, perfectly centered, with generous transparent padding on all four sides.",
  "ABSOLUTELY NO text, NO letters, NO words, NO numbers, NO Latin inscriptions, NO date, NO brand name, NO captions, NO ribbons with writing — the emblem must be purely graphic, language-agnostic.",
].join(" ");

const NEGATIVE_PROMPT =
  "text, letters, words, characters, alphabet, typography, numbers, date, year, latin inscription, ribbon with text, watermark, gradient, color variation, multi-color, photorealistic, 3D rendering, shadow, drop shadow, surface, paper background, cluttered, busy, cartoon, mascot, photographic, realistic coffee bean photograph";

interface Args { force: boolean; quality: GenQuality; help: boolean; }
function parseArgs(argv: string[]): Args {
  const a: Args = { force: false, quality: "high", help: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--force") a.force = true;
    else if (k === "--quality") { a.quality = v as GenQuality; i++; }
    else if (k === "-h" || k === "--help") a.help = true;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: tsx scripts/gen-logo.ts [--force] [--quality low|medium|high|auto]\n");
    process.exit(0);
  }

  const startedAll = Date.now();
  const result = await generateImages({
    items: [{ id: "mark", prompt: PROMPT, negativePrompt: NEGATIVE_PROMPT, seed: 1962 }],
    provider: "openai",
    model: "gpt-image-1",
    quality: args.quality,
    background: "transparent",
    outDir: "public/brand",
    format: "webp",
    // Square 1:1 for a logo mark
    width: 1024,
    height: 1024,
    outWidth: 1024,
    outHeight: 1024,
    encodeQuality: 95,
    concurrency: 1,
    force: args.force,
    onProgress: (e) => {
      if (e.type === "start") process.stdout.write(`▶ logo  provider=openai/gpt-image-1  quality=${args.quality}  transparent=true  1024x1024\n`);
      else if (e.type === "generated") process.stdout.write(`  ✓ mark (${(e.durationMs / 1000).toFixed(1)}s)\n`);
      else if (e.type === "skip") process.stdout.write(`  ⊘ mark skipped (exists) — pass --force to regenerate\n`);
      else if (e.type === "error") process.stdout.write(`  ✗ mark: ${e.error}\n`);
    },
  });

  const elapsed = ((Date.now() - startedAll) / 1000).toFixed(1);
  process.stdout.write(`\n● done in ${elapsed}s — generated:${result.generated.length} skipped:${result.skipped.length} failed:${result.failed.length}\n`);
  process.exit(result.failed.length > 0 ? 2 : 0);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
