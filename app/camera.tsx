
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { authenticatedPost, authenticatedGet } from '@/utils/api';

interface AnalysisResult {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl: string;
  confidence: string;
  databaseSuggestions?: DatabaseFood[];
}

interface DatabaseFood {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
}

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export default function CameraScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [usageInfo, setUsageInfo] = useState<{ can_scan: boolean; scans_remaining?: number; is_pro: boolean } | null>(null);
  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DatabaseFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDatabaseFood, setSelectedDatabaseFood] = useState<DatabaseFood | null>(null);

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const checkUsageLimit = async () => {
    try {
      const data = await authenticatedGet<{ can_scan: boolean; reason?: string; scans_remaining?: number; is_pro: boolean }>('/api/usage/check-limit');
      console.log('[API] Usage limit check:', data);
      
      if (!data.can_scan) {
        showError('Scan Limit Reached', data.reason || 'You have reached your daily scan limit. Upgrade to Pro for unlimited scans.');
        return false;
      }
      
      setUsageInfo(data);
      return true;
    } catch (error: any) {
      console.error('[API] Error checking usage limit:', error);
      showError('Error', 'Failed to check usage limit. Please try again.');
      return false;
    }
  };

  const incrementUsage = async () => {
    try {
      await authenticatedPost('/api/usage/increment', {});
      console.log('Usage incremented');
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showError('Permission Required', 'Camera permission is required to take photos of your food.');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    console.log('User tapped Take Photo button');
    
    const canScan = await checkUsageLimit();
    if (!canScan) return;
    
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Photo taken:', result.assets[0].uri);
        setSelectedImage(result.assets[0].uri);
        analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showError('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    console.log('User tapped Pick from Gallery button');
    
    const canScan = await checkUsageLimit();
    if (!canScan) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Image selected from gallery:', result.assets[0].uri);
        setSelectedImage(result.assets[0].uri);
        analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showError('Error', 'Failed to pick image. Please try again.');
    }
  };

  const analyzeImage = async (imageUri: string) => {
    console.log('[API] Analyzing food image:', imageUri);
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      
      const uriParts = imageUri.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';
      
      // @ts-expect-error - FormData append accepts this format in React Native
      formData.append('image', {
        uri: imageUri,
        name: `food-photo.${fileType}`,
        type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
      });

      console.log('[API] Sending multipart form data to backend for GPT-4 Vision analysis');

      const result = await authenticatedPost<AnalysisResult>('/api/food/analyze-image', formData);

      console.log('[API] GPT-4 Vision analysis result:', result);
      console.log('[API] Confidence level:', result.confidence);
      if (result.databaseSuggestions) {
        console.log('[API] Database suggestions count:', result.databaseSuggestions.length);
      }
      
      await incrementUsage();
      
      setAnalysisResult(result);
      setShowResultModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error('[API] Error analyzing image:', error);
      showError('Analysis Failed', error.message || 'Failed to analyze the food image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const searchFoodDatabase = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    console.log('[API] Searching food database:', query);
    setSearching(true);

    try {
      const results = await authenticatedPost<DatabaseFood[]>('/api/food/search', {
        query: query.trim(),
      });

      console.log('[API] Search results:', results);
      setSearchResults(results);
    } catch (error: any) {
      console.error('[API] Error searching food database:', error);
      showError('Search Failed', error.message || 'Failed to search food database. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const selectDatabaseFood = (food: DatabaseFood) => {
    console.log('User selected database food:', food.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedDatabaseFood(food);
    setShowManualSearch(false);
    
    // Update analysis result with database food data
    // The API returns calories/protein/carbs/fat already calculated for the serving size
    const currentResult = analysisResult || {
      foodName: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      imageUrl: '',
      confidence: 'high' as const,
    };
    setAnalysisResult({
      ...currentResult,
      foodName: food.name,
      calories: Math.round(food.calories),
      protein: Math.round(food.protein),
      carbs: Math.round(food.carbs),
      fat: Math.round(food.fat),
      confidence: 'high',
    });
    
    // Show result modal if it's not already visible (manual search without prior scan)
    if (!showResultModal) {
      setShowResultModal(true);
    }
  };

  const saveEntry = async () => {
    if (!analysisResult) return;

    console.log('[API] Saving food entry');
    setSaving(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const hasImage = !!analysisResult.imageUrl && analysisResult.imageUrl.length > 0;

      if (hasImage) {
        // Use the from-image endpoint when we have an image URL
        const payload = {
          foodName: analysisResult.foodName,
          calories: analysisResult.calories,
          protein: analysisResult.protein,
          carbs: analysisResult.carbs,
          fat: analysisResult.fat,
          imageUrl: analysisResult.imageUrl,
          mealType: mealType,
          databaseFoodId: selectedDatabaseFood?.id,
        };

        console.log('[API] Saving from-image payload:', payload);
        await authenticatedPost('/api/food-entries/from-image', payload);
      } else {
        // Use the regular food-entries endpoint for manual database search entries
        const payload: any = {
          foodName: analysisResult.foodName,
          calories: analysisResult.calories,
          protein: analysisResult.protein,
          carbs: analysisResult.carbs,
          fat: analysisResult.fat,
          mealType: mealType,
        };

        console.log('[API] Saving manual entry payload:', payload);
        await authenticatedPost('/api/food-entries', payload);
      }

      console.log('[API] Food entry saved successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      router.back();
    } catch (error: any) {
      console.error('[API] Error saving entry:', error);
      showError('Save Failed', error.message || 'Failed to save food entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const retakePhoto = () => {
    console.log('User tapped Retake button');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImage(null);
    setAnalysisResult(null);
    setShowResultModal(false);
    setMealType('breakfast');
    setShowManualSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedDatabaseFood(null);
  };

  const openManualSearch = () => {
    console.log('User opened manual food search');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery('');
    setSearchResults([]);
    setShowManualSearch(true);
  };

  const confidenceColor = analysisResult?.confidence === 'high' 
    ? colors.success 
    : analysisResult?.confidence === 'medium' 
    ? colors.accent 
    : colors.error;

  const confidenceText = analysisResult?.confidence || 'unknown';

  const mealTypeOptions: { value: MealType; label: string; icon: string }[] = [
    { value: 'breakfast', label: 'Breakfast', icon: 'wb-sunny' },
    { value: 'lunch', label: 'Lunch', icon: 'restaurant' },
    { value: 'snack', label: 'Snack', icon: 'fastfood' },
    { value: 'dinner', label: 'Dinner', icon: 'dinner-dining' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Scan Food',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />

      {!selectedImage ? (
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <IconSymbol
              ios_icon_name="camera.fill"
              android_material_icon_name="camera"
              size={80}
              color={colors.primary}
            />
          </View>
          
          <Text style={styles.emptyTitle}>Scan Your Food</Text>
          <Text style={styles.emptySubtitle}>
            Take a photo of your meal and let AI automatically calculate the nutrition values
          </Text>

          {usageInfo && !usageInfo.is_pro && (
            <View style={styles.usageInfo}>
              <Text style={styles.usageText}>
                {usageInfo.scans_remaining !== undefined ? `${usageInfo.scans_remaining} scans remaining today` : 'Free: 3 scans per day'}
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={takePhoto}>
              <IconSymbol
                ios_icon_name="camera"
                android_material_icon_name="camera"
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.primaryButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={pickFromGallery}>
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.searchDatabaseButton} onPress={openManualSearch}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={24}
                color={colors.textSecondary}
              />
              <Text style={styles.searchDatabaseButtonText}>Search Food Database</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>
              For best results, take a clear photo with good lighting
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          
          {analyzing && (
            <View style={styles.analyzingOverlay}>
              <View style={styles.analyzingCard}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.analyzingText}>Analyzing your food...</Text>
                <Text style={styles.analyzingSubtext}>This may take a few seconds</Text>
              </View>
            </View>
          )}

          {!analyzing && !showResultModal && (
            <View style={styles.retakeButtonContainer}>
              <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto}>
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nutrition Analysis</Text>
              <TouchableOpacity onPress={() => setShowResultModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedImage && (
                <Image source={{ uri: selectedImage }} style={styles.resultImage} />
              )}

              {analysisResult && (
                <>
                  <View style={styles.confidenceContainer}>
                    <Text style={styles.confidenceLabel}>Confidence:</Text>
                    <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
                      <Text style={styles.confidenceText}>{confidenceText}</Text>
                    </View>
                  </View>

                  {analysisResult.confidence === 'low' && (
                    <View style={styles.warningBox}>
                      <IconSymbol
                        ios_icon_name="exclamationmark.triangle"
                        android_material_icon_name="warning"
                        size={20}
                        color={colors.accent}
                      />
                      <Text style={styles.warningText}>
                        Low confidence detection. You can search our database for the correct food item.
                      </Text>
                    </View>
                  )}

                  <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultLabel}>Food Name</Text>
                        <Text style={styles.resultValue}>{analysisResult.foodName}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.searchButton}
                        onPress={openManualSearch}
                      >
                        <IconSymbol
                          ios_icon_name="magnifyingglass"
                          android_material_icon_name="search"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={styles.searchButtonText}>Search</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {analysisResult.databaseSuggestions && analysisResult.databaseSuggestions.length > 0 && (
                    <View style={styles.suggestionsCard}>
                      <Text style={styles.suggestionsTitle}>Database Suggestions:</Text>
                      {analysisResult.databaseSuggestions.slice(0, 3).map((suggestion) => (
                        <TouchableOpacity
                          key={suggestion.id}
                          style={styles.suggestionItem}
                          onPress={() => selectDatabaseFood({
                            ...suggestion,
                            category: suggestion.category || 'other',
                            servingSize: 100,
                          })}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionName}>{suggestion.name}</Text>
                            <Text style={styles.suggestionCategory}>{suggestion.category?.replace('_', ' ')}</Text>
                          </View>
                          <Text style={styles.suggestionCalories}>{Math.round(suggestion.calories)} cal</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <View style={styles.nutritionGrid}>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{analysisResult.calories}</Text>
                      <Text style={styles.nutritionLabel}>Calories</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{analysisResult.protein}g</Text>
                      <Text style={styles.nutritionLabel}>Protein</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{analysisResult.carbs}g</Text>
                      <Text style={styles.nutritionLabel}>Carbs</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{analysisResult.fat}g</Text>
                      <Text style={styles.nutritionLabel}>Fat</Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Meal Type</Text>
                    <View style={styles.mealTypeGrid}>
                      {mealTypeOptions.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.mealTypeButton,
                            mealType === option.value && styles.mealTypeButtonSelected,
                          ]}
                          onPress={() => {
                            setMealType(option.value);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                        >
                          <IconSymbol
                            ios_icon_name={option.icon}
                            android_material_icon_name={option.icon}
                            size={24}
                            color={mealType === option.value ? colors.primary : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.mealTypeText,
                              mealType === option.value && styles.mealTypeTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.retakeButtonSecondary}
                      onPress={retakePhoto}
                    >
                      <Text style={styles.retakeButtonSecondaryText}>Retake</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                      onPress={saveEntry}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save Entry</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Search Modal */}
      <Modal
        visible={showManualSearch}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualSearch(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Food Database</Text>
              <TouchableOpacity onPress={() => setShowManualSearch(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.searchInputContainer}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for food (e.g., biryani, pizza, ice cream)"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchFoodDatabase(text);
                }}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            <ScrollView style={styles.searchResultsContainer} showsVerticalScrollIndicator={false}>
              {searchResults.length === 0 && searchQuery.trim() !== '' && !searching && (
                <View style={styles.emptySearchState}>
                  <IconSymbol
                    ios_icon_name="magnifyingglass"
                    android_material_icon_name="search"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.emptySearchText}>No results found</Text>
                  <Text style={styles.emptySearchSubtext}>Try a different search term</Text>
                </View>
              )}

              {searchResults.map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={styles.searchResultItem}
                  onPress={() => selectDatabaseFood(food)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{food.name}</Text>
                    <Text style={styles.searchResultCategory}>{food.category?.replace('_', ' ')}</Text>
                    <View style={styles.searchResultMacros}>
                      <Text style={styles.searchResultMacroText}>P: {Math.round(food.protein)}g</Text>
                      <Text style={styles.searchResultMacroText}>C: {Math.round(food.carbs)}g</Text>
                      <Text style={styles.searchResultMacroText}>F: {Math.round(food.fat)}g</Text>
                    </View>
                    {food.servingSize && (
                      <Text style={styles.searchResultServingText}>per {food.servingSize}g serving</Text>
                    )}
                  </View>
                  <View style={styles.searchResultCaloriesContainer}>
                    <Text style={styles.searchResultCalories}>{Math.round(food.calories)}</Text>
                    <Text style={styles.searchResultCaloriesLabel}>cal</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  usageInfo: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  usageText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  searchDatabaseButton: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchDatabaseButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 32,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 32,
  },
  analyzingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  analyzingSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  retakeButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  retakeButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  resultImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  confidenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confidenceBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  resultCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mealTypeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  mealTypeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}15`,
  },
  mealTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  mealTypeTextSelected: {
    color: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  retakeButtonSecondary: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  retakeButtonSecondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorModal: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent}20`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  suggestionsCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  suggestionCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  suggestionCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  searchModalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
    height: '90%',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  searchResultsContainer: {
    flex: 1,
  },
  emptySearchState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptySearchText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySearchSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  searchResultCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  searchResultMacros: {
    flexDirection: 'row',
    gap: 12,
  },
  searchResultMacroText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  searchResultServingText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  searchResultCaloriesContainer: {
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  searchResultCalories: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  searchResultCaloriesLabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
});
