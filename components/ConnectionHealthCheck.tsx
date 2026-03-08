
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as Network from 'expo-network';

interface ConnectionHealthCheckProps {
  children: React.ReactNode;
}

export function ConnectionHealthCheck({ children }: ConnectionHealthCheckProps) {
  const { colors } = useTheme();
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  const checkConnection = async () => {
    try {
      setIsChecking(true);
      const networkState = await Network.getNetworkStateAsync();
      setIsConnected(networkState.isConnected ?? true);
    } catch (error) {
      console.log('[ConnectionHealthCheck] Error checking network:', error);
      // Assume connected if we can't check
      setIsConnected(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (isChecking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.text, { color: colors.text }]}>Checking connection...</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>No Internet Connection</Text>
        <Text style={[styles.text, { color: colors.text }]}>
          Please check your internet connection and try again.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={checkConnection}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
