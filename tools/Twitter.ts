import z from "zod";
import { MCPResponse, MCPTool } from "../@types";
import { searchTweetsSchema } from "./validators";
import { createCacheFile } from "utils/cache";

import { TwitterApi } from "twitter-api-v2";
import { TwitterApiRateLimitPlugin } from '@twitter-api-v2/plugin-rate-limit'

const rateLimitPlugin = new TwitterApiRateLimitPlugin();
const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN as string, { plugins: [rateLimitPlugin] });

const readOnlyClient = twitterClient.readOnly.v2;
const writeCache = createCacheFile('Twitter');

export const searchTweets: MCPTool = [
  "search-tweets",
  "Search Tweets",
  searchTweetsSchema,
  async (props) => {
    try {
      const { query, resultType } = z.object(searchTweetsSchema).parse(props);
      const tweetsRequest = await readOnlyClient.search(query, {
        sort_order: resultType,
        "user.fields": ["name", "username", "description", "location", "url", "entities", "connection_status"],
        "media.fields": ["preview_image_url", "url", "alt_text"],
        "tweet.fields": ["created_at", "lang", "public_metrics", "source", "article", "note_tweet", "author_id", "referenced_tweets", "withheld", "attachments"],
      });
      const currentRateLimitForMe = await rateLimitPlugin.v2.getRateLimit('users/me')
      const resetAt = currentRateLimitForMe?.reset ? new Date(currentRateLimitForMe?.reset * 1000).toLocaleString() : false;
      console.log(`[Twitter] Search query: ${query}, remaining requests: ${currentRateLimitForMe?.remaining}`);
      if (resetAt) console.log(`[Twitter] Search query: ${query}, rate limit reset at: ${resetAt}`);
      const data = tweetsRequest?.data?.data || [];
    const payload: MCPResponse = {
      content: [
        {
        type: "text",
          text: (data?.map?.((tweet, index) =>
            `# Tweet #${index + 1}${tweet.created_at ? ` created at: ${new Date(tweet.created_at).toLocaleString()}` : ''}
        - tweet ID: ${tweet.id}
        - metrics: ${JSON.stringify(tweet.public_metrics)}
        - tweet text: ${tweet.text}
        `) || ["No tweets found."]).join("\n\n"),
        }
      ]
    };
      writeCache('search-tweets', 'raw-data', { query, data });
      writeCache('search-tweets', 'response', payload);
    return payload;
    } catch (error: any) {
      if (error?.rateLimit?.reset) {
        const resetAt = new Date(error.rateLimit?.reset * 1000).toLocaleString();
        // calculate missing time in minutes:seconds
        const missingTimeInSeconds = Math.ceil((error.rateLimit?.reset * 1000 - Date.now()) / 1000);
        const missingMinutes = Math.floor(missingTimeInSeconds / 60);
        const missingSeconds = missingTimeInSeconds % 60;
        const missingTime = `${missingMinutes} minutes and ${missingSeconds} seconds`;
        console.error(`[Twitter] Rate limit (max of ${error?.rateLimit?.limit} in 15 minutes) exceeded, ${error?.rateLimit?.remaining} remaining\nreset at: ${resetAt}\nRemaining time: ${missingTime}`);
        return {
          content: [
            {
              type: "text",
              text: `Rate limit (max of ${error?.rateLimit?.limit} in 15 minutes) exceeded, ${error?.rateLimit?.remaining} remaining\nreset at: ${resetAt}\nRemaining time: ${missingTime}`,
            },
          ]
        }
      }
      return {
        content: [
          {
            type: "text",
            text: "Error fetching tweets: " + error,
          },
        ],
      }
    }
  },
]

export default [
  searchTweets
]