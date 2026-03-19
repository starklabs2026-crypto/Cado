import React, { useState, useEffect, useCallback } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Platform,
	ScrollView,
	ActivityIndicator,
	Alert,
	Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
	getOfferings,
	purchasePackage,
	restorePurchases,
	type PurchasePackage,
	type PurchasesOffering,
} from '@/lib/purchases';

// Fallback prices shown while RC offerings load or on error
const FALLBACK_MONTHLY = { price: '$3.99', period: '/month', saving: null };
const FALLBACK_ANNUAL = {
	price: '$29',
	period: '/year',
	saving: 'Save 39%',
	monthlyEquiv: '$2.42/mo',
};

const FEATURES = [
	'Unlimited AI food scans',
	'Detailed macro & micro nutrients',
	'Personalized calorie goals',
	'Full meal history & calendar',
	'Priority customer support',
];

type PlanId = 'monthly' | 'annual';

export default function SubscribeScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [selectedPlan, setSelectedPlan] = useState<PlanId>('annual');
	const [offering, setOffering] = useState<PurchasesOffering | null>(null);
	const [loading, setLoading] = useState(true);
	const [purchasing, setPurchasing] = useState(false);
	const [restoring, setRestoring] = useState(false);

	useEffect(() => {
		if (Platform.OS === 'web') {
			setLoading(false);
			return;
		}
		fetchOfferings();
	}, []);

	const fetchOfferings = async () => {
		try {
			const result = await getOfferings();
			setOffering(result);
		} catch (e) {
			console.warn('[Subscribe] Could not fetch offerings:', e);
		} finally {
			setLoading(false);
		}
	};

	// Pull price strings from RC or fall back to hardcoded values
	const monthlyPkg: PurchasePackage | null =
		offering?.monthly ?? offering?.availablePackages?.find(
			(p) => p.packageType === 'MONTHLY',
		) ?? null;

	const annualPkg: PurchasePackage | null =
		offering?.annual ?? offering?.availablePackages?.find(
			(p) => p.packageType === 'ANNUAL',
		) ?? null;

	const monthlyLabel = monthlyPkg
		? `${monthlyPkg.product.priceString}/month`
		: `${FALLBACK_MONTHLY.price}${FALLBACK_MONTHLY.period}`;

	const annualLabel = annualPkg
		? annualPkg.product.priceString
		: FALLBACK_ANNUAL.price;

	const handlePurchase = useCallback(async () => {
		if (Platform.OS === 'web') {
			Alert.alert(
				'Mobile Only',
				'Subscriptions are available on the iOS and Android apps.',
			);
			return;
		}

		const pkg =
			selectedPlan === 'annual'
				? (annualPkg ?? null)
				: (monthlyPkg ?? null);

		if (!pkg) {
			Alert.alert(
				'Not Available',
				'Could not load subscription plans. Please check your connection and try again.',
			);
			return;
		}

		try {
			setPurchasing(true);
			await purchasePackage(pkg);
			Alert.alert(
				'Welcome to Pro!',
				'Your subscription is active. Enjoy unlimited scans!',
				[{ text: 'Let\'s Go', onPress: () => router.back() }],
			);
		} catch (e: any) {
			if (!e?.userCancelled) {
				Alert.alert('Purchase Failed', e?.message ?? 'Something went wrong.');
			}
		} finally {
			setPurchasing(false);
		}
	}, [selectedPlan, annualPkg, monthlyPkg, router]);

	const handleRestore = useCallback(async () => {
		if (Platform.OS === 'web') return;
		try {
			setRestoring(true);
			await restorePurchases();
			Alert.alert(
				'Restored',
				'Your purchases have been restored successfully.',
				[{ text: 'Great', onPress: () => router.back() }],
			);
		} catch (e: any) {
			Alert.alert('Restore Failed', e?.message ?? 'No purchases found.');
		} finally {
			setRestoring(false);
		}
	}, [router]);

	if (Platform.OS === 'web') {
		return (
			<View style={styles.webContainer}>
				<Text style={styles.webTitle}>CalO Pro</Text>
				<Text style={styles.webSubtitle}>
					Subscriptions are available on the iOS and Android apps.
				</Text>
				<TouchableOpacity
					style={styles.webBackButton}
					onPress={() => router.back()}
				>
					<Text style={styles.webBackText}>Go Back</Text>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<LinearGradient
			colors={['#0A0A12', '#1A1025', '#2A1845']}
			style={styles.gradient}
		>
			{/* Close button */}
			<TouchableOpacity
				style={[styles.closeButton, { top: insets.top + 12 }]}
				onPress={() => router.back()}
				hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
			>
				<Ionicons name='close' size={24} color='rgba(255,255,255,0.7)' />
			</TouchableOpacity>

			<ScrollView
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
				]}
				showsVerticalScrollIndicator={false}
			>
				{/* Header */}
				<View style={styles.header}>
					<LinearGradient
						colors={['#FFD700', '#FFA500']}
						style={styles.crownBadge}
					>
						<Text style={styles.crownEmoji}>👑</Text>
					</LinearGradient>
					<Text style={styles.title}>CalO Pro</Text>
					<Text style={styles.subtitle}>
						Unlock your full health potential
					</Text>
				</View>

				{/* Features */}
				<View style={styles.featuresCard}>
					{FEATURES.map((feature, i) => (
						<View key={i} style={styles.featureRow}>
							<LinearGradient
								colors={['#10B981', '#059669']}
								style={styles.checkCircle}
							>
								<Ionicons name='checkmark' size={12} color='#fff' />
							</LinearGradient>
							<Text style={styles.featureText}>{feature}</Text>
						</View>
					))}
				</View>

				{/* Plan selector */}
				<View style={styles.planRow}>
					{/* Monthly plan */}
					<TouchableOpacity
						style={[
							styles.planCard,
							selectedPlan === 'monthly' && styles.planCardSelected,
						]}
						onPress={() => setSelectedPlan('monthly')}
						activeOpacity={0.8}
					>
						{selectedPlan === 'monthly' && (
							<View style={styles.selectedDot} />
						)}
						<Text style={styles.planName}>Monthly</Text>
						{loading ? (
							<ActivityIndicator color='#fff' size='small' />
						) : (
							<>
								<Text style={styles.planPrice}>
									{monthlyPkg
										? monthlyPkg.product.priceString
										: FALLBACK_MONTHLY.price}
								</Text>
								<Text style={styles.planPeriod}>/month</Text>
							</>
						)}
					</TouchableOpacity>

					{/* Annual plan (pre-selected, Best Value) */}
					<TouchableOpacity
						style={[
							styles.planCard,
							styles.planCardAnnual,
							selectedPlan === 'annual' && styles.planCardSelected,
						]}
						onPress={() => setSelectedPlan('annual')}
						activeOpacity={0.8}
					>
						<LinearGradient
							colors={['#FFD700', '#FFA500']}
							style={styles.bestValueBadge}
						>
							<Text style={styles.bestValueText}>BEST VALUE</Text>
						</LinearGradient>
						{selectedPlan === 'annual' && (
							<View style={styles.selectedDot} />
						)}
						<Text style={styles.planName}>Annual</Text>
						{loading ? (
							<ActivityIndicator color='#fff' size='small' />
						) : (
							<>
								<Text style={styles.planPrice}>{annualLabel}</Text>
								<Text style={styles.planPeriod}>/year</Text>
								<Text style={styles.planSaving}>
									{annualPkg ? '' : FALLBACK_ANNUAL.monthlyEquiv} · Save 39%
								</Text>
							</>
						)}
					</TouchableOpacity>
				</View>

				{/* CTA */}
				<TouchableOpacity
					onPress={handlePurchase}
					disabled={purchasing || loading}
					activeOpacity={0.85}
					style={styles.ctaWrapper}
				>
					<LinearGradient
						colors={
							purchasing || loading
								? ['#444', '#444']
								: ['#10B981', '#059669']
						}
						style={styles.ctaButton}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
					>
						{purchasing ? (
							<ActivityIndicator color='#fff' size='small' />
						) : (
							<>
								<Ionicons
									name='star'
									size={18}
									color='#fff'
									style={{ marginRight: 8 }}
								/>
								<Text style={styles.ctaText}>
									Start 5-Day Free Trial
								</Text>
							</>
						)}
					</LinearGradient>
				</TouchableOpacity>

				<Text style={styles.ctaSubtext}>
					{selectedPlan === 'annual'
						? `Then ${annualLabel}/yr · Cancel anytime`
						: `Then ${monthlyLabel} · Cancel anytime`}
				</Text>

				{/* Divider */}
				<View style={styles.divider} />

				{/* Footer links */}
				<View style={styles.footer}>
					<TouchableOpacity
						onPress={handleRestore}
						disabled={restoring}
					>
						<Text style={styles.footerLink}>
							{restoring ? 'Restoring…' : 'Restore Purchases'}
						</Text>
					</TouchableOpacity>

					<Text style={styles.footerDot}>·</Text>

					<TouchableOpacity
						onPress={() =>
							Linking.openURL('https://calo.app/terms')
						}
					>
						<Text style={styles.footerLink}>Terms</Text>
					</TouchableOpacity>

					<Text style={styles.footerDot}>·</Text>

					<TouchableOpacity
						onPress={() =>
							Linking.openURL('https://calo.app/privacy')
						}
					>
						<Text style={styles.footerLink}>Privacy</Text>
					</TouchableOpacity>
				</View>

				<Text style={styles.legalText}>
					Payment will be charged to your App Store / Play Store account.
					Subscription automatically renews unless cancelled at least 24 hours
					before the end of the current period. The 5-day free trial is
					available for new subscribers only.
				</Text>
			</ScrollView>
		</LinearGradient>
	);
}

const styles = StyleSheet.create({
	gradient: {
		flex: 1,
	},
	closeButton: {
		position: 'absolute',
		right: 20,
		zIndex: 10,
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: 'rgba(255,255,255,0.12)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollContent: {
		paddingHorizontal: 20,
	},
	header: {
		alignItems: 'center',
		marginBottom: 28,
	},
	crownBadge: {
		width: 72,
		height: 72,
		borderRadius: 36,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 16,
		shadowColor: '#FFD700',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.5,
		shadowRadius: 12,
		elevation: 8,
	},
	crownEmoji: {
		fontSize: 36,
	},
	title: {
		fontSize: 32,
		fontWeight: '800',
		color: '#FFFFFF',
		letterSpacing: -0.5,
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 16,
		color: 'rgba(255,255,255,0.65)',
		textAlign: 'center',
	},
	featuresCard: {
		backgroundColor: 'rgba(255,255,255,0.07)',
		borderRadius: 16,
		padding: 20,
		marginBottom: 24,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.1)',
	},
	featureRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 14,
	},
	checkCircle: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 12,
		flexShrink: 0,
	},
	featureText: {
		fontSize: 15,
		color: 'rgba(255,255,255,0.9)',
		fontWeight: '500',
		flex: 1,
	},
	planRow: {
		flexDirection: 'row',
		gap: 12,
		marginBottom: 24,
	},
	planCard: {
		flex: 1,
		backgroundColor: 'rgba(255,255,255,0.07)',
		borderRadius: 16,
		padding: 16,
		alignItems: 'center',
		borderWidth: 2,
		borderColor: 'rgba(255,255,255,0.12)',
		minHeight: 130,
		justifyContent: 'center',
	},
	planCardAnnual: {
		paddingTop: 28, // extra space for the "Best Value" badge
	},
	planCardSelected: {
		borderColor: '#10B981',
		backgroundColor: 'rgba(16, 185, 129, 0.12)',
	},
	selectedDot: {
		position: 'absolute',
		top: 10,
		left: 10,
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: '#10B981',
	},
	bestValueBadge: {
		position: 'absolute',
		top: -1,
		left: -1,
		right: -1,
		borderTopLeftRadius: 14,
		borderTopRightRadius: 14,
		paddingVertical: 4,
		alignItems: 'center',
	},
	bestValueText: {
		fontSize: 10,
		fontWeight: '800',
		color: '#000',
		letterSpacing: 1,
	},
	planName: {
		fontSize: 13,
		color: 'rgba(255,255,255,0.6)',
		fontWeight: '600',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginBottom: 6,
	},
	planPrice: {
		fontSize: 26,
		fontWeight: '800',
		color: '#FFFFFF',
		letterSpacing: -0.5,
	},
	planPeriod: {
		fontSize: 13,
		color: 'rgba(255,255,255,0.5)',
		marginTop: 2,
	},
	planSaving: {
		fontSize: 11,
		color: '#FFD700',
		fontWeight: '700',
		marginTop: 6,
		textAlign: 'center',
	},
	ctaWrapper: {
		borderRadius: 16,
		overflow: 'hidden',
		shadowColor: '#10B981',
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 8,
	},
	ctaButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 18,
		borderRadius: 16,
	},
	ctaText: {
		fontSize: 17,
		fontWeight: '800',
		color: '#fff',
		letterSpacing: 0.2,
	},
	ctaSubtext: {
		textAlign: 'center',
		fontSize: 13,
		color: 'rgba(255,255,255,0.45)',
		marginTop: 10,
		marginBottom: 24,
	},
	divider: {
		height: 1,
		backgroundColor: 'rgba(255,255,255,0.1)',
		marginBottom: 20,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		marginBottom: 16,
	},
	footerLink: {
		fontSize: 13,
		color: 'rgba(255,255,255,0.5)',
		textDecorationLine: 'underline',
	},
	footerDot: {
		fontSize: 13,
		color: 'rgba(255,255,255,0.3)',
	},
	legalText: {
		fontSize: 11,
		color: 'rgba(255,255,255,0.3)',
		textAlign: 'center',
		lineHeight: 16,
	},
	// Web fallback styles
	webContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 32,
		backgroundColor: '#1A1625',
	},
	webTitle: {
		fontSize: 28,
		fontWeight: '800',
		color: '#FFD700',
		marginBottom: 12,
	},
	webSubtitle: {
		fontSize: 16,
		color: 'rgba(255,255,255,0.7)',
		textAlign: 'center',
		marginBottom: 32,
	},
	webBackButton: {
		backgroundColor: '#10B981',
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 12,
	},
	webBackText: {
		color: '#fff',
		fontWeight: '700',
		fontSize: 15,
	},
});
