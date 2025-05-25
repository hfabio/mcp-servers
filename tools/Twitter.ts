import z from "zod";
import { MCPResponse, MCPTool } from "../@types";
import { TwitterApi } from "twitter-api-v2";
import { searchTweetsSchema } from "./validators";
import { createCacheFile } from "utils/cache";

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN as string);
const readOnlyClient = twitterClient.readOnly.v2;
const writeCache = createCacheFile('YouTube');

export const searchTweets: MCPTool = [
  "search-tweets",
  "Search Tweets",
  searchTweetsSchema,
  async (props) => {
    const {query, maxResults} = z.object(searchTweetsSchema).parse(props);
    const tweetsRequest = await readOnlyClient.search(query, {
      "user.fields": ["name", "username", "description", "location", "url"],
      "media.fields": ["preview_image_url", "url", "alt_text"],
      "tweet.fields": ["created_at","lang","public_metrics","source", "article", "note_tweet"],
    });
    const tweets = [];
    for await (const tweet of tweetsRequest) {
      tweets.push(tweet);
      if (tweets.length >= maxResults) {
        break;
      }
    }
    const data = tweetsRequest?.data || []
    const payload: MCPResponse = {
      content: data?.map?.((tweet) => ({
        type: "text",
        text: tweet.text,
        url: `https://twitter.com/${tweet.author_id}/status/${tweet.id}`,
      })) || [],
    };
    writeCache('search-subreddit', 'raw-data', data);
    writeCache('search-subreddit', 'response', payload);
    return payload;
  },
]

export default [
  searchTweets
]