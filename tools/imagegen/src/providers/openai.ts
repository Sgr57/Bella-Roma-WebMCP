import type {
  ImageProvider,
  OpenAIModel,
  Provider,
  ProviderRequest,
} from "../types.js";
import { ProviderError } from "../types.js";

const OPENAI_API_BASE = "https://api.openai.com/v1";
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export interface OpenAIProviderOptions {
  apiKey: string;
  model: OpenAIModel;
  maxRetries?: number;
}

// gpt-image-1 / dall-e-3 valid sizes. We snap requested width/height to the
// closest supported size by aspect ratio.
function pickSize(model: OpenAIModel, width?: number, height?: number): string {
  const w = width ?? 1024;
  const h = height ?? 1024;
  const ratio = w / h;

  if (model === "dall-e-2") {
    // dall-e-2 supports 256, 512, 1024 squares only.
    return "1024x1024";
  }
  if (model === "dall-e-3") {
    if (ratio > 1.2) return "1792x1024";
    if (ratio < 0.83) return "1024x1792";
    return "1024x1024";
  }
  // gpt-image-1
  if (ratio > 1.2) return "1536x1024";
  if (ratio < 0.83) return "1024x1536";
  return "1024x1024";
}

export class OpenAIProvider implements ImageProvider {
  readonly providerName: Provider = "openai";
  readonly model: OpenAIModel;
  private apiKey: string;
  private maxRetries: number;

  constructor(opts: OpenAIProviderOptions) {
    if (!opts.apiKey) throw new Error("OpenAIProvider: apiKey is required");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async generate(req: ProviderRequest): Promise<Buffer> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.generateOnce(req);
      } catch (err) {
        lastErr = err;
        const status = err instanceof ProviderError ? err.status : 0;
        // Retry transient backend errors (5xx) and 429 rate-limits;
        // and network errors. Never retry 4xx except 429.
        const isRetryable =
          status === 0 ||
          status === 429 ||
          (status >= 500 && status < 600);
        if (!isRetryable || attempt === this.maxRetries) throw err;
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
    throw lastErr;
  }

  private async generateOnce(req: ProviderRequest): Promise<Buffer> {
    const url = `${OPENAI_API_BASE}/images/generations`;
    const size = pickSize(this.model, req.width, req.height);

    const body: Record<string, unknown> = {
      model: this.model,
      prompt: req.prompt,
      n: 1,
      size,
    };

    if (this.model === "gpt-image-1") {
      // gpt-image-1 returns b64_json by default (response_format is not accepted).
      body.quality = req.quality ?? "medium";
      if (req.background && req.background !== "auto") {
        body.background = req.background;
        // Transparent bg requires a format with alpha. PNG is the safest default;
        // WebP also supports alpha but PNG is universally interoperable.
        body.output_format = req.background === "transparent" ? "png" : "png";
      }
    } else if (this.model === "dall-e-3") {
      body.response_format = "b64_json";
      body.quality = req.quality === "high" ? "hd" : "standard";
    } else {
      // dall-e-2
      body.response_format = "b64_json";
    }
    // Negative prompts are not supported by any OpenAI image model; silently drop.
    // Seeds are not supported either.

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let parsed: unknown = null;
      const txt = await res.text();
      try { parsed = JSON.parse(txt); } catch { parsed = txt; }
      throw new ProviderError(
        `OpenAI returned ${res.status}`,
        res.status,
        parsed
      );
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: unknown;
    };
    if (json.error) {
      throw new ProviderError("OpenAI returned an error payload", 200, json);
    }
    const b64 = json.data?.[0]?.b64_json;
    if (typeof b64 !== "string" || b64.length === 0) {
      throw new ProviderError("Unexpected response shape: no data[0].b64_json", 200, json);
    }
    return Buffer.from(b64, "base64");
  }
}
