/**
 * Unit tests for Logger utility
 */

import { Logger } from "./logger";

describe("Logger", () => {
  let logger: Logger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "warn").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Log Levels", () => {
    it("should respect minimum log level", () => {
      logger = new Logger({ logLevel: "warn" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.log).toHaveBeenCalledTimes(1); // Only warn
      expect(console.error).toHaveBeenCalledTimes(1); // Only error
    });

    it("should log all messages at debug level", () => {
      logger = new Logger({ logLevel: "debug" });

      logger.debug("debug");
      logger.info("info");
      logger.success("success");
      logger.warn("warn");
      logger.error("error");

      expect(console.log).toHaveBeenCalledTimes(4); // debug, info, success, warn
      expect(console.error).toHaveBeenCalledTimes(1); // error
    });
  });

  describe("Color Formatting", () => {
    it("should include colors when useColors is true", () => {
      logger = new Logger({ useColors: true });
      logger.info("test message");

      const call = (console.log as jest.Mock).mock.calls[0][0];
      expect(call).toContain("\x1b["); // ANSI color codes
    });

    it("should exclude colors when useColors is false", () => {
      logger = new Logger({ useColors: false });
      logger.info("test message");

      const call = (console.log as jest.Mock).mock.calls[0][0];
      expect(call).not.toContain("\x1b["); // No ANSI color codes
    });
  });

  describe("Message Formatting", () => {
    beforeEach(() => {
      logger = new Logger({ useColors: false });
    });

    it("should include icon in message", () => {
      logger.info("test");
      const call = (console.log as jest.Mock).mock.calls[0][0];
      expect(call).toContain("📋");
    });

    it("should format data as JSON when provided", () => {
      logger.info("test", { key: "value" });
      const call = (console.log as jest.Mock).mock.calls[0][0];
      expect(call).toContain('"key"');
      expect(call).toContain('"value"');
    });

    it("should handle error objects", () => {
      const error = new Error("Test error");
      logger.error("Failed", error);
      const call = (console.error as jest.Mock).mock.calls[0][0];
      expect(call).toContain("Test error");
    });
  });

  describe("Log Methods", () => {
    beforeEach(() => {
      logger = new Logger({ logLevel: "debug" });
    });

    it("should call console.log for debug", () => {
      logger.debug("debug message");
      expect(console.log).toHaveBeenCalled();
    });

    it("should call console.log for info", () => {
      logger.info("info message");
      expect(console.log).toHaveBeenCalled();
    });

    it("should call console.log for success", () => {
      logger.success("success message");
      expect(console.log).toHaveBeenCalled();
    });

    it("should call console.warn for warn", () => {
      logger.warn("warn message");
      expect(console.warn).toHaveBeenCalled();
    });

    it("should call console.error for error", () => {
      logger.error("error message");
      expect(console.error).toHaveBeenCalled();
    });
  });
});
