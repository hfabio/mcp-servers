
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