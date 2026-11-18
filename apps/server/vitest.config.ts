import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Short matchmaking timers so the queue tests do not wait real minutes.
    env: {
      MATCH_SCAN_MS: '100',
      MATCH_BOT_FILL_SECONDS: '2',
      MATCH_ACCEPT_SECONDS: '2',
      MATCH_DRAFT_SECONDS: '2',
      GOOGLE_CLIENT_ID: 'test-client-id',
    },
  },
});
