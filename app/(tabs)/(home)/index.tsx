
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
import { Stack, useRouter } from 'expo-router';
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
    console.log('[API] Loading food entries and stats');
    setLoading(true);
    try {
      const [todayEntries, todayStats] = await Promise.all([
        authenticatedGet<FoodEntry[]>('/api/food-entries/today'),
        authenticatedGet<TodayStats>('/api/food-entries/stats/today'),
      ]);

      console.log('[API] Today entries:', todayEntries);
      console.log('[API] Today stats:', todayStats);

      setEntries(todayEntries);
      setStats(todayStats);
      console.log('[API] Data loaded successfully');
    } catch (error) {
      console.error('[API] Error loading data:', error);
      showError('Error', 'Failed to load food entries. Please try again.');
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

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const calorieGoal = 2000;
  const calorieProgress = Math.min((stats.totalCalories / calorieGoal) * 100, 100);
  const remainingCalories = Math.max(calorieGoal - stats.totalCalories, 0);

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
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${calorieProgress}%` }]} />
          </View>

          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{stats.totalProtein}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{stats.totalCarbs}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{stats.totalFat}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Entries List */}
        <View style={styles.entriesSection}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>
          
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
            entries.map((entry) => {
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
                      {entry.mealType && (
                        <Text style={styles.entryMealType}>{entry.mealType}</Text>
                      )}
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

      {/* Add Entry Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Food Entry</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Food Name *</Text>
                <TextInput
                  style={styles.input}
                  value={foodName}
                  onChangeText={setFoodName}
                  placeholder="e.g., Chicken Breast"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Calories *</Text>
                <TextInput
                  style={styles.input}
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="e.g., 250"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={styles.label}>Protein (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroupHalf}>
                  <Text style={styles.label}>Carbs (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  value={fat}
                  onChangeText={setFat}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Meal Type</Text>
                <TextInput
                  style={styles.input}
                  value={mealType}
                  onChangeText={setMealType}
                  placeholder="e.g., Breakfast, Lunch, Dinner, Snack"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleAddEntry}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Entry</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  entryMealType: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
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
    bottom: Platform.OS === 'ios' ? 90 : 80,
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  formGroupHalf: {
    flex: 1,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmModal: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
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
