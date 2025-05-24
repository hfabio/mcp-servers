import path from 'path';
import fs from 'fs';

  const credentialsPath = path.join('credentials.json');

export async function getCredentials() {
  if (!fs.existsSync(credentialsPath)) return;
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  return credentials;
}
export async function writeCredentials(credentials: {[key: string]: string}) {
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  console.log('Credentials saved to', credentialsPath);
  return credentials;
}

export default {
  getCredentials,
  writeCredentials,
}