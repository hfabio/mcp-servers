import z from "zod";
import { MCPTool } from "../@types";
import { TwitterApi } from "twitter-api-v2";
import { searchTweetsSchema } from "./validators";

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN as string);
const readOnlyClient = twitterClient.readOnly.v2;

export const searchTweets: MCPTool = [
  "searchTweets",
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
    return {
      content: tweetsRequest?.data?.map?.((tweet) => ({
        type: "text",
        text: tweet.text,
        url: `https://twitter.com/${tweet.author_id}/status/${tweet.id}`,
      })) || [],
    };
  },
]

export default [
  searchTweets
]