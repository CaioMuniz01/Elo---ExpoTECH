// Manual integration check; performs ONE billable OpenAI call, never sends SMS.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
const env = new URL('../server/.env', import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('Preencha OPENAI_API_KEY no arquivo local server/.env.');
const server = createApp(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body, token, method = 'POST') => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    assert.equal(response.status, 200, `Falha em ${path}`); return response.json();
  };
  const { token } = await post('/auth/login', { email: 'demo@elo.app', password: 'EloDemo123!' });
  await post('/safety/settings', { aiConsent: true, contact: { name: 'Contato fictício de teste', phone: '11999990000' } }, token, 'PUT');
  const message = 'Simulação acadêmica, não é uma emergência real. Meu encontro está me deixando desconfortável. Qual recurso do Elo posso usar para avisar meu contato?';
  const result = await post('/safety/chat', { message }, token);
  assert.equal(result.response.origin, 'ai', 'O provedor não retornou IA real; confira créditos, rede e configuração.');
  assert.equal(result.messages.length, 2); assert.equal(result.messages[0].role, 'user'); assert.equal(result.messages[1].role, 'assistant');
  assert.ok(result.response.reply.trim()); assert.ok(['danger', 'fire', 'medical', 'concern', 'general'].includes(result.response.category));
  const evidence = { date: new Date().toISOString(), route: 'POST /safety/chat', database: 'isolated in-memory fixture', origin: result.response.origin, model: result.response.model, category: result.response.category, message, reply: result.response.reply, usage: result.response.usage, notificationsSent: false };
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../artifacts/ai-smoke.json', import.meta.url), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await new Promise(resolve => server.close(resolve)); }
