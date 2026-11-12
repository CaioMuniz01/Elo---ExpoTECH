import { fontStyles } from './fonts';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

export function DistanceControl({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  return <View style={s.wrap}><View style={s.row}><Text style={[s.label, { color }]}>Distância máxima</Text><Text accessibilityLiveRegion="polite" style={[s.value, { color }]}>{value} km</Text></View>
    {Platform.OS === 'web' ? React.createElement('input', { type: 'range', min: 1, max: 30, step: 1, value, 'aria-label': 'Distância máxima em quilômetros', onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value)), style: { width: '100%', height: 32, accentColor: color, cursor: 'pointer' } }) : <Slider accessibilityLabel="Distância máxima em quilômetros" accessibilityValue={{ min: 1, max: 30, now: value, text: `${value} quilômetros` }} minimumValue={1} maximumValue={30} step={1} value={value} onValueChange={onChange} minimumTrackTintColor={color} maximumTrackTintColor="#CBDAD5" thumbTintColor={color} style={s.slider} />}
    <View style={s.row}><Text style={s.tick}>1 km</Text><Text style={s.tick}>30 km</Text></View>
  </View>;
}
const s = StyleSheet.create(fontStyles({ wrap: { width: '100%', maxWidth: 300, alignSelf: 'center', gap: 3 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { fontSize: 12, fontWeight: '600' }, value: { fontSize: 18, fontWeight: '700' }, tick: { fontSize: 11, color: '#627876' }, slider: { width: '100%', height: 36 } }));
