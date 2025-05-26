import z from "zod";

export const getVideoListSchema = {
    query: z.string(),
    include_transcript: z.boolean().default(true),
    max_results: z.number().default(5),
    start_date: z.string().datetime().default(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    end_date: z.string().datetime().default(new Date().toISOString()),
};

export const searchRedditPostSchema = {
  subreddit: z.string().optional(),
  query: z.string(),
  sort: z.enum(['relevance', 'hot', 'new', 'top', 'rising']).default('relevance'),
  time: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('all'),
  limit: z.number().default(5),
  max_comments: z.number().default(10),
  depth: z.number().default(2),
}

export const searchRedditSubredditSchema = {
  count: z.number().default(0),
  query: z.string(),
  limit: z.number().default(25),
  show_users: z.boolean().default(false),
  sort: z.enum(['relevance', 'activity']).default('relevance'),
  sub_reddit_details: z.boolean().default(false),
}

export const searchTweetsSchema = {
  query: z.string().describe("The search query"),
  maxResults: z.number().default(25).describe("The maximum number of results to return"),
  lang: z.string().optional().describe("The language of the tweets"),
  resultType: z.enum(["recency", "relevancy"]).default("relevancy").describe("The type of results to return"),
}