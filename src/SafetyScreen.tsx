import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as SMS from 'expo-sms';
import * as Clipboard from 'expo-clipboard';
import { api, Profile } from './api';
import { fontStyles } from './fonts';
import { paletteFor } from './visuals';

type Contact = { name: string; phone: string };
type SafetyMessage = { id: string; role: 'user' | 'assistant'; text: string; created: number; metadata: { origin?: string; provider?: string; model?: string } };
type Alert = { id: string; recipient: string; message: string; mapUrl: string | null; created: number; status: 'prepared' | 'opened' | 'device_sent' | 'cancelled' | 'failed' };
type State = { contact: Contact | null; aiConsent: boolean; assistant: { configured: boolean }; messages: SafetyMessage[]; alerts: Alert[] };
const labels: Record<Alert['status'], string> = { prepared: 'Preparado · envio ainda não realizado', opened: 'Aplicativo aberto · envio não confirmado', device_sent: 'SMS informou envio · entrega não confirmada', cancelled: 'Envio cancelado', failed: 'Não foi possível abrir o envio' };

export function SafetyScreen({ user }: { user: Profile }) {
  const c = paletteFor(user.theme);
  const [state, setState] = useState<State | null>(null), [loading, setLoading] = useState(true);
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [editing, setEditing] = useState(false);
  const [contactBusy, setContactBusy] = useState(false), [aiBusy, setAiBusy] = useState(false), [sosBusy, setSosBusy] = useState(false);
  const [text, setText] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [voice, setVoice] = useState(false), [speaking, setSpeaking] = useState(false), [includeLocation, setIncludeLocation] = useState(true);
  const [alert, setAlert] = useState<Alert | null>(null);
  const mounted = useRef(true), sendLock = useRef(false), alertNonce = useRef<string | null>(null);
  const chat = useRef<ScrollView>(null), page = useRef<ScrollView>(null);
  useEffect(() => { mounted.current = true; api<State>('/safety').then(data => { if (!mounted.current) return; setState(data); setName(data.contact?.name || ''); setPhone(data.contact?.phone || ''); setEditing(!data.contact); }).catch(e => { if (mounted.current) setError(e.message); }).finally(() => { if (mounted.current) setLoading(false); }); return () => { mounted.current = false; void Speech.stop(); }; }, []);
  async function action(task: () => Promise<void>, kind: 'contact' | 'sos' = 'contact') {
    const setBusy = kind === 'sos' ? setSosBusy : setContactBusy;
    setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.'); } finally { if (mounted.current) setBusy(false); }
  }
  function speak(message: string) {
    void Speech.stop(); setSpeaking(true);
    Speech.speak(message, { language: 'pt-BR', rate: 0.95, onDone: () => { if (mounted.current) setSpeaking(false); }, onStopped: () => { if (mounted.current) setSpeaking(false); }, onError: () => { if (mounted.current) { setSpeaking(false); setError('Não foi possível reproduzir a voz neste dispositivo. O texto continua disponível.'); } } });
  }
  async function saveContact() {
    const saved = await api<{ contact: Contact; aiConsent: boolean }>('/safety/settings', 'PUT', { contact: { name, phone } });
    if (!mounted.current) return;
    setState(old => old ? { ...old, ...saved } : old); setPhone(saved.contact.phone); setEditing(false); setNotice('Contato de confiança salvo.');
  }
  async function consent(value: boolean) {
    const saved = await api<{ contact: Contact | null; aiConsent: boolean }>('/safety/settings', 'PUT', { aiConsent: value });
    if (mounted.current) setState(old => old ? { ...old, ...saved } : old);
  }
  function send() {
    if (sendLock.current || aiBusy || !text.trim() || !state?.aiConsent) return;
    sendLock.current = true; setAiBusy(true); setError(''); setNotice('');
    const message = text;
    api<{ messages: SafetyMessage[] }>('/safety/chat', 'POST', { message }, 55000).then(result => {
      if (!mounted.current) return;
      setState(old => old ? { ...old, messages: result.messages } : old); setText(current => current === message ? '' : current);
      const last = result.messages[result.messages.length - 1];
      if (voice && last?.role === 'assistant') speak(last.text);
    }).catch(e => { if (mounted.current) setError(e.message); }).finally(() => { sendLock.current = false; if (mounted.current) setAiBusy(false); });
  }
  async function prepareSOS() {
    if (!state?.contact) { setEditing(true); throw new Error('Salve um contato de confiança antes de preparar o SOS.'); }
    let location: { latitude: number; longitude: number; timestamp: number } | null = null;
    let locationWarning = '';
    if (includeLocation) {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') throw new Error('Permissão de localização não concedida.');
        const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Tempo de localização esgotado.')), 10000))]);
        location = { latitude: position.coords.latitude, longitude: position.coords.longitude, timestamp: position.timestamp };
      } catch { locationWarning = ' Não foi possível obter a localização. A mensagem foi preparada sem ela.'; }
    }
    alertNonce.current ||= `sos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await api<{ alert: Alert }>('/safety/alerts', 'POST', { clientId: alertNonce.current, location, locationConsent: !!location });
    if (mounted.current) { setAlert(result.alert); setNotice(`SOS preparado para ${state.contact.name}. Confirme o envio no aplicativo de mensagens.${locationWarning}`); }
  }
  async function updateAlert(status: Alert['status']) {
    if (!alert) return;
    const result = await api<{ alert: Alert }>(`/safety/alerts/${alert.id}`, 'PATCH', { status });
    if (mounted.current) setAlert(result.alert);
  }
  async function openSMS() {
    if (!alert) return;
    if (Platform.OS === 'web' || !await SMS.isAvailableAsync()) throw new Error('SMS não está disponível nesta prévia. Copie a mensagem ou compartilhe no celular.');
    await updateAlert('opened');
    try {
      const result = await SMS.sendSMSAsync([alert.recipient], alert.message);
      await updateAlert(result.result === 'sent' ? 'device_sent' : result.result === 'cancelled' ? 'cancelled' : 'opened');
    } catch { await updateAlert('failed'); throw new Error('Não foi possível abrir o SMS. Você pode copiar a mensagem para enviar por outro aplicativo.'); }
  }
  async function shareAlert() {
    if (!alert) return;
    const result = await Share.share({ title: 'Pedido de ajuda — Elo', message: alert.message });
    await updateAlert(result.action === Share.dismissedAction ? 'cancelled' : 'opened');
  }
  async function call(number: string) {
    if (Platform.OS === 'web') { setNotice(`No celular, abra o telefone e ligue ${number}. A prévia não realiza a ligação.`); return; }
    await Linking.openURL(`tel:${number}`);
  }
  const button = (label: string, callback: () => void, disabled = false, secondary = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={callback} style={({ pressed }) => [s.button, { backgroundColor: secondary ? c.soft : c.accent, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}><Text style={[s.buttonText, { color: secondary ? c.ink : '#fff' }]}>{label}</Text></Pressable>;
  return <ScrollView ref={page} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <View style={s.intro}><Text style={[s.eyebrow, { color: c.accent }]}>SEU ESPAÇO DE CUIDADO</Text><Text style={[s.title, { color: c.ink }]}>Elo Apoio</Text><Text style={[s.body, { color: c.muted }]}>Converse por texto, ouça uma resposta e prepare ajuda para alguém de confiança.</Text></View>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
    <View style={s.card}><View style={s.cardHeader}><Ionicons name="shield-checkmark-outline" size={22} color={c.accent} /><Text style={[s.subtitle, { color: c.ink }]}>Ajuda sem esperar a IA</Text></View><Text style={[s.body, { color: c.muted }]}>Prepare uma mensagem para seu contato. Você confirma o envio no SMS ou em outro aplicativo.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Incluir localização atual no SOS" aria-checked={includeLocation} onPress={() => setIncludeLocation(v => !v)} style={s.checkbox}><Ionicons name={includeLocation ? 'checkbox' : 'square-outline'} size={22} color={c.accent} /><Text style={[s.checkText, { color: c.ink }]}>Incluir minha localização atual</Text></Pressable><Text style={[s.small, { color: c.muted }]}>Um ponto no mapa, obtido com sua autorização ao preparar o SOS. Não há rastreamento contínuo.</Text>
      {button(sosBusy ? 'Preparando SOS…' : 'Preparar SOS', () => void action(prepareSOS, 'sos'), sosBusy || loading)}
      <View style={s.calls}>{[['190', 'Polícia'], ['193', 'Bombeiros'], ['192', 'SAMU']].map(([number, label]) => <Pressable key={number} accessibilityRole="button" accessibilityLabel={`Abrir telefone ${number}`} onPress={() => void action(() => call(number!))} style={s.call}><Ionicons name="call-outline" size={17} color={c.accent} /><Text style={[s.callNumber, { color: c.ink }]}>{number}</Text><Text style={[s.small, { color: c.muted }]}>{label}</Text></Pressable>)}</View>
    </View>
    {!!alert && <View style={s.card}><Text style={[s.subtitle, { color: c.ink }]}>Pedido preparado</Text><Text accessibilityLiveRegion="polite" style={[s.small, { color: c.accent }]}>{labels[alert.status]}</Text><Text selectable style={[s.messagePreview, { color: c.ink, backgroundColor: c.soft }]}>{alert.message}</Text>{alert.mapUrl && <Pressable accessibilityRole="link" onPress={() => void action(async () => { await Linking.openURL(alert.mapUrl!); })}><Text style={[s.link, { color: c.accent }]}>Ver ponto no mapa ↗</Text></Pressable>}{button('Abrir SMS para meu contato', () => void action(openSMS, 'sos'), sosBusy)}{button('Compartilhar mensagem', () => void action(shareAlert, 'sos'), sosBusy, true)}{button('Copiar mensagem', () => void action(async () => { const ok = await Clipboard.setStringAsync(alert.message); if (!ok) throw new Error('Não foi possível copiar. Selecione a mensagem acima.'); setNotice('Mensagem copiada. Envie para seu contato de confiança.'); }), false, true)}{button('Preparar um novo pedido', () => { setAlert(null); alertNonce.current = null; }, sosBusy, true)}</View>}
    <View style={s.card}><View style={s.cardHeader}><Ionicons name="people-outline" size={22} color={c.accent} /><Text style={[s.subtitle, { color: c.ink }]}>Contato de confiança</Text></View>{loading ? <ActivityIndicator color={c.accent} /> : !editing && state?.contact ? <><Text style={[s.body, { color: c.ink }]}>{state.contact.name}</Text><Text style={[s.small, { color: c.muted }]}>{state.contact.phone}</Text>{button('Editar contato', () => setEditing(true), false, true)}</> : <><Text style={[s.small, { color: c.muted }]}>Escolha alguém que aceite ser seu contato de confiança.</Text><TextInput accessibilityLabel="Nome do contato de confiança" placeholder="Nome" placeholderTextColor={c.muted} value={name} onChangeText={setName} maxLength={80} style={[s.input, { color: c.ink, borderColor: c.border }]} /><TextInput accessibilityLabel="Telefone do contato de confiança" placeholder="Telefone com DDD" placeholderTextColor={c.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} style={[s.input, { color: c.ink, borderColor: c.border }]} />{button('Salvar contato de confiança', () => void action(saveContact), contactBusy)}{state?.contact && button('Remover contato de confiança', () => void action(async () => { const result = await api<{ contact: null; aiConsent: boolean }>('/safety/settings', 'PUT', { contact: null }); setState(old => old ? { ...old, ...result } : old); setName(''); setPhone(''); setNotice('Contato removido.'); }), contactBusy, true)}</>}</View>
    <View style={s.card}><View style={s.cardHeader}><Ionicons name="chatbubbles-outline" size={22} color={c.accent} /><Text style={[s.subtitle, { color: c.ink }]}>Converse com o assistente</Text></View><Text style={[s.small, { color: c.muted }]}>É um assistente de software, não uma central de emergência. Ele não envia alertas ou chama socorro por conta própria.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Autorizar conversa com a IA" aria-checked={!!state?.aiConsent} disabled={contactBusy || loading} onPress={() => void action(() => consent(!state?.aiConsent))} style={s.checkbox}><Ionicons name={state?.aiConsent ? 'checkbox' : 'square-outline'} size={22} color={c.accent} /><Text style={[s.checkText, { color: c.ink }]}>Permito enviar minhas mensagens e um contexto limitado do app à OpenAI para receber orientação.</Text></Pressable><Text style={[s.small, { color: c.muted }]}>O telefone do contato e as coordenadas não são enviados ao modelo. Você pode apagar esta conversa.</Text>
      <Pressable accessibilityRole="switch" accessibilityLabel="Respostas em voz" aria-checked={voice} onPress={() => { setVoice(v => !v); if (voice) { void Speech.stop(); setSpeaking(false); } }} style={s.voice}><Ionicons name={voice ? 'volume-high-outline' : 'volume-mute-outline'} size={21} color={c.accent} /><Text style={[s.body, { color: c.ink }]}>Respostas em voz: {voice ? 'ligadas' : 'desligadas'}</Text></Pressable>{speaking && button('Parar voz', () => { void Speech.stop(); setSpeaking(false); }, false, true)}
      <ScrollView ref={chat} nestedScrollEnabled style={s.chat} contentContainerStyle={s.chatContent} onContentSizeChange={() => chat.current?.scrollToEnd({ animated: true })}>{!state?.messages.length && <Text style={[s.body, { color: c.muted }]}>Conte o que está acontecendo. Exemplo: “Estou em um encontro e me sinto em perigo”.</Text>}{state?.messages.map(message => <View key={message.id} style={[s.bubble, { alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: message.role === 'user' ? c.accent : c.soft }]}><Text style={[s.chatText, { color: message.role === 'user' ? '#fff' : c.ink }]}>{message.text}</Text>{message.role === 'assistant' && <><Text style={[s.origin, { color: c.muted }]}>{message.metadata.origin === 'ai' ? 'IA · OpenAI' : 'Orientação fixa · IA indisponível'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Ouvir resposta do assistente" onPress={() => speak(message.text)} style={s.listen}><Ionicons name="volume-high-outline" size={17} color={c.accent} /><Text style={[s.small, { color: c.accent }]}>Ouvir resposta</Text></Pressable></>}</View>)}{aiBusy && <ActivityIndicator color={c.accent} />}</ScrollView>
      <TextInput accessibilityLabel="Mensagem para o assistente de segurança" placeholder="Como posso ajudar?" placeholderTextColor={c.muted} value={text} onChangeText={setText} multiline maxLength={2000} style={[s.input, s.chatInput, { color: c.ink, borderColor: c.border }]} returnKeyType="send" submitBehavior={Platform.OS === 'web' ? 'newline' : 'submit'} onSubmitEditing={Platform.OS === 'web' ? undefined : send} onKeyPress={event => { const native = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean }; if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey && !native.isComposing) { event.preventDefault(); send(); } }} />
      {button(aiBusy ? 'Consultando assistente…' : 'Enviar para o assistente', send, aiBusy || !state?.aiConsent || !text.trim())}
      {!!state?.messages.length && button('Apagar conversa do assistente', () => void action(async () => { await api('/safety/messages', 'DELETE'); void Speech.stop(); setState(old => old ? { ...old, messages: [] } : old); }), aiBusy || contactBusy, true)}
    </View>
  </ScrollView>;
}
const s = StyleSheet.create(fontStyles({ page: { padding: 20, paddingBottom: 32, gap: 18 }, intro: { backgroundColor: '#FFFFFFED', padding: 19, borderRadius: 22, gap: 10 }, eyebrow: { fontSize: 9, letterSpacing: 1.8, fontWeight: '700' }, title: { fontSize: 31, fontWeight: '700' }, body: { fontSize: 13, lineHeight: 21 }, card: { backgroundColor: '#FFFFFFFA', borderRadius: 22, padding: 18, gap: 14 }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 }, subtitle: { fontSize: 17, fontWeight: '600', flex: 1 }, small: { fontSize: 11, lineHeight: 18 }, checkbox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }, checkText: { fontSize: 12, lineHeight: 20, flex: 1 }, button: { minHeight: 48, padding: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, buttonText: { fontSize: 12, fontWeight: '600' }, calls: { flexDirection: 'row', justifyContent: 'space-around', gap: 10 }, call: { flex: 1, alignItems: 'center', paddingVertical: 9, gap: 4 }, callNumber: { fontSize: 18, fontWeight: '700' }, input: { borderWidth: 1, borderRadius: 14, padding: 13, minHeight: 48, backgroundColor: '#fff', fontSize: 13 }, chatInput: { minHeight: 75, maxHeight: 140, textAlignVertical: 'top' }, voice: { flexDirection: 'row', gap: 9, alignItems: 'center', paddingVertical: 8 }, chat: { maxHeight: 330, minHeight: 100 }, chatContent: { gap: 12, paddingVertical: 8 }, bubble: { maxWidth: '95%', borderRadius: 18, padding: 13, gap: 9 }, chatText: { fontSize: 13, lineHeight: 21 }, origin: { fontSize: 9 }, listen: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 5 }, error: { color: '#9B2945', backgroundColor: '#FDECEF', borderRadius: 14, padding: 13, fontSize: 12, lineHeight: 20 }, notice: { color: '#17181C', backgroundColor: '#FFFFFFF2', borderRadius: 14, padding: 13, fontSize: 12, lineHeight: 20 }, messagePreview: { fontSize: 12, lineHeight: 21, padding: 14, borderRadius: 13 }, link: { fontSize: 12, fontWeight: '600' } }));
