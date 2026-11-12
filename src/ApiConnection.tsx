import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { baseUrl, configureServer } from './api';
import { fontStyles } from './fonts';
export function ApiConnection() {
  const [open, setOpen] = useState(false), [value, setValue] = useState(baseUrl), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  async function save() { setBusy(true); setNotice(''); try { await configureServer(value); setNotice('Servidor conectado. Você já pode entrar.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível conectar.'); } finally { setBusy(false); } }
  return <View style={s.box}><Pressable accessibilityRole="button" onPress={() => { setValue(baseUrl); setOpen(v => !v); }}><Text style={s.link}>Configurar conexão</Text></Pressable>{open && <><Text style={s.text}>Use o endereço informado ao iniciar o servidor Elo. No celular, conecte à mesma rede Wi-Fi do computador.</Text><TextInput accessibilityLabel="Endereço do servidor Elo" value={value} onChangeText={setValue} autoCapitalize="none" keyboardType="url" style={s.input} /><Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={s.button}><Text style={s.link}>{busy ? 'Conectando…' : 'Salvar conexão'}</Text></Pressable>{!!notice && <Text accessibilityLiveRegion="polite" style={s.text}>{notice}</Text>}</>}</View>;
}
const s = StyleSheet.create(fontStyles({ box: { gap: 10, marginTop: 12 }, link: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '600' }, text: { color: '#fff', fontSize: 12, lineHeight: 18 }, input: { color: '#17181C', backgroundColor: '#fff', padding: 12, borderRadius: 12, fontSize: 13 }, button: { borderWidth: 1, borderColor: '#ffffff80', padding: 12, borderRadius: 12 } }));
