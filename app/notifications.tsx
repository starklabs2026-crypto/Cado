
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import * as Haptics from 'expo-haptics';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: {
    groupId?: string;
    invitationId?: string;
  } | null;
  read: boolean;
  createdAt: string;
}

type ThemeColors = typeof lightColors;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  unreadBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  notificationCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreadCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  bottomPadding: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
    textAlign: 'center',
  },
});

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const showError = (title: string, message: string) => {
    console.log('Error:', title, message);
    const fullMessage = `${title}\n${message}`;
    setErrorMessage(fullMessage);
    setErrorModalVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const showSuccess = (message: string) => {
    console.log('Success:', message);
    setSuccessMessage(message);
    setSuccessModalVisible(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const loadNotifications = useCallback(async () => {
    console.log('Loading notifications...');
    try {
      const data = await authenticatedGet<Notification[]>('/api/notifications');
      console.log('Notifications loaded:', data.length);
      setNotifications(data);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      showError('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    console.log('User pulled to refresh notifications');
    setRefreshing(true);
    loadNotifications();
  };

  const handleAcceptInvitation = async (invitationId: string, groupName: string) => {
    console.log('User tapped Accept for invitation:', invitationId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await authenticatedPost<{ success: boolean; groupId: string }>(
        `/api/group-invitations/${invitationId}/accept`,
        {}
      );

      console.log('Invitation accepted:', response);
      showSuccess(`You have joined the group "${groupName}"!`);
      
      // Reload notifications to update UI
      loadNotifications();
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      const errorMsg = error?.message || 'Failed to accept invitation. Please try again.';
      showError('Error', errorMsg);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    console.log('User tapped Reject for invitation:', invitationId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await authenticatedPost<{ success: boolean }>(
        `/api/group-invitations/${invitationId}/reject`,
        {}
      );

      console.log('Invitation rejected:', response);
      showSuccess('Invitation declined');
      
      // Reload notifications to update UI
      loadNotifications();
    } catch (error: any) {
      console.error('Failed to reject invitation:', error);
      const errorMsg = error?.message || 'Failed to reject invitation. Please try again.';
      showError('Error', errorMsg);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    console.log('Marking notification as read:', notificationId);
    try {
      await authenticatedPost(`/api/notifications/${notificationId}/mark-read`, {});
      
      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      const minsText = diffMins === 1 ? 'minute' : 'minutes';
      return `${diffMins} ${minsText} ago`;
    }
    if (diffHours < 24) {
      const hoursText = diffHours === 1 ? 'hour' : 'hours';
      return `${diffHours} ${hoursText} ago`;
    }
    if (diffDays < 7) {
      const daysText = diffDays === 1 ? 'day' : 'days';
      return `${diffDays} ${daysText} ago`;
    }
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    return `${month} ${day}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Notifications',
            headerBackTitle: 'Back',
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadText = unreadCount === 1 ? 'notification' : 'notifications';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />

      {notifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <IconSymbol
            ios_icon_name="bell.slash"
            android_material_icon_name="notifications-off"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptyText}>
            You&apos;re all caught up! Group invitations and updates will appear here.
          </Text>
        </ScrollView>
      ) : (
        <>
          {unreadCount > 0 && (
            <View style={styles.unreadBanner}>
              <Text style={styles.unreadText}>
                {unreadCount}
              </Text>
              <Text style={styles.unreadText}> </Text>
              <Text style={styles.unreadText}>
                {unreadText}
              </Text>
            </View>
          )}

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {notifications.map((notification) => {
              const timeAgo = formatDate(notification.createdAt);
              const isInvitation = notification.type === 'group_invitation';
              const invitationId = notification.data?.invitationId;

              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                  onPress={() => !notification.read && handleMarkAsRead(notification.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationHeader}>
                    <View style={styles.iconContainer}>
                      <IconSymbol
                        ios_icon_name={isInvitation ? 'person.2.fill' : 'bell.fill'}
                        android_material_icon_name={isInvitation ? 'group' : 'notifications'}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      <Text style={styles.notificationTime}>{timeAgo}</Text>
                    </View>
                    {!notification.read && <View style={styles.unreadDot} />}
                  </View>

                  {isInvitation && invitationId && !notification.read && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleRejectInvitation(invitationId)}
                      >
                        <Text style={styles.rejectButtonText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => {
                          const groupName = notification.title.replace('Invitation to join ', '');
                          handleAcceptInvitation(invitationId, groupName);
                        }}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <View style={styles.bottomPadding} />
          </ScrollView>
        </>
      )}

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="error"
              size={48}
              color={colors.error}
            />
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color={colors.success}
            />
            <Text style={styles.modalTitle}>Success</Text>
            <Text style={styles.modalText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
