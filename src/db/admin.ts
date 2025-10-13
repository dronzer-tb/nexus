import * as fs from 'fs';
import * as path from 'path';

export interface AdminUser {
  username: string;
  password: string; // hashed
}

const ADMIN_PATH = path.join(process.cwd(), 'db', 'admin.json');

export function loadAdmin(): AdminUser | null {
  if (!fs.existsSync(ADMIN_PATH)) {
    return null;
  }

  try {
    const data = fs.readFileSync(ADMIN_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load admin:', err);
    return null;
  }
}

export function saveAdmin(admin: AdminUser): void {
  const dir = path.dirname(ADMIN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2), 'utf-8');
}
