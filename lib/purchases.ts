/**
 * Web stub for react-native-purchases.
 * Metro resolves lib/purchases.native.ts on iOS/Android automatically.
 * This file is the fallback used on web where the native SDK is unavailable.
 */

export interface PurchasePackage {
	identifier: string;
	packageType: string;
	product: {
		priceString: string;
		price: number;
		title: string;
		description: string;
	};
	offeringIdentifier: string;
}

export interface PurchasesOffering {
	identifier: string;
	serverDescription: string;
	availablePackages: PurchasePackage[];
	monthly: PurchasePackage | null;
	annual: PurchasePackage | null;
}

export function initializePurchases(): void {
	// No-op on web
}

export async function loginPurchasesUser(_userId: string): Promise<void> {
	// No-op on web
}

export async function logoutPurchasesUser(): Promise<void> {
	// No-op on web
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
	return null;
}

export async function purchasePackage(
	_pkg: PurchasePackage,
): Promise<{ customerInfo: unknown }> {
	throw new Error('Purchases not available on web');
}

export async function restorePurchases(): Promise<{ customerInfo: unknown }> {
	throw new Error('Purchases not available on web');
}
