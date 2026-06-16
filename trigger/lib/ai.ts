/**
 * AI SDK model factory — wraps the OpenRouter provider so quote-desk tasks share
 * one configured LLM entry point.
 *
 * Usage (Vercel AI SDK):
 *
 *   import { generateObject } from "ai";
 *   import { getModel } from "@/trigger/lib/ai";
 *
 *   const { object } = await generateObject({ model: getModel(), schema, prompt });
 *
 * Default model is `anthropic/claude-sonnet-4-6`; pass any OpenRouter model id to
 * swap it (e.g. `getModel("anthropic/claude-opus-4-1")`).
 */
import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

/** Default OpenRouter model id for quote-desk extraction + drafting. */
export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

let provider: OpenRouterProvider | undefined;

/** Lazily build (and cache) the OpenRouter provider from `OPENROUTER_API_KEY`. */
function getProvider(): OpenRouterProvider {
  if (!provider) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set — required to call the OpenRouter LLM provider.",
      );
    }
    provider = createOpenRouter({ apiKey });
  }
  return provider;
}

/**
 * Resolve an AI SDK `LanguageModel` for the given OpenRouter model id, defaulting
 * to {@link DEFAULT_MODEL}. The result is passed directly to `generateObject` /
 * `generateText`.
 */
export function getModel(modelId: string = DEFAULT_MODEL): LanguageModel {
  return getProvider().chat(modelId);
}
