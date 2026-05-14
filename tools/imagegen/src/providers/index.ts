import type {
  CloudflareModel,
  GenerateOptions,
  ImageProvider,
  OpenAIModel,
} from "../types.js";
import { CloudflareProvider } from "./cloudflare.js";
import { OpenAIProvider } from "./openai.js";

export { CloudflareProvider } from "./cloudflare.js";
export { OpenAIProvider } from "./openai.js";

/**
 * Resolve credentials from explicit options first, then from env.
 * Throws a clear, provider-specific error if anything is missing.
 */
export function createProvider(opts: GenerateOptions): ImageProvider {
  if (opts.provider === "cloudflare") {
    const accountId = opts.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = opts.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID (env or opts.accountId) for provider=cloudflare");
    if (!apiToken) throw new Error("Missing CLOUDFLARE_API_TOKEN (env or opts.apiToken) for provider=cloudflare");
    return new CloudflareProvider({
      accountId,
      apiToken,
      model: opts.model as CloudflareModel,
    });
  }
  if (opts.provider === "openai") {
    const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY (env or opts.apiKey) for provider=openai");
    return new OpenAIProvider({
      apiKey,
      model: opts.model as OpenAIModel,
    });
  }
  throw new Error(`Unknown provider: ${String((opts as { provider: unknown }).provider)}`);
}
