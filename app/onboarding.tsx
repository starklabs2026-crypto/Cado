
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import * as Haptics from 'expo-haptics';
import { authenticatedPost } from '@/utils/api';

type Gender = 'male' | 'female' | 'other';
type Goal = 'lose_weight' | 'maintain' | 'gain_weight' | 'build_muscle';
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form data
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>('');

  const [errorModal, setErrorModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (step === 1) {
      if (!age || parseInt(age) < 10 || parseInt(age) > 120) {
        showError('Invalid Age', 'Please enter a valid age between 10 and 120.');
        return;
      }
      if (!gender) {
        showError('Select Gender', 'Please select your gender.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!heightCm || parseFloat(heightCm) < 50 || parseFloat(heightCm) > 300) {
        showError('Invalid Height', 'Please enter a valid height between 50 and 300 cm.');
        return;
      }
      if (!weightKg || parseFloat(weightKg) < 20 || parseFloat(weightKg) > 500) {
        showError('Invalid Weight', 'Please enter a valid weight between 20 and 500 kg.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!goal) {
        showError('Select Goal', 'Please select your fitness goal.');
        return;
      }
      if (!activityLevel) {
        showError('Select Activity Level', 'Please select your activity level.');
        return;
      }
      handleComplete();
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    console.log('Completing onboarding with data:', {
      age: parseInt(age),
      gender,
      height_cm: parseFloat(heightCm),
      weight_kg: parseFloat(weightKg),
      goal,
      activity_level: activityLevel,
    });

    setLoading(true);

    try {
      const response = await authenticatedPost('/api/user/complete-onboarding', {
        age: parseInt(age),
        gender,
        height_cm: parseFloat(heightCm),
        weight_kg: parseFloat(weightKg),
        goal,
        activity_level: activityLevel,
      });

      console.log('Onboarding completed successfully:', response);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      router.replace('/(tabs)/(home)');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      showError('Error', error.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = (step / 3) * 100;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
          <Text style={styles.progressText}>Step {step} of 3</Text>
        </View>

        {/* Step 1: Age & Gender */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={40}
                color={colors.primary}
              />
            </View>
            
            <Text style={styles.title}>Tell us about yourself</Text>
            <Text style={styles.subtitle}>This helps us calculate your daily calorie needs</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Enter your age"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.optionsGrid}>
                <TouchableOpacity
                  style={[styles.optionCard, gender === 'male' && styles.optionCardSelected]}
                  onPress={() => setGender('male')}
                >
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={24}
                    color={gender === 'male' ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.optionText, gender === 'male' && styles.optionTextSelected]}>
                    Male
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCard, gender === 'female' && styles.optionCardSelected]}
                  onPress={() => setGender('female')}
                >
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={24}
                    color={gender === 'female' ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.optionText, gender === 'female' && styles.optionTextSelected]}>
                    Female
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCard, gender === 'other' && styles.optionCardSelected]}
                  onPress={() => setGender('other')}
                >
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={24}
                    color={gender === 'other' ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.optionText, gender === 'other' && styles.optionTextSelected]}>
                    Other
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Height & Weight */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <IconSymbol
                ios_icon_name="ruler.fill"
                android_material_icon_name="straighten"
                size={40}
                color={colors.primary}
              />
            </View>
            
            <Text style={styles.title}>Your measurements</Text>
            <Text style={styles.subtitle}>We need this to calculate your calorie target</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="Enter your height in cm"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="Enter your weight in kg"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        )}

        {/* Step 3: Goal & Activity Level */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <IconSymbol
                ios_icon_name="target"
                android_material_icon_name="flag"
                size={40}
                color={colors.primary}
              />
            </View>
            
            <Text style={styles.title}>Your fitness goal</Text>
            <Text style={styles.subtitle}>What do you want to achieve?</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Goal</Text>
              <View style={styles.optionsColumn}>
                <TouchableOpacity
                  style={[styles.optionCardWide, goal === 'lose_weight' && styles.optionCardSelected]}
                  onPress={() => setGoal('lose_weight')}
                >
                  <Text style={[styles.optionTextWide, goal === 'lose_weight' && styles.optionTextSelected]}>
                    Lose Weight
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCardWide, goal === 'maintain' && styles.optionCardSelected]}
                  onPress={() => setGoal('maintain')}
                >
                  <Text style={[styles.optionTextWide, goal === 'maintain' && styles.optionTextSelected]}>
                    Maintain Weight
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCardWide, goal === 'gain_weight' && styles.optionCardSelected]}
                  onPress={() => setGoal('gain_weight')}
                >
                  <Text style={[styles.optionTextWide, goal === 'gain_weight' && styles.optionTextSelected]}>
                    Gain Weight
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCardWide, goal === 'build_muscle' && styles.optionCardSelected]}
                  onPress={() => setGoal('build_muscle')}
                >
                  <Text style={[styles.optionTextWide, goal === 'build_muscle' && styles.optionTextSelected]}>
                    Build Muscle
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Activity Level</Text>
              <View style={styles.optionsColumn}>
                <TouchableOpacity
                  style={[styles.optionCardWide, activityLevel === 'sedentary' && styles.optionCardSelected]}
                  onPress={() => setActivityLevel('sedentary')}
                >
                  <Text style={[styles.optionTextWide, activityLevel === 'sedentary' && styles.optionTextSelected]}>
                    Sedentary (little or no exercise)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCardWide, activityLevel === 'lightly_active' && styles.optionCardSelected]}
                  onPress={() => setActivityLevel('lightly_active')}
                >
                  <Text style={[styles.optionTextWide, activityLevel === 'lightly_active' && styles.optionTextSelected]}>
                    Lightly Active (1-3 days/week)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCardWide, activityLevel === 'moderately_active' && styles.optionCardSelected]}
                  onPress={() => setActivityLevel('moderately_active')}
                >
                  <Text style={[styles.optionTextWide, activityLevel === 'moderately_active' && styles.optionTextSelected]}>
                    Moderately Active (3-5 days/week)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCardWide, activityLevel === 'very_active' && styles.optionCardSelected]}
                  onPress={() => setActivityLevel('very_active')}
                >
                  <Text style={[styles.optionTextWide, activityLevel === 'very_active' && styles.optionTextSelected]}>
                    Very Active (6-7 days/week)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCardWide, activityLevel === 'extremely_active' && styles.optionCardSelected]}
                  onPress={() => setActivityLevel('extremely_active')}
                >
                  <Text style={[styles.optionTextWide, activityLevel === 'extremely_active' && styles.optionTextSelected]}>
                    Extremely Active (athlete)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <IconSymbol
              ios_icon_name="arrow.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.nextButton, loading && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step === 3 ? 'Complete' : 'Next'}
              </Text>
              {step < 3 && (
                <IconSymbol
                  ios_icon_name="arrow.right"
                  android_material_icon_name="arrow-forward"
                  size={24}
                  color="#FFFFFF"
                />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

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
    paddingTop: Platform.OS === 'android' ? 48 : 0,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}15`,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  optionTextSelected: {
    color: colors.primary,
  },
  optionsColumn: {
    gap: 12,
  },
  optionCardWide: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionTextWide: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  nextButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
