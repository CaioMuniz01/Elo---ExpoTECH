// Manual check: THREE billable API calls; no SMS, sharing or phone app is opened.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
const env = new URL('../server/.env', import.meta.url); if (existsSync(env)) process.loadEnvFile(env);
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('Configure OPENAI_API_KEY no servidor.');
const server = createApp(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  let token = '';
  const request = async (path, method = 'GET', body) => { const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }); assert.equal(response.status, 200, path); return response.json(); };
  token = (await request('/auth/login', 'POST', { email: 'demo@elo.app', password: 'EloDemo123!' })).token;
  await request('/safety/settings', 'PUT', { aiConsent: true, contact: { name: 'Contato fictício', phone: '11999990000' } });
  const cases = [
    { name: 'dating', input: { message: 'Simulação acadêmica: dê três dicas respeitosas de assuntos para um primeiro encontro.' } },
    { name: 'profile', input: { message: 'Resuma somente os fatos declarados por Marina no perfil selecionado e sugira duas perguntas sobre seus interesses. Não avalie caráter nem segurança.', profileId: 'marina', profileConsent: true } },
    { name: 'action', input: { message: 'Quero ligar para o meu contato de confiança. Proponha abrir o discador e aguarde minha confirmação no botão; não diga que já ligou.' } },
  ];
  const evidence = { date: new Date().toISOString(), route: 'POST /safety/chat', database: 'isolated in-memory', cases: [], notificationsSent: false };
  for (const item of cases) {
    const result = await request('/safety/chat', 'POST', item.input); assert.equal(result.response.origin, 'ai');
    if (item.name === 'action') assert.ok(result.messages.at(-1).metadata.actions.includes('call_contact'), 'A IA deve propor abrir o discador, sem executar.');
    else assert.equal(result.messages.at(-1).metadata.actions.length, 0);
    evidence.cases.push({ name: item.name, input: item.input, ...result.response });
  }
  assert.equal((await request('/safety')).alerts.length, 0);
  mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../artifacts/ai-smoke-enhanced.json', import.meta.url), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await new Promise(resolve => server.close(resolve)); }
