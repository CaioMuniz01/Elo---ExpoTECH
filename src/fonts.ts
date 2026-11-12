import { useFonts } from 'expo-font';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { TextStyle, ViewStyle, ImageStyle } from 'react-native';

export function useAppFonts() {
  return useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
}
export const fonts = { body: 'Manrope_400Regular', medium: 'Manrope_500Medium', semibold: 'Manrope_600SemiBold', bold: 'Manrope_700Bold', title: 'Outfit_600SemiBold', display: 'Outfit_700Bold' };
export function fontStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(styles: T): T {
  for (const [key, raw] of Object.entries(styles)) {
    const style = raw as TextStyle;
    if (style.fontSize === undefined) continue;
    const display = /title|hero|logo|profileName|name$/i.test(key);
    const weight = String(style.fontWeight || '400');
    style.fontFamily = display ? (Number(weight) >= 700 ? fonts.display : fonts.title) : Number(weight) >= 700 ? fonts.bold : Number(weight) >= 600 ? fonts.semibold : Number(weight) >= 500 ? fonts.medium : fonts.body;
    style.fontWeight = 'normal';
  }
  return styles;
}
