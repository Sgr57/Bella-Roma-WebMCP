#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { generateImages } from "./index.js";
import type {
  GenerateItem,
  GenQuality,
  ImageFormat,
  Provider,
} from "./types.js";

interface ParsedArgs {
  input?: string;
  out?: string;
  provider: Provider;
  model: string;
  format: ImageFormat;
  size: number;
  encodeQuality: number;
  quality: GenQuality;
  width: number;
  height: number;
  concurrency: number;
  steps?: number;
  force: boolean;
  dryRun: boolean;
  help: boolean;
}

const DEFAULT_MODEL_PER_PROVIDER: Record<Provider, string> = {
  openai: "gpt-image-1",
  cloudflare: "flux-2-dev",
};

function parseArgs(argv: string[]): ParsedArgs {
  const a: ParsedArgs = {
    provider: "openai",
    model: "",
    format: "webp",
    size: 512,
    encodeQuality: 85,
    quality: "medium",
    width: 1024,
    height: 1024,
    concurrency: 2,
    force: false,
    dryRun: false,
    help: false,
  };
  let modelExplicit = false;

  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case "-h":
      case "--help":
        a.help = true;
        break;
      case "--input":          a.input = v; i++; break;
      case "--out":            a.out = v; i++; break;
      case "--provider":       a.provider = v as Provider; i++; break;
      case "--model":          a.model = v; modelExplicit = true; i++; break;
      case "--format":         a.format = v as ImageFormat; i++; break;
      case "--size":           a.size = parseInt(v, 10); i++; break;
      case "--encode-quality": a.encodeQuality = parseInt(v, 10); i++; break;
      case "--quality":        a.quality = v as GenQuality; i++; break;
      case "--width":          a.width = parseInt(v, 10); i++; break;
      case "--height":         a.height = parseInt(v, 10); i++; break;
      case "--concurrency":    a.concurrency = parseInt(v, 10); i++; break;
      case "--steps":          a.steps = parseInt(v, 10); i++; break;
      case "--force":          a.force = true; break;
      case "--dry-run":        a.dryRun = true; break;
    }
  }
  if (!modelExplicit) a.model = DEFAULT_MODEL_PER_PROVIDER[a.provider];
  return a;
}

function printHelp() {
  process.stdout.write(`imagegen — agnostic multi-provider image generator

Usage:
  imagegen --input items.json --out ./out [options]

Required env (depending on --provider):
  OPENAI_API_KEY                                              (provider: openai)
  CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN                (provider: cloudflare)

Options:
  --input <file>                  JSON file: [{ "id": "x", "prompt": "..." }, ...]
  --out <dir>                     Output directory
  --provider <name>               openai (default) | cloudflare
  --model <name>                  Provider-specific model id (defaults: gpt-image-1 / flux-2-dev)
                                  openai:     gpt-image-1 | dall-e-3 | dall-e-2
                                  cloudflare: flux-2-dev | flux-2-klein-9b | flux-2-klein-4b | flux-1-schnell
  --quality <low|medium|high|auto>  Generation quality (default: medium). gpt-image-1: direct;
                                  dall-e-3: high→hd, others→standard; Cloudflare Flux: ignored.
  --width <px>                    Requested generation width  (default: 1024)
  --height <px>                   Requested generation height (default: 1024)
  --format <fmt>                  Output container: webp | png | jpeg (default: webp)
  --size <px>                     Output square px after sharp resize (default: 512)
  --encode-quality <0-100>        Sharp encoder quality for webp/jpeg (default: 85)
  --steps <n>                     Override diffusion steps (Cloudflare Flux only)
  --concurrency <n>               Parallel requests (default: 2)
  --force                         Re-generate even if output exists
  --dry-run                       Print plan; no network, no files
  -h, --help                      Show this help
`);
}

async function loadItems(file: string): Promise<GenerateItem[]> {
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("input file must be a JSON array");
  return parsed.map((row: unknown, i: number) => {
    if (!row || typeof row !== "object") throw new Error(`item[${i}] is not an object`);
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string") throw new Error(`item[${i}].id must be string`);
    if (typeof r.prompt !== "string") throw new Error(`item[${i}].prompt must be string`);
    return {
      id: r.id,
      prompt: r.prompt,
      negativePrompt: typeof r.negativePrompt === "string" ? r.negativePrompt : undefined,
      seed: typeof r.seed === "number" ? r.seed : undefined,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input || !args.out) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const items = await loadItems(args.input);
  const startedAll = Date.now();

  let dryWouldSkip = 0;
  let dryWouldGen = 0;

  const result = await generateImages({
    items,
    provider: args.provider,
    model: args.model,
    outDir: args.out,
    format: args.format,
    size: args.size,
    encodeQuality: args.encodeQuality,
    quality: args.quality,
    width: args.width,
    height: args.height,
    concurrency: args.concurrency,
    steps: args.steps,
    force: args.force,
    dryRun: args.dryRun,
    onProgress: (e) => {
      if (e.type === "start") {
        const tag = e.dryRun ? "DRY-RUN " : "";
        process.stdout.write(`▶ ${tag}${args.provider}/${args.model}  quality=${args.quality}  count=${e.total}\n`);
      } else if (e.type === "skip") {
        process.stdout.write(`  ⊘ [${e.index + 1}/${e.total}] ${e.id} skipped (exists)\n`);
      } else if (e.type === "generated") {
        process.stdout.write(`  ✓ [${e.index + 1}/${e.total}] ${e.id} (${(e.durationMs / 1000).toFixed(1)}s)\n`);
      } else if (e.type === "dry-run") {
        if (e.plan.willSkip) dryWouldSkip++; else dryWouldGen++;
        const tag = e.plan.willSkip ? "would-skip " : "would-gen   ";
        process.stdout.write(`\n  ◆ [${e.index + 1}/${e.total}] ${tag}${e.plan.id}\n`);
        process.stdout.write(`     out:      ${e.plan.outPath}\n`);
        process.stdout.write(`     provider: ${e.plan.provider}/${e.plan.model}${e.plan.quality ? ` quality=${e.plan.quality}` : ""}${e.plan.seed != null ? `   seed=${e.plan.seed}` : ""}\n`);
        process.stdout.write(`     prompt:   ${e.plan.prompt}\n`);
        if (e.plan.negativePrompt) {
          process.stdout.write(`     neg:      ${e.plan.negativePrompt}\n`);
        }
      } else if (e.type === "error") {
        process.stdout.write(`  ✗ [${e.index + 1}/${e.total}] ${e.id}: ${e.error}\n`);
      } else if (e.type === "done") {
        const elapsed = ((Date.now() - startedAll) / 1000).toFixed(1);
        if (typeof e.planned === "number") {
          process.stdout.write(`\n● dry-run done in ${elapsed}s — planned:${e.planned}  would-generate:${dryWouldGen}  would-skip:${dryWouldSkip}\n`);
        } else {
          process.stdout.write(`\n● done in ${elapsed}s — generated:${e.generated} skipped:${e.skipped} failed:${e.failed}\n`);
        }
      }
    },
  });

  process.exit(result.failed.length > 0 ? 2 : 0);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
