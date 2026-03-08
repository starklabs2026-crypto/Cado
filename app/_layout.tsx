
import { useColorScheme, View, ActivityIndicator, Linking, Platform, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useFonts } from "expo-font";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useNetworkState } from "expo-network";
import * as SplashScreen from "expo-splash-screen";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useCallback, useState } from "react";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider as CustomThemeProvider } from "@/contexts/ThemeContext";
import { Stack, useRouter, useSegments } from "expo-router";
import { ErrorBoundary } from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const handleAuthRedirect = useCallback(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth" || segments[0] === "auth-popup" || segments[0] === "auth-callback";

    if (!user && !inAuthGroup) {
      console.log("[AuthGate] No user, redirecting to /auth");
      router.replace("/auth");
    } else if (user && inAuthGroup) {
      console.log("[AuthGate] User authenticated, redirecting to /");
      router.replace("/");
    }
  }, [user, loading, segments, router]);

  useEffect(() => {
    handleAuthRedirect();
  }, [handleAuthRedirect]);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log('[DeepLink] Received deep link:', event.url);
      
      const url = event.url;
      const groupInviteMatch = url.match(/group-invite\/([^/?]+)/);
      
      if (groupInviteMatch && groupInviteMatch[1]) {
        const token = groupInviteMatch[1];
        console.log('[DeepLink] Extracted invite token:', token);
        
        if (user) {
          router.push(`/join-group/${token}`);
        } else {
          console.log('[DeepLink] User not authenticated, will redirect after login');
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[DeepLink] Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [user, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ color: "#fff", marginTop: 16, fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

function NetworkStatusMonitor() {
  const { isConnected, isInternetReachable } = useNetworkState();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (isConnected === false || isInternetReachable === false) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [isConnected, isInternetReachable]);

  if (!showWarning) return null;

  return (
    <View style={styles.networkWarning}>
      <Text style={styles.networkWarningText}>
        ⚠️ No internet connection. Some features may not work.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SystemBars style="auto" />
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <CustomThemeProvider>
            <AuthProvider>
              <WidgetProvider>
                <NetworkStatusMonitor />
                <AuthGate>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="auth" options={{ headerShown: false }} />
                  <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
                  <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                  <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                  <Stack.Screen name="camera" options={{ headerShown: true, title: 'Scan Food' }} />
                  <Stack.Screen name="create-group" options={{ headerShown: true, title: 'Create Private Group' }} />
                  <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
                  <Stack.Screen name="join-group/[token]" options={{ headerShown: true, title: 'Join Group' }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                </AuthGate>
                <StatusBar style="auto" />
              </WidgetProvider>
            </AuthProvider>
          </CustomThemeProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  networkWarning: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF9500',
    padding: 12,
    zIndex: 9999,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  networkWarningText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
