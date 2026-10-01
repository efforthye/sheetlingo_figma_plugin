// Usage: node scripts/set-auth-server.mjs https://sheetlingo-auth.<you>.workers.dev
import fs from 'fs';
const url = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\/[\w.-]+$/.test(url)) { console.error('Usage: node scripts/set-auth-server.mjs https://your-worker.workers.dev'); process.exit(1); }

const cfg = 'src/shared/config.ts';
fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace(/export const AUTH_SERVER = '[^']*';/, `export const AUTH_SERVER = '${url}';`));

const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const base = ['https://docs.google.com', 'https://script.google.com', 'https://*.googleusercontent.com', 'https://sheets.googleapis.com', 'https://www.googleapis.com', 'https://cdn.jsdelivr.net'];
m.networkAccess = {
  allowedDomains: Array.from(new Set([...base, url])),
  reasoning: 'Reads the Google Sheet the user connects (public CSV or Google Sheets API after sign-in via the Sheetlingo auth server) and loads the Pretendard UI font.',
};
fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
console.log('✓ AUTH_SERVER =', url, '\n✓ manifest.json networkAccess updated — re-import the manifest in Figma.');
