import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { createProvider } from "./providers/index.js";
import type {
  DryRunPlanItem,
  GenerateOptions,
  GenerateResult,
  ImageFormat,
  ProgressEvent,
  ProviderRequest,
  SidecarMeta,
} from "./types.js";
import { ProviderError } from "./types.js";

export * from "./types.js";
export {
  CloudflareProvider,
  OpenAIProvider,
  createProvider,
} from "./providers/index.js";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function extFor(format: ImageFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

async function encode(
  raw: Buffer,
  format: ImageFormat,
  size: number,
  encodeQuality: number
): Promise<Buffer> {
  let pipeline = sharp(raw).resize(size, size, { fit: "cover" });
  if (format === "webp") pipeline = pipeline.webp({ quality: encodeQuality });
  else if (format === "jpeg") pipeline = pipeline.jpeg({ quality: encodeQuality });
  else pipeline = pipeline.png({ compressionLevel: 9 });
  return pipeline.toBuffer();
}

export async function generateImages(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const format: ImageFormat = opts.format ?? "webp";
  const size = opts.size ?? 512;
  const encodeQuality = opts.encodeQuality ?? 85;
  const quality = opts.quality ?? "medium";
  const width = opts.width ?? 1024;
  const height = opts.height ?? 1024;
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const saveSidecar = opts.saveSidecar ?? true;
  const force = opts.force ?? false;
  const dryRun = opts.dryRun ?? false;

  // Dry-run never touches the network or filesystem, so it must work without
  // credentials. We still build a provider only for real runs.
  let provider: ReturnType<typeof createProvider> | null = null;
  if (!dryRun) {
    provider = createProvider(opts);
    await mkdir(opts.outDir, { recursive: true });
  }

  const result: GenerateResult = { generated: [], skipped: [], failed: [] };
  if (dryRun) result.planned = [];
  const total = opts.items.length;
  const emit = (e: ProgressEvent) => opts.onProgress?.(e);

  emit({ type: "start", total, dryRun });

  let cursor = 0;
  const next = () => cursor++;

  const worker = async () => {
    while (true) {
      const idx = next();
      if (idx >= total) return;
      const item = opts.items[idx];
      const ext = extFor(format);
      const outPath = join(opts.outDir, `${item.id}.${ext}`);

      const exists = await fileExists(outPath);
      const willSkip = !force && exists;

      if (dryRun) {
        const plan: DryRunPlanItem = {
          id: item.id,
          outPath,
          willSkip,
          prompt: item.prompt,
          negativePrompt: item.negativePrompt,
          seed: item.seed,
          provider: opts.provider,
          model: opts.model,
          quality,
        };
        result.planned!.push(plan);
        emit({ type: "dry-run", index: idx, total, plan });
        continue;
      }

      if (willSkip) {
        result.skipped.push({ id: item.id, path: outPath });
        emit({ type: "skip", id: item.id, path: outPath, index: idx, total });
        continue;
      }

      const started = Date.now();
      try {
        await mkdir(dirname(outPath), { recursive: true });
        const providerReq: ProviderRequest = {
          prompt: item.prompt,
          negativePrompt: item.negativePrompt,
          seed: item.seed,
          steps: opts.steps,
          quality,
          width,
          height,
        };
        const raw = await provider!.generate(providerReq);
        const encoded = await encode(raw, format, size, encodeQuality);
        await writeFile(outPath, encoded);

        const durationMs = Date.now() - started;

        if (saveSidecar) {
          const meta: SidecarMeta = {
            id: item.id,
            provider: opts.provider,
            model: opts.model,
            prompt: item.prompt,
            negativePrompt: item.negativePrompt,
            seed: item.seed,
            steps: opts.steps,
            quality,
            format,
            size,
            encodeQuality,
            generatedAt: new Date().toISOString(),
            durationMs,
          };
          await writeFile(
            join(opts.outDir, `${item.id}.json`),
            JSON.stringify(meta, null, 2)
          );
        }

        result.generated.push({ id: item.id, path: outPath });
        emit({ type: "generated", id: item.id, path: outPath, index: idx, total, durationMs });
      } catch (err) {
        const message =
          err instanceof ProviderError
            ? `${err.message} :: ${JSON.stringify(err.body).slice(0, 400)}`
            : err instanceof Error
              ? err.message
              : String(err);
        result.failed.push({ id: item.id, error: message });
        emit({ type: "error", id: item.id, error: message, index: idx, total });
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  emit({
    type: "done",
    generated: result.generated.length,
    skipped: result.skipped.length,
    failed: result.failed.length,
    planned: dryRun ? result.planned!.length : undefined,
  });

  return result;
}
