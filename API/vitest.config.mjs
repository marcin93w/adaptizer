import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

// Runs the tests inside a real workerd, so `env` carries the same D1 and R2
// bindings the deployed Worker sees. The publish path is only meaningfully
// testable against a real R2 put and a real SQLite upsert, so we bind both
// here rather than hand-mocking them.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        // wrangler.toml carries the production R2 bucket name; the pool gives
        // us an isolated in-memory bucket under the same `bucket` binding.
        r2Buckets: ['bucket'],
        bindings: { PUBLISH_API_KEY: 'test-key' },
      },
    }),
  ],
  test: {},
});
