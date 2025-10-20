/**
 * Unit tests for DeepResearchPipeline
 */

import { DeepResearchPipeline } from "./research-pipeline";
import { Logger } from "./logger";

// Mock the API clients to avoid making real API calls
jest.mock("./apiClients", () => ({
  togetheraiClient: jest.fn(() => "mock-model"),
  searchOnExa: jest.fn(),
}));

// Mock the AI SDK
jest.mock("ai", () => ({
  generateText: jest.fn(),
  generateObject: jest.fn(),
  extractReasoningMiddleware: jest.fn(() => ({})),
  wrapLanguageModel: jest.fn((config) => config.model),
}));

describe("DeepResearchPipeline", () => {
  let pipeline: DeepResearchPipeline;
  let mockLogger: Logger;

  beforeEach(() => {
    // Create a mock logger to suppress output during tests
    mockLogger = new Logger({ logLevel: "error", useColors: false });
    jest.spyOn(mockLogger, "info").mockImplementation();
    jest.spyOn(mockLogger, "debug").mockImplementation();
    jest.spyOn(mockLogger, "success").mockImplementation();
    jest.spyOn(mockLogger, "warn").mockImplementation();
    jest.spyOn(mockLogger, "error").mockImplementation();

    pipeline = new DeepResearchPipeline(undefined, undefined, undefined, {
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Input Validation", () => {
    it("should throw error for empty topic", async () => {
      await expect(pipeline.runResearch("")).rejects.toThrow(
        "Research topic cannot be empty"
      );
    });

    it("should throw error for whitespace-only topic", async () => {
      await expect(pipeline.runResearch("   ")).rejects.toThrow(
        "Research topic cannot be empty"
      );
    });

    it("should throw error for topic longer than 1000 characters", async () => {
      const longTopic = "A".repeat(1001);
      await expect(pipeline.runResearch(longTopic)).rejects.toThrow(
        "Research topic is too long"
      );
    });

    it("should accept valid topic length", async () => {
      const validTopic = "A".repeat(1000);
      // This will fail due to mocked functions, but should pass validation
      await expect(pipeline.runResearch(validTopic)).rejects.not.toThrow(
        "Research topic is too long"
      );
    });
  });

  describe("Configuration", () => {
    it("should accept custom maxQueries option", () => {
      const customPipeline = new DeepResearchPipeline(
        undefined,
        undefined,
        undefined,
        { maxQueries: 5 }
      );
      expect(customPipeline["researchConfig"].maxQueries).toBe(5);
    });

    it("should accept custom maxSources option", () => {
      const customPipeline = new DeepResearchPipeline(
        undefined,
        undefined,
        undefined,
        { maxSources: 10 }
      );
      expect(customPipeline["researchConfig"].maxSources).toBe(10);
    });

    it("should accept custom maxCompletionTokens option", () => {
      const customPipeline = new DeepResearchPipeline(
        undefined,
        undefined,
        undefined,
        { maxCompletionTokens: 4096 }
      );
      expect(customPipeline["researchConfig"].maxTokens).toBe(4096);
    });

    it("should use default logger if none provided", () => {
      const defaultPipeline = new DeepResearchPipeline();
      expect(defaultPipeline["logger"]).toBeDefined();
    });
  });

  describe("Retry Logic", () => {
    it("should retry failed operations", async () => {
      let attemptCount = 0;
      const failingFn = jest.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      });

      const result = await pipeline["retryWithBackoff"](failingFn, {
        maxRetries: 3,
        initialDelay: 10,
      });

      expect(result).toBe("success");
      expect(failingFn).toHaveBeenCalledTimes(3);
    });

    it("should throw error after max retries", async () => {
      const failingFn = jest.fn(async () => {
        throw new Error("Permanent failure");
      });

      await expect(
        pipeline["retryWithBackoff"](failingFn, {
          maxRetries: 2,
          initialDelay: 10,
        })
      ).rejects.toThrow("Permanent failure");

      expect(failingFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should log retry attempts", async () => {
      let attemptCount = 0;
      const failingFn = jest.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error("Temporary failure");
        }
        return "success";
      });

      await pipeline["retryWithBackoff"](failingFn, {
        maxRetries: 2,
        initialDelay: 10,
        operation: "Test operation",
      });

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("Context Truncation", () => {
    it("should not truncate short results", () => {
      const shortContent = "A".repeat(100);
      const result = pipeline["truncateResultsForContext"](
        { toString: () => shortContent } as any,
        1000
      );

      expect(result).toBe(shortContent);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should truncate long results", () => {
      const longContent = "A".repeat(30000);
      const result = pipeline["truncateResultsForContext"](
        { toString: () => longContent } as any,
        20000
      );

      expect(result.length).toBeLessThanOrEqual(20000);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should try to keep complete results when truncating", () => {
      const content = "Result 1\n\n" + "A".repeat(25000) + "\n\nResult 2";
      const result = pipeline["truncateResultsForContext"](
        { toString: () => content } as any,
        20000
      );

      // Should break at last complete result marker
      expect(result.length).toBeLessThanOrEqual(20000);
    });
  });
});
