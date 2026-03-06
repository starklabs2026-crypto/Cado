
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, Redirect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { authenticatedGet, authenticatedPost, authenticatedDelete } from '@/utils/api';

interface FoodEntry {
  id: string;
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType?: string;
  imageUrl?: string;
  recognizedByAi?: boolean;
  createdAt: string;
}

interface TodayStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entryCount: number;
}

interface UserProfile {
  onboarding_completed: boolean;
  daily_calorie_target?: number;
  is_pro: boolean;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [stats, setStats] = useState<TodayStats>({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    entryCount: 0,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const loadData = useCallback(async () => {
    console.log('[API] Loading food entries, stats, and profile');
    setLoading(true);
    try {
      const [todayEntries, todayStats, userProfile] = await Promise.all([
        authenticatedGet<FoodEntry[]>('/api/food-entries/today'),
        authenticatedGet<TodayStats>('/api/food-entries/stats/today'),
        authenticatedGet<UserProfile>('/api/user/profile'),
      ]);

      console.log('[API] Today entries:', todayEntries);
      console.log('[API] Today stats:', todayStats);
      console.log('[API] User profile:', userProfile);

      setEntries(todayEntries);
      setStats(todayStats);
      setProfile(userProfile);
      
      console.log('[API] Data loaded successfully');
    } catch (error) {
      console.error('[API] Error loading data:', error);
      showError('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('HomeScreen mounted, user:', user);
    if (!authLoading && !user) {
      console.log('User not authenticated, redirecting to auth');
      router.replace('/auth');
    } else if (user) {
      console.log('User authenticated, loading data');
      loadData();
    }
  }, [user, authLoading, router, loadData]);

  const confirmDelete = (entryId: string) => {
    console.log('Confirming delete for entry:', entryId);
    setDeleteEntryId(entryId);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteEntryId) return;
    
    console.log('[API] Deleting food entry:', deleteEntryId);
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await authenticatedDelete(`/api/food-entries/${deleteEntryId}`);
      console.log('[API] Food entry deleted successfully');

      const entryToDelete = entries.find(e => e.id === deleteEntryId);
      if (entryToDelete) {
        setEntries(entries.filter(e => e.id !== deleteEntryId));
        setStats({
          totalCalories: stats.totalCalories - entryToDelete.calories,
          totalProtein: stats.totalProtein - (entryToDelete.protein || 0),
          totalCarbs: stats.totalCarbs - (entryToDelete.carbs || 0),
          totalFat: stats.totalFat - (entryToDelete.fat || 0),
          entryCount: stats.entryCount - 1,
        });
      }
      
      setShowDeleteModal(false);
      setDeleteEntryId(null);
    } catch (error) {
      console.error('[API] Error deleting entry:', error);
      setShowDeleteModal(false);
      setDeleteEntryId(null);
      showError('Error', 'Failed to delete food entry. Please try again.');
    }
  };

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Redirect to onboarding if not completed
  if (profile && !profile.onboarding_completed) {
    return <Redirect href="/onboarding" />;
  }

  const calorieGoal = profile?.daily_calorie_target || 2000;
  const calorieProgress = Math.min((stats.totalCalories / calorieGoal) * 100, 100);
  const remainingCalories = Math.max(calorieGoal - stats.totalCalories, 0);

  // Group entries by meal type
  const groupedEntries: { [key: string]: FoodEntry[] } = {
    breakfast: [],
    lunch: [],
    snack: [],
    dinner: [],
    other: [],
  };

  entries.forEach((entry) => {
    const mealType = entry.mealType?.toLowerCase() || 'other';
    if (groupedEntries[mealType]) {
      groupedEntries[mealType].push(entry);
    } else {
      groupedEntries.other.push(entry);
    }
  });

  const mealSections = [
    { key: 'breakfast', label: 'Breakfast', icon: 'wb-sunny' },
    { key: 'lunch', label: 'Lunch', icon: 'restaurant' },
    { key: 'snack', label: 'Snack', icon: 'fastfood' },
    { key: 'dinner', label: 'Dinner', icon: 'dinner-dining' },
    { key: 'other', label: 'Other', icon: 'restaurant' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calo</Text>
        <Text style={styles.headerSubtitle}>Track your nutrition</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Today</Text>
            <Text style={styles.statsDate}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          </View>
          
          <View style={styles.calorieCircle}>
            <Text style={styles.calorieNumber}>{stats.totalCalories}</Text>
            <Text style={styles.calorieLabel}>calories</Text>
            <Text style={styles.calorieRemaining}>{remainingCalories} remaining</Text>
            <Text style={styles.calorieGoal}>Goal: {calorieGoal}</Text>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${calorieProgress}%` }]} />
          </View>

          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{stats.totalProtein.toFixed(1)}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{stats.totalCarbs.toFixed(1)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{stats.totalFat.toFixed(1)}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Entries List by Meal Type */}
        <View style={styles.entriesSection}>
          <Text style={styles.sectionTitle}>Today&apos;s Meals</Text>
          
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="camera"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No meals logged yet</Text>
              <Text style={styles.emptySubtext}>Tap the camera button to scan your first meal</Text>
            </View>
          ) : (
            mealSections.map((section) => {
              const sectionEntries = groupedEntries[section.key];
              if (sectionEntries.length === 0) return null;

              return (
                <View key={section.key} style={styles.mealSection}>
                  <View style={styles.mealSectionHeader}>
                    <IconSymbol
                      ios_icon_name={section.icon}
                      android_material_icon_name={section.icon}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.mealSectionTitle}>{section.label}</Text>
                  </View>

                  {sectionEntries.map((entry) => {
                    const entryCalories = entry.calories.toString();
                    const entryProtein = entry.protein ? `${entry.protein}g` : '0g';
                    const entryCarbs = entry.carbs ? `${entry.carbs}g` : '0g';
                    const entryFat = entry.fat ? `${entry.fat}g` : '0g';
                    
                    return (
                      <View key={entry.id} style={styles.entryCard}>
                        {entry.imageUrl && (
                          <Image source={{ uri: entry.imageUrl }} style={styles.entryImage} />
                        )}
                        
                        <View style={styles.entryHeader}>
                          <View style={styles.entryInfo}>
                            <View style={styles.entryNameRow}>
                              <Text style={styles.entryName}>{entry.foodName}</Text>
                              {entry.recognizedByAi && (
                                <View style={styles.aiBadge}>
                                  <IconSymbol
                                    ios_icon_name="sparkles"
                                    android_material_icon_name="auto-awesome"
                                    size={12}
                                    color="#FFFFFF"
                                  />
                                  <Text style={styles.aiBadgeText}>AI</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => confirmDelete(entry.id)}
                            style={styles.deleteButton}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={styles.entryStats}>
                          <View style={styles.entryStat}>
                            <Text style={styles.entryStatValue}>{entryCalories}</Text>
                            <Text style={styles.entryStatLabel}>cal</Text>
                          </View>
                          <View style={styles.entryStat}>
                            <Text style={styles.entryStatValue}>{entryProtein}</Text>
                            <Text style={styles.entryStatLabel}>protein</Text>
                          </View>
                          <View style={styles.entryStat}>
                            <Text style={styles.entryStatValue}>{entryCarbs}</Text>
                            <Text style={styles.entryStatLabel}>carbs</Text>
                          </View>
                          <View style={styles.entryStat}>
                            <Text style={styles.entryStatValue}>{entryFat}</Text>
                            <Text style={styles.entryStatLabel}>fat</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Scan Food Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          console.log('Scan Food button tapped');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/camera');
        }}
      >
        <IconSymbol
          ios_icon_name="camera.fill"
          android_material_icon_name="camera"
          size={28}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Delete Entry?</Text>
            <Text style={styles.confirmMessage}>Are you sure you want to delete this food entry?</Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmButtonCancel}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteEntryId(null);
                }}
              >
                <Text style={styles.confirmButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButtonDelete}
                onPress={handleDelete}
              >
                <Text style={styles.confirmButtonDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModal.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>{errorModal.title}</Text>
            <Text style={styles.confirmMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={styles.confirmButtonDelete}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={styles.confirmButtonDeleteText}>OK</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  statsDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  calorieCircle: {
    alignItems: 'center',
    marginBottom: 20,
  },
  calorieNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
  },
  calorieLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  calorieRemaining: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  calorieGoal: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  macroLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  entriesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  mealSection: {
    marginBottom: 24,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  mealSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  entryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  entryImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  entryInfo: {
    flex: 1,
  },
  entryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 4,
  },
  entryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  entryStat: {
    alignItems: 'center',
  },
  entryStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  entryStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModal: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    width: '90%',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButtonCancel: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonDelete: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonDeleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
