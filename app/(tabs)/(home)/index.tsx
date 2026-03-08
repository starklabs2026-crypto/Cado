
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
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, Redirect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors } from '@/styles/commonStyles';
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

type ThemeColors = typeof lightColors;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    paddingTop: Platform.OS === 'android' ? 20 : 0,
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
  macroProtein: {
    color: colors.protein,
  },
  macroCarbs: {
    color: colors.carbs,
  },
  macroFat: {
    color: colors.fat,
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
  fabContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 90,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
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

export default function HomeScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useTheme();
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  
  // Form state
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealType, setMealType] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const handleAddEntry = async () => {
    if (!foodName.trim() || !calories.trim()) {
      showError('Validation Error', 'Please enter food name and calories');
      return;
    }

    console.log('[API] Adding food entry:', { foodName, calories, protein, carbs, fat, mealType });
    setSubmitting(true);
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const payload: any = {
        foodName: foodName.trim(),
        calories: parseInt(calories),
      };
      if (protein.trim()) payload.protein = parseInt(protein);
      if (carbs.trim()) payload.carbs = parseInt(carbs);
      if (fat.trim()) payload.fat = parseInt(fat);
      if (mealType.trim()) payload.mealType = mealType.trim();

      const newEntry = await authenticatedPost<FoodEntry>('/api/food-entries', payload);
      console.log('[API] Food entry created:', newEntry);

      setEntries([newEntry, ...entries]);
      setStats({
        totalCalories: stats.totalCalories + newEntry.calories,
        totalProtein: stats.totalProtein + (newEntry.protein || 0),
        totalCarbs: stats.totalCarbs + (newEntry.carbs || 0),
        totalFat: stats.totalFat + (newEntry.fat || 0),
        entryCount: stats.entryCount + 1,
      });
      
      // Reset form
      setFoodName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setMealType('');
      setShowAddModal(false);
      
      console.log('[API] Food entry added successfully');
    } catch (error) {
      console.error('[API] Error adding entry:', error);
      showError('Error', 'Failed to add food entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

  const dynamicStyles = createStyles(colors);

  if (authLoading || loading) {
    return (
      <View style={[dynamicStyles.loadingContainer, { backgroundColor: colors.background }]}>
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

  const proteinValue = `${stats.totalProtein.toFixed(1)}g`;
  const carbsValue = `${stats.totalCarbs.toFixed(1)}g`;
  const fatValue = `${stats.totalFat.toFixed(1)}g`;

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Calo</Text>
        <Text style={dynamicStyles.headerSubtitle}>By FoodPharmer</Text>
      </View>

      <ScrollView style={dynamicStyles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Stats Card */}
        <View style={dynamicStyles.statsCard}>
          <View style={dynamicStyles.statsHeader}>
            <Text style={dynamicStyles.statsTitle}>Today</Text>
            <Text style={dynamicStyles.statsDate}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          </View>
          
          <View style={dynamicStyles.calorieCircle}>
            <Text style={dynamicStyles.calorieNumber}>{stats.totalCalories}</Text>
            <Text style={dynamicStyles.calorieLabel}>calories</Text>
            <Text style={dynamicStyles.calorieRemaining}>{remainingCalories} remaining</Text>
            <Text style={dynamicStyles.calorieGoal}>Goal: {calorieGoal}</Text>
          </View>

          <View style={dynamicStyles.progressBar}>
            <View style={[dynamicStyles.progressFill, { width: `${calorieProgress}%` }]} />
          </View>

          <View style={dynamicStyles.macrosRow}>
            <View style={dynamicStyles.macroItem}>
              <Text style={[dynamicStyles.macroValue, dynamicStyles.macroProtein]}>{proteinValue}</Text>
              <Text style={dynamicStyles.macroLabel}>Protein</Text>
            </View>
            <View style={dynamicStyles.macroItem}>
              <Text style={[dynamicStyles.macroValue, dynamicStyles.macroCarbs]}>{carbsValue}</Text>
              <Text style={dynamicStyles.macroLabel}>Carbs</Text>
            </View>
            <View style={dynamicStyles.macroItem}>
              <Text style={[dynamicStyles.macroValue, dynamicStyles.macroFat]}>{fatValue}</Text>
              <Text style={dynamicStyles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Entries List by Meal Type */}
        <View style={dynamicStyles.entriesSection}>
          <Text style={dynamicStyles.sectionTitle}>Today&apos;s Meals</Text>
          
          {entries.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="camera"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={dynamicStyles.emptyText}>No meals logged yet</Text>
              <Text style={dynamicStyles.emptySubtext}>Tap the camera button to scan your first meal</Text>
            </View>
          ) : (
            mealSections.map((section) => {
              const sectionEntries = groupedEntries[section.key];
              if (sectionEntries.length === 0) return null;

              return (
                <View key={section.key} style={dynamicStyles.mealSection}>
                  <View style={dynamicStyles.mealSectionHeader}>
                    <IconSymbol
                      ios_icon_name={section.icon}
                      android_material_icon_name={section.icon}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={dynamicStyles.mealSectionTitle}>{section.label}</Text>
                  </View>

                  {sectionEntries.map((entry) => {
                    const entryCalories = entry.calories.toString();
                    const entryProtein = entry.protein ? `${entry.protein}g` : '0g';
                    const entryCarbs = entry.carbs ? `${entry.carbs}g` : '0g';
                    const entryFat = entry.fat ? `${entry.fat}g` : '0g';
                    
                    return (
                      <View key={entry.id} style={dynamicStyles.entryCard}>
                        {entry.imageUrl && (
                          <Image source={{ uri: entry.imageUrl }} style={dynamicStyles.entryImage} />
                        )}
                        
                        <View style={dynamicStyles.entryHeader}>
                          <View style={dynamicStyles.entryInfo}>
                            <View style={dynamicStyles.entryNameRow}>
                              <Text style={dynamicStyles.entryName}>{entry.foodName}</Text>
                              {entry.recognizedByAi && (
                                <View style={dynamicStyles.aiBadge}>
                                  <IconSymbol
                                    ios_icon_name="sparkles"
                                    android_material_icon_name="auto-awesome"
                                    size={12}
                                    color="#FFFFFF"
                                  />
                                  <Text style={dynamicStyles.aiBadgeText}>AI</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => confirmDelete(entry.id)}
                            style={dynamicStyles.deleteButton}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={dynamicStyles.entryStats}>
                          <View style={dynamicStyles.entryStat}>
                            <Text style={dynamicStyles.entryStatValue}>{entryCalories}</Text>
                            <Text style={dynamicStyles.entryStatLabel}>cal</Text>
                          </View>
                          <View style={dynamicStyles.entryStat}>
                            <Text style={[dynamicStyles.entryStatValue, dynamicStyles.macroProtein]}>{entryProtein}</Text>
                            <Text style={dynamicStyles.entryStatLabel}>protein</Text>
                          </View>
                          <View style={dynamicStyles.entryStat}>
                            <Text style={[dynamicStyles.entryStatValue, dynamicStyles.macroCarbs]}>{entryCarbs}</Text>
                            <Text style={dynamicStyles.entryStatLabel}>carbs</Text>
                          </View>
                          <View style={dynamicStyles.entryStat}>
                            <Text style={[dynamicStyles.entryStatValue, dynamicStyles.macroFat]}>{entryFat}</Text>
                            <Text style={dynamicStyles.entryStatLabel}>fat</Text>
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

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Scan Food Button - Fixed positioning to avoid tab bar */}
      <View style={dynamicStyles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={dynamicStyles.fab}
          onPress={() => {
            console.log('Scan Food button tapped');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/camera');
          }}
          activeOpacity={0.8}
        >
          <IconSymbol
            ios_icon_name="camera.fill"
            android_material_icon_name="camera"
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.confirmModal}>
            <Text style={dynamicStyles.confirmTitle}>Delete Entry?</Text>
            <Text style={dynamicStyles.confirmMessage}>Are you sure you want to delete this food entry?</Text>
            
            <View style={dynamicStyles.confirmButtons}>
              <TouchableOpacity
                style={dynamicStyles.confirmButtonCancel}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteEntryId(null);
                }}
              >
                <Text style={dynamicStyles.confirmButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={dynamicStyles.confirmButtonDelete}
                onPress={handleDelete}
              >
                <Text style={dynamicStyles.confirmButtonDeleteText}>Delete</Text>
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
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.confirmModal}>
            <Text style={dynamicStyles.confirmTitle}>{errorModal.title}</Text>
            <Text style={dynamicStyles.confirmMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={dynamicStyles.confirmButtonDelete}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={dynamicStyles.confirmButtonDeleteText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
