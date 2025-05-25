import { YoutubeTranscript } from 'youtube-transcript';
import { MCPResponse, MCPTool } from "../@types"
import { z } from "zod"
import { createCacheFile } from "../utils/cache"

const {YOUTUBE_API_KEY, YOUTUBE_API_URL} = process.env;

const getVideoListSchema = {
    query: z.string(),
    include_transcript: z.boolean().default(true),
    max_results: z.number().default(5),
    start_date: z.string().datetime().default(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    end_date: z.string().datetime().default(new Date().toISOString()),
};

const getVideoTranscription = async (videoId: string) => {
  try {
    const transcription = await YoutubeTranscript.fetchTranscript(videoId);
    return transcription.map((item: any) => {
      let sanitizedText = item.text.replace(/<[^>]*>/g, ""); // Remove HTML tags
      sanitizedText = sanitizedText.replace(/&[a-z]+;/g, ""); // Remove HTML entities
      sanitizedText = sanitizedText.replace(/[\u200B-\u200D\uFEFF]/g, ""); // Remove zero-width characters
      sanitizedText = sanitizedText.replace(/ +/g, " "); // Replace multiple spaces with a single space
      sanitizedText = sanitizedText.trim(); // Trim leading and trailing spaces
      return sanitizedText;
    }).join(" ");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error fetching transcription:", videoId, error.message);
    } else {
      console.error("Error fetching transcription:", videoId, error);
    }
    // const test = await fetch(`http://video.google.com/timedtext?lang=en&v=${videoId}`).then((result) => result.text());
    // const test = await fetch(`https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`).then((result) => result.text());
    return 'No transcription available';
  }
  // const response = await fetch(
  //   `${YOUTUBE_API_URL}/captions?videoId=${videoId}&key=${YOUTUBE_API_KEY}`
  // ).then((result) => result.json());
  // const transcriptId = response.items[0]?.id;
  // const transcription = await fetch(
  //   `${YOUTUBE_API_URL}/captions/${transcriptId}?tlang=en`
  // ).then((result) => result.json());
};

const writeCache = createCacheFile('YouTube');

export const getVideoList: MCPTool = [
  "search-youtube-videos",
  "search for youtube videos based on a query and returns the video list with optional transcript",
  getVideoListSchema,
  async ({ query, max_results, start_date, end_date, include_transcript }) => {
    const {
      query: sanitizedQuery,
      max_results: maxResults,
      start_date: startDate,
      end_date: endDate,
      include_transcript: includeTranscript,
    } = z.object(getVideoListSchema).parse({query, max_results, start_date, end_date, include_transcript});
    // videoCaption
    const videosUrl = `${YOUTUBE_API_URL}/search?part=snippet&q=${
        sanitizedQuery
      }&type=video&regionCode=ca&maxResults=${
        maxResults
      }&publishedAfter=${startDate}${
        includeTranscript ? "&videoCaption=closedCaption" : ""
      }&publishedBefore=${endDate}&key=${YOUTUBE_API_KEY}`;
    const init = performance.now();
    const response = await fetch(videosUrl).then(async (result) => {
      if (!includeTranscript) return await result.json();
      const data = await result.json();
      const transcripts = await Promise.all(data.items.map(async (item: any) => {
        const videoId = item.id.videoId;
        return await getVideoTranscription(videoId);
      }));
      return {
        ...data,
        items: data.items.map((item: any, index: number) => {
          return {
            ...item,
            transcription: transcripts[index],
            transcriptionTokens: Math.ceil(transcripts[index].length / 4),
          }
        })
      }
    })

    console.log("[YouTube] API response time:", (performance.now() - init)/1000, "s");
    console.log("[Youtube] Request total results:", response.pageInfo?.totalResults);
    console.log("[Youtube] Request kind:", response.kind);
    console.log("[YouTube] API response:", response.items.length);

    const payload: MCPResponse = {
      content: [
        {
          type: "text", 
          text: `Found ${response.items.length} videos for "${sanitizedQuery}":
          ${response.items.map(
            (item: any, index: number) => `# Video #${index + 1
            } Title: ${item.snippet.title
              }\n- Description: ${item.snippet.description
              }\n- Link: https://www.youtube.com/watch?v=${item.id.videoId
              }${includeTranscript ? `\n- Transcription: ${item.transcription}` : ""}`
        ).join("\n\n")}
          `.trim(),
        }
      ]
    };
    writeCache('search-youtube-videos', 'raw-data', response);
    writeCache('search-youtube-videos', 'response', payload);
    return payload
  }
];


export default [
  getVideoList
]