import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { catalog, genders } from './catalog.mjs';
import options from '../shared/filter-options.json' with { type: 'json' };
import { createSafetyService } from './safety.mjs';

export const choices = options;
const modes = ['Indiferente', 'Dar prioridade', 'Obrigatório'];
const defaults = () => ({ ...Object.fromEntries(Object.keys(choices).map(k => [k, { mode: modes[0], values: [] }])), distance: { mode: 'Indiferente', maxKm: 30 } });
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
const hash = (v) => createHash('sha256').update(v).digest('hex');
const passwordHash = (p, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(p, salt, 64).toString('hex')}`;
const verify = (p, stored) => { const [salt, value] = stored.split(':'); return timingSafeEqual(Buffer.from(value, 'hex'), scryptSync(p, salt, 64)); };
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (v, max = 500) => typeof v === 'string' && v.length <= max;

export function rankProfiles(profiles, preferences) {
  return profiles.map(profile => {
    let score = 0;
    for (const [key, preference] of Object.entries(preferences)) {
      const matches = key === 'distance' ? profile.distanceKm !== null && profile.distanceKm !== undefined && profile.distanceKm <= preference.maxKm : preference.values.includes(profile[key]);
      if (preference.mode === 'Obrigatório' && !matches) return null;
      if (preference.mode === 'Dar prioridade' && matches) score++;
    }
    return { ...profile, compatibility: score };
  }).filter(Boolean).sort((a, b) => b.compatibility - a.compatibility);
}

export function createApp(filename = ':memory:', runtime = {}) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password TEXT NOT NULL,profile TEXT NOT NULL,preferences TEXT NOT NULL,seed INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS likes(sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,PRIMARY KEY(sender,recipient));
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks(sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(sender,recipient));
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,sender TEXT NOT NULL,recipient TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL);
  `);
  const insert = db.prepare('INSERT OR IGNORE INTO users(id,email,password,profile,preferences,seed) VALUES(?,?,?,?,?,?)');
  const safety = createSafetyService(db, runtime);
  const demoId = 'demo';
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(demoId)) insert.run(demoId, 'demo@elo.app', passwordHash('EloDemo123!'), JSON.stringify({ name: 'Alex', age: 28, city: 'São Paulo', bio: 'Café, música e boas conversas.', interests: 'Café, Música, Viagens', religion: '', intention: 'Conhecer pessoas', smoking: 'Não fuma', drinking: 'Socialmente', photo: '' }), JSON.stringify(defaults()), 0);
  for (const p of catalog) {
    const profile = JSON.stringify({ ...p, photo: p.id, location: { latitude: -23.5505 + p.km / 111.195, longitude: -46.6333 }, theme: 'standard' });
    if (!db.prepare('SELECT id FROM users WHERE id=?').get(p.id)) insert.run(p.id, `${p.id}@exemplo.elo`, `disabled:${randomBytes(32).toString('hex')}`, profile, JSON.stringify(defaults()), 1);
    else db.prepare('UPDATE users SET profile=? WHERE id=? AND seed=1').run(profile, p.id);
    // Only the demonstration account receives prepared reciprocal likes.
    db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?,?)').run(p.id, demoId, 'like');
  }
  // Migrate JSON records without deleting accounts, sessions, likes or conversations.
  for (const row of db.prepare('SELECT * FROM users').all()) {
    const profile = JSON.parse(row.profile); delete profile.smoking; delete profile.drinking;
    profile.gender ??= ''; profile.trans ??= ''; profile.theme = 'standard';
    if (row.id === demoId && profile.demoVersion !== 2) { profile.photo = 'noa'; profile.gender ||= 'Pessoa não binária'; profile.location ??= { latitude: -23.5505, longitude: -46.6333 }; profile.demoVersion = 2; }
    const old = JSON.parse(row.preferences), preferences = defaults();
    for (const k of Object.keys(choices)) if (old[k]) preferences[k] = old[k];
    if (old.distance) preferences.distance = old.distance;
    db.prepare('UPDATE users SET profile=?,preferences=? WHERE id=?').run(JSON.stringify(profile), JSON.stringify(preferences), row.id);
  }
  const publicProfile = (row, origin) => {
    const { location, km, smoking, drinking, demoVersion, photoSheet, photoSlot, portraitDescription, ...profile } = JSON.parse(row.profile);
    return { gender: '', trans: '', theme: 'standard', ...profile, id: row.id, fictional: !!row.seed, locationReady: !!location, distanceKm: distanceKm(origin, location) };
  };
  const blocked = (a, b) => !!db.prepare('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').get(a, b, b, a);
  const matched = (a, b) => !blocked(a, b) && db.prepare("SELECT COUNT(*) AS n FROM likes WHERE kind='like' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))").get(a, b, b, a).n === 2;
  const attempts = new Map();
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const method = req.method;
      if (path === '/health') return send({ ok: true });
      let body = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 2000000) fail(413, 'Requisição muito grande.'); chunks.push(chunk); }
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { fail(400, 'JSON inválido.'); }
        if (!body || Array.isArray(body) || typeof body !== 'object') fail(400, 'Dados inválidos.');
      }
      if (method === 'POST' && ['/auth/login', '/auth/register'].includes(path)) {
        const address = req.socket.remoteAddress;
        const now = Date.now();
        if (attempts.size > 10000) attempts.clear();
        const record = attempts.get(address);
        const rate = record && record.until > now ? record : { n: 0, until: now + 60000 };
        attempts.set(address, rate); if (++rate.n > 30) fail(429, 'Muitas tentativas. Aguarde um minuto.');
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!text(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !text(body.password, 128) || body.password.length < 8) fail(400, 'Use um e-mail válido e uma senha de 8 a 128 caracteres.');
        let row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if (path === '/auth/register') {
          if (row) fail(409, 'Já existe uma conta com este e-mail.');
          if (!text(body.name, 60) || !body.name.trim() || !Number.isInteger(body.age) || body.age < 18 || body.age > 100) fail(400, 'Informe nome e idade entre 18 e 100 anos.');
          const id = randomUUID();
          if (body.gender !== undefined && body.gender !== '' && !genders.includes(body.gender)) fail(400, 'Identidade de gênero inválida.');
          const gender = body.gender || '';
          insert.run(id, email, passwordHash(body.password), JSON.stringify({ name: body.name.trim(), age: body.age, city: '', bio: '', interests: '', religion: '', intention: 'Conhecer pessoas', gender, trans: '', theme: 'standard', photo: '' }), JSON.stringify(defaults()), 0);
          row = db.prepare('SELECT * FROM users WHERE id=?').get(id);
        } else if (!row || row.seed || !verify(body.password, row.password)) fail(401, 'E-mail ou senha incorretos.');
        const token = randomBytes(32).toString('hex');
        db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), row.id, now + 7 * 86400000);
        return send({ token, user: publicProfile(row) });
      }
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const session = db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(hash(token), Date.now());
      if (!session) fail(401, 'Entre na sua conta para continuar.');
      const uid = session.user_id;
      const me = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
      if (path === '/safety' || path.startsWith('/safety/')) return send(await safety.handle(path, method, body, uid));
      if (method === 'POST' && path === '/auth/logout') { db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token)); return send({ ok: true }); }
      if (method === 'GET' && path === '/me') return send({ user: publicProfile(me), preferences: JSON.parse(me.preferences) });
      if (method === 'PUT' && path === '/me') {
        const profile = JSON.parse(me.profile);
        for (const k of ['name', 'city', 'bio', 'interests']) if (body[k] !== undefined) { if (!text(body[k], k === 'bio' ? 500 : 100) || (k === 'name' && !body[k].trim())) fail(400, 'Informações de perfil inválidas.'); profile[k] = body[k].trim(); }
        for (const k of Object.keys(choices)) if (body[k] !== undefined) { if (body[k] !== '' && !choices[k].includes(body[k])) fail(400, 'Opção inválida.'); profile[k] = body[k]; }
        if (body.trans !== undefined) { if (!['', 'Sim', 'Não'].includes(body.trans)) fail(400, 'Opção inválida.'); profile.trans = body.trans; }
        profile.theme = 'standard';
        if (body.photoUri !== undefined) { if (!text(body.photoUri, 1500000) || (body.photoUri && !/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(body.photoUri))) fail(400, 'Envie uma foto de até 1 MB.'); profile.photoUri = body.photoUri; }
        db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(profile), uid);
        return send({ user: publicProfile({ ...me, profile: JSON.stringify(profile) }) });
      }
      if (method === 'PUT' && path === '/location') {
        const profile = JSON.parse(me.profile);
        if (body.remove === true) {
          delete profile.location;
          const preferences = JSON.parse(me.preferences); preferences.distance.mode = 'Indiferente';
          db.prepare('UPDATE users SET preferences=? WHERE id=?').run(JSON.stringify(preferences), uid);
        }
        else {
          if (body.consent !== true || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude) || Math.abs(body.latitude) > 90 || Math.abs(body.longitude) > 180) fail(400, 'Autorize uma localização válida.');
          profile.location = { latitude: body.latitude, longitude: body.longitude };
        }
        db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(profile), uid);
        return send({ user: publicProfile({ ...me, profile: JSON.stringify(profile) }) });
      }
      if (method === 'PUT' && path === '/preferences') {
        const prefs = defaults();
        for (const k of Object.keys(choices)) {
          const p = body[k];
          if (!p || !modes.includes(p.mode) || !Array.isArray(p.values) || p.values.length > choices[k].length || !p.values.every(v => choices[k].includes(v)) || (p.mode !== 'Indiferente' && !p.values.length)) fail(400, 'Selecione valores válidos para cada preferência ativa.');
          prefs[k] = { mode: p.mode, values: [...new Set(p.values)] };
        }
        const distance = body.distance || defaults().distance;
        if (!modes.includes(distance.mode) || !Number.isInteger(distance.maxKm) || distance.maxKm < 1 || distance.maxKm > 30) fail(400, 'Escolha uma distância de 1 a 30 km.');
        if (distance.mode !== 'Indiferente' && !JSON.parse(me.profile).location) fail(400, 'Ative sua localização antes de usar a preferência de distância.');
        prefs.distance = { mode: distance.mode, maxKm: distance.maxKm };
        db.prepare('UPDATE users SET preferences=? WHERE id=?').run(JSON.stringify(prefs), uid);
        return send({ preferences: prefs });
      }
      if (method === 'GET' && path === '/discover') {
        const rows = db.prepare('SELECT * FROM users WHERE id<>? ORDER BY seed DESC,rowid ASC').all(uid).filter(r => !blocked(uid, r.id) && !db.prepare('SELECT 1 FROM likes WHERE sender=? AND recipient=?').get(uid, r.id));
        const origin = JSON.parse(me.profile).location;
        const complete = rows.filter(r => r.id !== demoId).filter(r => { const p = JSON.parse(r.profile); return p.bio?.trim() && (p.photo || p.photoUri); });
        return send({ profiles: rankProfiles(complete.map(r => publicProfile(r, origin)), JSON.parse(me.preferences)) });
      }
      if (method === 'POST' && path === '/likes') {
        const target = db.prepare('SELECT * FROM users WHERE id=?').get(typeof body.id === 'string' ? body.id : '');
        if (!target || target.id === uid || blocked(uid, target.id) || !['like', 'pass'].includes(body.kind)) fail(400, 'Perfil ou ação inválida.');
        db.prepare('INSERT INTO likes VALUES(?,?,?) ON CONFLICT(sender,recipient) DO UPDATE SET kind=excluded.kind').run(uid, target.id, body.kind);
        return send({ match: matched(uid, target.id), profile: publicProfile(target) });
      }
      if (method === 'POST' && path === '/discover/reset') { db.prepare("DELETE FROM likes WHERE sender=? AND kind='pass'").run(uid); return send({ ok: true }); }
      if (method === 'GET' && path === '/matches') return send({ profiles: db.prepare('SELECT * FROM users WHERE id<>?').all(uid).filter(r => matched(uid, r.id)).map(r => publicProfile(r, JSON.parse(me.profile).location)) });
      if (path === '/messages' && ['GET', 'POST'].includes(method)) {
        const peer = method === 'GET' ? url.searchParams.get('peer') : body.peer;
        if (typeof peer !== 'string' || !matched(uid, peer)) fail(403, 'A conversa exige um match ativo.');
        if (method === 'POST') {
          if (!text(body.text, 2000) || !body.text.trim()) fail(400, 'Escreva uma mensagem de até 2000 caracteres.');
          db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(randomUUID(), uid, peer, body.text.trim(), Date.now());
        }
        const messages = db.prepare('SELECT * FROM (SELECT id,sender,body AS text,created FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created DESC,rowid DESC LIMIT 200) ORDER BY created ASC').all(uid, peer, peer, uid);
        return send({ messages });
      }
      if (method === 'POST' && ['/block', '/report'].includes(path)) {
        if (typeof body.id !== 'string' || body.id === uid || !db.prepare('SELECT 1 FROM users WHERE id=?').get(body.id)) fail(400, 'Perfil inválido.');
        if (path === '/report') {
          if (!text(body.reason, 500) || !body.reason.trim()) fail(400, 'Informe o motivo da denúncia.');
          db.prepare('INSERT INTO reports VALUES(?,?,?,?,?)').run(randomUUID(), uid, body.id, body.reason.trim(), Date.now());
        }
        db.prepare('INSERT OR IGNORE INTO blocks VALUES(?,?)').run(uid, body.id);
        return send({ ok: true });
      }
      fail(404, 'Recurso não encontrado.');
    } catch (e) { if (!e.status) console.error(e); send({ error: e.status ? e.message : 'Erro interno. Tente novamente.' }, e.status || 500); }
  });
  server.on('close', () => db.close());
  return server;
}
