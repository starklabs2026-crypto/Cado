
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNetworkState } from 'expo-network';
import { isBackendConfigured, BACKEND_URL } from '@/utils/api';

interface ConnectionHealthCheckProps {
  onHealthy?: () => void;
  onUnhealthy?: (error: string) => void;
}

export function ConnectionHealthCheck({ onHealthy, onUnhealthy }: ConnectionHealthCheckProps) {
  const { isConnected, isInternetReachable } = useNetworkState();
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    checkConnection();
  }, [isConnected, isInternetReachable]);

  const checkConnection = async () => {
    setChecking(true);
    setStatus('checking');

    if (isConnected === false) {
      const error = 'No internet connection';
      setStatus('unhealthy');
      setErrorMessage(error);
      onUnhealthy?.(error);
      setChecking(false);
      return;
    }

    if (!isBackendConfigured()) {
      const error = 'Backend URL not configured';
      setStatus('unhealthy');
      setErrorMessage(error);
      onUnhealthy?.(error);
      setChecking(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 401) {
        setStatus('healthy');
        setErrorMessage('');
        onHealthy?.();
      } else {
        const error = `Server returned ${response.status}`;
        setStatus('unhealthy');
        setErrorMessage(error);
        onUnhealthy?.(error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setStatus('unhealthy');
      setErrorMessage(errorMsg);
      onUnhealthy?.(errorMsg);
    } finally {
      setChecking(false);
    }
  };

  if (status === 'healthy') {
    return null;
  }

  return (
    <View style={styles.container}>
      {checking ? (
        <>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.text}>Checking connection...</Text>
        </>
      ) : (
        <>
          <Text style={styles.errorText}>⚠️ Connection Issue</Text>
          <Text style={styles.errorDetail}>{errorMessage}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    margin: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetail: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
});
