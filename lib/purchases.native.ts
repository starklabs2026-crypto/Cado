/**
 * Native implementation of RevenueCat purchases.
 * Metro resolves this file on iOS and Android, lib/purchases.ts is used on web.
 */
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type { PurchasePackage, PurchasesOffering } from './purchases';

const IOS_KEY =
	(Constants.expoConfig?.extra?.revenuecatIosKey as string) ?? '';
const ANDROID_KEY =
	(Constants.expoConfig?.extra?.revenuecatAndroidKey as string) ?? '';

export function initializePurchases(): void {
	const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
	if (!apiKey) {
		console.warn(
			'[Purchases] RevenueCat API key not set. Add revenuecatIosKey / revenuecatAndroidKey to app.json extra.',
		);
		return;
	}
	Purchases.setLogLevel(LOG_LEVEL.DEBUG);
	Purchases.configure({ apiKey });
	console.log('[Purchases] RevenueCat initialized');
}

export async function loginPurchasesUser(userId: string): Promise<void> {
	try {
		await Purchases.logIn(userId);
		console.log('[Purchases] Logged in user:', userId);
	} catch (e) {
		console.warn('[Purchases] logIn failed:', e);
	}
}

export async function logoutPurchasesUser(): Promise<void> {
	try {
		await Purchases.logOut();
		console.log('[Purchases] Logged out');
	} catch (e) {
		console.warn('[Purchases] logOut failed:', e);
	}
}

export async function getOfferings() {
	try {
		const offerings = await Purchases.getOfferings();
		return offerings.current ?? null;
	} catch (e) {
		console.warn('[Purchases] getOfferings failed:', e);
		return null;
	}
}

export async function purchasePackage(pkg: any) {
	return await Purchases.purchasePackage(pkg);
}

export async function restorePurchases() {
	return await Purchases.restorePurchases();
}
