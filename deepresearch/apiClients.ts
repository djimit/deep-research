import { createTogetherAI } from "@ai-sdk/togetherai";
import Exa from "exa-js";
import "dotenv/config";

import { SearchResult } from "./models";
import { getConfig } from "./config-manager";
import { validateApiKey } from "./security";

// Get configuration
const config = getConfig();

// Validate API keys
validateApiKey(config.apiKeys.togetherAI, "TOGETHER_API_KEY");
validateApiKey(config.apiKeys.exaSearch, "EXA_API_KEY");

export const togetheraiClient = createTogetherAI({
  apiKey: config.apiKeys.togetherAI,
});

const exa = new Exa(config.apiKeys.exaSearch);

type SearchResults = {
  results: SearchResult[];
};

export const searchOnExa = async ({
  query,
}: {
  query: string;
}): Promise<SearchResults> => {
  try {
    const search = await exa.searchAndContents(query, {
      type: "keyword",
      text: true,
      numResults: 5,
    });

    const results = search.results.map((result) => {
      return new SearchResult({
        title: result.title || "",
        link: result.url,
        content: result.text,
      });
    });

    return {
      results,
    };
  } catch (e) {
    throw new Error(`Exa web search API error: ${e}`);
  }
};
