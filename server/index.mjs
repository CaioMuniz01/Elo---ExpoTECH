import { mkdirSync } from 'node:fs';
import { createApp } from './app.mjs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const envPath = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
const port = Number(process.env.PORT || 3001);
createApp(fileURLToPath(new URL('./data/elo.sqlite', import.meta.url))).listen(port, '0.0.0.0', () => console.log(`API Elo: http://localhost:${port} (desenvolvimento local)`));
