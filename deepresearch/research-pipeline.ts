/**
 * Deep Research Pipeline Implementation
 */

import {
  SearchResults,
  SearchResult,
  FilteredResultsData,
  IterativeResearchResult,
} from "./models";
import { MODEL_CONFIG, PROMPTS, RESEARCH_CONFIG } from "./config";
import { togetheraiClient, searchOnExa } from "./apiClients";
import {
  generateText,
  generateObject,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import { Logger } from "./logger";

/**
 * Deep Research Pipeline
 *
 * This class implements the complete research pipeline, from query generation
 * to final report synthesis.
 */
export class DeepResearchPipeline {
  private modelConfig: typeof MODEL_CONFIG;
  private researchConfig: typeof RESEARCH_CONFIG;
  private prompts: typeof PROMPTS;
  private logger: Logger;

  private researchPlanSchema = z.object({
    queries: z
      .string()
      .array()
      .describe("A list of search queries to thoroughly research the topic"),
  });

  private sourceListSchema = z.object({
    sources: z.array(z.number()).describe("List of source indices to keep"),
  });

  constructor(
    modelConfig = MODEL_CONFIG,
    researchConfig = RESEARCH_CONFIG,
    prompts = PROMPTS,
    options: {
      maxQueries?: number;
      maxSources?: number;
      maxCompletionTokens?: number;
      logger?: Logger;
    } = {}
  ) {
    this.modelConfig = modelConfig;
    this.researchConfig = researchConfig;
    this.prompts = prompts;
    this.logger = options.logger ?? new Logger();

    // Override config with options
    if (options.maxQueries !== undefined) {
      this.researchConfig.maxQueries = options.maxQueries;
    }
    if (options.maxSources !== undefined) {
      this.researchConfig.maxSources = options.maxSources;
    }
    if (options.maxCompletionTokens !== undefined) {
      this.researchConfig.maxTokens = options.maxCompletionTokens;
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      initialDelay?: number;
      maxDelay?: number;
      operation?: string;
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelay = options.initialDelay ?? 1000;
    const maxDelay = options.maxDelay ?? 10000;
    const operation = options.operation ?? "Operation";

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          this.logger.error(
            `${operation} failed after ${maxRetries} retries`,
            lastError
          );
          throw lastError;
        }

        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        this.logger.warn(
          `${operation} failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`,
          { error: lastError.message }
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Generate initial research queries based on the topic
   *
   * @param topic The research topic
   * @returns List of search queries
   */
  private async generateInitialQueries({
    topic,
  }: {
    topic: string;
  }): Promise<string[]> {
    try {
      let allQueries = await this.generateResearchQueries(topic);

      if (allQueries.length === 0) {
        throw new Error(
          "Failed to generate research queries. The topic may be too vague or unclear. " +
            "Please try rephrasing your research question."
        );
      }

      if (this.researchConfig.maxQueries > 0) {
        allQueries = allQueries.slice(0, this.researchConfig.maxQueries);
      }

      this.logger.info(
        `Generated ${allQueries.length} initial queries`,
        allQueries
      );

      return allQueries;
    } catch (error) {
      this.logger.error("Failed to generate initial queries", error);
      throw error;
    }
  }

  /**
   * Generate research queries for a given topic using LLM
   *
   * @param topic The research topic
   * @returns List of search queries
   */
  private async generateResearchQueries(topic: string): Promise<string[]> {
    const parsedPlan = await this.retryWithBackoff(
      async () => {
        return await generateObject({
          model: togetheraiClient(this.modelConfig.jsonModel),
          messages: [
            { role: "system", content: this.prompts.planningPrompt },
            { role: "user", content: `Research Topic: ${topic}` },
          ],
          schema: this.researchPlanSchema,
        });
      },
      { operation: "Generate research queries" }
    );

    this.logger.debug(
      "Research queries generated:",
      parsedPlan.object.queries
    );

    return parsedPlan.object.queries;
  }

  /**
   * Perform a single web search
   */
  private async webSearch(query: string): Promise<SearchResults> {
    this.logger.info(`Performing web search`, { query });

    try {
      // Truncate long queries to avoid issues (like in the Python version)
      if (query.length > 400) {
        query = query.substring(0, 400);
        this.logger.warn(`Truncated query to 400 characters`, { query });
      }

      const searchResults = await this.retryWithBackoff(
        async () => await searchOnExa({ query }),
        { operation: "Web search" }
      );

      this.logger.success(
        `Web search completed: ${searchResults.results.length} results found`
      );

      // Process and summarize raw content if available
      const processedResults = await this.processSearchResultsWithSummarization(
        query,
        searchResults.results
      );

      return new SearchResults(processedResults);
    } catch (error) {
      this.logger.error(`Web search failed for query: ${query}`, error);
      throw error;
    }
  }

  /**
   * Process search results with content summarization
   *
   * @param query The search query
   * @param results The search results to process
   * @returns Processed search results with summarized content
   */
  private async processSearchResultsWithSummarization(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // Create tasks for summarization
    const summarizationTasks = [];
    const resultInfo = [];

    for (const result of results) {
      if (!result.content) {
        continue;
      }

      // Create a task for summarization
      const task = this._summarize_content_async({
        result,
        query,
      });

      summarizationTasks.push(task);
      resultInfo.push(result);
    }

    // Wait for all summarization tasks to complete
    const summarizedContents = await Promise.all(summarizationTasks);

    // Combine results with summarized content
    const formattedResults: SearchResult[] = [];
    for (let i = 0; i < resultInfo.length; i++) {
      const result = resultInfo[i];
      const summarizedContent = summarizedContents[i];

      formattedResults.push(
        new SearchResult({
          title: result.title || "",
          link: result.link,
          content: summarizedContent,
        })
      );
    }

    return formattedResults;
  }

  /**
   * Summarize content asynchronously using the LLM
   *
   * @param props The props object containing searchResult and query
   * @returns The summarized content
   */
  private async _summarize_content_async(props: {
    result: SearchResult;
    query: string;
  }): Promise<string> {
    this.logger.debug(`Summarizing content from URL: ${props.result.link}`);

    try {
      const result = await this.retryWithBackoff(
        async () => {
          return await generateText({
            model: togetheraiClient(this.modelConfig.summaryModel),
            messages: [
              {
                role: "system",
                content: this.prompts.rawContentSummarizerPrompt,
              },
              {
                role: "user",
                content: `<Raw Content>${props.result.content}</Raw Content>\n\n<Research Topic>${props.query}</Research Topic>`,
              },
            ],
          });
        },
        { operation: `Summarize content from ${props.result.link}` }
      );

      return result.text;
    } catch (error) {
      this.logger.warn(
        `Failed to summarize content from ${props.result.link}, using original content`,
        error
      );
      // Fallback to truncated original content if summarization fails
      return props.result.content.substring(0, 1000);
    }
  }

  /**
   * Execute searches for all queries in parallel
   *
   * @param queries List of search queries
   * @returns Combined search results
   */
  private async performSearch({
    queries,
  }: {
    queries: string[];
  }): Promise<SearchResults> {
    this.logger.info(`Performing ${queries.length} searches in parallel`);

    const tasks = queries.map(async (query) => {
      // Perform search
      const results = await this.webSearch(query);
      return results;
    });

    const resultsList = await Promise.all(tasks);

    let combinedResults = new SearchResults([]);
    for (const results of resultsList) {
      combinedResults = combinedResults.add(results);
    }

    const combinedResultsDedup = combinedResults.dedup();
    this.logger.success(
      `Search complete: ${combinedResultsDedup.results.length} unique results after deduplication`
    );

    return combinedResultsDedup;
  }

  /**
   * Truncate results to fit within context window
   */
  private truncateResultsForContext(
    results: SearchResults,
    maxLength: number = 20000
  ): string {
    const formattedResults = results.toString();

    if (formattedResults.length <= maxLength) {
      return formattedResults;
    }

    this.logger.warn(
      `Results exceed context length (${formattedResults.length} chars), truncating to ${maxLength} chars`
    );

    // Truncate but try to keep complete results
    const truncated = formattedResults.substring(0, maxLength);
    const lastCompleteResult = truncated.lastIndexOf("\n\n");

    return lastCompleteResult > maxLength / 2
      ? truncated.substring(0, lastCompleteResult)
      : truncated;
  }

  /**
   * Evaluate if the current search results are sufficient or if more research is needed
   *
   * @param topic The research topic
   * @param results Current search results
   * @param queries List of queries already used
   * @returns List of additional queries needed or empty list if research is complete
   */
  private async evaluateResearchCompleteness(
    topic: string,
    results: SearchResults,
    queries: string[]
  ): Promise<string[]> {
    this.logger.info("Evaluating research completeness");

    try {
      // Truncate results to avoid context length issues
      const formattedResults = this.truncateResultsForContext(results);

      const evaluation = await this.retryWithBackoff(
        async () => {
          return await generateText({
            model: togetheraiClient(this.modelConfig.planningModel),
            messages: [
              { role: "system", content: this.prompts.evaluationPrompt },
              {
                role: "user",
                content:
                  `<Research Topic>${topic}</Research Topic>\n\n` +
                  `<Search Queries Used>${queries}</Search Queries Used>\n\n` +
                  `<Current Search Results>${formattedResults}</Current Search Results>`,
              },
            ],
          });
        },
        { operation: "Evaluate research completeness" }
      );

      this.logger.debug("Evaluation result:", { text: evaluation.text });

      const parsedEvaluation = await this.retryWithBackoff(
        async () => {
          return await generateObject({
            model: togetheraiClient(this.modelConfig.jsonModel),
            messages: [
              { role: "system", content: this.prompts.evaluationParsingPrompt },
              {
                role: "user",
                content: `Evaluation to be parsed: ${evaluation.text}`,
              },
            ],
            schema: this.researchPlanSchema,
          });
        },
        { operation: "Parse evaluation result" }
      );

      this.logger.info(
        `Evaluation complete: ${parsedEvaluation.object.queries.length} additional queries needed`
      );

      return parsedEvaluation.object.queries;
    } catch (error) {
      this.logger.error("Failed to evaluate research completeness", error);
      // Return empty array to stop iteration on error
      return [];
    }
  }

  /**
   * Process search results by deduplicating and filtering
   *
   * @param topic The research topic
   * @param results Search results to process
   * @returns Filtered search results
   */
  private async processSearchResults({
    topic,
    results,
  }: {
    topic: string;
    results: SearchResults;
  }): Promise<SearchResults> {
    // Deduplicate results
    results = results.dedup();
    this.logger.info(
      `Search processing complete: ${results.results.length} unique results`
    );

    return results;
  }

  /**
   * Filter search results based on relevance to the topic
   *
   * @param topic The research topic
   * @param results Search results to filter
   * @returns Tuple of (filtered results, source list)
   */
  private async filterResults({
    topic,
    results,
  }: {
    topic: string;
    results: SearchResults;
  }): Promise<FilteredResultsData> {
    this.logger.info("Filtering results by relevance");

    try {
      const formattedResults = this.truncateResultsForContext(results);

      const filterResponse = await this.retryWithBackoff(
        async () => {
          return await generateText({
            model: togetheraiClient(this.modelConfig.planningModel),
            messages: [
              { role: "system", content: this.prompts.filterPrompt },
              {
                role: "user",
                content: `<Research Topic>${topic}</Research Topic>\n\n<Current Search Results>${formattedResults}</Current Search Results>`,
              },
            ],
          });
        },
        { operation: "Filter results by relevance" }
      );

      this.logger.debug("Filter response received");

      const parsedFilter = await this.retryWithBackoff(
        async () => {
          return await generateObject({
            model: togetheraiClient(this.modelConfig.jsonModel),
            messages: [
              { role: "system", content: this.prompts.sourceParsingPrompt },
              {
                role: "user",
                content: `Filter response to be parsed: ${filterResponse.text}`,
              },
            ],
            schema: this.sourceListSchema,
          });
        },
        { operation: "Parse filter response" }
      );

      const sources = parsedFilter.object.sources;
      this.logger.info(`Filtered sources identified`, { sources });

      // Limit sources if needed
      let limitedSources = sources;
      if (this.researchConfig.maxSources > 0) {
        limitedSources = sources.slice(0, this.researchConfig.maxSources);
      }

      // Filter the results based on the source list
      const filteredResults = new SearchResults(
        limitedSources
          .filter((i) => i > 0 && i <= results.results.length)
          .map((i) => results.results[i - 1])
      );

      this.logger.success(
        `Filtering complete: ${filteredResults.results.length} sources kept`
      );

      return {
        filteredResults,
        sourceIndices: limitedSources,
      };
    } catch (error) {
      this.logger.error("Failed to filter results, using all results", error);
      // Fallback: return top N results
      const fallbackResults = new SearchResults(
        results.results.slice(0, this.researchConfig.maxSources)
      );
      return {
        filteredResults: fallbackResults,
        sourceIndices: Array.from(
          { length: fallbackResults.results.length },
          (_, i) => i + 1
        ),
      };
    }
  }

  /**
   * Conduct iterative research within budget to refine results
   *
   * @param topic The research topic
   * @param initialResults Results from initial search
   * @param allQueries List of all queries used so far
   * @returns Tuple of (final results, all queries used)
   */
  private async conductIterativeResearch({
    topic,
    initialResults,
    allQueries,
  }: {
    topic: string;
    initialResults: SearchResults;
    allQueries: string[];
  }): Promise<IterativeResearchResult> {
    this.logger.info(
      `Starting iterative research (budget: ${this.researchConfig.budget} iterations)`
    );
    let results = initialResults;

    for (let i = 0; i < this.researchConfig.budget; i++) {
      this.logger.info(
        `Iteration ${i + 1}/${this.researchConfig.budget}: Evaluating research completeness`
      );

      // Evaluate if more research is needed
      const additionalQueries = await this.evaluateResearchCompleteness(
        topic,
        results,
        allQueries
      );

      // Exit if research is complete
      if (additionalQueries.length === 0) {
        this.logger.success("Research complete: No additional queries needed");
        break;
      }

      // Limit the number of queries if needed
      let queriesToUse = additionalQueries;
      if (this.researchConfig.maxQueries > 0) {
        queriesToUse = additionalQueries.slice(
          0,
          this.researchConfig.maxQueries
        );
      }

      this.logger.info(
        `Iteration ${i + 1}: Performing ${queriesToUse.length} additional searches`,
        { queries: queriesToUse }
      );

      // Expand research with new queries
      const newResults = await this.performSearch({ queries: queriesToUse });
      results = results.add(newResults);
      allQueries.push(...queriesToUse);
    }

    this.logger.success(
      `Iterative research complete: ${results.results.length} total results from ${allQueries.length} queries`
    );

    return {
      finalSearchResults: results,
      queriesUsed: allQueries,
    };
  }

  /**
   * Run the complete research pipeline
   *
   * @param topic The research topic
   * @returns The research answer
   */
  async runResearch(topic: string): Promise<string> {
    // Input validation
    if (!topic || topic.trim().length === 0) {
      throw new Error("Research topic cannot be empty");
    }

    if (topic.length > 1000) {
      throw new Error(
        "Research topic is too long (max 1000 characters). Please provide a more concise topic."
      );
    }

    this.logger.info(`Starting research pipeline`, { topic });

    try {
      // Step 1: Generate initial queries
      const initialQueries = await this.generateInitialQueries({ topic });

      // Step 2: Perform initial search
      const initialResults = await this.performSearch({
        queries: initialQueries,
      });

      // Step 3: Conduct iterative research
      const { finalSearchResults, queriesUsed } =
        await this.conductIterativeResearch({
          topic,
          initialResults,
          allQueries: initialQueries,
        });

      // Step 4: Process search results
      const processedResults = await this.processSearchResults({
        topic,
        results: finalSearchResults,
      });

      // Step 4.5: Filter results based on relevance
      const { filteredResults, sourceIndices } = await this.filterResults({
        topic,
        results: processedResults,
      });

      // Step 5: Generate research answer with feedback loop
      let answer = await this.generateResearchAnswer({
        topic,
        results: filteredResults,
      });

      this.logger.success("Research pipeline completed successfully");

      return answer;
    } catch (error) {
      this.logger.error("Research pipeline failed", error);
      throw error;
    }
  }

  /**
   * Generate a comprehensive answer to the research topic based on the search results
   *
   * @param topic The research topic
   * @param results Filtered search results to use for answer generation
   * @returns Detailed research answer as a string
   */
  private async generateResearchAnswer({
    topic,
    results,
  }: {
    topic: string;
    results: SearchResults;
  }): Promise<string> {
    this.logger.info("Generating final research report");

    try {
      const formattedResults = results.toString();

      const enhancedModel = wrapLanguageModel({
        model: togetheraiClient(this.modelConfig.answerModel),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });

      const answer = await this.retryWithBackoff(
        async () => {
          return await generateText({
            model: enhancedModel,
            messages: [
              { role: "system", content: this.prompts.answerPrompt },
              {
                role: "user",
                content: `Research Topic: ${topic}\n\nSearch Results:\n${formattedResults}`,
              },
            ],
            maxTokens: this.researchConfig.maxTokens,
          });
        },
        { operation: "Generate research report" }
      );

      this.logger.success(
        `Research report generated (${answer.text.length} characters)`
      );

      return answer.text.trim();
    } catch (error) {
      this.logger.error("Failed to generate research report", error);
      throw error;
    }
  }
}
