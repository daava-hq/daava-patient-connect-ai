export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
}

export function logError(message: string, error?: unknown, meta?: Record<string, unknown>) {
  const err = error instanceof Error ? { name: error.name, message: error.message } : error;
  console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, error: err, ...meta }));
}
