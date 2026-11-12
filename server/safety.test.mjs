import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, rankProfiles } from './app.mjs';
import { catalog } from './catalog.mjs';
import choices from '../shared/filter-options.json' with { type: 'json' };
import { askSafetyAI } from './safety-ai.mjs';

async function fixture(t, askAI) {
  const server = createApp(':memory:', { askAI }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (path, method = 'GET', body, token = '') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, ...await response.json() };
  };
  const login = await request('/auth/login', 'POST', { email: 'demo@elo.app', password: 'EloDemo123!' });
  return { request, token: login.token };
}
test('100 perfis adultos e pelo menos duas pessoas em cada opção de filtro', () => {
  assert.equal(catalog.length, 100); assert.equal(new Set(catalog.map(p => p.id)).size, 100);
  assert.ok(catalog.every(p => p.age >= 18 && p.bio && p.interests));
  for (const [field, values] of Object.entries(choices)) for (const value of values) {
    const filtered = rankProfiles(catalog, { [field]: { mode: 'Obrigatório', values: [value] } });
    assert.ok(filtered.length >= 2, `${field}: ${value}`); assert.ok(filtered.every(p => p[field] === value));
  }
});
test('Contato persiste, SOS exige contato e coordenadas atuais autorizadas; repetir não duplica', async t => {
  const { request, token } = await fixture(t);
  assert.equal((await request('/safety')).status, 401);
  assert.equal((await request('/safety/alerts', 'POST', { clientId: 'a' }, token)).status, 400);
  assert.equal((await request('/safety/settings', 'PUT', { contact: { name: 'Contato', phone: '123' } }, token)).status, 400);
  const settings = await request('/safety/settings', 'PUT', { contact: { name: 'Contato', phone: '(11) 99999-0000' } }, token);
  assert.equal(settings.contact.phone, '+5511999990000');
  assert.equal((await request('/safety', 'GET', undefined, token)).contact.name, 'Contato');
  const location = { latitude: -23.55, longitude: -46.63, timestamp: Date.now() };
  assert.equal((await request('/safety/alerts', 'POST', { clientId: 'a', location }, token)).status, 400);
  assert.equal((await request('/safety/alerts', 'POST', { clientId: 'a', locationConsent: true, location: { ...location, timestamp: 0 } }, token)).status, 400);
  const { alert } = await request('/safety/alerts', 'POST', { clientId: 'a', location, locationConsent: true }, token);
  assert.equal(alert.status, 'prepared'); assert.match(alert.mapUrl, /-23.550000,-46.630000/);
  assert.equal((await request('/safety/alerts', 'POST', { clientId: 'a' }, token)).alert.id, alert.id);
  assert.equal((await request('/safety/alerts', 'POST', { clientId: 'b' }, token)).alert.mapUrl, null);
  assert.equal((await request(`/safety/alerts/${alert.id}`, 'PATCH', { status: 'delivered' }, token)).status, 400);
  const other = await request('/auth/register', 'POST', { email: 'outro@teste.com', password: 'Teste123!', name: 'Outro', age: 25 });
  assert.equal((await request('/safety', 'GET', undefined, other.token)).contact, null);
  assert.equal((await request(`/safety/alerts/${alert.id}`, 'PATCH', { status: 'opened' }, other.token)).status, 404);
});
test('IA exige consentimento e usa contexto real mínimo sem telefone nem coordenadas', async t => {
  // Fast machines can persist both messages in the same millisecond.
  t.mock.method(Date, 'now', () => 1794456000000);
  let received;
  const { request, token } = await fixture(t, async input => { received = input; return { reply: 'Use Preparar SOS para avisar seu contato.', category: 'concern', origin: 'ai', provider: 'openai', model: 'test-double' }; });
  assert.equal((await request('/safety/chat', 'POST', { message: 'Preciso de ajuda' }, token)).status, 403);
  await request('/safety/settings', 'PUT', { aiConsent: true, contact: { name: 'Contato secreto', phone: '11999990000' } }, token);
  const result = await request('/safety/chat', 'POST', { message: 'Estou desconfortável no encontro' }, token);
  assert.equal(result.status, 200); assert.equal(result.messages.length, 2); assert.equal(result.messages[1].metadata.origin, 'ai');
  assert.equal(received.context.trustedContactConfigured, true); assert.equal(received.context.firstName, 'Alex');
  assert.ok(!JSON.stringify(received).includes('999990000')); assert.ok(!JSON.stringify(received).includes('latitude'));
  assert.equal((await request('/safety', 'GET', undefined, token)).messages.length, 2);
  await request('/safety/messages', 'DELETE', undefined, token);
  assert.equal((await request('/safety', 'GET', undefined, token)).messages.length, 0);
});
test('Falha da IA é identificada e não impede preparar SOS', async t => {
  const { request, token } = await fixture(t, async () => { throw Object.assign(new Error('offline'), { code: 'provider_error' }); });
  await request('/safety/settings', 'PUT', { aiConsent: true, contact: { name: 'Contato', phone: '11999990000' } }, token);
  const result = await request('/safety/chat', 'POST', { message: 'Preciso de ajuda' }, token);
  assert.equal(result.response.origin, 'offline-guidance'); assert.match(result.response.reply, /Não consegui consultar a IA/);
  assert.equal((await request('/safety/alerts', 'POST', { clientId: 'offline' }, token)).alert.status, 'prepared');
});
test('SOS continua disponível enquanto a IA aguarda; requisições de IA simultâneas são bloqueadas', async t => {
  let release, started; const begun = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const { request, token } = await fixture(t, async () => { started(); await pending; return { reply: 'Orientação', category: 'general', origin: 'ai' }; });
  await request('/safety/settings', 'PUT', { aiConsent: true, contact: { name: 'Contato', phone: '11999990000' } }, token);
  const chat = request('/safety/chat', 'POST', { message: 'Ajuda' }, token); await begun;
  try {
    assert.equal((await request('/safety/chat', 'POST', { message: 'Outro' }, token)).status, 409);
    assert.equal((await request('/safety/alerts', 'POST', { clientId: 'during-chat' }, token)).alert.status, 'prepared');
  } finally { release(); await chat; }
});
test('Adaptador OpenAI usa Responses sem armazenamento e rejeita afirmação de envio inexistente', async () => {
  const previous = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  try {
    let payload;
    const fetcher = async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ reply: 'Enviei seu alerta.', category: 'danger' }) }] }] }) }; };
    await assert.rejects(() => askSafetyAI({ messages: [{ role: 'user', content: 'Ajuda' }], context: {} }, fetcher), { code: 'invalid_output' });
    assert.equal(payload.store, false); assert.equal(payload.text.format.strict, true);
    await assert.rejects(() => askSafetyAI({ messages: [], context: {} }, async () => ({ ok: false, status: 429 })), { code: 'provider_limit' });
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
