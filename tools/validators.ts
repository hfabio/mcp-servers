import z from "zod";

export const searchRedditPostSchema = {
  subreddit: z.string().optional(),
  query: z.string(),
  sort: z.enum(['relevance', 'hot', 'new', 'top', 'rising']).default('relevance'),
  time: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('all'),
  limit: z.number().default(10),
}