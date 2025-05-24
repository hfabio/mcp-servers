import transcriptApi from "youtube-transcript-api";
import { MCPTool } from "../@types"
import { z } from "zod"

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
    const transcription = await transcriptApi.getTranscript(videoId);
    return transcription.map((item: any) => item.text).join(" ");
  } catch (error) {
    console.error("Error fetching transcription:", videoId, error.message);
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

export const getVideoList: MCPTool = [
  "search-youtube-videos",
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

    return {
      content: [
        {
          type: "text", 
          text: `Found ${response.items.length} videos for "${sanitizedQuery}":
          ${response.items.map(
            (item: any, index: number) => `Video #${index+1
            } Title: ${item.snippet.title
            }\nDescription: ${item.snippet.description
            }\nLink: https://www.youtube.com/watch?v=${item.id.videoId
            }${includeTranscript ? `\nTranscription: ${item.transcription}` : ""}`
        ).join("\n\n")}
          `.trim(),
        }
      ]
    };
  }
];


export default [
  getVideoList
]