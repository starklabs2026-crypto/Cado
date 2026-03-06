
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

interface WeeklyStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  dailyCalories: number[];
  days: string[];
}

interface ProgressData {
  thisWeek: WeeklyStats;
  lastWeek: WeeklyStats;
  twoWeeksAgo: WeeklyStats;
  threeWeeksAgo: WeeklyStats;
  bmi: number | null;
  bmiStatus: string | null;
  currentWeight: number | null;
  goalWeight: number | null;
}

type TimePeriod = 'thisWeek' | 'lastWeek' | 'twoWeeksAgo' | 'threeWeeksAgo';

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [isPro, setIsPro] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('thisWeek');
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const loadHistory = useCallback(async () => {
    console.log('[API] Loading food history and progress data');
    setLoading(true);

    try {
      const [historyData, profileData, progressResponse] = await Promise.all([
        authenticatedGet<DayHistory[]>('/api/food-entries/history?days=7'),
        authenticatedGet<{ is_pro: boolean }>('/api/user/profile'),
        authenticatedGet<ProgressData>('/api/food-entries/progress'),
      ]);
      console.log('[API] History loaded:', historyData);
      console.log('[API] Profile loaded:', profileData);
      console.log('[API] Progress data loaded:', progressResponse);
      setHistory(historyData);
      setIsPro(profileData.is_pro);
      setProgressData(progressResponse);
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

  const handlePeriodChange = (period: TimePeriod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPeriod(period);
  };

  const getBMIColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'underweight':
        return '#3B82F6';
      case 'healthy':
        return '#10B981';
      case 'overweight':
        return '#F59E0B';
      case 'obese':
        return '#EF4444';
      default:
        return colors.textSecondary;
    }
  };

  const getBMIPosition = (bmi: number) => {
    const minBMI = 15;
    const maxBMI = 35;
    const clampedBMI = Math.max(minBMI, Math.min(maxBMI, bmi));
    const position = ((clampedBMI - minBMI) / (maxBMI - minBMI)) * 100;
    return `${position}%`;
  };

  const renderProgressReport = () => {
    if (!progressData) return null;

    const weekData = progressData[selectedPeriod];
    const maxCalories = Math.max(...weekData.dailyCalories, 1);
    const avgCalories = weekData.totalCalories / 7;

    return (
      <View style={styles.progressSection}>
        {/* Time Period Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.periodTabsContainer}
          contentContainerStyle={styles.periodTabsContent}
        >
          <TouchableOpacity
            style={[styles.periodTab, selectedPeriod === 'thisWeek' && styles.periodTabActive]}
            onPress={() => handlePeriodChange('thisWeek')}
          >
            <Text style={[styles.periodTabText, selectedPeriod === 'thisWeek' && styles.periodTabTextActive]}>
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodTab, selectedPeriod === 'lastWeek' && styles.periodTabActive]}
            onPress={() => handlePeriodChange('lastWeek')}
          >
            <Text style={[styles.periodTabText, selectedPeriod === 'lastWeek' && styles.periodTabTextActive]}>
              Last Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodTab, selectedPeriod === 'twoWeeksAgo' && styles.periodTabActive]}
            onPress={() => handlePeriodChange('twoWeeksAgo')}
          >
            <Text style={[styles.periodTabText, selectedPeriod === 'twoWeeksAgo' && styles.periodTabTextActive]}>
              2 wks. ago
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodTab, selectedPeriod === 'threeWeeksAgo' && styles.periodTabActive]}
            onPress={() => handlePeriodChange('threeWeeksAgo')}
          >
            <Text style={[styles.periodTabText, selectedPeriod === 'threeWeeksAgo' && styles.periodTabTextActive]}>
              3 wks. ago
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Total Calories Card */}
        <View style={styles.caloriesCard}>
          <Text style={styles.caloriesCardTitle}>Total calories</Text>
          <View style={styles.caloriesValueContainer}>
            <Text style={styles.caloriesValue}>{avgCalories.toFixed(1)}</Text>
            <Text style={styles.caloriesUnit}>cals</Text>
          </View>

          {/* Weekly Chart */}
          <View style={styles.chartContainer}>
            {weekData.dailyCalories.map((calories, index) => {
              const heightPercent = (calories / maxCalories) * 100;
              const dayLabel = weekData.days[index];

              return (
                <View key={index} style={styles.chartBar}>
                  <View style={styles.chartBarContainer}>
                    <View style={[styles.chartBarFill, { height: `${heightPercent}%` }]} />
                  </View>
                  <Text style={styles.chartDayLabel}>{dayLabel}</Text>
                </View>
              );
            })}
          </View>

          {/* Macro Legend */}
          <View style={styles.macroLegend}>
            <View style={styles.macroLegendItem}>
              <View style={[styles.macroLegendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.macroLegendText}>Protein</Text>
            </View>
            <View style={styles.macroLegendItem}>
              <View style={[styles.macroLegendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.macroLegendText}>Carbs</Text>
            </View>
            <View style={styles.macroLegendItem}>
              <View style={[styles.macroLegendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.macroLegendText}>Fats</Text>
            </View>
          </View>

          {/* Motivational Message */}
          <View style={styles.motivationBanner}>
            <Text style={styles.motivationText}>Getting started is the hardest part. You&apos;re ready for this!</Text>
          </View>
        </View>

        {/* BMI Card */}
        {progressData.bmi != null && progressData.bmiStatus != null ? (
          <View style={styles.bmiCard}>
            <Text style={styles.bmiCardTitle}>Your BMI</Text>
            <View style={styles.bmiValueContainer}>
              <Text style={styles.bmiValue}>{progressData.bmi.toFixed(2)}</Text>
              <Text style={styles.bmiSubtext}>Your weight is</Text>
              <View style={[styles.bmiStatusBadge, { backgroundColor: getBMIColor(progressData.bmiStatus) }]}>
                <Text style={styles.bmiStatusText}>{progressData.bmiStatus}</Text>
              </View>
              <TouchableOpacity style={styles.bmiInfoButton}>
                <IconSymbol
                  ios_icon_name="questionmark.circle"
                  android_material_icon_name="help"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* BMI Scale */}
            <View style={styles.bmiScale}>
              <View style={styles.bmiScaleBar}>
                <View style={[styles.bmiScaleSegment, { backgroundColor: '#3B82F6' }]} />
                <View style={[styles.bmiScaleSegment, { backgroundColor: '#10B981' }]} />
                <View style={[styles.bmiScaleSegment, { backgroundColor: '#F59E0B' }]} />
                <View style={[styles.bmiScaleSegment, { backgroundColor: '#EF4444' }]} />
              </View>
              <View style={[styles.bmiIndicator, { left: getBMIPosition(progressData.bmi) }]} />
            </View>

            {/* BMI Legend */}
            <View style={styles.bmiLegend}>
              <View style={styles.bmiLegendItem}>
                <View style={[styles.bmiLegendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.bmiLegendText}>Underweight</Text>
              </View>
              <View style={styles.bmiLegendItem}>
                <View style={[styles.bmiLegendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.bmiLegendText}>Healthy</Text>
              </View>
              <View style={styles.bmiLegendItem}>
                <View style={[styles.bmiLegendDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.bmiLegendText}>Overweight</Text>
              </View>
              <View style={styles.bmiLegendItem}>
                <View style={[styles.bmiLegendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.bmiLegendText}>Obese</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.bmiCard}>
            <Text style={styles.bmiCardTitle}>Your BMI</Text>
            <Text style={styles.bmiSubtext}>
              Complete your profile with height and weight to see your BMI.
            </Text>
          </View>
        )}
      </View>
    );
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Progress Report Section */}
          {renderProgressReport()}

          {/* History Section */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Daily History</Text>
            {history.length === 0 ? (
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
              history.map((day) => {
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
              })
            )}
          </View>

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
  scrollView: {
    flex: 1,
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  periodTabsContainer: {
    marginBottom: 16,
  },
  periodTabsContent: {
    gap: 8,
  },
  periodTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  periodTabActive: {
    backgroundColor: colors.primary,
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },
  caloriesCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  caloriesCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  caloriesValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  caloriesValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
  },
  caloriesUnit: {
    fontSize: 18,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 16,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  chartBarContainer: {
    flex: 1,
    width: '80%',
    backgroundColor: colors.border,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  chartDayLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  macroLegendText: {
    fontSize: 13,
    color: colors.text,
  },
  motivationBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 12,
  },
  motivationText: {
    fontSize: 13,
    color: '#065F46',
    textAlign: 'center',
    fontWeight: '600',
  },
  bmiCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  bmiCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  bmiValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 8,
  },
  bmiValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
  },
  bmiSubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  bmiStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bmiStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bmiInfoButton: {
    marginLeft: 'auto',
  },
  bmiScale: {
    height: 40,
    marginBottom: 16,
    position: 'relative',
  },
  bmiScaleBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bmiScaleSegment: {
    flex: 1,
  },
  bmiIndicator: {
    position: 'absolute',
    top: 0,
    width: 3,
    height: 40,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  bmiLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  bmiLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bmiLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bmiLegendText: {
    fontSize: 12,
    color: colors.text,
  },
  historySection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
