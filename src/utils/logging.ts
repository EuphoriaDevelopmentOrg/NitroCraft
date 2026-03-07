import { config } from "../config";

function format(args: unknown[]): string {
  return args.map((value) => {
    if (value instanceof Error) {
      return value.stack || value.message;
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }).join(" ");
}

function write(level: string, logger: (...items: unknown[]) => void, args: unknown[]): void {
  const prefix = config.server.logTime ? `${new Date().toISOString()} ${level}:` : `${level}:`;
  logger(prefix, format(args));
}

export const log = (...args: unknown[]) => write("INFO", console.log, args);
export const warn = (...args: unknown[]) => write("WARN", console.warn, args);
export const error = (...args: unknown[]) => write("ERROR", console.error, args);
export const debug = (...args: unknown[]) => {
  if (config.server.debugEnabled) {
    write("DEBUG", console.log, args);
  }
};
