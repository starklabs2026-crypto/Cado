
import React, { useState, useRef, useCallback } from 'react';
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
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors } from '@/styles/commonStyles';
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
  servingUnit?: string;
}

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export default function CameraScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
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

  // Debounce search to avoid too many API calls
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSearch = useCallback((query: string) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current = setTimeout(() => {
      searchFoodDatabase(query);
    }, 400);
  }, []);

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
      console.log('[API] Nutritional data - Calories:', result.calories, 'Protein:', result.protein, 'Carbs:', result.carbs, 'Fat:', result.fat);
      
      if (result.databaseSuggestions) {
        console.log('[API] Database suggestions count:', result.databaseSuggestions.length);
      }
      
      // Check if nutritional data is valid (not all zeros)
      // Backend now returns fallback values (200 cal, 5g protein, 30g carbs, 8g fat) instead of zeros
      const hasValidNutrition = result.calories > 0 || result.protein > 0 || result.carbs > 0 || result.fat > 0;
      
      if (!hasValidNutrition) {
        console.warn('[API] Analysis returned zero nutritional values - prompting user to search database');
        showError(
          'Incomplete Analysis',
          'The AI could not determine the nutritional values. Please search our food database to find the correct item.'
        );
        // Still show the result modal so user can search
        setAnalysisResult(result);
        setShowResultModal(true);
        setShowManualSearch(true); // Auto-open search modal
      } else {
        await incrementUsage();
        setAnalysisResult(result);
        setShowResultModal(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // If confidence is low but we have database suggestions, show a hint
        if (result.confidence === 'low' && result.databaseSuggestions && result.databaseSuggestions.length > 0) {
          console.log('[API] Low confidence - database suggestions available for user to pick from');
        }
      }
    } catch (error: any) {
      console.error('[API] Error analyzing image:', error);
      showError('Analysis Failed', error.message || 'Failed to analyze the food image. Please try searching our food database instead.');
      // Open manual search as fallback
      setShowManualSearch(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const searchFoodDatabase = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    console.log('[API] Searching food database:', query);

    try {
      const results = await authenticatedPost<DatabaseFood[]>('/api/food/search', {
        query: query.trim(),
      });

      console.log('[API] Search results count:', results.length, 'for query:', query);
      setSearchResults(results);
    } catch (error: any) {
      console.error('[API] Error searching food database:', error);
      // Don't show error modal for search - just show empty state
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectDatabaseFood = (food: DatabaseFood) => {
    console.log('User selected database food:', food.name);
    console.log('Database food nutritional data - Calories:', food.calories, 'Protein:', food.protein, 'Carbs:', food.carbs, 'Fat:', food.fat);
    console.log('Database food serving info - Size:', food.servingSize, 'Unit:', (food as any).servingUnit);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedDatabaseFood(food);
    setShowManualSearch(false);
    
    // Update analysis result with database food data
    // The API returns calories/protein/carbs/fat already calculated for the serving size
    // Backend now guarantees these values are non-zero for database items
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

    // Validate nutritional data before saving - backend also validates this
    const hasValidNutrition = analysisResult.calories > 0 || analysisResult.protein > 0 || analysisResult.carbs > 0 || analysisResult.fat > 0;
    
    if (!hasValidNutrition) {
      showError(
        'Invalid Nutritional Data',
        'Cannot save entry with zero nutritional values. Please search our food database to find the correct item.'
      );
      setShowManualSearch(true);
      return;
    }

    console.log('[API] Saving food entry with nutritional data:', {
      foodName: analysisResult.foodName,
      calories: analysisResult.calories,
      protein: analysisResult.protein,
      carbs: analysisResult.carbs,
      fat: analysisResult.fat,
    });
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
      // Handle backend validation error for incomplete nutritional data
      const errorMessage = error.message || '';
      if (
        errorMessage.includes('Nutritional data is incomplete') ||
        errorMessage.includes('incomplete') ||
        errorMessage.includes('0 calories') ||
        errorMessage.includes('zero')
      ) {
        showError(
          'Incomplete Nutritional Data',
          'The nutritional values appear to be incomplete. Please search our food database to find the correct item with accurate nutrition info.'
        );
        setShowManualSearch(true);
      } else {
        showError('Save Failed', errorMessage || 'Failed to save food entry. Please try again.');
      }
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
  
  // Check if nutritional data is valid
  const hasValidNutrition = analysisResult 
    ? (analysisResult.calories > 0 || analysisResult.protein > 0 || analysisResult.carbs > 0 || analysisResult.fat > 0)
    : false;

  const mealTypeOptions: { value: MealType; label: string; icon: string }[] = [
    { value: 'breakfast', label: 'Breakfast', icon: 'wb-sunny' },
    { value: 'lunch', label: 'Lunch', icon: 'restaurant' },
    { value: 'snack', label: 'Snack', icon: 'fastfood' },
    { value: 'dinner', label: 'Dinner', icon: 'dinner-dining' },
  ];

  const dynamicStyles = createStyles(colors);

  return (
    <View style={dynamicStyles.container}>
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
        <View style={dynamicStyles.emptyState}>
          <View style={dynamicStyles.iconContainer}>
            <IconSymbol
              ios_icon_name="camera.fill"
              android_material_icon_name="camera"
              size={80}
              color={colors.primary}
            />
          </View>
          
          <Text style={dynamicStyles.emptyTitle}>Scan Your Food</Text>
          <Text style={dynamicStyles.emptySubtitle}>
            Take a photo of your meal and let AI automatically calculate the nutrition values
          </Text>

          {usageInfo && !usageInfo.is_pro && (
            <View style={dynamicStyles.usageInfo}>
              <Text style={dynamicStyles.usageText}>
                {usageInfo.scans_remaining !== undefined ? `${usageInfo.scans_remaining} scans remaining today` : 'Free: 3 scans per day'}
              </Text>
            </View>
          )}

          <View style={dynamicStyles.buttonContainer}>
            <TouchableOpacity style={dynamicStyles.primaryButton} onPress={takePhoto}>
              <IconSymbol
                ios_icon_name="camera"
                android_material_icon_name="camera"
                size={24}
                color="#FFFFFF"
              />
              <Text style={dynamicStyles.primaryButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={dynamicStyles.secondaryButton} onPress={pickFromGallery}>
              <IconSymbol
                ios_icon_name="photo"
                android_material_icon_name="image"
                size={24}
                color={colors.primary}
              />
              <Text style={dynamicStyles.secondaryButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={dynamicStyles.searchDatabaseButton} onPress={openManualSearch}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={24}
                color={colors.textSecondary}
              />
              <Text style={dynamicStyles.searchDatabaseButtonText}>Search Food Database</Text>
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.infoBox}>
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={dynamicStyles.infoText}>
              For best results, take a clear photo with good lighting
            </Text>
          </View>
        </View>
      ) : (
        <View style={dynamicStyles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={dynamicStyles.previewImage} />
          
          {analyzing && (
            <View style={dynamicStyles.analyzingOverlay}>
              <View style={dynamicStyles.analyzingCard}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={dynamicStyles.analyzingText}>Analyzing your food...</Text>
                <Text style={dynamicStyles.analyzingSubtext}>This may take a few seconds</Text>
              </View>
            </View>
          )}

          {!analyzing && !showResultModal && (
            <View style={dynamicStyles.retakeButtonContainer}>
              <TouchableOpacity style={dynamicStyles.retakeButton} onPress={retakePhoto}>
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={dynamicStyles.retakeButtonText}>Retake</Text>
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
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Nutrition Analysis</Text>
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
                <Image source={{ uri: selectedImage }} style={dynamicStyles.resultImage} />
              )}

              {analysisResult && (
                <>
                  <View style={dynamicStyles.confidenceContainer}>
                    <Text style={dynamicStyles.confidenceLabel}>Confidence:</Text>
                    <View style={[dynamicStyles.confidenceBadge, { backgroundColor: confidenceColor }]}>
                      <Text style={dynamicStyles.confidenceText}>{confidenceText}</Text>
                    </View>
                  </View>

                  {!hasValidNutrition && (
                    <View style={dynamicStyles.warningBox}>
                      <IconSymbol
                        ios_icon_name="exclamationmark.triangle"
                        android_material_icon_name="warning"
                        size={20}
                        color={colors.error}
                      />
                      <Text style={dynamicStyles.warningText}>
                        No nutritional data available. Please search our database to find the correct food item.
                      </Text>
                    </View>
                  )}

                  {(analysisResult.confidence === 'low' || !hasValidNutrition) && (
                    <View style={dynamicStyles.warningBox}>
                      <IconSymbol
                        ios_icon_name="exclamationmark.triangle"
                        android_material_icon_name="warning"
                        size={20}
                        color={colors.accent}
                      />
                      <Text style={dynamicStyles.warningText}>
                        {!hasValidNutrition 
                          ? 'Please search our database for accurate nutritional information.'
                          : 'Low confidence detection. You can search our database for the correct food item.'}
                      </Text>
                    </View>
                  )}

                  <View style={dynamicStyles.resultCard}>
                    <View style={dynamicStyles.resultHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={dynamicStyles.resultLabel}>Food Name</Text>
                        <Text style={dynamicStyles.resultValue}>{analysisResult.foodName || 'Unknown'}</Text>
                      </View>
                      <TouchableOpacity
                        style={dynamicStyles.searchButton}
                        onPress={openManualSearch}
                      >
                        <IconSymbol
                          ios_icon_name="magnifyingglass"
                          android_material_icon_name="search"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={dynamicStyles.searchButtonText}>Search</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {analysisResult.databaseSuggestions && analysisResult.databaseSuggestions.length > 0 && (
                    <View style={dynamicStyles.suggestionsCard}>
                      <Text style={dynamicStyles.suggestionsTitle}>Database Suggestions:</Text>
                      {analysisResult.databaseSuggestions.slice(0, 3).map((suggestion) => (
                        <TouchableOpacity
                          key={suggestion.id}
                          style={dynamicStyles.suggestionItem}
                          onPress={() => selectDatabaseFood({
                            id: suggestion.id,
                            name: suggestion.name,
                            category: (suggestion as any).category || 'other',
                            calories: suggestion.calories,
                            protein: suggestion.protein,
                            carbs: suggestion.carbs,
                            fat: suggestion.fat,
                            servingSize: (suggestion as any).servingSize || 100,
                            servingUnit: (suggestion as any).servingUnit || 'g',
                          })}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={dynamicStyles.suggestionName}>{suggestion.name}</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                              <Text style={dynamicStyles.suggestionCategory}>
                                P: {Math.round(suggestion.protein)}g · C: {Math.round(suggestion.carbs)}g · F: {Math.round(suggestion.fat)}g
                              </Text>
                            </View>
                          </View>
                          <Text style={dynamicStyles.suggestionCalories}>{Math.round(suggestion.calories)} cal</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <View style={dynamicStyles.nutritionGrid}>
                    <View style={dynamicStyles.nutritionItem}>
                      <Text style={[dynamicStyles.nutritionValue, !hasValidNutrition && dynamicStyles.nutritionValueZero]}>
                        {analysisResult.calories}
                      </Text>
                      <Text style={dynamicStyles.nutritionLabel}>Calories</Text>
                    </View>
                    <View style={dynamicStyles.nutritionItem}>
                      <Text style={[dynamicStyles.nutritionValue, !hasValidNutrition && dynamicStyles.nutritionValueZero]}>
                        {analysisResult.protein}g
                      </Text>
                      <Text style={dynamicStyles.nutritionLabel}>Protein</Text>
                    </View>
                    <View style={dynamicStyles.nutritionItem}>
                      <Text style={[dynamicStyles.nutritionValue, !hasValidNutrition && dynamicStyles.nutritionValueZero]}>
                        {analysisResult.carbs}g
                      </Text>
                      <Text style={dynamicStyles.nutritionLabel}>Carbs</Text>
                    </View>
                    <View style={dynamicStyles.nutritionItem}>
                      <Text style={[dynamicStyles.nutritionValue, !hasValidNutrition && dynamicStyles.nutritionValueZero]}>
                        {analysisResult.fat}g
                      </Text>
                      <Text style={dynamicStyles.nutritionLabel}>Fat</Text>
                    </View>
                  </View>

                  <View style={dynamicStyles.formGroup}>
                    <Text style={dynamicStyles.label}>Meal Type</Text>
                    <View style={dynamicStyles.mealTypeGrid}>
                      {mealTypeOptions.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            dynamicStyles.mealTypeButton,
                            mealType === option.value && dynamicStyles.mealTypeButtonSelected,
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
                              dynamicStyles.mealTypeText,
                              mealType === option.value && dynamicStyles.mealTypeTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={dynamicStyles.actionButtons}>
                    <TouchableOpacity
                      style={dynamicStyles.retakeButtonSecondary}
                      onPress={retakePhoto}
                    >
                      <Text style={dynamicStyles.retakeButtonSecondaryText}>Retake</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        dynamicStyles.saveButton, 
                        (saving || !hasValidNutrition) && dynamicStyles.saveButtonDisabled
                      ]}
                      onPress={saveEntry}
                      disabled={saving || !hasValidNutrition}
                    >
                      {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={dynamicStyles.saveButtonText}>
                          {hasValidNutrition ? 'Save Entry' : 'Search Database First'}
                        </Text>
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
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.searchModalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Search Food Database</Text>
              <TouchableOpacity onPress={() => setShowManualSearch(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.searchInputContainer}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={20}
                color={colors.textSecondary}
              />
              <TextInput
                style={dynamicStyles.searchInput}
                placeholder="Search for food (e.g., vanilla ice cream, chow mein, apple)"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  debouncedSearch(text);
                }}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            <ScrollView style={dynamicStyles.searchResultsContainer} showsVerticalScrollIndicator={false}>
              {searchResults.length === 0 && searchQuery.trim() !== '' && !searching && (
                <View style={dynamicStyles.emptySearchState}>
                  <IconSymbol
                    ios_icon_name="magnifyingglass"
                    android_material_icon_name="search"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text style={dynamicStyles.emptySearchText}>No results found</Text>
                  <Text style={dynamicStyles.emptySearchSubtext}>
                    Try: vanilla ice cream, chow mein, fried rice, gulab jamun, apple, scrambled eggs
                  </Text>
                </View>
              )}
              {searchResults.length === 0 && searchQuery.trim() === '' && !searching && (
                <View style={dynamicStyles.emptySearchState}>
                  <IconSymbol
                    ios_icon_name="fork.knife"
                    android_material_icon_name="restaurant"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text style={dynamicStyles.emptySearchText}>Search our food database</Text>
                  <Text style={dynamicStyles.emptySearchSubtext}>
                    Chinese dishes, Indian sweets, fruits, eggs, beverages and more
                  </Text>
                </View>
              )}

              {searchResults.map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={dynamicStyles.searchResultItem}
                  onPress={() => selectDatabaseFood(food)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.searchResultName}>{food.name}</Text>
                    <Text style={dynamicStyles.searchResultCategory}>{food.category?.replace('_', ' ')}</Text>
                    <View style={dynamicStyles.searchResultMacros}>
                      <Text style={dynamicStyles.searchResultMacroText}>P: {Math.round(food.protein)}g</Text>
                      <Text style={dynamicStyles.searchResultMacroText}>C: {Math.round(food.carbs)}g</Text>
                      <Text style={dynamicStyles.searchResultMacroText}>F: {Math.round(food.fat)}g</Text>
                    </View>
                    {food.servingSize && (
                      <Text style={dynamicStyles.searchResultServingText}>
                        per {food.servingSize}{food.servingUnit || 'g'} serving
                      </Text>
                    )}
                  </View>
                  <View style={dynamicStyles.searchResultCaloriesContainer}>
                    <Text style={dynamicStyles.searchResultCalories}>{Math.round(food.calories)}</Text>
                    <Text style={dynamicStyles.searchResultCaloriesLabel}>cal</Text>
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
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.errorModal}>
            <Text style={dynamicStyles.errorTitle}>{errorModal.title}</Text>
            <Text style={dynamicStyles.errorMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={dynamicStyles.errorButton}
              onPress={() => setErrorModal({ ...errorModal, visible: false })}
            >
              <Text style={dynamicStyles.errorButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type ThemeColors = typeof lightColors;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  nutritionValueZero: {
    color: colors.error,
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
    textAlign: 'center',
    paddingHorizontal: 20,
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
