import { ProfileImage } from './src/ProfileImage';
import { SafetyScreen } from './src/SafetyScreen';
import { ApiConnection } from './src/ApiConnection';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, clearSession, fields, Message, Preferences, Profile, restoreSession, setSession } from './src/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { PreferencesPanel } from './src/PreferencesPanel';
import { QuickFilters } from './src/QuickFilters';
import { BottomNav } from './src/BottomNav';
import { DiscoveryDeck } from './src/DiscoveryDeck';
import { ReportSheet } from './src/ReportSheet';
import { fontStyles, useAppFonts } from './src/fonts';
import { ChatConversation } from './src/ChatConversation';
import { profilePhoto, tabBackgrounds, Tab, paletteFor } from './src/visuals';
const ThemeContext = createContext('standard');

function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const s = createStyles(useContext(ThemeContext));
  return <Pressable accessibilityRole="button" aria-disabled={disabled} disabled={disabled} onPress={onPress} style={[s.button, secondary && s.buttonSecondary, disabled && s.disabled]}><Text style={[s.buttonText, secondary && s.buttonSecondaryText]}>{title}</Text></Pressable>;
}
function Input({ label, value, onChangeText, secure = false, email = false, numeric = false, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; secure?: boolean; email?: boolean; numeric?: boolean; multiline?: boolean }) {
  const s = createStyles(useContext(ThemeContext));
  return <View style={s.inputGroup}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} secureTextEntry={secure} keyboardType={email ? 'email-address' : numeric ? 'number-pad' : 'default'} autoCapitalize={email ? 'none' : 'sentences'} multiline={multiline} maxLength={multiline ? 500 : secure ? 128 : 254} style={[s.input, multiline && { minHeight: 95, textAlignVertical: 'top' }]} /></View>;
}
function Avatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  const s = createStyles(useContext(ThemeContext));
  const source = profilePhoto(profile);
  if (!source) return <View style={[s.avatar, s.initial]}><Text style={s.initialText}>{profile.name.charAt(0)}</Text></View>;
  const photo = <ProfileImage profile={profile} style={large ? { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' } : s.avatar} resizeMode="cover" accessibilityLabel={`${profile.photoUri ? 'Foto' : 'Foto de exemplo'} de ${profile.name}`} />;
  return large ? <View style={s.portrait}>{photo}</View> : photo;
}

export default function App() {
  const [fontsLoaded, fontsError] = useAppFonts();
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [user, setUser] = useState<Profile | null>(null); const [tab, setTab] = useState<Tab>('discover');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [age, setAge] = useState(''); const [gender, setGender] = useState('');
  const [busy, setBusy] = useState(false); const [booting, setBooting] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]); const [matches, setMatches] = useState<Profile[]>([]); const [preferences, setPreferences] = useState<Preferences | null>(null); const [draft, setDraft] = useState<Profile | null>(null);
  const [peer, setPeer] = useState<Profile | null>(null); const [messages, setMessages] = useState<Message[]>([]); const [message, setMessage] = useState(''); const [match, setMatch] = useState<Profile | null>(null);
  const [report, setReport] = useState<Profile | null>(null); const [reason, setReason] = useState(''); const [phone, setPhone] = useState(''); const sessionVersion = useRef(0);
  const s = createStyles(user?.theme || 'standard');
  const colors = paletteFor(user?.theme || 'standard');
  const contentRef = useRef<ScrollView>(null);
  const sendLock = useRef(false), activePeer = useRef<string | null>(null);
  activePeer.current = peer?.id || null;
  const chatting = tab === 'matches' && !!peer;
  const [quickFilters, setQuickFilters] = useState(false);
  const [assistantPeer, setAssistantPeer] = useState<Profile | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const history = useRef<Tab[]>([]);
  const savedPreferences = useRef<Preferences | null>(null);
  async function refresh() {
    const [account, discovery, connections] = await Promise.all([api<{ user: Profile; preferences: Preferences }>('/me'), api<{ profiles: Profile[] }>('/discover'), api<{ profiles: Profile[] }>('/matches')]);
    setUser(account.user); setDraft(account.user); setPreferences(account.preferences); savedPreferences.current = account.preferences; setProfiles(discovery.profiles); setMatches(connections.profiles);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.'); } finally { setBusy(false); }
  }
  useEffect(() => { let active = true; (async () => { try { if (await restoreSession()) { if (active) await refresh(); } } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível restaurar a sessão.'); } finally { if (active) setBooting(false); } })(); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!user || tab !== 'matches') return;
    let active = true; const version = sessionVersion.current;
    const poll = async () => { try { const result = await api<{ profiles: Profile[] }>('/matches'); if (!active || version !== sessionVersion.current) return; setMatches(result.profiles); if (peer) { if (!result.profiles.some(p => p.id === peer.id)) { setPeer(null); setMessages([]); return; } const chat = await api<{ messages: Message[] }>(`/messages?peer=${encodeURIComponent(peer.id)}`); if (active && version === sessionVersion.current) setMessages(existing => chat.messages.length >= existing.length ? chat.messages : existing); } } catch { /* Retry on next poll; user actions report failures. */ } };
    void poll(); const timer = setInterval(poll, 4000); return () => { active = false; clearInterval(timer); };
  }, [user?.id, tab, peer?.id]);
  function switchTab(next: Tab) { setTab(next); setError(''); setNotice(''); setMatch(null); setReport(null); contentRef.current?.scrollTo({ y: 0, animated: false }); if (next !== 'matches') { setPeer(null); setMessage(''); } }
  function navigate(next: Tab) { if (next !== tab) { history.current.push(tab); setCanGoBack(true); } switchTab(next); }
  function goBack() { const previous = history.current.pop(); if (previous) switchTab(previous); setCanGoBack(history.current.length > 0); }
  function askAssistant(profile: Profile) { setAssistantPeer(profile); navigate('safety'); }
  function openQuickFilters() { if (savedPreferences.current) setPreferences(savedPreferences.current); setError(''); setQuickFilters(true); }
  function closeQuickFilters() { if (savedPreferences.current) setPreferences(savedPreferences.current); setError(''); setQuickFilters(false); }
  async function savePreferences() {
    if (!preferences) return;
    const result = await api<{ preferences: Preferences }>('/preferences', 'PUT', preferences);
    const discovery = await api<{ profiles: Profile[] }>('/discover');
    savedPreferences.current = result.preferences; setPreferences(result.preferences); setProfiles(discovery.profiles); setQuickFilters(false);
    if (tab !== 'discover') navigate('discover'); else contentRef.current?.scrollTo({ y: 0, animated: false });
    setNotice('Preferências salvas. Suas sugestões já foram atualizadas.');
  }
  async function authenticate(demo = false) {
    const data = await api<{ token: string; user: Profile }>(authScreen === 'register' && !demo ? '/auth/register' : '/auth/login', 'POST', { email: demo ? 'demo@elo.app' : email, password: demo ? 'EloDemo123!' : password, name, age: Number(age), gender });
    await setSession(data.token); setUser(data.user); setPassword(''); setTab('discover'); await refresh();
  }
  async function logout() {
    try { await api('/auth/logout', 'POST'); } catch { /* Local logout still works offline; server sessions expire independently. */ }
    sessionVersion.current++; await clearSession(); setUser(null); setDraft(null); setPreferences(null); setProfiles([]); setMatches([]); setMessages([]); setPeer(null); setMatch(null); setReport(null); setMessage(''); setEmail(''); setPassword(''); setAuthScreen('welcome'); history.current = []; setCanGoBack(false); setQuickFilters(false); setAssistantPeer(null); savedPreferences.current = null;
  }
    async function updateLocation(remove = false) {
    if (remove) await api('/location', 'PUT', { remove: true });
    else {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Localização não autorizada. Você pode continuar usando os demais filtros.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await api('/location', 'PUT', { consent: true, latitude: position.coords.latitude, longitude: position.coords.longitude });
    }
    const account = await api<{ user: Profile; preferences: Preferences }>('/me');
    setUser(account.user); savedPreferences.current = account.preferences;
    setPreferences(current => current ? { ...current, distance: remove ? { ...current.distance, mode: 'Indiferente' } : current.distance } : account.preferences);
    setProfiles((await api<{ profiles: Profile[] }>('/discover')).profiles);
    setNotice(remove ? 'Localização removida.' : 'Localização atualizada. Só a distância aproximada aparece para outras pessoas.');
  }
  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2, 3], quality: 0.5, base64: true });
    if (result.canceled || !result.assets[0]?.base64 || !draft) return;
    const asset = result.assets[0];
    const photoUri = 'data:' + (asset.mimeType || 'image/jpeg') + ';base64,' + asset.base64;
    if (photoUri.length > 1500000) throw new Error('A foto ficou grande. Escolha uma imagem menor, de até 1 MB.');
    setDraft({ ...draft, photoUri }); setNotice('Foto escolhida. Salve o perfil para publicar a alteração.');
  }
  async function react(kind: 'like' | 'pass') {
    if (!profiles[0]) return;
  const current = profiles[0]; const result = await api<{ match: boolean }>('/likes', 'POST', { id: current.id, kind });
    setProfiles(p => p.filter(x => x.id !== current.id)); if (result.match) setMatch(current);
    setMatches((await api<{ profiles: Profile[] }>('/matches')).profiles);
  }
  function sendMessage() {
    if (sendLock.current || busy || !peer || !message.trim()) return;
    sendLock.current = true;
    const target = peer.id, text = message, version = sessionVersion.current;
    void run(async () => {
      try {
        const result = await api<{ messages: Message[] }>('/messages', 'POST', { peer: target, text });
        if (activePeer.current === target && sessionVersion.current === version) { setMessages(result.messages); setMessage(current => current === text ? '' : current); }
      } finally { sendLock.current = false; }
    });
  }
  async function block(withReport: boolean) {
    if (!report) return;
    await api(withReport ? '/report' : '/block', 'POST', { id: report.id, reason }); setPeer(null); setReport(null); await refresh(); setNotice(withReport ? 'Denúncia registrada no banco local e perfil bloqueado.' : 'Perfil bloqueado.');
  }
  const current = profiles[0];
  if (booting || (!fontsLoaded && !fontsError)) return <View style={s.loading}><ActivityIndicator color="#C52F49" /><Text style={s.muted}>Preparando seu espaço…</Text></View>;
  if (!user) return <ImageBackground source={require('./assets/login-background.png')} style={[s.fill, { height: '100%', width: '100%' }]} resizeMode="cover" blurRadius={3}><StatusBar barStyle="light-content" /><View style={s.overlay} /><KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.auth} keyboardShouldPersistTaps="handled">
    <View style={s.rowBetween}><Text style={s.logoLight}>elo</Text><Text style={s.badge}>ENCONTROS REAIS</Text></View><View style={s.authSpacer} /><Text style={s.eyebrowLight}>MENOS ACASO. MAIS CONEXÃO.</Text><Text style={s.hero}>{authScreen === 'welcome' ? 'Toda boa história\ncomeça com\num encontro.' : authScreen === 'login' ? 'Bom ter\nvocê por aqui.' : 'Sua próxima\nhistória começa aqui.'}</Text><Text style={s.authDescription}>Encontre quem combina com seus valores,{ '\n' }seu jeito e o que você quer viver.</Text>
    {authScreen !== 'welcome' && <View style={s.authForm}>{authScreen === 'register' && <><Input label="Seu nome" value={name} onChangeText={setName} /><Input label="Idade (18 anos ou mais)" value={age} onChangeText={setAge} numeric /><Text style={s.label}>Como você se identifica? (opcional)</Text><View style={s.chips}>{fields.find(f => f.key === 'gender')!.options.map(value => <Pressable key={value} accessibilityRole="radio" aria-checked={gender === value} onPress={() => setGender(value)} style={[s.chip, gender === value && s.chipActive]}><Text style={[s.chipText, gender === value && s.chipTextActive]}>{value}</Text></Pressable>)}</View><Text style={s.small}>Homens e mulheres trans estão incluídos. Você pode ajustar seu perfil depois.</Text></>}<Input label="E-mail" value={email} onChangeText={setEmail} email /><Input label="Senha (mínimo 8 caracteres)" value={password} onChangeText={setPassword} secure /><Text style={s.muted}>Ambiente de desenvolvimento local. Use dados de teste.</Text></View>}
    {!!error && <Text accessibilityRole="alert" style={s.errorLight}>{error}</Text>}
    <Button title={busy ? 'Aguarde…' : authScreen === 'welcome' ? 'Começar minha história  →' : authScreen === 'register' ? 'Criar minha conta  →' : 'Entrar  →'} disabled={busy} onPress={() => authScreen === 'welcome' ? (setAuthScreen('register'), setError('')) : void run(() => authenticate())} />
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setAuthScreen(authScreen === 'login' ? 'register' : 'login'); setError(''); }} style={s.authLink}><Text style={s.authLinkText}>{authScreen === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => authenticate(true))} style={s.authLink}><Text style={s.authLinkText}>Entrar na conta de exemplo</Text></Pressable><Text style={s.footerLight}>Para maiores de 18 anos. Perfis de exemplo são fictícios.</Text>
    <ApiConnection />
  </ScrollView></KeyboardAvoidingView></ImageBackground>;

  return <ThemeContext.Provider value={user.theme || 'standard'}><View style={s.app}><ImageBackground accessibilityLabel="Fundo desfocado da aba" source={tabBackgrounds[tab]} blurRadius={14} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]} resizeMode="cover"><View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.56)' }]} /></ImageBackground><StatusBar barStyle="dark-content" />{!chatting && <View style={s.header}><View style={{ width: 54, alignItems: 'flex-start' }}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" disabled={!canGoBack} onPress={goBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: canGoBack ? 1 : 0.3 }}><Ionicons name="chevron-back" size={24} color={colors.accent} /></Pressable></View><View style={{ flex: 1, alignItems: 'center' }}><Text testID="app-title" accessibilityRole="header" style={s.logo}>elo</Text></View><View style={{ width: 54, alignItems: 'flex-end' }}>{tab === 'discover' ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir filtros rápidos" onPress={openQuickFilters} style={{ width: 48, height: 48, gap: 3, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="options-outline" size={23} color={colors.accent} /><Text style={s.headerAction}>Filtros</Text></Pressable> : tab === 'profile' ? <Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" disabled={busy} onPress={() => void run(logout)} style={{ width: 48, height: 48, gap: 3, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="log-out-outline" size={23} color="#9B2945" /><Text style={[s.headerAction, { color: '#9B2945' }]}>Sair</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Abrir segurança" onPress={() => navigate('safety')} style={{ width: 48, height: 48, gap: 3, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="shield-checkmark-outline" size={23} color={colors.accent} /><Text style={s.headerAction}>Cuidado</Text></Pressable>}</View></View>}
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{chatting && peer ? <ChatConversation onAskAssistant={() => askAssistant(peer!)} peer={peer} user={user} messages={messages} value={message} onChange={setMessage} onSend={sendMessage} busy={busy} error={error} onBack={() => { setPeer(null); setMessages([]); setMessage(''); setError(''); }} onReport={() => { setReport(peer); setReason(''); }} /> : tab === 'discover' ? <DiscoveryDeck onAskAssistant={askAssistant} profile={current} user={user} busy={busy} error={error} notice={notice} match={match} onLike={() => void run(() => react('like'))} onPass={() => void run(() => react('pass'))} onReport={profile => { setReport(profile); setReason(''); setError(''); }} onOpenMatch={() => { if (match) { setPeer(match); setMessages([]); navigate('matches'); } }} onDismissMatch={() => setMatch(null)} onComplete={() => navigate('profile')} onReset={() => void run(async () => { await api('/discover/reset', 'POST'); await refresh(); })} onFilters={openQuickFilters} /> : tab === 'safety' ? <SafetyScreen user={user} selectedProfile={assistantPeer} onClearProfile={() => setAssistantPeer(null)} /> : <ScrollView ref={contentRef} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}{busy && <ActivityIndicator color="#C52F49" />}
      {tab === 'matches' && <><View style={s.pageIntro}><Text style={s.eyebrow}>QUANDO O INTERESSE É MÚTUO</Text><Text style={s.title}>Seus encontros começam aqui.</Text><Text style={s.muted}>Escolha um elo para continuar a conversa.</Text></View>{!matches.length && <View style={s.card}><Text style={s.muted}>Ainda sem matches. Curta um perfil para começar. Na conta de exemplo, os perfis fictícios já curtiram você.</Text><Button title="Descobrir pessoas" onPress={() => navigate('discover')} /></View>}{matches.map(p => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} disabled={busy} style={s.matchRow} onPress={() => void run(async () => { const data = await api<{ messages: Message[] }>(`/messages?peer=${encodeURIComponent(p.id)}`); setMessages(data.messages); setPeer(p); setMessage(''); })}><Avatar profile={p} /><View style={s.fill}><Text style={s.subtitle}>{p.name}, {p.age}</Text><Text style={s.small}>{p.fictional ? 'Perfil fictício · conversa de teste' : 'Continuar conversa'}</Text></View><Ionicons name="chatbubble-ellipses-outline" size={23} color={colors.accent} /></Pressable>)}</>}
      {tab === 'preferences' && <><View style={s.pageIntro}><Text style={s.eyebrow}>CONEXÕES DO SEU JEITO</Text><Text style={s.title}>Suas preferências.</Text><Text style={s.muted}>Selecione o que combina com você. Priorize ou torne obrigatório.</Text></View>{preferences && <PreferencesPanel preferences={preferences} onChange={value => { setPreferences(value); setNotice(''); setError(''); }} user={user} busy={busy} onLocation={remove => void run(() => updateLocation(remove))} />}<Button title="Salvar preferências  →" disabled={busy} onPress={() => void run(savePreferences)} /></>}
      {tab === 'profile' && draft && <><View style={s.pageIntro}><Text style={s.eyebrow}>SEU JEITO DE SE APRESENTAR</Text><Text style={s.title}>Sua história, por você.</Text></View><View style={s.card}><Avatar profile={draft} /><Button title="Escolher foto do meu perfil" secondary disabled={busy} onPress={() => void run(choosePhoto)} /><Text style={s.muted}>Conta conectada · {user.age} anos</Text><Input label="Nome" value={draft.name} onChangeText={v => setDraft({ ...draft, name: v })} /><Input label="Cidade" value={draft.city} onChangeText={v => setDraft({ ...draft, city: v })} /><Input label="Sobre você" value={draft.bio} onChangeText={v => setDraft({ ...draft, bio: v })} multiline /><Input label="Interesses (separados por vírgula)" value={draft.interests} onChangeText={v => setDraft({ ...draft, interests: v })} />{fields.map(f => <View key={f.key} style={s.inputGroup}><Text style={s.label}>{f.key === 'gender' ? 'Minha identidade de gênero (opcional)' : f.label}</Text><View style={s.chips}>{['', ...f.options].map(value => <Pressable key={value} accessibilityRole="radio" aria-checked={draft[f.key] === value} onPress={() => setDraft({ ...draft, [f.key]: value })} style={[s.chip, draft[f.key] === value && s.chipActive]}><Text style={[s.chipText, draft[f.key] === value && s.chipTextActive]}>{value || 'Não informar'}</Text></Pressable>)}</View></View>)}<Text style={s.label}>Quero informar que sou uma pessoa trans (opcional)</Text><View style={s.chips}>{['', 'Sim', 'Não'].map(value => <Pressable key={value} accessibilityRole="radio" aria-checked={draft.trans === value} onPress={() => setDraft({ ...draft, trans: value })} style={[s.chip, draft.trans === value && s.chipActive]}><Text style={[s.chipText, draft.trans === value && s.chipTextActive]}>{value || 'Prefiro não informar'}</Text></Pressable>)}</View><Text style={s.small}>As informações que você escolher informar aparecem no seu perfil.</Text><Button title="Salvar meu perfil" disabled={busy} onPress={() => void run(async () => { const data = await api<{ user: Profile }>('/me', 'PUT', draft); setUser(data.user); setDraft(data.user); setNotice('Perfil atualizado.'); })} /></View></>}


    </ScrollView>}</KeyboardAvoidingView>{report && <ReportSheet profile={report} theme={user.theme} reason={reason} onChange={setReason} busy={busy} error={error} onSubmit={() => void run(() => block(true))} onBlock={() => void run(() => block(false))} onClose={() => { setReport(null); setError(''); }} />}{quickFilters && preferences && <QuickFilters user={user} preferences={preferences} onChange={value => { setPreferences(value); setError(''); }} busy={busy} error={error} onClose={closeQuickFilters} onSave={() => void run(savePreferences)} onLocation={remove => void run(() => updateLocation(remove))} />}<BottomNav selected={tab} onChange={navigate} user={user} count={matches.length} />
  </View></ThemeContext.Provider>;
}

function createStyles(theme = 'standard') {
const c = paletteFor(theme);
return StyleSheet.create(fontStyles({
  pageIntro: { backgroundColor: '#FFFFFFE8', borderRadius: 22, padding: 18, gap: 10 }, headerAction: { color: c.accent, fontSize: 9, fontWeight: '600' }, distance: { color: c.accent, fontSize: 13, fontWeight: '700' }, fill: { flex: 1 }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: c.canvas },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.56)' }, auth: { flexGrow: 1, paddingTop: 62, paddingBottom: 32, paddingHorizontal: 28, maxWidth: 540, width: '100%', alignSelf: 'center', gap: 18, minHeight: 780 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, logoLight: { color: '#fff8ef', fontSize: 54, fontWeight: '600', letterSpacing: -4 }, logo: { color: c.ink, fontSize: 38, fontWeight: '700', letterSpacing: -1.8, textAlign: 'center', lineHeight: 48 }, badge: { color: '#fff8ef', borderColor: '#ffffff55', borderWidth: 1, borderRadius: 30, padding: 10, fontSize: 9, letterSpacing: 1.5 }, authSpacer: { flex: 1, minHeight: 85 }, eyebrowLight: { color: '#f0b9af', letterSpacing: 2, fontSize: 10, fontWeight: '700' }, hero: { color: '#fff7ef', fontSize: 44, lineHeight: 49, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -1.5 }, authDescription: { color: '#e6d5d9', fontSize: 15, lineHeight: 23 }, authForm: { backgroundColor: '#fff8f3', borderRadius: 22, padding: 20, gap: 14 }, authLink: { alignItems: 'center', padding: 10 }, authLinkText: { color: '#fff8ef', fontSize: 14 }, footerLight: { color: '#d8c4c9', fontSize: 10, textAlign: 'center' }, errorLight: { color: '#ffd5ca', fontSize: 13, lineHeight: 20 },
  app: { flex: 1, height: '100%', maxHeight: '100%', backgroundColor: c.canvas, width: '100%', maxWidth: 480, alignSelf: 'center' }, header: { paddingTop: Platform.OS === 'ios' ? 50 : Platform.OS === 'android' ? 30 : 14, paddingBottom: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFFDE' }, greeting: { color: c.ink, fontSize: 14, fontWeight: '600' }, small: { color: c.muted, fontSize: 11, lineHeight: 17 }, safetyIcon: { marginLeft: 'auto', backgroundColor: c.soft, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, safetyIconText: { color: c.ink, fontSize: 25 }, content: { padding: 22, paddingBottom: 36, gap: 18 }, eyebrow: { color: c.accent, fontSize: 9, letterSpacing: 1.7, marginBottom: 8, fontWeight: '700' }, title: { color: c.ink, fontSize: 29, lineHeight: 35, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -0.7 }, subtitle: { color: c.ink, fontSize: 18, fontWeight: '600' }, muted: { color: c.muted, fontSize: 13, lineHeight: 21 }, bio: { color: c.ink, fontSize: 14, lineHeight: 22 }, button: { backgroundColor: c.primary, borderRadius: 16, minHeight: 52, padding: 15, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: c.ink, fontWeight: '700', fontSize: 14 }, buttonSecondary: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }, buttonSecondaryText: { color: c.accent }, disabled: { opacity: 0.45 }, inputGroup: { gap: 7 }, label: { color: c.ink, fontSize: 12, fontWeight: '600' }, input: { borderWidth: 1, borderColor: c.border, borderRadius: 13, minHeight: 49, padding: 13, color: c.ink, backgroundColor: c.card, fontSize: 14 }, error: { color: '#a02d48', backgroundColor: '#ffe8e8', padding: 13, borderRadius: 12, lineHeight: 20 }, notice: { color: c.ink, backgroundColor: c.soft, padding: 14, borderRadius: 14, fontSize: 12, lineHeight: 20 }, card: { backgroundColor: c.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: c.border, gap: 16 }, matchCard: { backgroundColor: c.soft, padding: 22, borderRadius: 22, gap: 15 }, profileCard: { borderRadius: 25, overflow: 'hidden', backgroundColor: c.card, borderWidth: 1, borderColor: c.border }, portrait: { width: '100%', aspectRatio: 2 / 3, resizeMode: 'cover' }, profileInfo: { padding: 20, gap: 12 }, profileName: { fontSize: 27, color: c.ink, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }, example: { color: c.muted, fontSize: 9, letterSpacing: 1.2 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tag: { backgroundColor: c.soft, borderRadius: 22, paddingHorizontal: 13, paddingVertical: 7 }, tagText: { color: c.muted, fontSize: 11 }, compatible: { color: c.accent, fontSize: 11, fontWeight: '600' }, actions: { flexDirection: 'row', gap: 16, justifyContent: 'center' }, textLink: { textAlign: 'center', color: c.muted, fontSize: 11, padding: 8 }, avatar: { width: 62, height: 62, borderRadius: 20, resizeMode: 'cover' }, initial: { backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }, initialText: { color: c.accent, fontSize: 25, fontWeight: '600' }, matchRow: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 15, borderRadius: 20 }, chevron: { color: c.accent, fontSize: 22 }, chip: { borderWidth: 1, borderColor: c.border, borderRadius: 24, paddingHorizontal: 13, paddingVertical: 12 }, chipActive: { backgroundColor: c.accent, borderColor: c.accent }, chipText: { color: c.muted, fontSize: 12 }, chipTextActive: { color: '#fff8f1' }, mode: { paddingVertical: 7 }, chat: { minHeight: 150, gap: 12 }, bubble: { padding: 14, borderRadius: 18, maxWidth: '88%', gap: 7 }, mine: { backgroundColor: c.accent, alignSelf: 'flex-end' }, theirs: { backgroundColor: c.soft, alignSelf: 'flex-start' }, mineText: { color: '#fff7f2', fontSize: 14, lineHeight: 22 }, time: { color: c.muted, fontSize: 9, textAlign: 'right' }, 
}));
}
