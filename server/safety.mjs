import { randomUUID } from 'node:crypto';
import { aiStatus, askSafetyAI, fallbackReply } from './safety-ai.mjs';
import actionLabels from '../shared/assistant-actions.json' with { type: 'json' };
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const validText = (v, max) => typeof v === 'string' && v.length <= max;
export function normalizePhone(value) {
  if (!validText(value, 30)) fail(400, 'Informe um telefone válido com DDD.');
  let digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^[1-9]\d{9,14}$/.test(digits)) fail(400, 'Informe um telefone válido com DDD e código do país.');
  return `+${digits}`;
}

export function createSafetyService(db, options = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS safety_settings(user_id TEXT PRIMARY KEY REFERENCES users(id),contact TEXT,ai_consent INTEGER DEFAULT 0,updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS safety_messages(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,body TEXT NOT NULL,metadata TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS safety_alerts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,recipient TEXT NOT NULL,message TEXT NOT NULL,map_url TEXT,created INTEGER NOT NULL,status TEXT NOT NULL,UNIQUE(user_id,client_id));`);
  const inFlight = new Set(), attempts = new Map();
  db.exec('CREATE TABLE IF NOT EXISTS safety_actions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),message_id TEXT NOT NULL REFERENCES safety_messages(id) ON DELETE CASCADE,action TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL)');
  const getSettings = uid => { const row = db.prepare('SELECT * FROM safety_settings WHERE user_id=?').get(uid); return { contact: row?.contact ? JSON.parse(row.contact) : null, aiConsent: !!row?.ai_consent }; };
  const getMessages = uid => db.prepare('SELECT id,role,text,metadata,created FROM (SELECT rowid AS sequence,id,role,body AS text,metadata,created FROM safety_messages WHERE user_id=? ORDER BY rowid DESC LIMIT 60) ORDER BY sequence ASC').all(uid).map(m => ({ ...m, metadata: JSON.parse(m.metadata) }));
  const getAlert = (id, uid) => db.prepare('SELECT id,recipient,message,map_url AS mapUrl,created,status FROM safety_alerts WHERE id=? AND user_id=?').get(id, uid);
  async function handle(path, method, body, uid) {
    if (path === '/safety' && method === 'GET') return { ...getSettings(uid), assistant: aiStatus(), messages: getMessages(uid), alerts: db.prepare('SELECT id,created,status,map_url AS mapUrl FROM safety_alerts WHERE user_id=? ORDER BY created DESC LIMIT 10').all(uid) };
    if (path === '/safety/settings' && method === 'PUT') {
      const old = getSettings(uid); let contact = old.contact;
      if (body.contact !== undefined) {
        if (body.contact === null) contact = null;
        else {
          if (!validText(body.contact?.name, 80) || !body.contact.name.trim()) fail(400, 'Informe o nome do contato de confiança.');
          contact = { name: body.contact.name.trim(), phone: normalizePhone(body.contact.phone) };
        }
      }
      if (body.aiConsent !== undefined && typeof body.aiConsent !== 'boolean') fail(400, 'Consentimento inválido.');
      const aiConsent = body.aiConsent ?? old.aiConsent;
      db.prepare('INSERT INTO safety_settings VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET contact=excluded.contact,ai_consent=excluded.ai_consent,updated=excluded.updated').run(uid, contact ? JSON.stringify(contact) : null, aiConsent ? 1 : 0, Date.now());
      return { contact, aiConsent };
    }
    if (path === '/safety/messages' && method === 'DELETE') { if (inFlight.has(uid)) fail(409, 'Aguarde a resposta antes de apagar a conversa.'); db.prepare('DELETE FROM safety_messages WHERE user_id=?').run(uid); return { messages: [] }; }
    if (path === '/safety/chat' && method === 'POST') {
      const settings = getSettings(uid);
      if (!settings.aiConsent) fail(403, 'Autorize o envio da mensagem à IA antes de conversar.');
      if (!validText(body.message, 2000) || !body.message.trim()) fail(400, 'Escreva uma mensagem de até 2000 caracteres.');
      let selectedProfile = null;
      if (body.profileId !== undefined && body.profileId !== null) {
        if (body.profileConsent !== true) fail(403, 'Autorize o uso dos dados declarados deste perfil antes de enviar à IA.');
        if (!validText(body.profileId, 100) || body.profileId === uid) fail(400, 'Selecione um perfil válido.');
        const row = db.prepare('SELECT profile FROM users WHERE id=?').get(body.profileId);
        const blocked = db.prepare('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').get(uid, body.profileId, body.profileId, uid);
        if (!row || blocked) fail(404, 'Perfil indisponível para o assistente.');
        const target = JSON.parse(row.profile);
        if (!target.bio?.trim() || !(target.photo || target.photoUri)) fail(404, 'Perfil indisponível para o assistente.');
        selectedProfile = Object.fromEntries(['name', 'age', 'city', 'bio', 'interests', 'intention'].map(key => [key, target[key] || '']));
      }
      if (inFlight.has(uid)) fail(409, 'Aguarde a resposta anterior.');
      const now = Date.now(), limit = attempts.get(uid);
      const rate = limit && limit.until > now ? limit : { n: 0, until: now + 5 * 60000 };
      if (attempts.size > 10000) attempts.clear(); attempts.set(uid, rate);
      if (++rate.n > 20) fail(429, 'Limite de mensagens do assistente atingido. Aguarde alguns minutos; o SOS continua disponível.');
      inFlight.add(uid);
      try {
        const message = body.message.trim();
        db.prepare('INSERT INTO safety_messages VALUES(?,?,?,?,?,?)').run(randomUUID(), uid, 'user', message, '{}', now);
        const profile = JSON.parse(db.prepare('SELECT profile FROM users WHERE id=?').get(uid).profile);
        const lastAlert = db.prepare('SELECT status FROM safety_alerts WHERE user_id=? ORDER BY created DESC LIMIT 1').get(uid);
        const context = { firstName: profile.name.split(' ')[0], userInterests: profile.interests || '', trustedContactConfigured: !!settings.contact, locationAuthorizedForDiscovery: !!profile.location, lastAlertStatus: lastAlert?.status || 'none', selectedProfile };
        const messages = getMessages(uid).slice(-10).map(m => ({ role: m.role, content: m.text }));
        let answer;
        try { answer = await (options.askAI || askSafetyAI)({ messages, context }); }
        catch (error) { console.warn('Assistente indisponível:', error.code || error.name || 'provider_error'); answer = { reply: fallbackReply, category: 'general', origin: 'offline-guidance', provider: null, model: null, reason: error.code || 'unavailable' }; }
        const actions = answer.origin === 'ai' && Array.isArray(answer.actions) ? [...new Set(answer.actions)].filter(action => Object.hasOwn(actionLabels, action)).slice(0, 3) : [];
        db.prepare('INSERT INTO safety_messages VALUES(?,?,?,?,?,?)').run(randomUUID(), uid, 'assistant', answer.reply, JSON.stringify({ origin: answer.origin, provider: answer.provider, model: answer.model, category: answer.category, actions, profileId: selectedProfile ? body.profileId : null, reason: answer.reason || null }), Date.now());
        return { messages: getMessages(uid), response: answer };
      } finally { inFlight.delete(uid); }
    }
    if (path === '/safety/actions' && method === 'POST') {
      if (body.confirmation !== true || typeof body.action !== 'string' || !Object.hasOwn(actionLabels, body.action) || typeof body.messageId !== 'string') fail(400, 'Revise e confirme uma ação válida.');
      const message = db.prepare("SELECT metadata FROM safety_messages WHERE id=? AND user_id=? AND role='assistant'").get(body.messageId, uid);
      const metadata = message ? JSON.parse(message.metadata) : null;
      if (metadata?.origin !== 'ai' || !metadata.actions?.includes(body.action)) fail(403, 'Esta ação não foi proposta nesta conversa.');
      const contact = getSettings(uid).contact;
      if (['prepare_sos', 'open_sms', 'share_sos', 'call_contact'].includes(body.action) && !contact) fail(400, 'Cadastre um contato de confiança antes de confirmar.');
      const id = randomUUID();
      db.prepare('INSERT INTO safety_actions VALUES(?,?,?,?,?,?)').run(id, uid, body.messageId, body.action, 'confirmed', Date.now());
      return { actionId: id, action: body.action, status: 'confirmed', contact };
    }
    const actionMatch = path.match(/^\/safety\/actions\/([a-f0-9-]+)$/);
    if (actionMatch && method === 'PATCH') {
      if (!['prepared', 'opened', 'cancelled', 'failed'].includes(body.status)) fail(400, 'Estado da ação inválido.');
      const row = db.prepare('SELECT id FROM safety_actions WHERE id=? AND user_id=?').get(actionMatch[1], uid);
      if (!row) fail(404, 'Ação não encontrada.');
      db.prepare('UPDATE safety_actions SET status=? WHERE id=?').run(body.status, row.id);
      return { actionId: row.id, status: body.status };
    }
    if (path === '/safety/alerts' && method === 'POST') {
      const settings = getSettings(uid);
      if (!settings.contact) fail(400, 'Cadastre um contato de confiança antes de preparar o SOS.');
      if (!validText(body.clientId, 100) || !body.clientId.trim()) fail(400, 'Identificador do alerta inválido.');
      const existing = db.prepare('SELECT id FROM safety_alerts WHERE user_id=? AND client_id=?').get(uid, body.clientId);
      if (existing) return { alert: getAlert(existing.id, uid) };
      let mapUrl = null;
      if (body.location !== undefined && body.location !== null) {
        const l = body.location;
        if (body.locationConsent !== true || !Number.isFinite(l.latitude) || !Number.isFinite(l.longitude) || Math.abs(l.latitude) > 90 || Math.abs(l.longitude) > 180 || !Number.isFinite(l.timestamp) || Math.abs(Date.now() - l.timestamp) > 120000) fail(400, 'A localização precisa ser atual e autorizada para este alerta.');
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${l.latitude.toFixed(6)},${l.longitude.toFixed(6)}`;
      }
      const name = JSON.parse(db.prepare('SELECT profile FROM users WHERE id=?').get(uid).profile).name;
      const id = randomUUID(), created = Date.now();
      const message = `Elo — pedido de ajuda de ${name}. Preciso de ajuda. Por favor, entre em contato comigo agora. Horário: ${new Date(created).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. ${mapUrl ? `Localização pontual autorizada: ${mapUrl}` : 'Localização não incluída.'}`;
      db.prepare('INSERT INTO safety_alerts VALUES(?,?,?,?,?,?,?,?)').run(id, uid, body.clientId, settings.contact.phone, message, mapUrl, created, 'prepared');
      return { alert: getAlert(id, uid) };
    }
    const alertMatch = path.match(/^\/safety\/alerts\/([a-f0-9-]+)$/);
    if (alertMatch && method === 'PATCH') {
      if (!['opened', 'device_sent', 'cancelled', 'failed'].includes(body.status)) fail(400, 'Estado do alerta inválido.');
      const alert = getAlert(alertMatch[1], uid); if (!alert) fail(404, 'Alerta não encontrado.');
      if (alert.status === 'device_sent' && body.status !== 'device_sent') fail(409, 'O aplicativo de mensagens já informou envio para este alerta.');
      db.prepare('UPDATE safety_alerts SET status=? WHERE id=? AND user_id=?').run(body.status, alert.id, uid);
      return { alert: getAlert(alert.id, uid) };
    }
    fail(404, 'Recurso de segurança não encontrado.');
  }
  return { handle };
}
