type LogContext = Record<string, unknown>;

function write(level: "info" | "warn" | "error", event: string, context: LogContext = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context
  };

  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.info(JSON.stringify(payload));
}

export const logger = {
  info(event: string, context?: LogContext) {
    write("info", event, context);
  },
  warn(event: string, context?: LogContext) {
    write("warn", event, context);
  },
  error(event: string, error: unknown, context: LogContext = {}) {
    write("error", event, {
      ...context,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    });
  }
};
