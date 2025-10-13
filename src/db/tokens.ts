import * as fs from 'fs';
import * as path from 'path';

export interface TokenStore {
  [name: string]: string;
}

const TOKENS_PATH = path.join(process.cwd(), 'db', 'tokens.json');

export function loadTokens(): TokenStore {
  if (!fs.existsSync(TOKENS_PATH)) {
    return {};
  }

  try {
    const data = fs.readFileSync(TOKENS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load tokens:', err);
    return {};
  }
}

export function saveToken(tokens: TokenStore): void {
  const dir = path.dirname(TOKENS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}
