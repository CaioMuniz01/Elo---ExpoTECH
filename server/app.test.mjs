import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, rankProfiles, distanceKm } from './app.mjs';
import { DatabaseSync } from 'node:sqlite';

async function fixture(t, file) {
  const server = createApp(file); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (path, method = 'GET', body, token = '') => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, ...await res.json() };
  };
  const demo = async () => request('/auth/login', 'POST', { email: 'demo@elo.app', password: 'EloDemo123!' });
  return { server, request, demo };
}
const preferences = () => ({ ...Object.fromEntries(['religion', 'intention', 'gender'].map(k => [k, { mode: 'Indiferente', values: [] }])), distance: { mode: 'Indiferente', maxKm: 30 } });

test('Prioridade ordena sem excluir; obrigatório exclui dados ausentes', () => {
  const profiles = [{ id: 'a', religion: '' }, { id: 'b', religion: 'Católica' }, { id: 'c', religion: 'Espírita' }];
  assert.deepEqual(rankProfiles(profiles, { religion: { mode: 'Dar prioridade', values: ['Católica'] } }).map(p => p.id), ['b', 'a', 'c']);
  assert.deepEqual(rankProfiles(profiles, { religion: { mode: 'Obrigatório', values: ['Católica'] } }).map(p => p.id), ['b']);
  assert.equal(rankProfiles(profiles, { religion: { mode: 'Indiferente', values: [] } }).length, 3);
});
test('Rotas privadas exigem login e senha inválida é rejeitada', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/discover')).status, 401);
  assert.equal((await request('/auth/login', 'POST', { email: 'demo@elo.app', password: 'Incorreta123!' })).status, 401);
});
test('Cadastro valida idade, unicidade, login e revogação da sessão', async t => {
  const { request } = await fixture(t);
  const input = { email: 'teste@exemplo.com', password: 'Teste123!', name: 'Teste', age: 17 };
  assert.equal((await request('/auth/register', 'POST', input)).status, 400);
  const registered = await request('/auth/register', 'POST', { ...input, age: 25 });
  assert.equal(registered.status, 200); assert.ok(registered.token); assert.equal(registered.user.age, 25);
  assert.equal((await request('/auth/register', 'POST', { ...input, age: 25 })).status, 409);
  const login = await request('/auth/login', 'POST', input); assert.ok(login.token);
  assert.equal((await request('/me', 'GET', undefined, login.token)).user.name, 'Teste');
  await request('/auth/logout', 'POST', {}, login.token);
  assert.equal((await request('/me', 'GET', undefined, login.token)).status, 401);
});
test('Preferências inválidas são rejeitadas e filtro é aplicado no servidor', async t => {
  const { request, demo } = await fixture(t); const { token } = await demo(); const prefs = preferences();
  prefs.religion = { mode: 'Obrigatório', values: [] };
  assert.equal((await request('/preferences', 'PUT', prefs, token)).status, 400);
  prefs.religion.values = ['Católica'];
  assert.equal((await request('/preferences', 'PUT', prefs, token)).status, 200);
  const filtered = (await request('/discover', 'GET', undefined, token)).profiles;
  assert.ok(filtered.length >= 2); assert.ok(filtered.every(p => p.religion === 'Católica'));
  assert.equal((await request('/me', 'GET', undefined, token)).preferences.religion.mode, 'Obrigatório');
});
test('Mensagens exigem reciprocidade; match e mensagem são persistidos', async t => {
  const { request, demo } = await fixture(t); const { token } = await demo();
  assert.equal((await request('/messages', 'POST', { peer: 'marina', text: 'Oi' }, token)).status, 403);
  assert.equal((await request('/likes', 'POST', { id: 'marina', kind: 'like' }, token)).match, true);
  const sent = await request('/messages', 'POST', { peer: 'marina', text: 'Vamos conversar sobre trilhas?' }, token);
  assert.equal(sent.messages[0].text, 'Vamos conversar sobre trilhas?');
  assert.equal((await request('/messages?peer=marina', 'GET', undefined, token)).messages.length, 1);
  assert.equal((await request('/matches', 'GET', undefined, token)).profiles.length, 1);
});
test('Duas contas novas trocam mensagens; uma terceira não acessa a conversa', async t => {
  const { request } = await fixture(t);
  const register = email => request('/auth/register', 'POST', { email, password: 'Senha123!', name: 'Pessoa', age: 25 });
  const a = await register('a@teste.com'); const b = await register('b@teste.com'); const c = await register('c@teste.com');
  assert.equal((await request('/likes', 'POST', { id: b.user.id, kind: 'like' }, a.token)).match, false);
  assert.equal((await request('/likes', 'POST', { id: a.user.id, kind: 'like' }, b.token)).match, true);
  await request('/messages', 'POST', { peer: b.user.id, text: 'Olá B' }, a.token);
  const result = await request(`/messages?peer=${a.user.id}`, 'GET', undefined, b.token); assert.equal(result.messages[0].text, 'Olá B');
  assert.equal((await request(`/messages?peer=${a.user.id}`, 'GET', undefined, c.token)).status, 403);
});
test('Bloqueio remove match, descoberta e acesso à conversa', async t => {
  const { request, demo } = await fixture(t); const { token } = await demo();
  await request('/likes', 'POST', { id: 'marina', kind: 'like' }, token);
  assert.equal((await request('/report', 'POST', { id: 'marina', reason: 'Teste de denúncia' }, token)).status, 200);
  assert.equal((await request('/matches', 'GET', undefined, token)).profiles.length, 0);
  assert.equal((await request('/messages?peer=marina', 'GET', undefined, token)).status, 403);
  assert.equal((await request('/likes', 'POST', { id: 'marina', kind: 'like' }, token)).status, 400);
});
test('Reiniciar servidor preserva conta, sessão, perfil e preferências em SQLite', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'elo-test-')); const filename = join(dir, 'test.sqlite'); let server;
  try {
    const start = async () => { server = createApp(filename); server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; };
    let base = await start();
    const login = await (await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@elo.app', password: 'EloDemo123!' }) })).json();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };
    await fetch(`${base}/me`, { method: 'PUT', headers, body: JSON.stringify({ bio: 'Persistiu!' }) });
    const prefs = preferences(); prefs.religion = { mode: 'Dar prioridade', values: ['Espírita'] };
    await fetch(`${base}/preferences`, { method: 'PUT', headers, body: JSON.stringify(prefs) });
    await new Promise(resolve => server.close(resolve));
    const legacy = new DatabaseSync(filename);
    const oldProfile = JSON.parse(legacy.prepare('SELECT profile FROM users WHERE id=?').get('demo').profile);
    oldProfile.theme = 'iris';
    legacy.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(oldProfile), 'demo'); legacy.close();
    base = await start();
    const result = await (await fetch(`${base}/me`, { headers })).json(); assert.equal(result.user.bio, 'Persistiu!'); assert.equal(result.preferences.religion.values[0], 'Espírita'); assert.equal(result.user.theme, 'standard');
  } finally { if (server?.listening) await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true }); }
});
test('Distância usa coordenadas, respeita o limite de 30 km e não revela posições', async t => {
  const { request, demo } = await fixture(t); const { token } = await demo();
  const prefs = preferences(); prefs.distance = { mode: 'Obrigatório', maxKm: 10 };
  assert.equal((await request('/preferences', 'PUT', prefs, token)).status, 200);
  const result = await request('/discover', 'GET', undefined, token);
  assert.ok(result.profiles.length >= 10); assert.ok(result.profiles.some(p => p.id === 'sample-025'));
  for (const p of result.profiles) { assert.ok(p.distanceKm <= 10); assert.equal(p.location, undefined); assert.equal(p.km, undefined); }
  prefs.distance.maxKm = 31; assert.equal((await request('/preferences', 'PUT', prefs, token)).status, 400);
  assert.ok(Math.abs(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) - 111.195) < 0.01);
});
test('Localização exige consentimento; indisponível é excluída somente no modo obrigatório', async t => {
  const { request } = await fixture(t);
  const account = await request('/auth/register', 'POST', { email: 'local@teste.com', password: 'Teste123!', name: 'Local', age: 25 });
  const { token } = account; const prefs = preferences(); prefs.distance = { mode: 'Obrigatório', maxKm: 30 };
  assert.equal((await request('/preferences', 'PUT', prefs, token)).status, 400);
  assert.equal((await request('/location', 'PUT', { latitude: -23.5505, longitude: -46.6333 }, token)).status, 400);
  assert.equal((await request('/location', 'PUT', { consent: true, latitude: -23.5505, longitude: -46.6333 }, token)).status, 200);
  assert.equal((await request('/preferences', 'PUT', prefs, token)).status, 200);
  assert.equal((await request('/discover', 'GET', undefined, token)).profiles.length, 100);
  assert.equal((await request('/location', 'PUT', { remove: true }, token)).user.locationReady, false);
  assert.equal((await request('/me', 'GET', undefined, token)).preferences.distance.mode, 'Indiferente');
  const profiles = [{ id: 'a', distanceKm: null }, { id: 'b', distanceKm: 2 }, { id: 'c', distanceKm: 25 }];
  assert.deepEqual(rankProfiles(profiles, { distance: { mode: 'Dar prioridade', maxKm: 10 } }).map(p => p.id), ['b', 'a', 'c']);
  assert.deepEqual(rankProfiles(profiles, { distance: { mode: 'Obrigatório', maxKm: 10 } }).map(p => p.id), ['b']);
});
test('Filtro de mulheres inclui mulheres trans; identidade não é inferida pela foto', async t => {
  const { request, demo } = await fixture(t); const { token } = await demo(); const prefs = preferences();
  prefs.gender = { mode: 'Obrigatório', values: ['Mulher'] };
  await request('/preferences', 'PUT', prefs, token);
  const result = await request('/discover', 'GET', undefined, token);
  assert.ok(result.profiles.some(p => p.id === 'joana' && p.trans === 'Sim'));
  assert.ok(result.profiles.every(p => p.gender === 'Mulher'));
  assert.ok(result.profiles.every(p => p.smoking === undefined && p.drinking === undefined));
});
test('Perfis incompletos ficam fora da descoberta; completar com foto e bio os inclui', async t => {
  const { request, demo } = await fixture(t); const { token } = await demo();
  const account = await request('/auth/register', 'POST', { email: 'incompleto@teste.com', password: 'Teste123!', name: 'Pessoa', age: 25, gender: 'Homem' });
  assert.equal(account.user.theme, 'standard');
  assert.ok(!(await request('/discover', 'GET', undefined, token)).profiles.some(p => p.id === account.user.id));
  const photoUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0S8AAAAASUVORK5CYII=';
  assert.equal((await request('/me', 'PUT', { bio: 'Agora completo', photoUri, theme: 'iris', trans: 'Sim' }, account.token)).status, 200);
  const person = (await request('/discover', 'GET', undefined, token)).profiles.find(p => p.id === account.user.id);
  assert.equal(person.theme, 'standard'); assert.equal(person.gender, 'Homem'); assert.equal(person.trans, 'Sim');
  assert.equal((await request('/me', 'PUT', { photoUri: 'https://qualquer-imagem.com/foto' }, account.token)).status, 400);
});
