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
	Linking,
	KeyboardAvoidingView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
}

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export default function CameraScreen() {
	const router = useRouter();
	const { user } = useAuth();
	const { colors } = useTheme();
	const [selectedImage, setSelectedImage] = useState<string | null>(null);
	const [analyzing, setAnalyzing] = useState(false);
	const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
		null,
	);
	const [showResultModal, setShowResultModal] = useState(false);
	const [showLowConfidenceModal, setShowLowConfidenceModal] = useState(false);
	const [saving, setSaving] = useState(false);
	const [mealType, setMealType] = useState<MealType>('breakfast');
	const [usageInfo, setUsageInfo] = useState<{
		can_scan: boolean;
		scans_remaining?: number;
		is_pro: boolean;
	} | null>(null);
	const [errorModal, setErrorModal] = useState<{
		visible: boolean;
		title: string;
		message: string;
	}>({
		visible: false,
		title: '',
		message: '',
	});
	const [showManualInput, setShowManualInput] = useState(false);
	const [manualFoodName, setManualFoodName] = useState('');
	const [lookingUpNutrition, setLookingUpNutrition] = useState(false);

	const showError = (title: string, message: string) => {
		setErrorModal({ visible: true, title, message });
	};

	/**
	 * Preprocess image: center-crop and resize to 512x512 max.
	 * Optimizes payload size for the vision model while preserving detail.
	 */
	const preprocessImage = async (uri: string): Promise<string> => {
		try {
			console.log(
				'[Image] Preprocessing image for optimal AI analysis...',
			);
			const result = await ImageManipulator.manipulateAsync(
				uri,
				[{ resize: { width: 512, height: 512 } }],
				{ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
			);
			console.log(
				'[Image] Preprocessed image:',
				result.uri,
				`(${result.width}x${result.height})`,
			);
			return result.uri;
		} catch (error) {
			console.warn(
				'[Image] Preprocessing failed, using original image:',
				error,
			);
			return uri;
		}
	};

	const checkUsageLimit = async () => {
		// All usage limits have been removed as per user request
		return true;
	};

	const incrementUsage = async () => {
		// Usage limits removed
	};

	const requestPermissions = async () => {
		const { status } = await ImagePicker.requestCameraPermissionsAsync();
		if (status !== 'granted') {
			showError(
				'Permission Required',
				'Camera permission is required to take photos of your food.',
			);
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
				quality: 0.8,
			});

			if (!result.canceled && result.assets[0]) {
				console.log(
					'Image selected from gallery:',
					result.assets[0].uri,
				);
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
			// Preprocess image: center-crop + resize to 512x512 for optimal AI payload
			const processedUri = await preprocessImage(imageUri);

			const formData = new FormData();

			const uriParts = processedUri.split('.');
			const fileType = uriParts[uriParts.length - 1] || 'jpg';
			const mimeType = `image/${fileType === 'jpg' ? 'jpeg' : fileType}`;

			if (Platform.OS === 'web') {
				// On web, fetch the image URI as a blob and append it properly
				const response = await fetch(processedUri);
				const blob = await response.blob();
				formData.append('image', blob, `food-photo.${fileType}`);
			} else {
				// @ts-expect-error - FormData append accepts this format in React Native
				formData.append('image', {
					uri: processedUri,
					name: `food-photo.${fileType}`,
					type: mimeType,
				});
			}

			console.log(
				'[API] Sending preprocessed image (512x512) to backend for GPT-4o Vision analysis',
			);

			const result = await authenticatedPost<AnalysisResult>(
				'/api/food/analyze-image',
				formData,
			);

			console.log('[API] GPT-4o Vision analysis result:', result);
			console.log('[API] Confidence level:', result.confidence);
			console.log(
				'[API] Nutritional data - Calories:',
				result.calories,
				'Protein:',
				result.protein,
				'Carbs:',
				result.carbs,
				'Fat:',
				result.fat,
			);

			// Confidence guardrail: if low confidence or food name is UNCLEAR
			if (
				result.confidence === 'low' ||
				result.foodName === 'UNCLEAR' ||
				result.foodName === 'Unknown Food'
			) {
				console.warn(
					'[API] Low confidence or unclear food - showing low confidence modal',
				);
				setShowLowConfidenceModal(true);
				Haptics.notificationAsync(
					Haptics.NotificationFeedbackType.Warning,
				);
				return;
			}

			// Check if nutritional data is valid (not all zeros)
			const hasValidNutrition =
				result.calories > 0 ||
				result.protein > 0 ||
				result.carbs > 0 ||
				result.fat > 0;

			if (!hasValidNutrition) {
				console.warn(
					'[API] Analysis returned zero nutritional values - prompting user to type food name',
				);
				showError(
					'Incomplete Analysis',
					'The AI could not determine the nutritional values. Please type the food name to get accurate nutrition information.',
				);
				// Still show the result modal so user can type food name
				setAnalysisResult(result);
				setShowResultModal(true);
				setShowManualInput(true); // Auto-open manual input modal
			} else {
				await incrementUsage();
				setAnalysisResult(result);
				setShowResultModal(true);
				Haptics.notificationAsync(
					Haptics.NotificationFeedbackType.Success,
				);

				// If confidence is medium, suggest user to type food name for better accuracy
				if (result.confidence === 'medium') {
					console.log(
						'[API] Medium confidence - user can type food name for better accuracy',
					);
				}
			}
		} catch (error: any) {
			console.error('[API] Error analyzing image:', error);
			// Set a placeholder result so the manual input can still save an entry
			setAnalysisResult({
				foodName: 'Picture not clear',
				calories: 0,
				protein: 0,
				carbs: 0,
				fat: 0,
				imageUrl: '',
				confidence: 'low',
			});
			showError(
				'Analysis Failed',
				error.message ||
					'Failed to analyze the food image. Please type the food name to get nutritional information.',
			);
			// Open manual input as fallback
			setShowManualInput(true);
		} finally {
			setAnalyzing(false);
		}
	};

	const lookupNutritionByName = async () => {
		if (!manualFoodName.trim()) {
			showError(
				'Food Name Required',
				'Please enter a food name to look up nutritional information.',
			);
			return;
		}

		console.log('[API] Looking up nutrition for:', manualFoodName);
		setLookingUpNutrition(true);

		try {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

			console.log(
				'[API] Requesting POST /api/food/lookup-nutrition with foodName:',
				manualFoodName.trim(),
			);
			const result = await authenticatedPost<{
				foodName: string;
				calories: number;
				protein: number;
				carbs: number;
				fat: number;
				confidence: string;
			}>('/api/food/lookup-nutrition', {
				foodName: manualFoodName.trim(),
			});

			console.log('[API] LLM nutrition lookup result:', result);
			console.log(
				'[API] Nutritional data - Calories:',
				result.calories,
				'Protein:',
				result.protein,
				'Carbs:',
				result.carbs,
				'Fat:',
				result.fat,
			);

			// Update analysis result with LLM data
			const currentResult = analysisResult || {
				foodName: '',
				calories: 0,
				protein: 0,
				carbs: 0,
				fat: 0,
				imageUrl: selectedImage || '',
				confidence: 'high' as const,
			};

			setAnalysisResult({
				...currentResult,
				foodName: result.foodName,
				calories: Math.round(result.calories),
				protein: Math.round(result.protein),
				carbs: Math.round(result.carbs),
				fat: Math.round(result.fat),
				confidence: result.confidence as 'high' | 'medium' | 'low',
			});

			setShowManualInput(false);
			setShowResultModal(true);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		} catch (error: any) {
			console.error('[API] Error looking up nutrition:', error);
			showError(
				'Lookup Failed',
				error.message ||
					'Failed to look up nutritional information. Please try again.',
			);
		} finally {
			setLookingUpNutrition(false);
		}
	};

	const saveEntry = async () => {
		if (!analysisResult) return;

		// Validate nutritional data before saving - backend also validates this
		const hasValidNutrition =
			analysisResult.calories > 0 ||
			analysisResult.protein > 0 ||
			analysisResult.carbs > 0 ||
			analysisResult.fat > 0;

		if (!hasValidNutrition) {
			showError(
				'Invalid Nutritional Data',
				'Cannot save entry with zero nutritional values. Please type the food name to get accurate nutritional information.',
			);
			setShowResultModal(false);
			setShowManualInput(true);
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

			// Check if we have a real image URL (from AI analysis) vs a local URI or empty
			// Local URIs (file://) are not valid for the from-image endpoint which expects a hosted URL
			const imageUrl = analysisResult.imageUrl || '';
			const hasHostedImage =
				imageUrl.length > 0 &&
				(imageUrl.startsWith('http://') ||
					imageUrl.startsWith('https://'));

			if (hasHostedImage) {
				// Use the from-image endpoint when we have a hosted image URL from AI analysis
				const payload = {
					foodName: analysisResult.foodName,
					calories: analysisResult.calories,
					protein: analysisResult.protein,
					carbs: analysisResult.carbs,
					fat: analysisResult.fat,
					imageUrl: imageUrl,
					mealType: mealType,
				};

				console.log('[API] Saving from-image payload:', payload);
				await authenticatedPost(
					'/api/food-entries/from-image',
					payload,
				);
			} else {
				// Use the regular food-entries endpoint for LLM lookup results (no hosted image)
				const payload: any = {
					foodName: analysisResult.foodName,
					calories: analysisResult.calories,
					protein: analysisResult.protein,
					carbs: analysisResult.carbs,
					fat: analysisResult.fat,
					mealType: mealType,
				};

				console.log('[API] Saving LLM lookup entry payload:', payload);
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
					'The nutritional values appear to be incomplete. Please type the food name to get accurate nutrition information.',
				);
				setShowResultModal(false);
				setShowManualInput(true);
			} else {
				showError(
					'Save Failed',
					errorMessage ||
						'Failed to save food entry. Please try again.',
				);
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
		setShowManualInput(false);
		setShowLowConfidenceModal(false);
		setManualFoodName('');
	};

	const openManualInput = () => {
		console.log(
			'User tapped Type Name button - opening manual input modal',
		);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

		// CRITICAL FIX: Close result modal first, then open manual input modal
		// This prevents modal stacking issues on iOS
		setShowResultModal(false);

		// Use setTimeout to ensure the result modal closes before opening manual input
		setTimeout(() => {
			setManualFoodName('');
			setShowManualInput(true);
			console.log('Manual input modal opened');
		}, 100);
	};

	const confidenceColor =
		analysisResult?.confidence === 'high'
			? colors.success
			: analysisResult?.confidence === 'medium'
				? colors.accent
				: colors.error;

	const confidenceText = analysisResult?.confidence || 'unknown';

	// Check if nutritional data is valid
	const hasValidNutrition = analysisResult
		? analysisResult.calories > 0 ||
			analysisResult.protein > 0 ||
			analysisResult.carbs > 0 ||
			analysisResult.fat > 0
		: false;

	// Check if all nutrition values are zero (e.g., water) — suppress warnings in this case
	const allZero = analysisResult
		? analysisResult.calories === 0 &&
			analysisResult.protein === 0 &&
			analysisResult.carbs === 0 &&
			analysisResult.fat === 0
		: false;

	const mealTypeOptions: { value: MealType; label: string; icon: any }[] = [
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
							ios_icon_name='camera.fill'
							android_material_icon_name='camera'
							size={80}
							color={colors.primary}
						/>
					</View>

					<Text style={dynamicStyles.emptyTitle}>Scan Your Food</Text>
					<Text style={dynamicStyles.emptySubtitle}>
						Take a photo of your meal and let AI automatically
						calculate the nutrition values
					</Text>

					{usageInfo && !usageInfo.is_pro && (
						<View style={dynamicStyles.usageInfo}>
							<Text style={dynamicStyles.usageText}>
								{usageInfo.scans_remaining !== undefined
									? `${usageInfo.scans_remaining} scans remaining today`
									: 'Free: 3 scans per day'}
							</Text>
						</View>
					)}

					<View style={dynamicStyles.buttonContainer}>
						<TouchableOpacity
							style={dynamicStyles.primaryButton}
							onPress={takePhoto}
						>
							<IconSymbol
								ios_icon_name='camera'
								android_material_icon_name='camera'
								size={24}
								color='#FFFFFF'
							/>
							<Text style={dynamicStyles.primaryButtonText}>
								Take Photo
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={dynamicStyles.secondaryButton}
							onPress={pickFromGallery}
						>
							<IconSymbol
								ios_icon_name='photo'
								android_material_icon_name='image'
								size={24}
								color={colors.primary}
							/>
							<Text style={dynamicStyles.secondaryButtonText}>
								Choose from Gallery
							</Text>
						</TouchableOpacity>
					</View>

					<View style={dynamicStyles.infoBox}>
						<IconSymbol
							ios_icon_name='info.circle'
							android_material_icon_name='info'
							size={20}
							color={colors.textSecondary}
						/>
						<Text style={dynamicStyles.infoText}>
							For best results, take a clear photo with good
							lighting
						</Text>
					</View>
				</View>
			) : (
				<View style={dynamicStyles.previewContainer}>
					<Image
						source={{ uri: selectedImage }}
						style={dynamicStyles.previewImage}
					/>

					{analyzing && (
						<View style={dynamicStyles.analyzingOverlay}>
							<View style={dynamicStyles.analyzingCard}>
								<ActivityIndicator
									size='large'
									color={colors.primary}
								/>
								<Text style={dynamicStyles.analyzingText}>
									Analyzing your food...
								</Text>
								<Text style={dynamicStyles.analyzingSubtext}>
									This may take a few seconds
								</Text>
							</View>
						</View>
					)}

					{!analyzing && !showResultModal && (
						<View style={dynamicStyles.retakeButtonContainer}>
							<TouchableOpacity
								style={dynamicStyles.retakeButton}
								onPress={retakePhoto}
							>
								<IconSymbol
									ios_icon_name='arrow.clockwise'
									android_material_icon_name='refresh'
									size={24}
									color='#FFFFFF'
								/>
								<Text style={dynamicStyles.retakeButtonText}>
									Retake
								</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>
			)}

			{/* Result Modal */}
			<Modal
				visible={showResultModal}
				animationType='slide'
				transparent={true}
				onRequestClose={() => setShowResultModal(false)}
			>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				>
					<View style={dynamicStyles.modalOverlay}>
						<View style={dynamicStyles.modalContent}>
							<View style={dynamicStyles.modalHeader}>
								<Text style={dynamicStyles.modalTitle}>
									Nutrition Analysis
								</Text>
								<TouchableOpacity
									onPress={() => setShowResultModal(false)}
								>
									<IconSymbol
										ios_icon_name='xmark'
										android_material_icon_name='close'
										size={24}
										color={colors.text}
									/>
								</TouchableOpacity>
							</View>

							<ScrollView showsVerticalScrollIndicator={false}>
								{selectedImage && (
									<Image
										source={{ uri: selectedImage }}
										style={dynamicStyles.resultImage}
									/>
								)}

								{analysisResult && (
									<>
										<View
											style={
												dynamicStyles.confidenceContainer
											}
										>
											<Text
												style={
													dynamicStyles.confidenceLabel
												}
											>
												Confidence:
											</Text>
											<View
												style={[
													dynamicStyles.confidenceBadge,
													{
														backgroundColor:
															confidenceColor,
													},
												]}
											>
												<Text
													style={
														dynamicStyles.confidenceText
													}
												>
													{confidenceText}
												</Text>
											</View>
										</View>

										{!hasValidNutrition && !allZero && (
											<View
												style={dynamicStyles.warningBox}
											>
												<IconSymbol
													ios_icon_name='exclamationmark.triangle'
													android_material_icon_name='warning'
													size={20}
													color={colors.error}
												/>
												<Text
													style={
														dynamicStyles.warningText
													}
												>
													No nutritional data
													available. Please type the
													food name to get accurate
													information.
												</Text>
											</View>
										)}

										{!allZero &&
											(analysisResult.confidence ===
												'low' ||
												!hasValidNutrition) && (
												<View
													style={
														dynamicStyles.warningBox
													}
												>
													<IconSymbol
														ios_icon_name='exclamationmark.triangle'
														android_material_icon_name='warning'
														size={20}
														color={colors.accent}
													/>
													<Text
														style={
															dynamicStyles.warningText
														}
													>
														{!hasValidNutrition
															? 'Please type the food name for accurate nutritional information.'
															: 'Low confidence detection. You can type the food name for better accuracy.'}
													</Text>
												</View>
											)}

										<View style={dynamicStyles.resultCard}>
											<View
												style={
													dynamicStyles.resultHeader
												}
											>
												<View style={{ flex: 1 }}>
													<Text
														style={
															dynamicStyles.resultLabel
														}
													>
														Food Name
													</Text>
													<Text
														style={
															dynamicStyles.resultValue
														}
													>
														{analysisResult.foodName ||
															'Unknown'}
													</Text>
												</View>
												<TouchableOpacity
													style={
														dynamicStyles.searchButton
													}
													onPress={openManualInput}
												>
													<IconSymbol
														ios_icon_name='pencil'
														android_material_icon_name='edit'
														size={20}
														color={colors.primary}
													/>
													<Text
														style={
															dynamicStyles.searchButtonText
														}
													>
														Type Name
													</Text>
												</TouchableOpacity>
											</View>
										</View>

										<View
											style={dynamicStyles.nutritionGrid}
										>
											<View
												style={
													dynamicStyles.nutritionItem
												}
											>
												<Text
													style={[
														dynamicStyles.nutritionValue,
														!hasValidNutrition &&
															dynamicStyles.nutritionValueZero,
													]}
												>
													{analysisResult.calories}
												</Text>
												<Text
													style={
														dynamicStyles.nutritionLabel
													}
												>
													Calories
												</Text>
											</View>
											<View
												style={
													dynamicStyles.nutritionItem
												}
											>
												<Text
													style={[
														dynamicStyles.nutritionValue,
														!hasValidNutrition &&
															dynamicStyles.nutritionValueZero,
													]}
												>
													{analysisResult.protein}g
												</Text>
												<Text
													style={
														dynamicStyles.nutritionLabel
													}
												>
													Protein
												</Text>
											</View>
											<View
												style={
													dynamicStyles.nutritionItem
												}
											>
												<Text
													style={[
														dynamicStyles.nutritionValue,
														!hasValidNutrition &&
															dynamicStyles.nutritionValueZero,
													]}
												>
													{analysisResult.carbs}g
												</Text>
												<Text
													style={
														dynamicStyles.nutritionLabel
													}
												>
													Carbs
												</Text>
											</View>
											<View
												style={
													dynamicStyles.nutritionItem
												}
											>
												<Text
													style={[
														dynamicStyles.nutritionValue,
														!hasValidNutrition &&
															dynamicStyles.nutritionValueZero,
													]}
												>
													{analysisResult.fat}g
												</Text>
												<Text
													style={
														dynamicStyles.nutritionLabel
													}
												>
													Fat
												</Text>
											</View>
										</View>

										<View style={dynamicStyles.formGroup}>
											<Text style={dynamicStyles.label}>
												Meal Type
											</Text>
											<View
												style={
													dynamicStyles.mealTypeGrid
												}
											>
												{mealTypeOptions.map(
													(option) => (
														<TouchableOpacity
															key={option.value}
															style={[
																dynamicStyles.mealTypeButton,
																mealType ===
																	option.value &&
																	dynamicStyles.mealTypeButtonSelected,
															]}
															onPress={() => {
																setMealType(
																	option.value,
																);
																Haptics.impactAsync(
																	Haptics
																		.ImpactFeedbackStyle
																		.Light,
																);
															}}
														>
															<IconSymbol
																ios_icon_name={
																	option.icon
																}
																android_material_icon_name={
																	option.icon
																}
																size={24}
																color={
																	mealType ===
																	option.value
																		? colors.primary
																		: colors.textSecondary
																}
															/>
															<Text
																style={[
																	dynamicStyles.mealTypeText,
																	mealType ===
																		option.value &&
																		dynamicStyles.mealTypeTextSelected,
																]}
															>
																{option.label}
															</Text>
														</TouchableOpacity>
													),
												)}
											</View>
										</View>

										<View
											style={dynamicStyles.actionButtons}
										>
											<TouchableOpacity
												style={
													dynamicStyles.retakeButtonSecondary
												}
												onPress={retakePhoto}
											>
												<Text
													style={
														dynamicStyles.retakeButtonSecondaryText
													}
												>
													Retake
												</Text>
											</TouchableOpacity>

											<TouchableOpacity
												style={[
													dynamicStyles.saveButton,
													(saving ||
														!hasValidNutrition) &&
														dynamicStyles.saveButtonDisabled,
												]}
												onPress={saveEntry}
												disabled={
													saving || !hasValidNutrition
												}
											>
												{saving ? (
													<ActivityIndicator color='#FFFFFF' />
												) : (
													<Text
														style={
															dynamicStyles.saveButtonText
														}
													>
														{hasValidNutrition
															? 'Save Entry'
															: 'Type Food Name First'}
													</Text>
												)}
											</TouchableOpacity>
										</View>
									</>
								)}
							</ScrollView>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Manual Food Name Input Modal */}
			<Modal
				visible={showManualInput}
				animationType='slide'
				transparent={true}
				onRequestClose={() => setShowManualInput(false)}
			>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				>
					<View
						style={[
							dynamicStyles.modalOverlay,
							{ justifyContent: 'center' },
						]}
					>
						<View style={dynamicStyles.manualInputModalContent}>
							<View style={dynamicStyles.modalHeader}>
								<Text style={dynamicStyles.modalTitle}>
									Type Food Name
								</Text>
								<TouchableOpacity
									onPress={() => setShowManualInput(false)}
								>
									<IconSymbol
										ios_icon_name='xmark'
										android_material_icon_name='close'
										size={24}
										color={colors.text}
									/>
								</TouchableOpacity>
							</View>

							<View style={dynamicStyles.manualInputDescription}>
								<IconSymbol
									ios_icon_name='info.circle'
									android_material_icon_name='info'
									size={20}
									color={colors.primary}
								/>
								<Text
									style={
										dynamicStyles.manualInputDescriptionText
									}
								>
									Type the name of the food item and our AI
									will find the nutritional values for you.
								</Text>
							</View>

							<View style={dynamicStyles.manualInputContainer}>
								<TextInput
									style={dynamicStyles.manualInput}
									placeholder='e.g., vanilla ice cream, chicken biryani, apple'
									placeholderTextColor={colors.textSecondary}
									value={manualFoodName}
									onChangeText={setManualFoodName}
									autoFocus
									returnKeyType='done'
									onSubmitEditing={lookupNutritionByName}
								/>
							</View>

							<TouchableOpacity
								style={[
									dynamicStyles.lookupButton,
									(!manualFoodName.trim() ||
										lookingUpNutrition) &&
										dynamicStyles.lookupButtonDisabled,
								]}
								onPress={lookupNutritionByName}
								disabled={
									!manualFoodName.trim() || lookingUpNutrition
								}
							>
								{lookingUpNutrition ? (
									<ActivityIndicator color='#FFFFFF' />
								) : (
									<>
										<IconSymbol
											ios_icon_name='sparkles'
											android_material_icon_name='auto-awesome'
											size={20}
											color='#FFFFFF'
										/>
										<Text
											style={
												dynamicStyles.lookupButtonText
											}
										>
											Get Nutrition Info
										</Text>
									</>
								)}
							</TouchableOpacity>

							<View style={dynamicStyles.examplesContainer}>
								<Text style={dynamicStyles.examplesTitle}>
									Examples:
								</Text>
								<View style={dynamicStyles.exampleTags}>
									{[
										'Vanilla Ice Cream',
										'Chicken Biryani',
										'Apple',
										'Scrambled Eggs',
									].map((example) => (
										<TouchableOpacity
											key={example}
											style={dynamicStyles.exampleTag}
											onPress={() =>
												setManualFoodName(example)
											}
										>
											<Text
												style={
													dynamicStyles.exampleTagText
												}
											>
												{example}
											</Text>
										</TouchableOpacity>
									))}
								</View>
							</View>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Low Confidence Modal */}
			<Modal
				visible={showLowConfidenceModal}
				animationType='fade'
				transparent={true}
				onRequestClose={() => setShowLowConfidenceModal(false)}
			>
				<View style={dynamicStyles.modalOverlay}>
					<View style={dynamicStyles.errorModal}>
						<Text style={dynamicStyles.errorTitle}>
							Picture not clear
						</Text>
						<Text style={dynamicStyles.errorMessage}>
							Please take a photo with better lighting.
						</Text>

						<View style={dynamicStyles.actionButtons}>
							<TouchableOpacity
								style={dynamicStyles.retakeButtonSecondary}
								onPress={() => {
									setShowLowConfidenceModal(false);
									retakePhoto();
									takePhoto();
								}}
							>
								<Text
									style={
										dynamicStyles.retakeButtonSecondaryText
									}
								>
									Take photo
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={dynamicStyles.saveButton}
								onPress={() => {
									setShowLowConfidenceModal(false);
									setTimeout(
										() => setShowManualInput(true),
										100,
									);
								}}
							>
								<Text style={dynamicStyles.saveButtonText}>
									Search
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

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
						<Text style={dynamicStyles.errorTitle}>
							{errorModal.title}
						</Text>
						<Text style={dynamicStyles.errorMessage}>
							{errorModal.message}
						</Text>
						<TouchableOpacity
							style={dynamicStyles.errorButton}
							onPress={() => {
								setErrorModal({
									...errorModal,
									visible: false,
								});
								if (
									errorModal.title === 'Permission Required'
								) {
									try {
										Linking.openSettings();
									} catch (e) {
										console.warn(
											'Could not open settings:',
											e,
										);
									}
								}
							}}
						>
							<Text style={dynamicStyles.errorButtonText}>
								OK
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</View>
	);
}

type ThemeColors = typeof lightColors;

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
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
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border,
		},
		retakeButtonSecondaryText: {
			color: colors.text,
			fontSize: 16,
			fontWeight: '600',
			textAlign: 'center',
		},
		saveButton: {
			flex: 2,
			backgroundColor: colors.primary,
			borderRadius: 12,
			padding: 16,
			alignItems: 'center',
			justifyContent: 'center',
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
		manualInputModalContent: {
			backgroundColor: colors.card,
			borderTopLeftRadius: 24,
			borderTopRightRadius: 24,
			padding: 24,
			maxHeight: '70%',
		},
		manualInputDescription: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: `${colors.primary}15`,
			borderRadius: 12,
			padding: 16,
			marginBottom: 24,
			gap: 12,
		},
		manualInputDescriptionText: {
			flex: 1,
			fontSize: 14,
			color: colors.text,
			lineHeight: 20,
		},
		manualInputContainer: {
			backgroundColor: colors.background,
			borderRadius: 12,
			borderWidth: 2,
			borderColor: colors.primary,
			marginBottom: 20,
		},
		manualInput: {
			fontSize: 16,
			color: colors.text,
			paddingHorizontal: 16,
			paddingVertical: 16,
		},
		lookupButton: {
			flexDirection: 'row',
			backgroundColor: colors.primary,
			borderRadius: 12,
			padding: 18,
			alignItems: 'center',
			justifyContent: 'center',
			gap: 12,
			marginBottom: 24,
		},
		lookupButtonDisabled: {
			opacity: 0.6,
		},
		lookupButtonText: {
			color: '#FFFFFF',
			fontSize: 16,
			fontWeight: '600',
		},
		examplesContainer: {
			marginTop: 8,
		},
		examplesTitle: {
			fontSize: 14,
			fontWeight: '600',
			color: colors.textSecondary,
			marginBottom: 12,
		},
		exampleTags: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			gap: 8,
		},
		exampleTag: {
			backgroundColor: colors.background,
			borderRadius: 20,
			paddingVertical: 8,
			paddingHorizontal: 16,
			borderWidth: 1,
			borderColor: colors.border,
		},
		exampleTagText: {
			fontSize: 13,
			color: colors.text,
			fontWeight: '500',
		},
	});
