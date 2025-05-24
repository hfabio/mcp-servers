import z from "zod";
import { MCPTool } from "../@types";
import { searchRedditPostSchema, searchRedditSubredditSchema } from "./validators";
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

const parseSubreddit = (subreddit) => {
  const {
    title,
    display_name_prefixed,
    description,
    subscribers,
    active_user_count,
    created,
    public_description,
    advertiser_category,
    header_title,
    url
  } = subreddit;
  let parsedSubreddit = `# subreddit: ${title} (${display_name_prefixed}) with (${active_user_count || 0} active users and ${subscribers} subscribers)\n`;
  parsedSubreddit += `- title: ${header_title}\n`;
  parsedSubreddit += `- category ${advertiser_category}\n`;
  parsedSubreddit += `- url: ${url}\n`;
  parsedSubreddit += `- created at: ${new Date(created * 1000).toLocaleString()}\n`;
  parsedSubreddit += `- short description: ${public_description}\n`;
  parsedSubreddit += `- description: \n${description}\n`;
  parsedSubreddit = parsedSubreddit.replace(/<[^>]*>/g, ''); // Remove HTML tags
  parsedSubreddit = parsedSubreddit.replace(/&[a-zA-Z0-9#]+;/g, ''); // Remove HTML entities
  parsedSubreddit = parsedSubreddit.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
  parsedSubreddit = parsedSubreddit.replace(/ +/g, ' ').replaceAll('[]', '').trim(); // Remove extra spaces
  const parsedSubredditTokens = Math.ceil(parsedSubreddit.length / 4);
  return {
    display_name_prefixed,
    title,
    header_title,
    category: advertiser_category,
    description,
    subscribers,
    active_user_count,
    created_utc: new Date(created * 1000).toLocaleString(),
    public_description,
    parsedSubreddit,
    parsedSubredditTokens,
    url
  }
}

async function getPostData(subreddit, maxComments=10, maxDepth=2){
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
      outerReplies.forEach((reply, index) => {
        if ((index + 1) >= maxComments) return;
        replies += reply.parsedComment;
        let depthReplies = [...(reply.replies || [])];
        let currentReply;
        while (depthReplies.length > 0) {
          currentReply = depthReplies.shift();
          if (maxDepth < currentReply.depth) break;
          replies += currentReply.parsedComment;
          if (currentReply.replies?.length) depthReplies = [...(currentReply.replies || []), ...depthReplies];
        }
      });
      sanitizedResponse += `\n\n# Replies:\n${replies}`;
    }
    sanitizedResponse = sanitizedResponse.replace(/<[^>]*>/g, ''); // Remove HTML tags
    sanitizedResponse = sanitizedResponse.replace(/&[a-zA-Z0-9#]+;/g, ''); // Remove HTML entities
    sanitizedResponse = sanitizedResponse.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
    sanitizedResponse = sanitizedResponse.replace(/ +/g, ' ').trim(); // Remove extra spaces
    return {
      id,
      title,
      author,
      url,
      subreddit_name_prefixed,
      permalink,
      sanitizedResponse,
      sanitizedResponseTokens: Math.ceil(sanitizedResponse.length / 4),
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
  async (params) => {
    const {
      query,
      count,
      limit,
      show_users,
      sort,
      sub_reddit_details,
    } = z.object(searchRedditSubredditSchema).parse(params);

    try {
        // const response = await fetch(`${REDDIT_API_URL}/search_subreddits`, {
        //     method: 'POST',
        //     headers: await getHeaders(),
        //     body: JSON.stringify({
        //         exact: false,
        //         include_over_18: false,
        //         include_unadvertisable: false,
        //         query: sanitizedQuery,
        //         limit: 10,
        //     })
        // }).then(result => result.json())
        let url = `${REDDIT_API_URL?.replace('/api', '')}/subreddits/search?`;
        if (count) url += `count=${count}&`;
        if (limit) url += `limit=${limit}&`;
        if (show_users) url += `show_users=${show_users}&`;
        if (sort) url += `sort=${sort}&`;
        if (sub_reddit_details) url += `sr_detail=${sub_reddit_details}&`;
        url += `q=${encodeURIComponent(query)}`;
        console.log(`[Reddit] Fetching subreddits (${query})`);
        const init = performance.now();
        const response = await fetch(url, {
            headers: await getHeaders(),
        }).then(result => result.json())
        .catch(async (error) => {
            const errorText = await error.text();
            throw new Error(`Erro ao buscar subreddits: ${errorText}`);
        });
        console.log('[Reddit] API subreddits response time:', (performance.now() - init)/1000, "s");
        const data = response.data.children.map(child => parseSubreddit(child.data));
        const total_tokens = data.reduce((acc, curr) => acc + curr.parsedSubredditTokens, 0)
        console.log(`[Reddit] Subreddits fetched (${query}), ${data.length} subreddits with total ${total_tokens} tokens`);
        console.log(`[Reddit] Subreddits fetched (${query}) in ${(performance.now() - init)/1000}s`);
        return {
          content: data.map((subreddit) => ({
              type: 'text',
              text: subreddit.parsedSubreddit,
          })),
        }; 
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
    const {subreddit, query, depth, max_comments} = z.object(searchRedditPostSchema).parse(params);
    let url = `${REDDIT_API_URL?.replace('/api', '')}`;
    if (subreddit) url += `/r/${encodeURIComponent(subreddit)}`;
    url += `/search?q=${encodeURIComponent(query)}`;
    if (params.sort) url += `&sort=${params.sort}`;
    if (params.limit) url += `&limit=${params.limit}`;
    if (params.time) url += `&t=${params.time}`;
    url += `&q=${encodeURIComponent(query)}`;

    try {
        let init = performance.now();
        console.log(`[Reddit] Fetching posts (${query})`);
        const response = await fetch(url, {
            method: 'GET',
            headers: await getHeaders(),
        }).catch(async (error) => {
            const errorText = await error.text();
            throw new Error(`Erro ao buscar posts: ${errorText}`);
        }).then(result => result.json());
        console.log('[Reddit] API posts response time:', (performance.now() - init)/1000, "s");
        const init2 = performance.now();
        console.log(`[Reddit] Getting replies (${query})`);
        const data = await Promise.all(response.data.children.map(child => getPostData(child.data, max_comments, depth)));
        console.log('[Reddit] API replies response time:', (performance.now() - init2)/1000, "s");
        console.log(`[Reddit] Posts fetched (${query}), ${data.length} posts with total ${data.reduce((acc, curr) => acc + curr.sanitizedResponseTokens, 0)} tokens`);
        console.log(`[Reddit] Posts fetched (${query}) in ${(performance.now() - init)/1000}s`);
        return {
          content: data.map((post) => ({
              type: 'text',
              text: post.sanitizedResponse,
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