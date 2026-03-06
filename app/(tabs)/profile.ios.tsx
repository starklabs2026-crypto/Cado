
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet } from '@/utils/api';

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorModal, setErrorModal] = useState<{ visible: boolean; message: string }>({
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
      setErrorModal({ visible: true, message: 'Failed to sign out. Please try again.' });
    }
  };

  const handleEditProfile = () => {
    console.log('User tapped Edit Profile button');
    router.push('/onboarding');
  };

  const getGoalLabel = (goal?: string) => {
    switch (goal) {
      case 'lose_weight': return 'Lose Weight';
      case 'maintain': return 'Maintain Weight';
      case 'gain_weight': return 'Gain Weight';
      case 'build_muscle': return 'Build Muscle';
      default: return 'Not set';
    }
  };

  const getActivityLabel = (level?: string) => {
    switch (level) {
      case 'sedentary': return 'Sedentary';
      case 'lightly_active': return 'Lightly Active';
      case 'moderately_active': return 'Moderately Active';
      case 'very_active': return 'Very Active';
      case 'extremely_active': return 'Extremely Active';
      default: return 'Not set';
    }
  };

  const userName = user?.name || 'User';
  const userEmail = user?.email || 'No email';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: true,
          title: 'Profile',
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <IconSymbol
              ios_icon_name="person.circle.fill"
              android_material_icon_name="account-circle"
              size={80}
              color={colors.primary}
            />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
          {profile?.is_pro && (
            <View style={styles.proBadge}>
              <IconSymbol
                ios_icon_name="star.fill"
                android_material_icon_name="star"
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>

        {/* Usage Card */}
        {!loadingProfile && usage && (
          <View style={styles.usageCard}>
            <View style={styles.usageHeader}>
              <Text style={styles.usageTitle}>Today's Usage</Text>
              {usage.is_pro ? (
                <View style={styles.proTag}>
                  <Text style={styles.proTagText}>Unlimited</Text>
                </View>
              ) : (
                <Text style={styles.usageSubtitle}>{usage.scans_remaining} scans remaining</Text>
              )}
            </View>
            {!usage.is_pro && (
              <View style={styles.usageBar}>
                <View
                  style={[
                    styles.usageBarFill,
                    { width: `${Math.min((usage.scans_count / 3) * 100, 100)}%` },
                  ]}
                />
              </View>
            )}
            <Text style={styles.usageDetail}>
              {usage.is_pro
                ? `${usage.scans_count} scans today (Pro: unlimited)`
                : `${usage.scans_count} of 3 free scans used today`}
            </Text>
          </View>
        )}

        {/* Stats Section */}
        {loadingProfile ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : profile ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>My Stats</Text>
              <TouchableOpacity onPress={handleEditProfile}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.daily_calorie_target || '—'}</Text>
                <Text style={styles.statLabel}>Daily Goal (cal)</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.weight_kg ? `${profile.weight_kg}kg` : '—'}</Text>
                <Text style={styles.statLabel}>Weight</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.height_cm ? `${profile.height_cm}cm` : '—'}</Text>
                <Text style={styles.statLabel}>Height</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{profile.age || '—'}</Text>
                <Text style={styles.statLabel}>Age</Text>
              </View>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <IconSymbol
                  ios_icon_name="target"
                  android_material_icon_name="flag"
                  size={24}
                  color={colors.text}
                />
                <Text style={styles.settingText}>Goal</Text>
              </View>
              <Text style={styles.settingValue}>{getGoalLabel(profile.goal)}</Text>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <IconSymbol
                  ios_icon_name="figure.walk"
                  android_material_icon_name="directions-walk"
                  size={24}
                  color={colors.text}
                />
                <Text style={styles.settingText}>Activity Level</Text>
              </View>
              <Text style={styles.settingValue}>{getActivityLabel(profile.activity_level)}</Text>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={24}
                  color={colors.text}
                />
                <Text style={styles.settingText}>Gender</Text>
              </View>
              <Text style={styles.settingValue}>
                {profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not set'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Subscription Section */}
        {!loadingProfile && profile && !profile.is_pro && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            <View style={styles.proCard}>
              <View style={styles.proCardHeader}>
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={28}
                  color={colors.accent}
                />
                <Text style={styles.proCardTitle}>Upgrade to Pro</Text>
              </View>
              <Text style={styles.proCardDescription}>
                Get unlimited food scans and access to full history beyond 7 days.
              </Text>
              <View style={styles.proFeatureList}>
                <Text style={styles.proFeature}>✓ Unlimited daily food scans</Text>
                <Text style={styles.proFeature}>✓ Full history (no 7-day limit)</Text>
                <Text style={styles.proFeature}>✓ Priority AI analysis</Text>
              </View>
            </View>
          </View>
        )}

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="info.circle"
                android_material_icon_name="info"
                size={24}
                color={colors.text}
              />
              <Text style={styles.settingText}>Help & Support</Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={24}
                color={colors.text}
              />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="logout"
            size={24}
            color={colors.error}
          />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Error Modal */}
      <Modal
        visible={errorModal.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorModalTitle}>Error</Text>
            <Text style={styles.errorModalMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={styles.errorModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginTop: 8,
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
});
