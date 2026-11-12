import { ProfileImage } from './ProfileImage';
import { fontStyles } from './fonts';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Profile } from './api';
import { paletteFor, profilePhoto, Tab } from './visuals';

const items: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; active: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'discover', label: 'Descobrir', icon: 'compass-outline', active: 'compass' },
  { key: 'matches', label: 'Matches', icon: 'heart-outline', active: 'heart' },
  { key: 'preferences', label: 'Filtros', icon: 'options-outline', active: 'options' },
  { key: 'profile', label: 'Meu perfil', icon: 'person-outline', active: 'person' },
  { key: 'safety', label: 'Segurança', icon: 'shield-checkmark-outline', active: 'shield-checkmark' },
];
export function BottomNav({ selected, onChange, user, count }: { selected: Tab; onChange: (tab: Tab) => void; user: Profile; count: number }) {
  const c = paletteFor(user.theme); const source = profilePhoto(user);
  return <View style={s.outer}><View accessibilityRole="tablist" accessibilityLabel="Navegação principal" style={[s.bar, { borderColor: c.border, shadowColor: c.ink }]}>{items.map(item => {
    const active = selected === item.key;
    return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} aria-selected={active} onPress={() => onChange(item.key)} style={({ pressed }) => [s.item, pressed && { opacity: 0.7 }]}>
      <View style={[s.iconPill, active && { backgroundColor: c.soft }]}>
        {item.key === 'profile' && source ? <View style={[s.avatarRing, { borderColor: active ? c.accent : '#ffffff' }]}><ProfileImage profile={user} style={s.avatar} accessibilityLabel="Sua foto de perfil na navegação" /></View> : <Ionicons name={active ? item.active : item.icon} size={24} color={active ? c.accent : c.muted} />}
        {item.key === 'matches' && count > 0 && <View accessibilityLabel={`${count} matches`} style={[s.badge, { backgroundColor: c.accent }]}><Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text></View>}
      </View>
      <Text numberOfLines={1} style={[s.label, { color: active ? c.accent : c.muted, fontWeight: active ? '700' : '500' }]}>{item.label}</Text>
      <View style={[s.dot, { backgroundColor: active ? c.accent : 'transparent' }]} />
    </Pressable>;
  })}</View></View>;
}
const s = StyleSheet.create(fontStyles({
  outer: { paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 6, paddingTop: 0, backgroundColor: '#FFFFFFF5' },
  bar: { flexDirection: 'row', backgroundColor: '#FFFFFFF5', borderRadius: 0, borderTopWidth: 1, paddingHorizontal: 6, paddingTop: 7, paddingBottom: 5, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0, shadowRadius: 20, elevation: 0 },
  item: { flex: 1, alignItems: 'center', gap: 4, minHeight: 59, paddingVertical: 2 },
  iconPill: { width: 50, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  label: { fontSize: 10 }, dot: { width: 4, height: 4, borderRadius: 2 },
  avatarRing: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, padding: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 26, height: 26, borderRadius: 13, resizeMode: 'cover' },
  badge: { position: 'absolute', top: 0, right: 2, borderRadius: 8, minWidth: 16, height: 16, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
}));
