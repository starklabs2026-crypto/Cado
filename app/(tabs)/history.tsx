
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { Stack } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticatedGet } from '@/utils/api';
import * as Haptics from 'expo-haptics';

interface FoodEntry {
  id: string;
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType?: string;
  imageUrl?: string;
  createdAt: string;
}

interface DayStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

interface DayHistory {
  date: string;
  entries: FoodEntry[];
  stats: DayStats;
}

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [isPro, setIsPro] = useState(false);
  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const loadHistory = useCallback(async () => {
    console.log('[API] Loading food history');
    setLoading(true);

    try {
      const [historyData, profileData] = await Promise.all([
        authenticatedGet<DayHistory[]>('/api/food-entries/history?days=7'),
        authenticatedGet<{ is_pro: boolean }>('/api/user/profile'),
      ]);
      console.log('[API] History loaded:', historyData);
      console.log('[API] Profile loaded:', profileData);
      setHistory(historyData);
      setIsPro(profileData.is_pro);
    } catch (error: any) {
      console.error('[API] Error loading history:', error);
      showError('Error', error.message || 'Failed to load history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const toggleDate = (date: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const getMealTypeIcon = (mealType?: string) => {
    switch (mealType) {
      case 'breakfast':
        return 'wb-sunny';
      case 'lunch':
        return 'restaurant';
      case 'snack':
        return 'fastfood';
      case 'dinner':
        return 'dinner-dining';
      default:
        return 'restaurant';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <TouchableOpacity onPress={loadHistory}>
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {!isPro && (
        <View style={styles.proNotice}>
          <IconSymbol
            ios_icon_name="info.circle"
            android_material_icon_name="info"
            size={20}
            color={colors.accent}
          />
          <Text style={styles.proNoticeText}>
            Free users can view 7 days of history. Upgrade to Pro for unlimited history.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={60}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start scanning your meals to see your food history here
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {history.map((day) => {
            const isExpanded = expandedDates.has(day.date);
            const dateDisplay = formatDate(day.date);

            return (
              <View key={day.date} style={styles.dayCard}>
                <TouchableOpacity
                  style={styles.dayHeader}
                  onPress={() => toggleDate(day.date)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayHeaderLeft}>
                    <Text style={styles.dayDate}>{dateDisplay}</Text>
                    <Text style={styles.dayEntryCount}>
                      {day.entries.length} {day.entries.length === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>

                  <View style={styles.dayHeaderRight}>
                    <View style={styles.caloriesBadge}>
                      <Text style={styles.caloriesText}>{day.stats.totalCalories}</Text>
                      <Text style={styles.caloriesLabel}>cal</Text>
                    </View>
                    <IconSymbol
                      ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
                      android_material_icon_name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.dayContent}>
                    <View style={styles.macrosRow}>
                      <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{day.stats.totalProtein.toFixed(1)}g</Text>
                        <Text style={styles.macroLabel}>Protein</Text>
                      </View>
                      <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{day.stats.totalCarbs.toFixed(1)}g</Text>
                        <Text style={styles.macroLabel}>Carbs</Text>
                      </View>
                      <View style={styles.macroItem}>
                        <Text style={styles.macroValue}>{day.stats.totalFat.toFixed(1)}g</Text>
                        <Text style={styles.macroLabel}>Fat</Text>
                      </View>
                    </View>

                    <View style={styles.entriesList}>
                      {day.entries.map((entry) => {
                        const mealTypeIcon = getMealTypeIcon(entry.mealType);
                        const mealTypeDisplay = entry.mealType || 'Meal';

                        return (
                          <View key={entry.id} style={styles.entryCard}>
                            {entry.imageUrl && (
                              <Image source={{ uri: entry.imageUrl }} style={styles.entryImage} />
                            )}
                            <View style={styles.entryContent}>
                              <View style={styles.entryHeader}>
                                <View style={styles.entryHeaderLeft}>
                                  <IconSymbol
                                    ios_icon_name={mealTypeIcon}
                                    android_material_icon_name={mealTypeIcon}
                                    size={16}
                                    color={colors.primary}
                                  />
                                  <Text style={styles.entryMealType}>{mealTypeDisplay}</Text>
                                </View>
                                <Text style={styles.entryCalories}>{entry.calories} cal</Text>
                              </View>
                              <Text style={styles.entryName}>{entry.foodName}</Text>
                              <View style={styles.entryMacros}>
                                <Text style={styles.entryMacroText}>P: {entry.protein || 0}g</Text>
                                <Text style={styles.entryMacroText}>C: {entry.carbs || 0}g</Text>
                                <Text style={styles.entryMacroText}>F: {entry.fat || 0}g</Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* Error Modal */}
      <Modal
        visible={errorModal.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setErrorModal({ ...errorModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorTitle}>{errorModal.title}</Text>
            <Text style={styles.errorMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={styles.errorButtonText}>OK</Text>
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
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  proNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent}20`,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    gap: 12,
  },
  proNoticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  dayEntryCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  caloriesBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  caloriesText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  caloriesLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 2,
  },
  dayContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  entriesList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  entryImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  entryContent: {
    padding: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryMealType: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  entryCalories: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  entryMacros: {
    flexDirection: 'row',
    gap: 12,
  },
  entryMacroText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomPadding: {
    height: 100,
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
    width: '90%',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
