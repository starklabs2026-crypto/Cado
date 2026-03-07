
import { StyleSheet } from 'react-native';

// Light theme colors
export const lightColors = {
  background: '#F8FAF9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  primary: '#10B981',
  secondary: '#34D399',
  accent: '#F59E0B',
  highlight: '#FBBF24',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981',
  protein: '#EF4444',
  carbs: '#F59E0B',
  fat: '#3B82F6',
};

// Dark theme colors - Dark purple/navy with golden accents (like Cal AI)
export const darkColors = {
  background: '#1A1625', // Dark purple/navy background
  card: '#252033', // Slightly lighter purple for cards
  text: '#FFFFFF', // White text for primary content
  textSecondary: '#A0A0B0', // Light gray for secondary text
  primary: '#FFD700', // Golden yellow for primary actions
  secondary: '#FFA500', // Orange-gold for secondary elements
  accent: '#FF6B35', // Coral/orange accent
  highlight: '#FFD700', // Golden highlight
  border: '#3A3545', // Subtle purple border
  error: '#FF6B6B',
  success: '#FFD700',
  protein: '#FF6B6B', // Red for protein
  carbs: '#FFA500', // Orange for carbs
  fat: '#4A9EFF', // Blue for fat
};

// Default to light theme
export const colors = lightColors;

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
