type Level = 'debug' | 'log' | 'warn' | 'error';

function write(level: Level, name: string, message: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, name, message, ...fields });
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(line + '\n');
}

/** One named logger per module, writing JSON lines. */
export function createLogger(name: string) {
  return {
    debug: (message: string, fields?: Record<string, unknown>) => write('debug', name, message, fields),
    log: (message: string, fields?: Record<string, unknown>) => write('log', name, message, fields),
    warn: (message: string, fields?: Record<string, unknown>) => write('warn', name, message, fields),
    error: (message: string, err?: unknown, fields?: Record<string, unknown>) =>
      write('error', name, message, { ...fields, error: err instanceof Error ? err.message : err }),
  };
}
