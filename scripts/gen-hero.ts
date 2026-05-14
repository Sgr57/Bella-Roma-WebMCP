/**
 * One-shot generator for the Bella Roma hero banner.
 *
 *   npx tsx --env-file-if-exists=tools/imagegen/.env scripts/gen-hero.ts [--force] [--quality medium|high]
 *
 * Output:
 *   public/hero/banner.webp   (PNG-with-alpha, served as .webp file)
 *   public/hero/banner.json   (sidecar)
 */
import { generateImages } from "../tools/imagegen/src/index.js";
import type { GenQuality } from "../tools/imagegen/src/types.js";

const PROMPT = [
  "Premium editorial flat-lay photography composition with a fully TRANSPARENT background — no surface, no paper, no studio backdrop, no shadow plate. Each element must be cleanly cut out and floating on transparency, ready to be composited onto any web page.",
  "Wide 3:2 horizontal canvas, arrangement spread across the frame.",
  "LEFT SIDE (object zone): a small white porcelain espresso demitasse seen from a slight high angle showing dark crema and a faint steam wisp, three or four scattered roasted coffee beans, one glossy green coffee plant leaf with subtle veining, asymmetric organic placement.",
  "RIGHT SIDE (object zone): an open small burlap sack tilted toward the camera with roasted coffee beans gently spilling, two coffee leaves arranged loosely, two more scattered beans, a small wooden coffee spoon.",
  "CENTRAL AREA: completely empty, no objects, generous transparent negative space reserved for typography overlay.",
  "Each element rendered photorealistic, hyper-detailed, refined Italian café aesthetic, soft diffused light coming from upper-left, very subtle short contact shadow directly beneath each object only (no large cast shadows that would imply a surface).",
  "No text, no logos, no watermarks, no captions, no packaging branding, no human hands, no people.",
].join(" ");

const NEGATIVE_PROMPT =
  "background color, paper, surface, studio backdrop, tabletop, cream background, white background, large cast shadow, ground plane, text, watermark, logo, brand name, hands, people, cluttered center";

interface Args { force: boolean; quality: GenQuality; help: boolean; }
function parseArgs(argv: string[]): Args {
  const a: Args = { force: false, quality: "medium", help: false };
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
    process.stdout.write("Usage: tsx scripts/gen-hero.ts [--force] [--quality low|medium|high|auto]\n");
    process.exit(0);
  }

  const startedAll = Date.now();
  const result = await generateImages({
    items: [{ id: "banner", prompt: PROMPT, negativePrompt: NEGATIVE_PROMPT, seed: 42 }],
    provider: "openai",
    model: "gpt-image-1",
    quality: args.quality,
    background: "transparent",
    outDir: "public/hero",
    format: "webp", // webp preserves alpha and stays small
    width: 1536,
    height: 1024,
    outWidth: 1536,
    outHeight: 1024,
    encodeQuality: 92,
    concurrency: 1,
    force: args.force,
    onProgress: (e) => {
      if (e.type === "start") process.stdout.write(`▶ hero  provider=openai/gpt-image-1  quality=${args.quality}  transparent=true  1536x1024\n`);
      else if (e.type === "generated") process.stdout.write(`  ✓ banner (${(e.durationMs / 1000).toFixed(1)}s)\n`);
      else if (e.type === "skip") process.stdout.write(`  ⊘ banner skipped (exists) — pass --force to regenerate\n`);
      else if (e.type === "error") process.stdout.write(`  ✗ banner: ${e.error}\n`);
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
