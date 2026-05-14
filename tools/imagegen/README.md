# imagegen

Agnostic, multi-provider image generator. Project-independent — drop this folder into any repo and use it.

**Providers** (pluggable):
- **OpenAI** — `gpt-image-1` (recommended), `dall-e-3`, `dall-e-2`
- **Cloudflare Workers AI** — Flux 2 family (`flux-2-dev`, `flux-2-klein-9b`, `flux-2-klein-4b`) + `flux-1-schnell`

**Features:**
- One-shot generation from a list of `{ id, prompt }`
- Post-processing built-in: resize + format conversion (webp/png/jpeg) via `sharp`
- Idempotent: existing outputs are skipped unless `--force`
- Sidecar JSON beside each image records provider/model/prompt/seed used
- Library API + standalone CLI
- `--dry-run` prints the planned prompts/paths with zero cost
- Retry on transient 5xx / network errors with exponential backoff

## Install (standalone, in another project)

```sh
cp -r tools/imagegen <your-project>/tools/imagegen
cd <your-project>/tools/imagegen
npm install
```

Requires Node ≥ 20.6 (uses native `fetch` and `--env-file`).

## Configure

Copy the env template next to the tool and fill in only the provider you'll use:

```sh
cp tools/imagegen/.env.example tools/imagegen/.env
$EDITOR tools/imagegen/.env
```

The tool reads (whichever is needed):

| Provider | Env vars |
|---|---|
| `openai` | `OPENAI_API_KEY` |
| `cloudflare` | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (Workers AI: Edit scope) |

You can also pass them programmatically as `apiKey` / `accountId` / `apiToken` to `generateImages`.

## Library usage

```ts
import { generateImages } from "./tools/imagegen/src/index.js";

await generateImages({
  items: [
    { id: "apple", prompt: "a single red apple on white background, studio photo" },
    { id: "pear",  prompt: "a single green pear on white background, studio photo" },
  ],
  provider: "openai",          // or "cloudflare"
  model: "gpt-image-1",        // provider-specific (defaults below)
  quality: "medium",           // "low" | "medium" | "high" | "auto"
  outDir: "./out",
  format: "webp",
  size: 512,                   // square px after sharp resize
  width: 1024, height: 1024,   // requested generation size (provider snaps to nearest)
  concurrency: 2,
  force: false,
  saveSidecar: true,
});
```

## CLI usage

```sh
# OpenAI (default)
npx tsx --env-file-if-exists=tools/imagegen/.env tools/imagegen/src/cli.ts \
  --input items.json --out ./out --quality medium

# Cloudflare Flux
npx tsx --env-file-if-exists=tools/imagegen/.env tools/imagegen/src/cli.ts \
  --input items.json --out ./out --provider cloudflare --model flux-2-dev

# Dry-run (no credentials needed)
npx tsx tools/imagegen/src/cli.ts --input items.json --out ./out --dry-run
```

## Cost & quality notes

**OpenAI gpt-image-1** (1024×1024, indicative pricing):
- `low` ≈ $0.011/img — fastest, great for prompt screening
- `medium` ≈ $0.042/img — default, very good editorial quality
- `high` ≈ $0.167/img — top fidelity, reserve for finals

**Cloudflare Workers AI**: free tier ~10k neurons/day shared across all models. A single `flux-2-dev` generation consumes ~3k neurons.

## How `--quality` maps per provider

| Quality | gpt-image-1 | dall-e-3 | dall-e-2 | Cloudflare Flux |
|---|---|---|---|---|
| `low` | low | standard | n/a | ignored — uses `--steps` |
| `medium` | medium | standard | n/a | ignored |
| `high` | high | hd | n/a | ignored |
| `auto` | auto | standard | n/a | ignored |

## Preview without spending money

`--dry-run` / `dryRun: true` prints the full planned prompt, provider, model, quality, seed and output path for every item. It does NOT call any API and does NOT touch the filesystem — works even before credentials are configured.

## Output

```
./out/
  apple.webp        ← final image (resized, encoded)
  apple.json        ← sidecar: { provider, model, prompt, quality, seed, durationMs, ... }
  pear.webp
  pear.json
```

Idempotency means re-running the script is free: only missing items are generated.
