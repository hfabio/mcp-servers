import z from "zod";

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