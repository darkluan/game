interface RuntimeConfig {
  serverUrl: string;
}

function read(): RuntimeConfig {
  let injected: Partial<RuntimeConfig> = {};
  try {
    injected = JSON.parse(document.getElementById('__runtime_config__')?.textContent ?? '{}');
  } catch {
    // Malformed injected config: fall back to the dev defaults below.
  }
  return {
    serverUrl: injected.serverUrl || import.meta.env.VITE_SERVER_URL || 'http://localhost:2567',
  };
}

/** Read once from the JSON the host injects into index.html; build env is only a dev fallback. */
export const runtimeConfig = read();
