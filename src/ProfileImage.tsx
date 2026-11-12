import React, { useState } from 'react';
import { Image, ImageProps, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Profile } from './api';
import { profilePhoto } from './visuals';
import { portraitTiles } from './profileSheets';

type Props = Omit<ImageProps, 'source'> & { profile: Profile };
export function ProfileImage({ profile, style, resizeMode = 'cover', accessibilityLabel, accessible, blurRadius, ...props }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tile = !profile.photoUri ? portraitTiles[profile.photo] : undefined;
  const source = profilePhoto(profile);
  if (!tile) return <Image source={source} style={style} resizeMode={resizeMode} accessibilityLabel={accessibilityLabel} accessible={accessible} blurRadius={blurRadius} {...props} />;
  const scale = resizeMode === 'contain' ? Math.min(size.width / 512, size.height / 768) : Math.max(size.width / 512, size.height / 768);
  const width = 512 * scale, height = 768 * scale;
  return <View style={[style as StyleProp<ViewStyle>, { overflow: 'hidden' }]} onLayout={event => { const { width, height } = event.nativeEvent.layout; setSize(old => old.width === width && old.height === height ? old : { width, height }); }} accessible={accessible ?? !!accessibilityLabel} accessibilityLabel={accessibilityLabel} accessibilityRole="image">
    {!!size.width && !!size.height && <View style={{ position: 'absolute', left: (size.width - width) / 2, top: (size.height - height) / 2, width, height, overflow: 'hidden' }}><Image source={tile.source} accessible={false} blurRadius={blurRadius} resizeMode="stretch" style={{ position: 'absolute', width: width * 2, height: height * 2, left: -(tile.slot % 2) * width, top: -Math.floor(tile.slot / 2) * height }} {...props} /></View>}
  </View>;
}
