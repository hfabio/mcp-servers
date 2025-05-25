import fs from 'fs';
import path from 'path';


export const createCacheFile = (context: string) => (toolName: string, type: string, data: any) => {
  if (fs.existsSync(path.resolve('cache', context)) || !fs.existsSync(path.resolve('cache', context, toolName))) {
    fs.mkdirSync(path.resolve('cache', context, toolName), { recursive: true });
  }
  console.log(`[${context}] Caching ${toolName} ${type} data...`);
  const currentTimestamp = new Date().toISOString();
  const filePath = path.resolve('cache', context, toolName, `${type}-${currentTimestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[${context}] ${toolName} ${type} cached`);
  return filePath;
}

export const getTemplate = (context?: string, toolName?: string, type?: string) => {
  let title;
  if (context) title = ' - ' + context;
  if (toolName) title = ' - ' + toolName;
  if (type) title = ' - ' + type;

  const files = fs.readdirSync(
    path.resolve(...['cache', context, toolName].filter(Boolean) as string[])
  ).filter((file) => !file.startsWith('.'));
  const template = `
  <html>
  <head>
  <title>MCP - </title>
  </head>
  <body>
  <h1>MCP cached files from requests${title || ''}</h1>
  ${files.map((file) => {
    const filePath = path.resolve(...['cache', context, toolName].filter(Boolean) as string[], file);
    const url = `/cache/${filePath.split('cache/')[1]}`;
    const stats = fs.statSync(filePath);
    const isFile = stats.isFile();
    const fileSizeInBytes = stats.size;
    const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);
    return `<p>
    <a href="${url}">${file}</a>
    ${isFile ? `<a href="${url}" download>Download (${fileSizeInKB} KB)</a>` : ''}
    </p>`;
  }
  ).join('')}
  </body>
  </html>
  `
  return template;
}