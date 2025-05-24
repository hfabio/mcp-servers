import z from "zod";
import { MCPTool } from "../@types";
import { searchRedditPostSchema } from "./validators";
import {getCredentials, writeCredentials} from '../utils/credentials';

const {
  REDDIT_API_URL,
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_USERNAME,
  REDDIT_PASSWORD,
  REDDIT_APPLICATION_NAME,
} = process.env;

const userAgent = `node:${REDDIT_APPLICATION_NAME}:v1.0.0 (by /u/${REDDIT_USERNAME})`;

async function getAccessToken() {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) {
    throw new Error('Missing Reddit API credentials');
  }
    let credentials = await getCredentials();
    if (credentials?.reddit_token) return credentials.reddit_token;
    const authString = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('username', REDDIT_USERNAME as string);
    params.append('password', REDDIT_PASSWORD as string);

    try {
        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': userAgent
            },
            body: params.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao obter token de acesso: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Access Token obtido com sucesso!');
        await writeCredentials({
          ...credentials,
          reddit_token: data.access_token
        });
        return data.access_token;
    } catch (error) {
        console.error('Erro na autenticação:', error);
        throw error;
    }
}

const getHeaders = async () => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Failed to obtain access token');
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': userAgent
  };
}

const parseComment = (comment, isReply = false) => {
  const {
    author,
    body,
    permission,
    ups,
    downs,
    score,
    stickied,
    created,
    replies,
    depth = 0
  } = comment?.data;
  let parsedComment = `${''.padStart(depth, '\t')}## ${isReply || depth > 0 ? 'Reply to c' : 'C'}omment by ${author}`;
  parsedComment += `${permission === 'moderator' ? ' (moderator)' : ''}${stickied ? ' **stickied reply**' : ''}`;
  parsedComment += `\n${''.padStart(depth, '\t')}${body}`;
  parsedComment += `\n${''.padStart(depth, '\t')}Created at: ${new Date(created * 1000).toLocaleString()}`;
  parsedComment += `\n${''.padStart(depth, '\t')}Score: ${score} (${ups} upvotes, ${downs} downvotes)\n`;

  return {
    parsedComment,
    author,
    body,
    permission: permission ? 'admin' : 'user',
    ups,
    downs,
    score,
    stickied,
    depth,
    created,
    replies: replies?.data?.children.map(child => parseComment(child, true)),
  };
}

async function getPostData(subreddit){
  const {
    title,
    author,
    url,
    subreddit_name_prefixed,
    id,
    permalink
  } = subreddit;
  try {
    const test = await fetch(`${REDDIT_API_URL?.replace('/api', '')}${permalink}`, {
            headers: await getHeaders(),
    }).then(result => result.json());

    let sanitizedResponse = `
    # ${title} 
    by ${author} on subreddit ${subreddit_name_prefixed}
    url: ${url}
    Author message:
    ${test[0].data.children[0].data.selftext}`
    let outerReplies;
    if (test[1]?.data?.children?.length > 0) {
      outerReplies = test[1].data.children.map(parseComment);
      let replies = '';
      outerReplies.forEach((reply) => {
        replies += reply.parsedComment;
        let depthReplies = [...(reply.replies || [])];
        let currentReply;
        while (depthReplies.length > 0) {
          currentReply = depthReplies.shift();
          replies += currentReply.parsedComment;
          if (currentReply.replies?.length) depthReplies = [...(currentReply.replies || []), ...depthReplies];
        }
      });
      sanitizedResponse += `\n\n# Replies:\n${replies}`;
    }
    return {
      id,
      title,
      author,
      url,
      subreddit_name_prefixed,
      permalink,
      sanitizedResponse,
      replies: outerReplies
    }
  } catch (error) {
    console.log('Erro ao buscar post:', error);
    throw error;
  }
}

export const searchSubreddit: MCPTool = [
  'search-subreddit',
  {
    query: z.string(),
  },
  async ({ query }) => {
    const {
      query: sanitizedQuery,
    } = z.object({
      query: z.string(),
    }).parse({ query });

    try {
        const response = await fetch(`${REDDIT_API_URL}/search_subreddits`, {
            method: 'POST',
            headers: await getHeaders(),
            body: JSON.stringify({
                exact: false,
                query: sanitizedQuery.substring(0, 50),
                limit: 10,
            })
        }).then(result => result.json())
        .catch(async (error) => {
            const errorText = await error.text();
            throw new Error(`Erro ao buscar subreddits: ${errorText}`);
        });

        const data = response.subreddits;
        return data; 
    } catch (error) {
        console.error('Erro ao buscar subreddits:', error);
        throw error;
    }
  },
]

export const searchPosts: MCPTool = [
  'search-subreddit-posts',
  searchRedditPostSchema,
  async (params) => {
    const {subreddit, query} = z.object(searchRedditPostSchema).parse(params);
    let url = `${REDDIT_API_URL?.replace('/api', '')}`;
    if (subreddit) url += `/r/${encodeURIComponent(subreddit)}`;
    url += `/search?q=${encodeURIComponent(query)}`;
    if (params.sort) url += `&sort=${params.sort}`;
    if (params.limit) url += `&limit=${params.limit}`;
    if (params.time) url += `&t=${params.time}`;
    url += `&q=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: await getHeaders(),
        }).catch(async (error) => {
            const errorText = await error.text();
            throw new Error(`Erro ao buscar posts: ${errorText}`);
        }).then(result => result.json());

        const data = await Promise.all(response.data.children.map(child => getPostData(child.data)));
        return {
          content: data.map((post) => ({
              type: 'text',
              text: post.sanitizedResponse.trim(),
          }))
        };
    } catch (error) {
        console.error('Erro ao buscar posts:', error);
        throw error;
    }
  }
];

export default [
  searchSubreddit,
  searchPosts
]