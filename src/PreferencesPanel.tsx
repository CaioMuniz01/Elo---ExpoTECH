import { fontStyles } from './fonts';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fields, Field, Preferences, Profile } from './api';
import { filterModes } from './preferences';
import { paletteFor } from './visuals';
import { DistanceControl } from './DistanceControl';

const emoji: Record<string, string> = {
  Católica: '✝️', Evangélica: '✝️', Espírita: '✨', Umbanda: '🌿', Candomblé: '🌿', Judaica: '✡️', Islâmica: '☪️', Budista: '☸️', Agnóstica: '🤔', Ateia: '🌱', Outra: '💫',
  'Relacionamento sério': '💞', 'Conhecer pessoas': '👋', 'Ainda descobrindo': '🧭', Mulher: '👩', Homem: '👨', 'Pessoa não binária': '🌈', Agênero: '✨', 'Gênero fluido': '🌊', 'Outra identidade': '💫',
};
type Props = { preferences: Preferences; onChange: (p: Preferences) => void; user: Profile; busy: boolean; onLocation: (remove?: boolean) => void };
export function PreferencesPanel({ preferences, onChange, user, busy, onLocation }: Props) {
  const c = paletteFor(user.theme);
  function toggle(key: Field, value: string) {
    const old = preferences[key], values = old.values.includes(value) ? old.values.filter(v => v !== value) : [...old.values, value];
    onChange({ ...preferences, [key]: { values, mode: !values.length ? 'Indiferente' : old.mode === 'Indiferente' ? 'Dar prioridade' : old.mode } });
  }
  function modes(key: Field | 'distance') {
    const selected = preferences[key].mode;
    return <View style={s.modes}>{filterModes.map(mode => <Pressable key={mode} accessibilityRole="radio" accessibilityLabel={mode + (key === 'distance' ? ' (distância)' : '')} aria-checked={selected === mode} onPress={() => onChange({ ...preferences, [key]: { ...preferences[key], mode } })} style={[s.mode, { backgroundColor: selected === mode ? c.soft : 'transparent' }]}><Text style={[s.modeText, { color: selected === mode ? c.accent : c.muted, fontWeight: selected === mode ? '700' : '400' }]}>{mode}</Text></Pressable>)}</View>;
  }
  return <View style={s.root}>
    <View style={[s.section, { borderBottomColor: c.border }]}><View style={s.heading}><Text style={[s.title, { color: c.ink }]}>📍  Perto de você</Text><Text style={[s.optional, { color: c.muted }]}>até 30 km</Text></View>
      <DistanceControl value={preferences.distance.maxKm} color={c.accent} onChange={maxKm => onChange({ ...preferences, distance: { mode: preferences.distance.mode === 'Indiferente' ? 'Dar prioridade' : preferences.distance.mode, maxKm } })} />
      {modes('distance')}
      <View style={s.locationRow}><Pressable accessibilityRole="button" disabled={busy} accessibilityLabel="Usar minha localização" onPress={() => onLocation()} style={s.location}><Ionicons name="locate-outline" size={17} color={c.accent} /><Text style={[s.locationText, { color: c.accent }]}>{user.locationReady ? 'Atualizar localização' : 'Usar minha localização'}</Text></Pressable>{user.locationReady && <Pressable accessibilityRole="button" disabled={busy} accessibilityLabel="Remover minha localização" onPress={() => onLocation(true)} style={s.location}><Text style={[s.locationText, { color: c.muted }]}>Remover</Text></Pressable>}</View>
      <Text style={[s.note, { color: c.muted }]}>{user.id === 'demo' ? 'Conta de exemplo: distâncias simuladas em São Paulo.' : 'Você autoriza o uso da localização. A posição exata não aparece no perfil.'}</Text>
      {preferences.distance.mode === 'Obrigatório' && <Text style={[s.note, { color: c.muted }]}>Perfis além do raio ou sem localização ficam fora.</Text>}
    </View>
    {fields.map(field => <View key={field.key} style={[s.section, { borderBottomColor: c.border }]}><Text style={[s.title, { color: c.ink }]}>{field.key === 'religion' ? '✨  Seus valores' : field.key === 'intention' ? '💭  O que você busca?' : '🌈  Quem você quer conhecer?'}</Text>
      {field.key === 'religion' && <Text style={[s.note, { color: c.muted }]}>Religião · escolha uma ou mais opções</Text>}
      <View style={s.choices}>{field.options.map(value => {
        const checked = preferences[field.key].values.includes(value);
        return <Pressable key={value} accessibilityRole="checkbox" accessibilityLabel={value} aria-checked={checked} onPress={() => toggle(field.key, value)} style={({ pressed }) => [s.option, { backgroundColor: checked ? c.soft : c.card, borderColor: checked ? c.accent : c.border, opacity: pressed ? 0.7 : 1 }]}><Text style={s.emoji}>{emoji[value] || '✨'}</Text><Text style={[s.optionText, { color: checked ? c.accent : c.ink, fontWeight: checked ? '600' : '400' }]}>{value}</Text>{checked && <Ionicons name="checkmark" size={14} color={c.accent} />}</Pressable>;
      })}</View>
      {modes(field.key)}
      {field.key === 'gender' && <Text style={[s.note, { color: c.muted }]}>Mulheres e homens incluem pessoas cis e trans. Cada pessoa informa a própria identidade.</Text>}
      {preferences[field.key].mode === 'Obrigatório' && <Text style={[s.note, { color: c.muted }]}>Perfis sem essa informação também ficam fora.</Text>}
    </View>)}
  </View>;
}
const s = StyleSheet.create(fontStyles({
  root: { gap: 24 }, section: { gap: 15, paddingBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 16, fontWeight: '600' }, optional: { fontSize: 11 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, option: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 11, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, minHeight: 44 }, emoji: { fontSize: 16 }, optionText: { fontSize: 12 }, modes: { flexDirection: 'row', padding: 3, backgroundColor: '#FFFFFFA8', borderRadius: 13 }, mode: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, minHeight: 38, paddingHorizontal: 3 }, modeText: { fontSize: 10 }, locationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, location: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, minHeight: 40 }, locationText: { fontSize: 12, fontWeight: '600' }, note: { fontSize: 11, lineHeight: 18 },
}));
