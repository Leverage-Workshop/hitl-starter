import { defineConfig } from "@trigger.dev/sdk";

/**
 * trigger.dev project config — the engine side of the quote-desk contract.
 *
 * `project` is the project ref from the trigger.dev dashboard. It is read from
 * `TRIGGER_PROJECT_REF` so the ref is not hard-committed; replace the fallback
 * with your real `proj_…` ref (or set the env var) before `dev`/`deploy`.
 * See docs/clients/halberd-co/workflows/quote-desk-setup.md.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_REPLACE_ME",
  dirs: ["./trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
