
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/utils/errorLogger';
import { ErrorUtils } from 'expo';
import { shouldMuteMessage } from '@/utils/errorLogger';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Global error handler for uncaught errors
ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
  const errorMessage = error.message || String(error);
  
  // Suppress Metro bundler connection errors
  if (shouldMuteMessage(errorMessage)) {
    console.log('[GlobalErrorHandler] Suppressed non-critical error:', errorMessage);
    return;
  }
  
  if (isFatal) {
    console.error('[GlobalErrorHandler] Fatal error:', error);
  } else {
    console.error('[GlobalErrorHandler] Non-fatal error:', error);
  }
});

function RootLayoutNav() {
  const { isDark } = useTheme();

  return (
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="camera" options={{ headerShown: false }} />
        <Stack.Screen name="create-group" options={{ presentation: 'modal', title: 'Create Group' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal', title: 'Notifications' }} />
        <Stack.Screen name="group-chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="join-group/[token]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
