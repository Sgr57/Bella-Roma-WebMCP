/**
 * webMCP-specific adapter on top of tools/imagegen.
 *
 *   --style editorial|dipinto   visual style (required)
 *   --test                      run on the 4-product test bench
 *   --all                       run on the full catalog
 *   --only id1,id2,...          run on a comma-separated list of product ids
 *   --force                     re-generate even if file exists
 *   --dry-run                   print prompts/paths only — no API call, no files
 *   --provider <name>           openai (default) | cloudflare
 *   --model <name>              provider-specific model id (defaults below)
 *   --quality <low|med|high|auto>  generation quality (default: medium)
 *   --size <px>                 output size after sharp resize (default: 512)
 *
 * Defaults: provider=openai, model=gpt-image-1, quality=medium.
 *
 * Output:
 *   public/products/<style>/<id>.webp
 *   public/products/<style>/<id>.json   (sidecar with provider+model+prompt+seed)
 */
import { generateImages } from "../tools/imagegen/src/index.js";
import type {
  GenerateItem,
  GenQuality,
  Provider,
} from "../tools/imagegen/src/types.js";
import { PRODUCTS, type Product } from "../src/lib/products.js";

type StyleKey = "editorial" | "dipinto";

const TEST_BENCH_IDS = [
  "espresso",
  "cappuccino",
  "filtro-etiopia",
  "beans-colombia-250g",
];

// ── Style templates ────────────────────────────────────────────────────────
// Each template wraps the per-product subject in a consistent visual envelope.
// Keep these stable — the WHOLE point of having a "linea visiva" is that the
// envelope never changes across the 27 images.
const STYLE_TEMPLATES: Record<StyleKey, {
  envelope: (subject: string) => string;
  negative: string;
}> = {
  editorial: {
    envelope: (subject) =>
      `Premium editorial product photography. Top-down 1:1 composition, single subject perfectly centered on a warm cream paper background (hex #F5F0E6). Soft diffused morning light from the upper-left, gentle natural shadow falling to lower-right, shallow depth of field with the subject in crisp focus. Hyper-detailed, magazine-quality, refined Italian café aesthetic. Subject: ${subject}. No text, no logos, no watermarks, no captions, no packaging branding, no human hands.`,
    negative:
      "text, watermark, logo, brand name, packaging label, hands, fingers, cluttered, multiple subjects, busy background, neon colors, low quality, blurry, oversaturated",
  },
  dipinto: {
    envelope: (subject) =>
      `Hand-painted gouache illustration in the style of vintage 1960s Italian café posters. Warm earth-tone palette: terracotta, deep coffee brown, cream, ochre, muted sage. Visible confident brush strokes with soft paper-grain texture. 1:1 composition, single subject centered on a softly textured cream background. Editorial, mid-century, refined. Subject: ${subject}. No text, no logos, no watermarks, no captions.`,
    negative:
      "text, watermark, logo, brand name, photorealistic, 3d render, neon, harsh contrast, multiple subjects, cluttered, low quality",
  },
};

// ── Per-product subject builder ────────────────────────────────────────────
// Uses the rich metadata already present on the Product record to disambiguate
// visually-similar drinks (cappuccino vs flat white, etc.) and to enrich
// inanimate items (beans by origin, capsules, milk options).

function intensityHint(intensity: number | undefined): string {
  if (typeof intensity !== "number") return "";
  if (intensity >= 9) return "very dark roast, near-black liquid with a thick golden crema disc on top";
  if (intensity >= 7) return "dark roast, deep mahogany liquid with a rich hazelnut crema";
  if (intensity >= 5) return "medium roast, warm amber liquid with a light tan crema";
  if (intensity >= 3) return "light roast, golden-amber liquid, thin pale crema";
  return "very light roast, pale honey-colored liquid";
}

function temperatureHint(t: Product["temperature"]): string {
  if (t === "hot") return "with delicate steam wisps rising naturally";
  if (t === "iced") return "with crystal-clear ice cubes visible, condensation droplets on the glass";
  return "";
}

function buildDrinkSubject(p: Product): string {
  const parts: string[] = [];
  const roast = intensityHint(p.intensity);
  const temp = temperatureHint(p.temperature);

  switch (p.id) {
    case "espresso":
      parts.push(`a small white porcelain demitasse on a matching saucer, ${roast}`);
      break;
    case "doppio":
      parts.push(`a slightly larger white porcelain cup filled to the brim, ${roast}, a small espresso spoon on the saucer`);
      break;
    case "ristretto":
      parts.push(`a small white porcelain demitasse only half-filled, ${roast}, extremely concentrated`);
      break;
    case "macchiato":
      parts.push(`a small white porcelain demitasse, ${roast}, topped with a single dollop of velvety white milk foam`);
      break;
    case "americano":
      parts.push(`a tall white ceramic mug filled with diluted espresso, ${roast}, no foam`);
      break;
    case "cappuccino":
      parts.push(`a classic round white porcelain cup with a wide handle, filled with espresso and topped with a thick velvet microfoam crown, the foam rising slightly above the rim, a delicate dusting of cocoa powder on top`);
      break;
    case "flat-white":
      parts.push(`a low and wide ceramic cup filled with espresso and a thin, glossy layer of microfoam — barely 1cm of foam — the surface mirror-smooth`);
      break;
    case "latte-macchiato":
      parts.push(`a tall transparent glass showing visible distinct layers from bottom to top: warm milk, espresso shot, white milk foam crown`);
      break;
    case "mocha":
      parts.push(`a round ceramic cup filled with chocolate-coffee blend, topped with whipped foam and a delicate drizzle of dark chocolate`);
      break;
    case "shakerato":
      parts.push(`a chilled coupé martini glass filled with a creamy iced coffee, dense espresso foam on top, frosted glass exterior`);
      break;
    case "decaffeinato":
      parts.push(`a small white porcelain demitasse, light amber liquid with a thin crema`);
      break;
    case "filtro-etiopia":
      parts.push(`a glass pour-over carafe filled with a clear, bright amber filter coffee, a single rising tendril of steam, on a wooden coaster`);
      break;
    case "filtro-colombia":
      parts.push(`a glass pour-over carafe filled with a warm caramel-toned filter coffee, on a wooden coaster`);
      break;
    default:
      parts.push(`a coffee drink in a white ceramic cup, ${roast}`);
  }

  if (temp) parts.push(temp);
  return parts.join(", ");
}

function buildSubject(p: Product): string {
  switch (p.type) {
    case "drink":
      return buildDrinkSubject(p);

    case "food":
      if (p.id === "cornetto-vuoto") return "a single golden flaky Italian cornetto pastry, crescent shape, on a small white plate, dusting of icing sugar";
      if (p.id === "cornetto-cioccolato") return "a single golden flaky Italian cornetto cut in half showing a generous dark chocolate cream filling oozing out, on a small white plate";
      if (p.id === "biscotti-cantucci") return "a small cluster of three traditional Tuscan cantucci almond biscotti with visible whole almonds, on a small white plate";
      if (p.id === "tiramisu") return "a single elegant portion of classic Italian tiramisù served in a small glass cup, visible layers of cream and coffee-soaked savoiardi, dusted with cocoa powder on top";
      return "an Italian pastry on a small white plate";

    case "beans": {
      const origin = p.origin ?? "Italy";
      const notes = (p.flavor_notes ?? []).slice(0, 2).join(" and ");
      return `an open small burlap sack of whole roasted coffee beans from ${origin}, beans spilling gently around its base, a few isolated beans in soft focus${notes ? `, evoking ${notes} flavor notes` : ""}`;
    }

    case "capsule":
      return p.id === "capsule-decaf-10pz"
        ? "a small neat row of five matte-black aluminum espresso capsules arranged on a clean surface"
        : "a small neat row of five matte-brown aluminum espresso capsules arranged on a clean surface";

    case "milk_option":
      if (p.id === "milk-whole") return "a small glass pitcher filled with creamy whole milk, soft white";
      if (p.id === "milk-oat") return "a small glass pitcher filled with oat milk next to a few raw oat grains scattered around";
      if (p.id === "milk-soy") return "a small glass pitcher filled with soy milk next to a few dry soybeans scattered around";
      if (p.id === "milk-almond") return "a small glass pitcher filled with almond milk next to three whole almonds scattered around";
      if (p.id === "milk-lactose-free") return "a small glass pitcher filled with milk, a tiny label-free tag indicating it is lactose-free";
      return "a small glass pitcher filled with milk";

    default:
      return p.name;
  }
}

function buildItem(p: Product, style: StyleKey): GenerateItem {
  const subject = buildSubject(p);
  const tpl = STYLE_TEMPLATES[style];
  return {
    id: p.id,
    prompt: tpl.envelope(subject),
    negativePrompt: tpl.negative,
    // deterministic seed per product so reruns of the same prompt are stable
    seed: hashId(p.id),
  };
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 2_147_483_647;
}

// ── CLI ────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL_PER_PROVIDER: Record<Provider, string> = {
  openai: "gpt-image-1",
  cloudflare: "flux-2-dev",
};

function parseArgs(argv: string[]) {
  const out = {
    style: undefined as StyleKey | undefined,
    test: false,
    all: false,
    only: [] as string[],
    force: false,
    dryRun: false,
    provider: "openai" as Provider,
    model: "" as string,
    quality: "medium" as GenQuality,
    size: 512,
    help: false,
  };
  let modelExplicit = false;

  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case "-h":
      case "--help":   out.help = true; break;
      case "--style":  out.style = v as StyleKey; i++; break;
      case "--test":   out.test = true; break;
      case "--all":    out.all = true; break;
      case "--only":   out.only = v.split(",").map((x) => x.trim()).filter(Boolean); i++; break;
      case "--force":  out.force = true; break;
      case "--dry-run": out.dryRun = true; break;
      case "--provider": out.provider = v as Provider; i++; break;
      case "--model":  out.model = v; modelExplicit = true; i++; break;
      case "--quality": out.quality = v as GenQuality; i++; break;
      case "--size":   out.size = parseInt(v, 10); i++; break;
    }
  }
  if (!modelExplicit) out.model = DEFAULT_MODEL_PER_PROVIDER[out.provider];
  return out;
}

function help() {
  process.stdout.write(`gen-product-images — webMCP product image generator

Usage:
  tsx scripts/gen-product-images.ts --style <editorial|dipinto> [--test|--all|--only id1,id2]

Required:
  --style <editorial|dipinto>   Visual style template

Selection (choose ONE):
  --test                        Run the 4-product test bench: ${TEST_BENCH_IDS.join(", ")}
  --all                         Run the full catalog (${PRODUCTS.length} products)
  --only id1,id2,...            Run a specific subset of product ids

Options:
  --provider <name>             openai (default) | cloudflare
  --model <name>                Provider-specific. Defaults: openai→gpt-image-1, cloudflare→flux-2-dev
                                openai:     gpt-image-1 | dall-e-3 | dall-e-2
                                cloudflare: flux-2-dev | flux-2-klein-9b | flux-2-klein-4b | flux-1-schnell
  --quality <q>                 low | medium (default) | high | auto
  --size <px>                   Sharp output size, default 512
  --force                       Re-generate even if file exists
  --dry-run                     Print prompts/paths only — no API call, no files

Output:
  public/products/<style>/<id>.webp
  public/products/<style>/<id>.json   (sidecar: prompt, model, seed used)

Env:
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (Workers AI:Edit scope)
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.style) {
    help();
    process.exit(args.help ? 0 : 1);
  }
  if (!STYLE_TEMPLATES[args.style]) {
    process.stderr.write(`Unknown style: ${args.style}\n`);
    process.exit(1);
  }

  let selected: Product[];
  if (args.test) {
    selected = TEST_BENCH_IDS
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
  } else if (args.all) {
    selected = PRODUCTS;
  } else if (args.only.length > 0) {
    selected = args.only
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
  } else {
    process.stderr.write("Pick one selection mode: --test, --all, or --only id1,id2,...\n");
    process.exit(1);
  }

  if (selected.length === 0) {
    process.stderr.write("No products selected.\n");
    process.exit(1);
  }

  const items = selected.map((p) => buildItem(p, args.style!));
  const outDir = `public/products/${args.style}`;

  const tag = args.dryRun ? "DRY-RUN  " : "";
  process.stdout.write(`▶ ${tag}style=${args.style}  provider=${args.provider}/${args.model}  quality=${args.quality}  size=${args.size}px  count=${items.length}\n`);
  process.stdout.write(`  out=${outDir}\n`);

  const startedAll = Date.now();
  let dryWouldSkip = 0;
  let dryWouldGen = 0;

  const result = await generateImages({
    items,
    provider: args.provider,
    model: args.model,
    quality: args.quality,
    outDir,
    format: "webp",
    size: args.size,
    encodeQuality: 88,
    concurrency: 2,
    force: args.force,
    dryRun: args.dryRun,
    onProgress: (e) => {
      if (e.type === "skip") {
        process.stdout.write(`  ⊘ [${e.index + 1}/${e.total}] ${e.id} skipped (exists)\n`);
      } else if (e.type === "generated") {
        process.stdout.write(`  ✓ [${e.index + 1}/${e.total}] ${e.id} (${(e.durationMs / 1000).toFixed(1)}s)\n`);
      } else if (e.type === "dry-run") {
        if (e.plan.willSkip) dryWouldSkip++; else dryWouldGen++;
        const t = e.plan.willSkip ? "would-skip " : "would-gen   ";
        process.stdout.write(`\n  ◆ [${e.index + 1}/${e.total}] ${t}${e.plan.id}\n`);
        process.stdout.write(`     out:    ${e.plan.outPath}\n`);
        process.stdout.write(`     model:  ${e.plan.model}${e.plan.seed != null ? `   seed: ${e.plan.seed}` : ""}\n`);
        process.stdout.write(`     prompt: ${e.plan.prompt}\n`);
        if (e.plan.negativePrompt) {
          process.stdout.write(`     neg:    ${e.plan.negativePrompt}\n`);
        }
      } else if (e.type === "error") {
        process.stdout.write(`  ✗ [${e.index + 1}/${e.total}] ${e.id}: ${e.error}\n`);
      }
    },
  });

  const elapsed = ((Date.now() - startedAll) / 1000).toFixed(1);
  if (args.dryRun) {
    process.stdout.write(`\n● dry-run done in ${elapsed}s — planned:${result.planned?.length ?? 0}  would-generate:${dryWouldGen}  would-skip:${dryWouldSkip}\n`);
  } else {
    process.stdout.write(`\n● done in ${elapsed}s — generated:${result.generated.length} skipped:${result.skipped.length} failed:${result.failed.length}\n`);
  }
  process.exit(result.failed.length > 0 ? 2 : 0);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
