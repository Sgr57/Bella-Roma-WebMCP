import type {
  CloudflareModel,
  ImageProvider,
  Provider,
  ProviderRequest,
} from "../types.js";
import { ProviderError } from "../types.js";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;

const DEFAULT_STEPS: Record<CloudflareModel, number> = {
  "flux-1-schnell": 4,
  "flux-2-klein-4b": 20,
  "flux-2-klein-9b": 28,
  "flux-2-dev": 28,
};

function isFlux2(model: CloudflareModel): boolean {
  return model.startsWith("flux-2");
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export interface CloudflareProviderOptions {
  accountId: string;
  apiToken: string;
  model: CloudflareModel;
  maxRetries?: number;
}

export class CloudflareProvider implements ImageProvider {
  readonly providerName: Provider = "cloudflare";
  readonly model: CloudflareModel;
  private accountId: string;
  private apiToken: string;
  private maxRetries: number;

  constructor(opts: CloudflareProviderOptions) {
    if (!opts.accountId) throw new Error("CloudflareProvider: accountId is required");
    if (!opts.apiToken) throw new Error("CloudflareProvider: apiToken is required");
    this.accountId = opts.accountId;
    this.apiToken = opts.apiToken;
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
        // Retry on transient backend failures (5xx) and network errors.
        // Never retry 4xx — those are caller errors.
        const isRetryable = status === 0 || (status >= 500 && status < 600);
        if (!isRetryable || attempt === this.maxRetries) throw err;
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
    throw lastErr;
  }

  private async generateOnce(req: ProviderRequest): Promise<Buffer> {
    const url = `${CF_API_BASE}/accounts/${this.accountId}/ai/run/@cf/black-forest-labs/${this.model}`;
    const steps = req.steps ?? DEFAULT_STEPS[this.model];

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
    };
    let body: BodyInit;

    if (isFlux2(this.model)) {
      // Flux 2 family on Workers AI requires multipart/form-data.
      const form = new FormData();
      form.set("prompt", req.prompt);
      if (typeof steps === "number") form.set("steps", String(steps));
      if (typeof req.seed === "number") form.set("seed", String(req.seed));
      if (req.width) form.set("width", String(req.width));
      if (req.height) form.set("height", String(req.height));
      if (req.negativePrompt) form.set("negative_prompt", req.negativePrompt);
      body = form;
    } else {
      const json: Record<string, unknown> = { prompt: req.prompt };
      if (typeof steps === "number") json.steps = steps;
      if (typeof req.seed === "number") json.seed = req.seed;
      if (req.width) json.width = req.width;
      if (req.height) json.height = req.height;
      if (req.negativePrompt) json.negative_prompt = req.negativePrompt;
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    }

    const res = await fetch(url, { method: "POST", headers, body });

    if (!res.ok) {
      let parsed: unknown = null;
      const txt = await res.text();
      try { parsed = JSON.parse(txt); } catch { parsed = txt; }
      throw new ProviderError(
        `Cloudflare Workers AI returned ${res.status}`,
        res.status,
        parsed
      );
    }

    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const json = (await res.json()) as {
        result?: { image?: string };
        success?: boolean;
        errors?: unknown;
      };
      // CF returns `errors: []` on success — only treat as error when non-empty.
      const hasErrors = Array.isArray(json.errors) && json.errors.length > 0;
      if (json.success === false || hasErrors) {
        throw new ProviderError("Cloudflare Workers AI returned an error payload", 200, json);
      }
      const b64 = json.result?.image;
      if (typeof b64 !== "string" || b64.length === 0) {
        throw new ProviderError("Unexpected response shape: no result.image", 200, json);
      }
      return Buffer.from(b64, "base64");
    }

    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }
}
