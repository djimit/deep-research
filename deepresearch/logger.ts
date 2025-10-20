/**
 * Logger utility for consistent logging throughout the application
 */

export type LogLevel = "debug" | "info" | "success" | "warn" | "error";

export interface LoggerOptions {
  useColors?: boolean;
  logLevel?: LogLevel;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
};

const COLORS = {
  debug: "\x1b[90m", // Gray
  info: "\x1b[36m", // Cyan
  success: "\x1b[32m", // Green
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  reset: "\x1b[0m",
};

const ICONS = {
  debug: "🔍",
  info: "📋",
  success: "✅",
  warn: "⚠️",
  error: "❌",
};

export class Logger {
  private useColors: boolean;
  private minLogLevel: number;

  constructor(options: LoggerOptions = {}) {
    this.useColors = options.useColors ?? true;
    this.minLogLevel = LOG_LEVELS[options.logLevel ?? "info"];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLogLevel;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const icon = ICONS[level];
    const color = this.useColors ? COLORS[level] : "";
    const reset = this.useColors ? COLORS.reset : "";

    let formattedMessage = `${color}${icon} ${message}${reset}`;

    if (data !== undefined) {
      formattedMessage += `\n${color}${JSON.stringify(data, null, 2)}${reset}`;
    }

    return formattedMessage;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, data));
    }
  }

  success(message: string, data?: any): void {
    if (this.shouldLog("success")) {
      console.log(this.formatMessage("success", message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog("error")) {
      const errorData = error instanceof Error ? error.message : error;
      console.error(this.formatMessage("error", message, errorData));
    }
  }
}

// Default logger instance
export const logger = new Logger();
