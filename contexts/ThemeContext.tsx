
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '@/styles/commonStyles';

type Theme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  secondary: string;
  accent: string;
  highlight: string;
  border: string;
  error: string;
  success: string;
  protein: string;
  carbs: string;
  fat: string;
}

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@calo_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
        console.log('[Theme] Loaded saved theme:', savedTheme);
      }
    } catch (error) {
      console.error('[Theme] Error loading theme, using default:', error);
      // Fallback to light theme if AsyncStorage fails
      setTheme('light');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      console.log('[Theme] Theme toggled to:', newTheme);
    } catch (error) {
      console.error('[Theme] Error saving theme:', error);
      // Still allow theme change even if save fails
    }
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // Don't render children until theme is loaded to prevent flash
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
