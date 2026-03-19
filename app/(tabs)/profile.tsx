import React, { useState, useEffect, useCallback } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	Modal,
	ActivityIndicator,
	Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import * as Haptics from 'expo-haptics';

interface UserProfile {
	userId: string;
	age?: number;
	gender?: string;
	height_cm?: number;
	weight_kg?: number;
	goal?: string;
	activity_level?: string;
	daily_calorie_target?: number;
	onboarding_completed: boolean;
	is_pro: boolean;
	pro_expires_at?: string;
}

interface UsageInfo {
	date: string;
	scans_count: number;
	scans_remaining: number;
	is_pro: boolean;
	can_scan: boolean;
}

export default function ProfileScreen() {
	const router = useRouter();
	const { user, signOut } = useAuth();
	const { colors, isDarkMode, toggleTheme } = useTheme();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [usage, setUsage] = useState<UsageInfo | null>(null);
	const [loadingProfile, setLoadingProfile] = useState(true);
	const [reseedingDatabase, setReseedingDatabase] = useState(false);
	const [reseedModal, setReseedModal] = useState<{
		visible: boolean;
		success: boolean;
		message: string;
		itemCount?: number;
	}>({
		visible: false,
		success: false,
		message: '',
	});
	const [errorModal, setErrorModal] = useState<{
		visible: boolean;
		message: string;
	}>({
		visible: false,
		message: '',
	});

	const loadProfile = useCallback(async () => {
		console.log('[API] Loading user profile and usage');
		setLoadingProfile(true);
		try {
			const [profileData, usageData] = await Promise.all([
				authenticatedGet<UserProfile>('/api/user/profile'),
				authenticatedGet<UsageInfo>('/api/usage/today'),
			]);
			console.log('[API] Profile loaded:', profileData);
			console.log('[API] Usage loaded:', usageData);
			setProfile(profileData);
			setUsage(usageData);
		} catch (error) {
			console.error('[API] Error loading profile:', error);
		} finally {
			setLoadingProfile(false);
		}
	}, []);

	useEffect(() => {
		loadProfile();
	}, [loadProfile]);

	const handleSignOut = async () => {
		console.log('User tapped Sign Out button');
		try {
			await signOut();
			console.log('Sign out successful, redirecting to auth');
			router.replace('/auth');
		} catch (error) {
			console.error('Error signing out:', error);
			setErrorModal({
				visible: true,
				message: 'Failed to sign out. Please try again.',
			});
		}
	};

	const handleEditProfile = () => {
		console.log('User tapped Edit Profile button');
		router.push('/onboarding');
	};

	const handleToggleTheme = () => {
		console.log('User tapped Theme Toggle button');
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		toggleTheme();
	};

	const handleReseedDatabase = async () => {
		console.log(
			'[API] Reseeding food database with correct nutritional values',
		);
		setReseedingDatabase(true);
		try {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
			const result = await authenticatedPost<{
				success: boolean;
				itemCount: number;
				message: string;
			}>('/api/food/reseed-database', {});
			console.log('[API] Reseed database result:', result);
			setReseedModal({
				visible: true,
				success: true,
				message:
					result.message ||
					`Food database reseeded successfully with ${result.itemCount} items.`,
				itemCount: result.itemCount,
			});
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		} catch (error: any) {
			console.error('[API] Error reseeding database:', error);
			setReseedModal({
				visible: true,
				success: false,
				message:
					error.message ||
					'Failed to reseed the food database. Please try again.',
			});
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
		} finally {
			setReseedingDatabase(false);
		}
	};

	const getGoalLabel = (goal?: string) => {
		switch (goal) {
			case 'lose_weight':
				return 'Lose Weight';
			case 'maintain':
				return 'Maintain Weight';
			case 'gain_weight':
				return 'Gain Weight';
			case 'build_muscle':
				return 'Build Muscle';
			default:
				return 'Not set';
		}
	};

	const getActivityLabel = (level?: string) => {
		switch (level) {
			case 'sedentary':
				return 'Sedentary';
			case 'lightly_active':
				return 'Lightly Active';
			case 'moderately_active':
				return 'Moderately Active';
			case 'very_active':
				return 'Very Active';
			case 'extremely_active':
				return 'Extremely Active';
			default:
				return 'Not set';
		}
	};

	const userName = user?.name || 'User';
	const userEmail = user?.email || 'No email';
	const dynamicStyles = createStyles(colors);

	return (
		<SafeAreaView style={dynamicStyles.container} edges={['top']}>
			<Stack.Screen
				options={{
					headerShown: false,
				}}
			/>

			<View style={dynamicStyles.header}>
				<Text style={dynamicStyles.headerTitle}>Profile</Text>
			</View>

			<ScrollView
				style={dynamicStyles.scrollView}
				showsVerticalScrollIndicator={false}
			>
				{/* User Info Card */}
				<View style={dynamicStyles.userCard}>
					<View style={dynamicStyles.avatarContainer}>
						<IconSymbol
							ios_icon_name='person.circle.fill'
							android_material_icon_name='account-circle'
							size={80}
							color={colors.primary}
						/>
					</View>
					<Text style={dynamicStyles.userName}>{userName}</Text>
					<Text style={dynamicStyles.userEmail}>{userEmail}</Text>
					{user?.isGuest && (
						<View style={dynamicStyles.guestBadge}>
							<IconSymbol
								ios_icon_name='person.crop.circle.badge.clock'
								android_material_icon_name='schedule'
								size={14}
								color='#FFFFFF'
							/>
							<Text style={dynamicStyles.guestBadgeText}>
								GUEST
							</Text>
						</View>
					)}
					{profile?.is_pro && (
						<View style={dynamicStyles.proBadge}>
							<IconSymbol
								ios_icon_name='star.fill'
								android_material_icon_name='star'
								size={14}
								color='#FFFFFF'
							/>
							<Text style={dynamicStyles.proBadgeText}>PRO</Text>
						</View>
					)}
				</View>

				{/* Dark Mode Toggle */}
				<TouchableOpacity
					style={[
						dynamicStyles.themeToggleCard,
						{
							backgroundColor: colors.card,
							borderColor: colors.border,
						},
					]}
					onPress={handleToggleTheme}
				>
					<View style={dynamicStyles.themeToggleLeft}>
						<View
							style={[
								dynamicStyles.themeIconContainer,
								{
									backgroundColor: isDarkMode
										? '#FFD700'
										: colors.primary,
								},
							]}
						>
							<IconSymbol
								ios_icon_name={
									isDarkMode ? 'moon.fill' : 'sun.max.fill'
								}
								android_material_icon_name={
									isDarkMode ? 'nightlight' : 'wb-sunny'
								}
								size={24}
								color={isDarkMode ? '#000000' : '#FFFFFF'}
							/>
						</View>
						<View>
							<Text
								style={[
									dynamicStyles.themeToggleTitle,
									{ color: colors.text },
								]}
							>
								{isDarkMode ? 'Dark Mode' : 'Light Mode'}
							</Text>
							<Text
								style={[
									dynamicStyles.themeToggleSubtitle,
									{ color: colors.textSecondary },
								]}
							>
								{isDarkMode
									? 'Black & Golden theme'
									: 'Fresh & Clean theme'}
							</Text>
						</View>
					</View>
					<View
						style={[
							dynamicStyles.toggleSwitch,
							{
								backgroundColor: isDarkMode
									? '#FFD700'
									: colors.border,
							},
						]}
					>
						<View
							style={[
								dynamicStyles.toggleKnob,
								{
									transform: [
										{ translateX: isDarkMode ? 22 : 2 },
									],
									backgroundColor: isDarkMode
										? '#000000'
										: '#FFFFFF',
								},
							]}
						/>
					</View>
				</TouchableOpacity>

				{/* Guest Warning Card */}
				{user?.isGuest && (
					<View style={dynamicStyles.guestWarningCard}>
						<View style={dynamicStyles.guestWarningHeader}>
							<IconSymbol
								ios_icon_name='exclamationmark.triangle.fill'
								android_material_icon_name='warning'
								size={24}
								color='#FF9500'
							/>
							<Text style={dynamicStyles.guestWarningTitle}>
								Guest Account
							</Text>
						</View>
						<Text style={dynamicStyles.guestWarningText}>
							You're using a temporary guest account. Your data
							will be deleted after 7 days of inactivity. Sign up
							to save your progress!
						</Text>
						<TouchableOpacity
							style={dynamicStyles.guestUpgradeButton}
							onPress={() => router.push('/auth')}
						>
							<Text style={dynamicStyles.guestUpgradeButtonText}>
								Create Account
							</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Usage Card Removed as limits no longer apply */}

				{/* Stats Section */}
				{loadingProfile ? (
					<View style={dynamicStyles.loadingContainer}>
						<ActivityIndicator
							size='small'
							color={colors.primary}
						/>
					</View>
				) : profile ? (
					<View style={dynamicStyles.section}>
						<View style={dynamicStyles.sectionHeaderRow}>
							<Text style={dynamicStyles.sectionTitle}>
								My Stats
							</Text>
							<TouchableOpacity onPress={handleEditProfile}>
								<Text style={dynamicStyles.editLink}>Edit</Text>
							</TouchableOpacity>
						</View>

						<View style={dynamicStyles.statsGrid}>
							<View style={dynamicStyles.statCard}>
								<Text style={dynamicStyles.statValue}>
									{profile.daily_calorie_target || '—'}
								</Text>
								<Text style={dynamicStyles.statLabel}>
									Daily Goal (cal)
								</Text>
							</View>
							<View style={dynamicStyles.statCard}>
								<Text style={dynamicStyles.statValue}>
									{profile.weight_kg
										? `${profile.weight_kg}kg`
										: '—'}
								</Text>
								<Text style={dynamicStyles.statLabel}>
									Weight
								</Text>
							</View>
							<View style={dynamicStyles.statCard}>
								<Text style={dynamicStyles.statValue}>
									{profile.height_cm
										? `${profile.height_cm}cm`
										: '—'}
								</Text>
								<Text style={dynamicStyles.statLabel}>
									Height
								</Text>
							</View>
							<View style={dynamicStyles.statCard}>
								<Text style={dynamicStyles.statValue}>
									{profile.age || '—'}
								</Text>
								<Text style={dynamicStyles.statLabel}>Age</Text>
							</View>
						</View>

						<View style={dynamicStyles.settingItem}>
							<View style={dynamicStyles.settingLeft}>
								<IconSymbol
									ios_icon_name='target'
									android_material_icon_name='flag'
									size={24}
									color={colors.text}
								/>
								<Text style={dynamicStyles.settingText}>
									Goal
								</Text>
							</View>
							<Text style={dynamicStyles.settingValue}>
								{getGoalLabel(profile.goal)}
							</Text>
						</View>

						<View style={dynamicStyles.settingItem}>
							<View style={dynamicStyles.settingLeft}>
								<IconSymbol
									ios_icon_name='figure.walk'
									android_material_icon_name='directions-walk'
									size={24}
									color={colors.text}
								/>
								<Text style={dynamicStyles.settingText}>
									Activity Level
								</Text>
							</View>
							<Text style={dynamicStyles.settingValue}>
								{getActivityLabel(profile.activity_level)}
							</Text>
						</View>

						<View style={dynamicStyles.settingItem}>
							<View style={dynamicStyles.settingLeft}>
								<IconSymbol
									ios_icon_name='person.fill'
									android_material_icon_name='person'
									size={24}
									color={colors.text}
								/>
								<Text style={dynamicStyles.settingText}>
									Gender
								</Text>
							</View>
							<Text style={dynamicStyles.settingValue}>
								{profile.gender
									? profile.gender.charAt(0).toUpperCase() +
										profile.gender.slice(1)
									: 'Not set'}
							</Text>
						</View>
					</View>
				) : null}

				{/* Subscription Section */}
				{!profile?.is_pro && <View style={dynamicStyles.section}>
					<Text style={dynamicStyles.sectionTitle}>Subscription</Text>
					<View style={dynamicStyles.proCard}>
						<View style={dynamicStyles.proCardHeader}>
							<IconSymbol
								ios_icon_name='star.fill'
								android_material_icon_name='star'
								size={28}
								color={colors.accent}
							/>
							<Text style={dynamicStyles.proCardTitle}>
								Cado Pro
							</Text>
						</View>
						<Text style={dynamicStyles.proCardDescription}>
							Unlock unrestricted tracking, unlimited meals, and
							premium reports. Start your 5-day free trial today!
						</Text>
						<View style={dynamicStyles.proFeatureList}>
							<TouchableOpacity
								style={[
									dynamicStyles.primaryButton,
									{ marginBottom: 12 },
								]}
								onPress={() => router.push('/subscribe')}
							>
								<Text style={dynamicStyles.primaryButtonText}>
									Start 5-Day Free Trial
								</Text>
							</TouchableOpacity>

							<View style={{ flexDirection: 'row', gap: 12 }}>
								<TouchableOpacity
									style={[
										dynamicStyles.planButton,
										{ flex: 1 },
									]}
									onPress={() => router.push('/subscribe')}
								>
									<Text style={dynamicStyles.planPrice}>
										$3.99
									</Text>
									<Text style={dynamicStyles.planPeriod}>
										/ month
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[
										dynamicStyles.planButton,
										{
											flex: 1,
											borderColor: colors.accent,
											borderWidth: 2,
										},
									]}
									onPress={() => router.push('/subscribe')}
								>
									<View style={dynamicStyles.bestValueBadge}>
										<Text
											style={dynamicStyles.bestValueText}
										>
											BEST VALUE
										</Text>
									</View>
									<Text style={dynamicStyles.planPrice}>
										$29.00
									</Text>
									<Text style={dynamicStyles.planPeriod}>
										/ year
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</View>}

				{/* Developer Tools Section */}
				<View style={dynamicStyles.section}>
					<Text style={dynamicStyles.sectionTitle}>
						Developer Tools
					</Text>
					<TouchableOpacity
						style={[
							dynamicStyles.settingItem,
							{ opacity: reseedingDatabase ? 0.6 : 1 },
						]}
						onPress={handleReseedDatabase}
						disabled={reseedingDatabase}
					>
						<View style={dynamicStyles.settingLeft}>
							{reseedingDatabase ? (
								<ActivityIndicator
									size='small'
									color={colors.primary}
								/>
							) : (
								<IconSymbol
									ios_icon_name='arrow.triangle.2.circlepath'
									android_material_icon_name='sync'
									size={24}
									color={colors.primary}
								/>
							)}
							<View>
								<Text style={dynamicStyles.settingText}>
									Reseed Food Database
								</Text>
								<Text
									style={[
										dynamicStyles.settingValue,
										{ fontSize: 11, marginTop: 2 },
									]}
								>
									Fix nutritional values (calories, protein,
									carbs, fat)
								</Text>
							</View>
						</View>
						{!reseedingDatabase && (
							<IconSymbol
								ios_icon_name='chevron.right'
								android_material_icon_name='chevron-right'
								size={20}
								color={colors.textSecondary}
							/>
						)}
					</TouchableOpacity>
				</View>

				{/* About Section */}
				<View style={dynamicStyles.section}>
					<Text style={dynamicStyles.sectionTitle}>About</Text>

					<TouchableOpacity style={dynamicStyles.settingItem}>
						<View style={dynamicStyles.settingLeft}>
							<IconSymbol
								ios_icon_name='info.circle'
								android_material_icon_name='info'
								size={24}
								color={colors.text}
							/>
							<Text style={dynamicStyles.settingText}>
								Help & Support
							</Text>
						</View>
						<IconSymbol
							ios_icon_name='chevron.right'
							android_material_icon_name='chevron-right'
							size={20}
							color={colors.textSecondary}
						/>
					</TouchableOpacity>

					<TouchableOpacity style={dynamicStyles.settingItem}>
						<View style={dynamicStyles.settingLeft}>
							<IconSymbol
								ios_icon_name='doc.text'
								android_material_icon_name='description'
								size={24}
								color={colors.text}
							/>
							<Text style={dynamicStyles.settingText}>
								Privacy Policy
							</Text>
						</View>
						<IconSymbol
							ios_icon_name='chevron.right'
							android_material_icon_name='chevron-right'
							size={20}
							color={colors.textSecondary}
						/>
					</TouchableOpacity>
				</View>

				{/* Sign Out Button */}
				<TouchableOpacity
					style={dynamicStyles.signOutButton}
					onPress={handleSignOut}
				>
					<IconSymbol
						ios_icon_name='arrow.right.square'
						android_material_icon_name='logout'
						size={24}
						color={colors.error}
					/>
					<Text style={dynamicStyles.signOutText}>Sign Out</Text>
				</TouchableOpacity>

				<View style={{ height: 100 }} />
			</ScrollView>

			{/* Error Modal */}
			<Modal
				visible={errorModal.visible}
				animationType='fade'
				transparent={true}
				onRequestClose={() =>
					setErrorModal({ ...errorModal, visible: false })
				}
			>
				<View style={dynamicStyles.modalOverlay}>
					<View style={dynamicStyles.errorModal}>
						<Text style={dynamicStyles.errorModalTitle}>Error</Text>
						<Text style={dynamicStyles.errorModalMessage}>
							{errorModal.message}
						</Text>
						<TouchableOpacity
							style={dynamicStyles.errorModalButton}
							onPress={() =>
								setErrorModal({ ...errorModal, visible: false })
							}
						>
							<Text style={dynamicStyles.errorModalButtonText}>
								OK
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{/* Reseed Database Result Modal */}
			<Modal
				visible={reseedModal.visible}
				animationType='fade'
				transparent={true}
				onRequestClose={() =>
					setReseedModal({ ...reseedModal, visible: false })
				}
			>
				<View style={dynamicStyles.modalOverlay}>
					<View style={dynamicStyles.errorModal}>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								gap: 10,
								marginBottom: 12,
							}}
						>
							<IconSymbol
								ios_icon_name={
									reseedModal.success
										? 'checkmark.circle.fill'
										: 'xmark.circle.fill'
								}
								android_material_icon_name={
									reseedModal.success
										? 'check-circle'
										: 'cancel'
								}
								size={28}
								color={
									reseedModal.success
										? colors.success
										: colors.error
								}
							/>
							<Text style={dynamicStyles.errorModalTitle}>
								{reseedModal.success
									? 'Database Reseeded'
									: 'Reseed Failed'}
							</Text>
						</View>
						<Text style={dynamicStyles.errorModalMessage}>
							{reseedModal.message}
						</Text>
						{reseedModal.success &&
							reseedModal.itemCount !== undefined && (
								<View
									style={{
										backgroundColor: `${colors.success}15`,
										borderRadius: 10,
										padding: 12,
										marginBottom: 16,
									}}
								>
									<Text
										style={{
											fontSize: 14,
											color: colors.text,
											textAlign: 'center',
										}}
									>
										✅ {reseedModal.itemCount} food items
										now have correct nutritional values
									</Text>
								</View>
							)}
						<TouchableOpacity
							style={[
								dynamicStyles.errorModalButton,
								{
									backgroundColor: reseedModal.success
										? colors.success
										: colors.error,
								},
							]}
							onPress={() =>
								setReseedModal({
									...reseedModal,
									visible: false,
								})
							}
						>
							<Text style={dynamicStyles.errorModalButtonText}>
								OK
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

type ThemeColors = typeof lightColors;

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: colors.background,
		},
		header: {
			paddingHorizontal: 20,
			paddingTop: Platform.OS === 'android' ? 20 : 0,
			paddingBottom: 16,
		},
		headerTitle: {
			fontSize: 32,
			fontWeight: '700',
			color: colors.text,
		},
		scrollView: {
			flex: 1,
			paddingHorizontal: 20,
		},
		userCard: {
			backgroundColor: colors.card,
			borderRadius: 20,
			padding: 24,
			alignItems: 'center',
			marginBottom: 16,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.1,
			shadowRadius: 8,
			elevation: 3,
		},
		avatarContainer: {
			marginBottom: 16,
		},
		userName: {
			fontSize: 24,
			fontWeight: '700',
			color: colors.text,
			marginBottom: 4,
		},
		userEmail: {
			fontSize: 14,
			color: colors.textSecondary,
			marginBottom: 8,
		},
		proBadge: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.accent,
			paddingHorizontal: 12,
			paddingVertical: 4,
			borderRadius: 20,
			gap: 4,
			marginTop: 4,
		},
		proBadgeText: {
			fontSize: 12,
			fontWeight: '700',
			color: '#FFFFFF',
		},
		guestBadge: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: '#FF9500',
			paddingHorizontal: 12,
			paddingVertical: 4,
			borderRadius: 20,
			gap: 4,
			marginTop: 4,
		},
		guestBadgeText: {
			fontSize: 12,
			fontWeight: '700',
			color: '#FFFFFF',
		},
		guestWarningCard: {
			backgroundColor: '#FFF3E0',
			borderRadius: 16,
			padding: 16,
			marginBottom: 16,
			borderWidth: 1,
			borderColor: '#FFB74D',
		},
		guestWarningHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
			marginBottom: 8,
		},
		guestWarningTitle: {
			fontSize: 16,
			fontWeight: '700',
			color: '#E65100',
		},
		guestWarningText: {
			fontSize: 14,
			color: '#5D4037',
			lineHeight: 20,
			marginBottom: 12,
		},
		guestUpgradeButton: {
			backgroundColor: '#FF9500',
			borderRadius: 8,
			padding: 12,
			alignItems: 'center',
		},
		guestUpgradeButtonText: {
			fontSize: 14,
			fontWeight: '600',
			color: '#FFFFFF',
		},
		usageCard: {
			backgroundColor: colors.card,
			borderRadius: 16,
			padding: 16,
			marginBottom: 16,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.05,
			shadowRadius: 4,
			elevation: 2,
		},
		usageHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: 8,
		},
		usageTitle: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.text,
		},
		usageSubtitle: {
			fontSize: 14,
			color: colors.primary,
			fontWeight: '600',
		},
		proTag: {
			backgroundColor: colors.accent,
			paddingHorizontal: 10,
			paddingVertical: 3,
			borderRadius: 12,
		},
		proTagText: {
			fontSize: 12,
			fontWeight: '700',
			color: '#FFFFFF',
		},
		usageBar: {
			height: 6,
			backgroundColor: colors.border,
			borderRadius: 3,
			overflow: 'hidden',
			marginBottom: 8,
		},
		usageBarFill: {
			height: '100%',
			backgroundColor: colors.primary,
			borderRadius: 3,
		},
		usageDetail: {
			fontSize: 13,
			color: colors.textSecondary,
		},
		loadingContainer: {
			paddingVertical: 20,
			alignItems: 'center',
		},
		section: {
			marginBottom: 24,
		},
		sectionHeaderRow: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: 12,
			paddingHorizontal: 4,
		},
		sectionTitle: {
			fontSize: 18,
			fontWeight: '600',
			color: colors.text,
			marginBottom: 12,
			paddingHorizontal: 4,
		},
		editLink: {
			fontSize: 14,
			color: colors.primary,
			fontWeight: '600',
		},
		statsGrid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			gap: 12,
			marginBottom: 12,
		},
		statCard: {
			flex: 1,
			minWidth: '45%',
			backgroundColor: colors.card,
			borderRadius: 12,
			padding: 16,
			alignItems: 'center',
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.05,
			shadowRadius: 4,
			elevation: 2,
		},
		statValue: {
			fontSize: 22,
			fontWeight: '700',
			color: colors.primary,
			marginBottom: 4,
		},
		statLabel: {
			fontSize: 12,
			color: colors.textSecondary,
			textAlign: 'center',
		},
		settingItem: {
			backgroundColor: colors.card,
			borderRadius: 12,
			padding: 16,
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			marginBottom: 8,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.05,
			shadowRadius: 4,
			elevation: 2,
		},
		settingLeft: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 12,
		},
		settingText: {
			fontSize: 16,
			color: colors.text,
		},
		settingRight: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
		},
		settingValue: {
			fontSize: 14,
			color: colors.textSecondary,
		},
		proCard: {
			backgroundColor: `${colors.accent}15`,
			borderRadius: 16,
			padding: 20,
			borderWidth: 1,
			borderColor: `${colors.accent}40`,
		},
		proCardHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 12,
			marginBottom: 12,
		},
		proCardTitle: {
			fontSize: 20,
			fontWeight: '700',
			color: colors.text,
		},
		proCardDescription: {
			fontSize: 14,
			color: colors.textSecondary,
			lineHeight: 20,
			marginBottom: 16,
		},
		proFeatureList: {
			gap: 8,
		},
		proFeature: {
			fontSize: 14,
			color: colors.text,
			fontWeight: '500',
		},
		primaryButton: {
			backgroundColor: colors.primary,
			borderRadius: 12,
			padding: 16,
			alignItems: 'center',
			justifyContent: 'center',
		},
		primaryButtonText: {
			color: '#FFF',
			fontSize: 16,
			fontWeight: '700',
		},
		planButton: {
			backgroundColor: colors.card,
			borderRadius: 12,
			padding: 16,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		planPrice: {
			fontSize: 20,
			fontWeight: '700',
			color: colors.text,
		},
		planPeriod: {
			fontSize: 14,
			color: colors.textSecondary,
			marginTop: 4,
		},
		bestValueBadge: {
			position: 'absolute',
			top: -10,
			backgroundColor: colors.accent,
			paddingHorizontal: 8,
			paddingVertical: 4,
			borderRadius: 10,
		},
		bestValueText: {
			fontSize: 10,
			fontWeight: '800',
			color: '#FFF',
		},
		signOutButton: {
			backgroundColor: colors.card,
			borderRadius: 12,
			padding: 16,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 12,
			marginTop: 8,
			borderWidth: 1,
			borderColor: colors.error,
		},
		signOutText: {
			fontSize: 16,
			fontWeight: '600',
			color: colors.error,
		},
		modalOverlay: {
			flex: 1,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			justifyContent: 'center',
			alignItems: 'center',
		},
		errorModal: {
			backgroundColor: colors.card,
			borderRadius: 20,
			padding: 24,
			marginHorizontal: 20,
			width: '85%',
		},
		errorModalTitle: {
			fontSize: 20,
			fontWeight: '700',
			color: colors.text,
			marginBottom: 12,
		},
		errorModalMessage: {
			fontSize: 16,
			color: colors.textSecondary,
			marginBottom: 24,
			lineHeight: 22,
		},
		errorModalButton: {
			backgroundColor: colors.primary,
			borderRadius: 12,
			padding: 16,
			alignItems: 'center',
		},
		errorModalButtonText: {
			color: '#FFFFFF',
			fontSize: 16,
			fontWeight: '600',
		},
		themeToggleCard: {
			borderRadius: 16,
			padding: 16,
			marginBottom: 16,
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.1,
			shadowRadius: 8,
			elevation: 3,
			borderWidth: 1,
		},
		themeToggleLeft: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 12,
		},
		themeIconContainer: {
			width: 48,
			height: 48,
			borderRadius: 24,
			justifyContent: 'center',
			alignItems: 'center',
		},
		themeToggleTitle: {
			fontSize: 16,
			fontWeight: '600',
		},
		themeToggleSubtitle: {
			fontSize: 12,
			marginTop: 2,
		},
		toggleSwitch: {
			width: 50,
			height: 28,
			borderRadius: 14,
			padding: 2,
			justifyContent: 'center',
		},
		toggleKnob: {
			width: 24,
			height: 24,
			borderRadius: 12,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.2,
			shadowRadius: 2,
			elevation: 2,
		},
	});
