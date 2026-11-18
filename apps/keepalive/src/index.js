/** Calls the game server's health check on a schedule, so the host never sees it idle and puts it to sleep. */
export default {
  async scheduled(_event, env) {
    try {
      const response = await fetch(`${env.SERVER_URL}/healthcheck`, { signal: AbortSignal.timeout(25_000) });
      if (!response.ok) console.error('keepalive: server answered', response.status);
    } catch (err) {
      // Asleep and still waking, or unreachable: the next run tries again.
      console.error('keepalive: no answer', String(err));
    }
  },
};
