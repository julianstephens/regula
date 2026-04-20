/**
 * Simple logging utility for tracing application flow
 * All logs include timestamps and context information
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
): string {
  const timestamp = formatTimestamp();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    console.debug(formatLog("debug", message, context));
  },

  info: (message: string, context?: LogContext) => {
    console.info(formatLog("info", message, context));
  },

  warn: (message: string, context?: LogContext | Error) => {
    if (context instanceof Error) {
      console.warn(
        formatLog("warn", message, {
          error: context.message,
          stack: context.stack,
        }),
      );
    } else {
      console.warn(formatLog("warn", message, context));
    }
  },

  error: (message: string, context?: LogContext | Error) => {
    if (context instanceof Error) {
      console.error(
        formatLog("error", message, {
          error: context.message,
          stack: context.stack,
        }),
      );
    } else {
      console.error(formatLog("error", message, context));
    }
  },
};
