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
  outW: number,
  outH: number,
  encodeQuality: number,
  preserveAlpha: boolean
): Promise<Buffer> {
  let pipeline = sharp(raw).resize(outW, outH, { fit: "cover" });
  if (format === "webp") {
    pipeline = pipeline.webp({
      quality: encodeQuality,
      ...(preserveAlpha ? { alphaQuality: 100 } : {}),
    });
  } else if (format === "jpeg") {
    // JPEG has no alpha — if caller wanted transparency this is the wrong format.
    pipeline = pipeline.jpeg({ quality: encodeQuality });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9 });
  }
  return pipeline.toBuffer();
}

/**
 * Sample the four corners of the encoded image and return the averaged RGB.
 * This is a robust proxy for "background color" when the subject lives in the
 * center and the corners are negative space (which is the case for our
 * editorial flat-lay style).
 */
async function sampleCornerColor(encoded: Buffer): Promise<{ r: number; g: number; b: number; hex: string }> {
  const img = sharp(encoded);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 8 || h < 8) return { r: 255, g: 255, b: 255, hex: "#FFFFFF" };

  const inset = 4; // px from edges, avoid any anti-aliasing artefacts
  const corners = [
    { left: inset, top: inset },
    { left: w - inset - 1, top: inset },
    { left: inset, top: h - inset - 1 },
    { left: w - inset - 1, top: h - inset - 1 },
  ];

  let r = 0, g = 0, b = 0;
  for (const c of corners) {
    const px = await sharp(encoded)
      .extract({ left: c.left, top: c.top, width: 1, height: 1 })
      .raw()
      .toBuffer();
    r += px[0];
    g += px[1];
    b += px[2];
  }
  r = Math.round(r / corners.length);
  g = Math.round(g / corners.length);
  b = Math.round(b / corners.length);
  const hex =
    "#" +
    [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  return { r, g, b, hex };
}

export async function generateImages(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const format: ImageFormat = opts.format ?? "webp";
  const size = opts.size ?? 512;
  const outWidth = opts.outWidth ?? size;
  const outHeight = opts.outHeight ?? size;
  const encodeQuality = opts.encodeQuality ?? 85;
  const background = opts.background;
  const preserveAlpha = background === "transparent";
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
          background,
        };
        const raw = await provider!.generate(providerReq);
        const encoded = await encode(raw, format, outWidth, outHeight, encodeQuality, preserveAlpha);
        await writeFile(outPath, encoded);

        const durationMs = Date.now() - started;
        // Corner sampling is meaningful only for opaque images. For transparent,
        // the corners are usually fully transparent and sampling adds no value.
        const dominantCornerColor = preserveAlpha ? undefined : await sampleCornerColor(encoded);

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
            outWidth,
            outHeight,
            encodeQuality,
            background,
            dominantCornerColor,
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
