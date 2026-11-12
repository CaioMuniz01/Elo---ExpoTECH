import { ProfileImage } from './ProfileImage';
import { ProfileDetails } from './ProfileDetails';
import { fontStyles } from './fonts';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Message, Profile } from './api';
import { paletteFor, profilePhoto } from './visuals';

type Props = { peer: Profile; user: Profile; messages: Message[]; value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; error: string; onBack: () => void; onReport: () => void; onAskAssistant: () => void };
export function ChatConversation({ peer, user, messages, value, onChange, onSend, busy, error, onBack, onReport, onAskAssistant }: Props) {
  const c = paletteFor(user.theme), photo = profilePhoto(peer);
  const [showProfile, setShowProfile] = useState(false);
  const list = useRef<ScrollView>(null), followEnd = useRef(true);
  const latest = messages[messages.length - 1];
  useEffect(() => { followEnd.current = true; }, [peer.id]);
  useEffect(() => { if (latest?.sender === user.id) followEnd.current = true; if (followEnd.current) list.current?.scrollToEnd({ animated: true }); }, [latest?.id, user.id]);
  const date = (timestamp: number) => new Date(timestamp).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  return <View style={s.root}>
    <View style={[s.header, { borderBottomColor: c.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar para todos os matches" onPress={onBack} style={s.iconButton}><Ionicons name="chevron-back" size={24} color={c.accent} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil de ${peer.name}`} onPress={() => setShowProfile(true)} style={s.identity}>
        {photo ? <ProfileImage profile={peer} style={s.avatar} accessibilityLabel={`Foto de ${peer.name} na conversa`} /> : <View style={[s.avatar, s.initial, { backgroundColor: c.soft }]}><Text style={{ color: c.accent, fontSize: 22 }}>{peer.name.charAt(0)}</Text></View>}
        <View style={s.identityText}><Text style={[s.name, { color: c.ink }]} numberOfLines={1}>{peer.name}, {peer.age}</Text><Text style={[s.caption, { color: c.muted }]}>{peer.fictional ? 'Perfil fictício · toque para ver' : 'Toque para ver o perfil'}</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Denunciar ou bloquear este contato" onPress={onReport} style={s.iconButton}><Ionicons name="ellipsis-horizontal" size={23} color={c.accent} /></Pressable>
    </View>
    <ScrollView ref={list} style={s.list} contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled" onScroll={e => { const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent; followEnd.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 100; }} scrollEventThrottle={100} onContentSizeChange={() => { if (followEnd.current) list.current?.scrollToEnd({ animated: false }); }}>
      <View style={s.start}><View style={[s.heart, { backgroundColor: c.soft }]}><Ionicons name="heart" size={18} color={c.accent} /></View><Text style={[s.startTitle, { color: c.ink }]}>Um novo elo com {peer.name}.</Text><Text style={[s.startCaption, { color: c.muted }]}>Uma boa conversa começa com curiosidade.</Text></View>
      {peer.fictional && <View style={[s.demo, { backgroundColor: c.card, borderColor: c.border }]}><Ionicons name="information-circle-outline" size={18} color={c.muted} /><Text style={[s.demoText, { color: c.muted }]}>Pessoa fictícia: as mensagens são salvas, mas este perfil não responde automaticamente.</Text></View>}
      {!messages.length && <Text style={[s.empty, { color: c.muted }]}>Que tal perguntar sobre {peer.interests.split(',')[0]?.toLowerCase() || 'um interesse em comum'}?</Text>}
      {messages.map((message, index) => {
        const mine = message.sender === user.id;
        const previous = messages[index - 1];
        return <View key={message.id} style={s.messageGroup}>{(!previous || date(previous.created) !== date(message.created)) && <Text style={[s.date, { color: c.muted }]}>{date(message.created)}</Text>}<View style={[s.messageRow, mine && s.rowMine]}>
          {!mine && photo && <ProfileImage profile={peer} style={s.tinyAvatar} />}
          <View style={[s.bubble, mine ? { backgroundColor: c.accent, borderBottomRightRadius: 5 } : { backgroundColor: c.card, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: c.border }]}>
            <Text style={[s.body, { color: mine ? '#FFFFFF' : c.ink }]}>{message.text}</Text><View style={s.metadata}><Text style={[s.time, { color: mine ? '#FFFFFFD9' : c.muted }]}>{new Date(message.created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>{mine && <Ionicons name="checkmark" size={13} color="#FFFFFFD9" accessibilityLabel="Mensagem salva" />}</View>
          </View>
        </View></View>;
      })}
    </ScrollView>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <View style={[s.composerWrap, { borderTopColor: c.border }]}><View style={[s.composer, { borderColor: c.border, backgroundColor: c.card }]}>
      <TextInput accessibilityLabel="Sua mensagem" placeholder={`Escreva para ${peer.name}…`} placeholderTextColor={c.muted} value={value} onChangeText={onChange} multiline maxLength={2000} style={[s.input, { color: c.ink }]} returnKeyType="send" submitBehavior={Platform.OS === 'web' ? 'newline' : 'submit'} onSubmitEditing={Platform.OS === 'web' ? undefined : onSend} onKeyPress={e => {
        if (Platform.OS !== 'web') return;
        const native = e.nativeEvent as typeof e.nativeEvent & { shiftKey?: boolean; isComposing?: boolean };
        if (native.key === 'Enter' && !native.shiftKey && !native.isComposing) { e.preventDefault(); onSend(); }
      }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" disabled={busy || !value.trim()} aria-disabled={busy || !value.trim()} onPress={onSend} style={({ pressed }) => [s.send, { backgroundColor: c.accent, opacity: busy || !value.trim() ? 0.4 : pressed ? 0.75 : 1 }]}>{busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={24} color="#fff" />}</Pressable>
    </View><Text style={[s.hint, { color: c.muted }]}>{Platform.OS === 'web' ? 'Enter envia · Shift + Enter quebra a linha' : 'Converse no seu ritmo. Respeito sempre.'}</Text></View>
    {showProfile && <ProfileDetails onAskAssistant={() => { setShowProfile(false); onAskAssistant(); }} profile={peer} theme={user.theme} onClose={() => setShowProfile(false)} />}
  </View>;
}

const s = StyleSheet.create(fontStyles({
  root: { flex: 1, minHeight: 0 }, header: { paddingTop: Platform.OS === 'ios' ? 55 : 36, paddingBottom: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 1, backgroundColor: '#FFFFFFEB' },
  iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }, identityText: { flex: 1, gap: 4 }, avatar: { width: 48, height: 48, borderRadius: 24, resizeMode: 'cover' }, initial: { alignItems: 'center', justifyContent: 'center' }, name: { fontSize: 17, fontWeight: '700' }, caption: { fontSize: 11, lineHeight: 16 },
  list: { flex: 1 }, messages: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 20, gap: 12, flexGrow: 1 }, start: { backgroundColor: '#FFFFFFE8', borderRadius: 18, padding: 16, alignItems: 'center', gap: 8, paddingBottom: 10 }, heart: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, startTitle: { fontSize: 15, fontWeight: '600' }, startCaption: { fontSize: 11 }, demo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 6 }, demoText: { fontSize: 11, lineHeight: 17, flex: 1 }, empty: { backgroundColor: '#FFFFFFE8', borderRadius: 16, paddingHorizontal: 15, fontSize: 13, lineHeight: 22, textAlign: 'center', paddingVertical: 30 },
  messageGroup: { gap: 12 }, date: { backgroundColor: '#FFFFFFE0', borderRadius: 12, paddingHorizontal: 10, alignSelf: 'center', textAlign: 'center', fontSize: 10, paddingVertical: 7 }, messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 }, rowMine: { justifyContent: 'flex-end' }, tinyAvatar: { width: 25, height: 25, borderRadius: 13 }, bubble: { maxWidth: '84%', paddingHorizontal: 15, paddingTop: 11, paddingBottom: 7, borderRadius: 20, minWidth: 65 }, body: { fontSize: 14, lineHeight: 22 }, metadata: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'flex-end', marginTop: 5 }, time: { fontSize: 9 },
  composerWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2, borderTopWidth: 1, backgroundColor: '#FFFFFFE8' }, composer: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 26, padding: 5, gap: 6 }, input: { flex: 1, minHeight: 42, maxHeight: 112, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10, fontSize: 14, lineHeight: 21, textAlignVertical: 'center' }, send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, hint: { fontSize: 9, textAlign: 'center', paddingVertical: 7 }, error: { color: '#9B2945', backgroundColor: '#FDECEF', padding: 12, fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: '#10262C80', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 540, maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 }, sheetContent: { padding: 22, paddingBottom: 40, gap: 16 }, fullPhoto: { width: '100%', aspectRatio: 2 / 3, borderRadius: 22, overflow: 'hidden' }, profileName: { fontSize: 29, fontWeight: '600' }, profileText: { fontSize: 14, lineHeight: 23 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tag: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20 },
}));
