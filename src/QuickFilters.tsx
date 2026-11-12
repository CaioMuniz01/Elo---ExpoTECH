import { fontStyles } from './fonts';
import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Preferences, Profile } from './api';
import { paletteFor } from './visuals';
import { PreferencesPanel } from './PreferencesPanel';

type Props = { user: Profile; preferences: Preferences; onChange: (p: Preferences) => void; busy: boolean; error: string; onClose: () => void; onSave: () => void; onLocation: (remove?: boolean) => void };
export function QuickFilters(props: Props) {
  const c = paletteFor(props.user.theme);
  return <Modal visible transparent animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={props.busy ? undefined : props.onClose}>
    <View style={s.backdrop}><Pressable accessibilityRole="button" accessibilityLabel="Fechar filtros" disabled={props.busy} onPress={props.onClose} style={StyleSheet.absoluteFillObject} /><View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.canvas }]}>
      <View style={[s.handle, { backgroundColor: c.border }]} /><View style={s.heading}><Pressable accessibilityRole="button" accessibilityLabel="Voltar para descoberta" disabled={props.busy} onPress={props.onClose} style={s.back}><Ionicons name="chevron-back" size={24} color={c.accent} /></Pressable><View style={s.titleGroup}><Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>Seus filtros</Text><Text style={[s.subtitle, { color: c.muted }]}>Conexões que fazem sentido para você.</Text></View></View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}><PreferencesPanel preferences={props.preferences} onChange={props.onChange} user={props.user} busy={props.busy} onLocation={props.onLocation} /></ScrollView>
      <View style={[s.footer, { borderTopColor: c.border, backgroundColor: c.card }]}>{!!props.error && <Text accessibilityRole="alert" style={s.error}>{props.error}</Text>}<Pressable accessibilityRole="button" accessibilityLabel="Salvar preferências" disabled={props.busy} onPress={props.onSave} style={[s.save, { backgroundColor: c.accent, opacity: props.busy ? 0.6 : 1 }]}>{props.busy ? <ActivityIndicator color="#fff" /> : <><Text style={s.saveText}>Aplicar e descobrir</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}</Pressable></View>
    </View></View>
  </Modal>;
}
const s = StyleSheet.create(fontStyles({ backdrop: { flex: 1, backgroundColor: '#112E3880', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 540, height: '88%', maxHeight: 850, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' }, handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 }, heading: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16, paddingBottom: 20 }, back: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }, titleGroup: { flex: 1, gap: 4 }, title: { fontSize: 23, fontWeight: '600' }, subtitle: { fontSize: 11 }, scroll: { flex: 1 }, content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 }, footer: { padding: 18, paddingBottom: Platform.OS === 'ios' ? 30 : 18, gap: 12, borderTopWidth: StyleSheet.hairlineWidth }, save: { minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 }, saveText: { color: '#fff', fontWeight: '700', fontSize: 14 }, error: { color: '#9B2945', fontSize: 12, lineHeight: 18 } }));
