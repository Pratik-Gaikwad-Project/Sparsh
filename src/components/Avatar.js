import React from 'react';
import { View, Text, Image } from 'react-native';

export default function Avatar({ name = 'L', hue = 345, size = 48, imageUrl }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: `hsl(${hue}, 55%, 42%)`, alignItems: 'center', justifyContent: 'center' }}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} resizeMode="cover" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{String(name || 'L').charAt(0).toUpperCase()}</Text>}
    </View>
  );
}
