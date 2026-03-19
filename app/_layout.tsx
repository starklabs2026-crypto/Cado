import {
	useColorScheme,
	View,
	ActivityIndicator,
	Linking,
	Platform,
	Text,
	StyleSheet,
	TouchableOpacity,
} from 'react-native';
import { useFonts } from 'expo-font';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNetworkState } from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from '@react-navigation/native';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useCallback, useState } from 'react';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { apiGet } from '@/utils/api';
import {
	initializePurchases,
	loginPurchasesUser,
	logoutPurchasesUser,
} from '@/lib/purchases';

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
	const { user, loading, signOut } = useAuth();
	const router = useRouter();
	const segments = useSegments();

	const handleAuthRedirect = useCallback(() => {
		if (loading) return;

		const inAuthGroup =
			segments[0] === 'auth' ||
			segments[0] === 'auth-popup' ||
			segments[0] === 'auth-callback';

		if (!user && !inAuthGroup) {
			console.log('[AuthGate] No user, redirecting to /auth');
			router.replace('/auth');
		} else if (user && !user.isGuest && inAuthGroup) {
			console.log('[AuthGate] User authenticated, redirecting to /');
			router.replace('/');
		}
	}, [user, loading, segments, router]);

	useEffect(() => {
		handleAuthRedirect();
	}, [handleAuthRedirect]);

	// Link/unlink RevenueCat subscriber identity when auth state changes
	useEffect(() => {
		if (Platform.OS === 'web') return;
		if (loading) return;
		if (user && !user.isGuest) {
			loginPurchasesUser(user.id);
		} else if (!user) {
			logoutPurchasesUser();
		}
	}, [user?.id, loading]);

	// Enforce 7-day guest session limit
	useEffect(() => {
		if (!user?.isGuest || loading) return;

		const checkGuestExpiry = async () => {
			try {
				const status = await apiGet<{
					is_guest: boolean;
					expired: boolean;
					days_remaining: number;
				}>('/api/auth/guest-status');

				if (status.expired) {
					console.log('[AuthGate] Guest session expired — signing out');
					await signOut();
					// After signOut, user becomes null → handleAuthRedirect sends to /auth
				} else {
					console.log(
						`[AuthGate] Guest session valid — ${status.days_remaining} day(s) remaining`,
					);
				}
			} catch (e) {
				// Network errors should not lock the guest out
				console.warn('[AuthGate] Could not check guest expiry:', e);
			}
		};

		checkGuestExpiry();
	}, [user?.id, user?.isGuest, loading]);

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
					console.log(
						'[DeepLink] User not authenticated, will redirect after login',
					);
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
			<View
				style={{
					flex: 1,
					justifyContent: 'center',
					alignItems: 'center',
					backgroundColor: '#000',
				}}
			>
				<ActivityIndicator size='large' color='#10B981' />
				<Text style={{ color: '#fff', marginTop: 16, fontSize: 16 }}>
					Loading...
				</Text>
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
		SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
	});

	// Initialize RevenueCat once on app start (native only)
	useEffect(() => {
		if (Platform.OS !== 'web') {
			initializePurchases();
		}
	}, []);

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
				<SystemBars style='auto' />
				<ThemeProvider
					value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
				>
					<CustomThemeProvider>
						<AuthProvider>
							<WidgetProvider>
								<NetworkStatusMonitor />
								<AuthGate>
									<Stack>
										<Stack.Screen
											name='(tabs)'
											options={{ headerShown: false }}
										/>
										<Stack.Screen
											name='auth'
											options={{ headerShown: false }}
										/>
										<Stack.Screen
											name='auth-popup'
											options={{ headerShown: false }}
										/>
										<Stack.Screen
											name='auth-callback'
											options={{ headerShown: false }}
										/>
										<Stack.Screen
											name='onboarding'
											options={{
												headerShown: false,
												gestureEnabled: false,
											}}
										/>
										<Stack.Screen
											name='camera'
											options={{
												headerShown: true,
												title: 'Scan Food',
											}}
										/>
										<Stack.Screen
											name='create-group'
											options={{
												headerShown: true,
												title: 'Create Private Group',
											}}
										/>
										<Stack.Screen
											name='notifications'
											options={{
												headerShown: true,
												title: 'Notifications',
											}}
										/>
										<Stack.Screen
											name='join-group/[token]'
											options={{
												headerShown: true,
												title: 'Join Group',
											}}
										/>
										<Stack.Screen
											name='subscribe'
											options={{
												headerShown: false,
												presentation: 'modal',
												gestureEnabled: true,
											}}
										/>
										<Stack.Screen name='+not-found' />
									</Stack>
								</AuthGate>
								<StatusBar style='auto' />
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
