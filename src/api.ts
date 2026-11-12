import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { FilterMode } from './preferences';
import options from '../shared/filter-options.json';
import Constants from 'expo-constants';

export type Profile = { id: string; name: string; age: number; city: string; bio: string; interests: string; religion: string; intention: string; gender: string; trans: string; theme: string; photo: string; photoUri?: string; fictional: boolean; locationReady: boolean; distanceKm: number | null; compatibility?: number };
export type Field = 'religion' | 'intention' | 'gender';
export type Preferences = Record<Field, { mode: FilterMode; values: string[] }> & { distance: { mode: FilterMode; maxKm: number } };
export type Message = { id: string; sender: string; text: string; created: number };
export const fields: { key: Field; label: string; options: string[] }[] = [
  { key: 'religion', label: 'Religião', options: options.religion },
  { key: 'intention', label: 'Intenção de relacionamento', options: options.intention },
  { key: 'gender', label: 'Quem você quer conhecer', options: options.gender },
];
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
export let baseUrl = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? `http://${globalThis.location?.hostname || 'localhost'}:3001` : `http://${expoHost || 'localhost'}:3001`);
let token = '';
const storage = {
  get: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.getItem('elo.session')) : SecureStore.getItemAsync('elo.session'),
  set: (v: string) => Platform.OS === 'web' ? Promise.resolve(sessionStorage.setItem('elo.session', v)) : SecureStore.setItemAsync('elo.session', v),
  clear: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.removeItem('elo.session')) : SecureStore.deleteItemAsync('elo.session'),
};
export const restoreSession = async () => { const savedUrl = Platform.OS === 'web' ? sessionStorage.getItem('elo.api') : await SecureStore.getItemAsync('elo.api'); if (savedUrl) baseUrl = savedUrl; token = await storage.get() || ''; return !!token; };
export async function configureServer(value: string) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Informe apenas o endereço do servidor, como http://192.168.1.10:3001');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url.origin}/health`, { signal: controller.signal });
    if (!response.ok || (await response.json()).ok !== true) throw new Error('Servidor Elo não encontrado neste endereço.');
  } catch { throw new Error('Não foi possível conectar ao servidor Elo. Confira o endereço, o Wi-Fi e se o servidor está ligado.'); }
  finally { clearTimeout(timeout); }
  await clearSession();
  if (Platform.OS === 'web') sessionStorage.setItem('elo.api', url.origin); else await SecureStore.setItemAsync('elo.api', url.origin);
  baseUrl = url.origin;
}
export const setSession = async (value: string) => { await storage.set(value); token = value; };
export const clearSession = async () => { token = ''; await storage.clear(); };
export async function api<T>(path: string, method = 'GET', data?: unknown, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), signal: controller.signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a ação.');
    return result as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('Não foi possível acessar o servidor. Verifique a conexão e se a API está ligada.');
    throw error;
  } finally { clearTimeout(timeout); }
}
