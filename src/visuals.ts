import { ImageSourcePropType } from 'react-native';
import { Profile } from './api';
import { portraitTiles } from './profileSheets';

export const portraits: Record<string, ImageSourcePropType> = {
  marina: require('../assets/profiles/marina.png'), rafael: require('../assets/profiles/rafael.png'), clara: require('../assets/profiles/clara.png'),
  joana: require('../assets/profiles/joana.png'), caio: require('../assets/profiles/caio.png'), noa: require('../assets/profiles/noa.png'),
  luiza: require('../assets/profiles/luiza.png'), andre: require('../assets/profiles/andre.png'), bia: require('../assets/profiles/bia.png'),
  davi: require('../assets/profiles/davi.png'), helena: require('../assets/profiles/helena.png'), amara: require('../assets/profiles/amara.png'),
  miguel: require('../assets/profiles/miguel.png'), iris: require('../assets/profiles/iris.png'), sam: require('../assets/profiles/sam.png'),
  val: require('../assets/profiles/val.png'), alexis: require('../assets/profiles/alexis.png'), sol: require('../assets/profiles/sol.png'),
  rebeca: require('../assets/profiles/rebeca.png'), daniel: require('../assets/profiles/daniel.png'), ester: require('../assets/profiles/ester.png'),
  yasmin: require('../assets/profiles/yasmin.png'), omar: require('../assets/profiles/omar.png'), taylor: require('../assets/profiles/taylor.png'),
};
export function profilePhoto(profile: Profile): ImageSourcePropType | undefined {
  return profile.photoUri ? { uri: profile.photoUri } : portraits[profile.photo] || portraitTiles[profile.photo]?.source;
}
export type Tab = 'discover' | 'matches' | 'preferences' | 'profile' | 'safety';
export const tabBackgrounds: Record<Tab, ImageSourcePropType> = {
  discover: require('../assets/backgrounds/discover.png'), matches: require('../assets/backgrounds/matches.png'),
  preferences: require('../assets/backgrounds/preferences.png'), profile: require('../assets/backgrounds/profile.png'), safety: require('../assets/backgrounds/safety.png'),
};
export const palette = { ink: '#17181C', muted: '#53555E', accent: '#C52F49', primary: '#FF6674', canvas: '#FFFFFF', card: '#FFFFFF', soft: '#F2F2F5', border: '#E4E4E9' };
// Legacy accounts keep working while the UI and API migrate to one visual identity.
export const paletteFor = (_theme?: string) => palette;
