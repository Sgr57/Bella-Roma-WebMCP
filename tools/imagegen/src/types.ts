export type Provider = "cloudflare" | "openai";

// Provider-specific model identifiers.
export type CloudflareModel =
  | "flux-1-schnell"
  | "flux-2-klein-4b"
  | "flux-2-klein-9b"
  | "flux-2-dev";

export type OpenAIModel = "gpt-image-1" | "dall-e-3" | "dall-e-2";

// Normalized quality level. Providers map this to their own scale:
//   - OpenAI gpt-image-1: low | medium | high | auto (direct mapping)
//   - OpenAI dall-e-3:    "low"/"medium" → "standard", "high" → "hd"
//   - Cloudflare Flux:    ignored (use `steps` instead)
export type GenQuality = "low" | "medium" | "high" | "auto";

export type ImageFormat = "webp" | "png" | "jpeg";

export interface GenerateItem {
  id: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
}

export interface GenerateOptions {
  items: GenerateItem[];
  provider: Provider;
  model: string;             // accepts any model valid for the chosen provider
  outDir: string;
  format?: ImageFormat;      // sharp output container (default: "webp")
  size?: number;             // sharp output square px (default: 512). Used when outWidth/outHeight not provided.
  outWidth?: number;         // sharp output width override (rectangular)
  outHeight?: number;        // sharp output height override (rectangular)
  encodeQuality?: number;    // sharp encoder quality 0-100 (default: 85)
  quality?: GenQuality;      // provider generation quality (default: "medium")
  steps?: number;            // diffusion steps; Flux-family only
  width?: number;            // requested generation width (default: 1024)
  height?: number;           // requested generation height (default: 1024)
  background?: "auto" | "transparent" | "opaque"; // gpt-image-1 only
  force?: boolean;
  dryRun?: boolean;
  saveSidecar?: boolean;
  concurrency?: number;
  onProgress?: (event: ProgressEvent) => void;
  // Credentials. If omitted, providers fall back to env:
  //   cloudflare → CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
  //   openai     → OPENAI_API_KEY
  accountId?: string;
  apiToken?: string;
  apiKey?: string;
}

export interface DryRunPlanItem {
  id: string;
  outPath: string;
  willSkip: boolean;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  provider: Provider;
  model: string;
  quality?: GenQuality;
}

export type ProgressEvent =
  | { type: "start"; total: number; dryRun: boolean }
  | { type: "skip"; id: string; path: string; index: number; total: number }
  | { type: "generated"; id: string; path: string; index: number; total: number; durationMs: number }
  | { type: "dry-run"; index: number; total: number; plan: DryRunPlanItem }
  | { type: "error"; id: string; error: string; index: number; total: number }
  | { type: "done"; generated: number; skipped: number; failed: number; planned?: number };

export interface GenerateResult {
  generated: { id: string; path: string }[];
  skipped: { id: string; path: string }[];
  failed: { id: string; error: string }[];
  planned?: DryRunPlanItem[];
}

// What every provider receives. Provider may ignore fields it doesn't support.
export interface ProviderRequest {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  quality?: GenQuality;
  width?: number;
  height?: number;
  /**
   * Background mode. Only OpenAI gpt-image-1 supports this today; other
   * providers silently ignore. "transparent" requires a format that supports
   * alpha (webp or png — NOT jpeg).
   */
  background?: "auto" | "transparent" | "opaque";
}

// Common interface implemented by every provider.
export interface ImageProvider {
  readonly providerName: Provider;
  readonly model: string;
  generate(req: ProviderRequest): Promise<Buffer>;
}

export interface SidecarMeta {
  id: string;
  provider: Provider;
  model: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  steps?: number;
  quality?: GenQuality;
  format: ImageFormat;
  size: number;
  outWidth: number;
  outHeight: number;
  encodeQuality: number;
  background?: "auto" | "transparent" | "opaque";
  /** Average color of the four corners — useful for matching a host page bg
      so the image blends seamlessly into the surrounding layout.
      Omitted when background=transparent (alpha pixels would skew the sample). */
  dominantCornerColor?: { r: number; g: number; b: number; hex: string };
  generatedAt: string;
  durationMs: number;
}

export class ProviderError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.body = body;
  }
}
