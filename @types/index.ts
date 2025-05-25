
export type MCPResponse = {
  content: Array<{
    type: 'text' | 'image' | 'video' | 'audio' | 'file';
    url?: string;
    file?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    duration?: number;
    width?: number;
    height?: number;
    size?: number;
    language?: string;
    text?: string;
  }>;
}
export type MCPTool = [string, string, { [key: string]: any }, (args: any) => Promise<MCPResponse>];

export type RedditComment = {
  data: {
    author: string;
    body: string;
    permission: string;
    ups: number;
    downs: number;
    score: number;
    stickied: boolean;
    created: number;
    replies: { data: { children: RedditComment[] } };
    depth?: 0 | undefined;
  };
};

export type ParsedRedditComment = {
  parsedComment: string;
  author: string;
  body: string;
  permission: 'admin' | 'user';
  ups: number;
  downs: number;
  score: number;
  stickied: boolean;
  depth: number;
  created: number;
  replies?: ParsedRedditComment[];
}

export type Subreddit = {
  title: string;
  display_name_prefixed: string;
  description: string;
  subscribers?: number;
  active_user_count?: number;
  created: number;
  public_description: string;
  advertiser_category: string;
  header_title: string;
  url: string;
  author: string
  subreddit_name_prefixed: string;
  id: number;
  permalink: string;
}

export type RedditPostParsed = {
  id: number;
  title: string;
  author: string;
  url: string;
  subreddit_name_prefixed: string;
  permalink: string;
  sanitizedResponse: string;
  sanitizedResponseTokens: number;
  replies: any[]
}