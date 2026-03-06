
import React from 'react';
import { Platform } from 'react-native';
import FloatingTabBar from '@/components/FloatingTabBar';
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  if (Platform.OS === 'ios') {
    return null;
  }

  const tabs = [
    {
      route: '/(tabs)/(home)',
      label: 'Home',
      ios_icon_name: 'house.fill',
      android_material_icon_name: 'home' as const,
    },
    {
      route: '/(tabs)/history',
      label: 'History',
      ios_icon_name: 'calendar',
      android_material_icon_name: 'calendar-today' as const,
    },
    {
      route: '/(tabs)/groups',
      label: 'Groups',
      ios_icon_name: 'person.3.fill',
      android_material_icon_name: 'group' as const,
    },
    {
      route: '/(tabs)/profile',
      label: 'Profile',
      ios_icon_name: 'person.fill',
      android_material_icon_name: 'person' as const,
    },
  ];

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(home)" />
        <Stack.Screen name="history" />
        <Stack.Screen name="groups" />
        <Stack.Screen name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
