/**
 * Unit tests for data models
 */

import { SearchResult, SearchResults } from "./models";

describe("SearchResult", () => {
  it("should create a search result with all fields", () => {
    const result = new SearchResult({
      title: "Test Title",
      link: "https://example.com",
      content: "Test content",
    });

    expect(result.title).toBe("Test Title");
    expect(result.link).toBe("https://example.com");
    expect(result.content).toBe("Test content");
  });

  it("should format toString correctly", () => {
    const result = new SearchResult({
      title: "Test",
      link: "https://example.com",
      content: "A".repeat(2000),
    });

    const str = result.toString();
    expect(str).toContain("Title: Test");
    expect(str).toContain("Link: https://example.com");
    expect(str).toContain("Content:");
    // Content should be truncated to 1000 chars
    expect(str.length).toBeLessThan(2100);
  });

  it("should format shortStr correctly", () => {
    const result = new SearchResult({
      title: "Test",
      link: "https://example.com",
      content: "A".repeat(2000),
    });

    const str = result.shortStr();
    expect(str).toContain("Title: Test");
    expect(str).toContain("Link: https://example.com");
    expect(str).toContain("Content:");
    // Content should be truncated to 1000 chars
    expect(str.length).toBeLessThan(2100);
  });
});

describe("SearchResults", () => {
  const createMockResult = (id: number) =>
    new SearchResult({
      title: `Result ${id}`,
      link: `https://example.com/${id}`,
      content: `Content ${id}`,
    });

  it("should create an empty SearchResults", () => {
    const results = new SearchResults([]);
    expect(results.results).toHaveLength(0);
  });

  it("should create SearchResults with multiple items", () => {
    const results = new SearchResults([
      createMockResult(1),
      createMockResult(2),
    ]);
    expect(results.results).toHaveLength(2);
  });

  it("should format toString with indices", () => {
    const results = new SearchResults([
      createMockResult(1),
      createMockResult(2),
    ]);

    const str = results.toString();
    expect(str).toContain("[1]");
    expect(str).toContain("[2]");
    expect(str).toContain("Result 1");
    expect(str).toContain("Result 2");
  });

  it("should add two SearchResults together", () => {
    const results1 = new SearchResults([createMockResult(1)]);
    const results2 = new SearchResults([createMockResult(2)]);

    const combined = results1.add(results2);
    expect(combined.results).toHaveLength(2);
    expect(combined.results[0].title).toBe("Result 1");
    expect(combined.results[1].title).toBe("Result 2");
  });

  it("should deduplicate results by link", () => {
    const results = new SearchResults([
      new SearchResult({
        title: "First",
        link: "https://example.com/same",
        content: "Content 1",
      }),
      new SearchResult({
        title: "Second",
        link: "https://example.com/different",
        content: "Content 2",
      }),
      new SearchResult({
        title: "Third",
        link: "https://example.com/same",
        content: "Content 3",
      }),
    ]);

    const deduped = results.dedup();
    expect(deduped.results).toHaveLength(2);
    expect(deduped.results[0].title).toBe("First");
    expect(deduped.results[1].title).toBe("Second");
  });

  it("should preserve order when deduplicating", () => {
    const results = new SearchResults([
      createMockResult(1),
      createMockResult(2),
      createMockResult(1), // Duplicate
      createMockResult(3),
    ]);

    const deduped = results.dedup();
    expect(deduped.results).toHaveLength(3);
    expect(deduped.results[0].title).toBe("Result 1");
    expect(deduped.results[1].title).toBe("Result 2");
    expect(deduped.results[2].title).toBe("Result 3");
  });

  it("should return empty SearchResults when deduplicating empty array", () => {
    const results = new SearchResults([]);
    const deduped = results.dedup();
    expect(deduped.results).toHaveLength(0);
  });
});
