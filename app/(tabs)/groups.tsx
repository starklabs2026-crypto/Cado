
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { lightColors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import * as Haptics from 'expo-haptics';

interface MyGroup {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  isPrivate: boolean;
  role: string;
  createdAt: string;
}

interface DiscoverGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  imageUrl: string;
  memberAvatars: string[];
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  myGroupCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  myGroupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  myGroupContent: {
    flex: 1,
    marginRight: 8,
  },
  myGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  myGroupName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
    marginLeft: 4,
  },
  myGroupDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  myGroupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myGroupMemberCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  roleBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  discoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 8,
  },
  discoverTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  createButtonText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  groupImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 12,
  },
  groupContent: {
    flex: 1,
    marginRight: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.card,
  },
  memberCountContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  memberCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  groupDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
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
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});

export default function GroupsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myGroups, setMyGroups] = useState<MyGroup[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<DiscoverGroup[]>([]);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = useCallback(async () => {
    console.log('[Groups] Loading groups from API...');
    try {
      const data = await authenticatedGet<{ myGroups: MyGroup[]; discoverGroups: DiscoverGroup[] }>('/api/groups');
      console.log('[Groups] Loaded myGroups:', data.myGroups.length, 'discoverGroups:', data.discoverGroups.length);
      setMyGroups(data.myGroups || []);
      setDiscoverGroups(data.discoverGroups || []);
    } catch (error: any) {
      console.error('Error loading groups:', error);
      setErrorModalMessage(error.message || 'Failed to load groups');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => {
    console.log('User pulled to refresh groups');
    setRefreshing(true);
    loadGroups();
  };

  const handleJoinGroup = async (groupId: string, groupName: string) => {
    console.log('[Groups] User tapped Join button for group:', groupId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await authenticatedPost<{ success: boolean; message: string }>(
        `/api/groups/${groupId}/join`,
        {}
      );
      console.log('[Groups] Joined group successfully:', result);
      setSuccessModalMessage(`Successfully joined "${groupName}"!`);
      setSuccessModalVisible(true);
      
      // Reload groups after joining
      setTimeout(() => {
        loadGroups();
      }, 1000);
    } catch (error: any) {
      console.error('Error joining group:', error);
      setErrorModalMessage(error.message || 'Failed to join group');
      setErrorModalVisible(true);
    }
  };

  const handleOpenGroupChat = (groupId: string) => {
    console.log('User tapped on group - navigating to chat:', groupId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/group-chat/${groupId}`);
  };

  const handleCreatePrivateGroup = () => {
    console.log('User tapped Create Private Group button - navigating to create screen');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/create-group');
  };

  const handleNotifications = () => {
    console.log('User tapped Notifications button - navigating to notifications screen');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/notifications');
  };

  const memberCountText = (count: number) => {
    const countStr = count.toString();
    const membersText = count === 1 ? 'member' : 'members';
    return { countStr, membersText };
  };

  const dynamicStyles = createStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Groups</Text>
        <TouchableOpacity style={dynamicStyles.notificationButton} onPress={handleNotifications}>
          <IconSymbol 
            ios_icon_name="bell.fill" 
            android_material_icon_name="notifications" 
            size={24} 
            color={colors.text} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={dynamicStyles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* My Groups Section */}
        {myGroups.length > 0 && (
          <>
            <View style={dynamicStyles.sectionHeader}>
              <Text style={dynamicStyles.sectionTitle}>My Groups</Text>
            </View>

            {myGroups.map((group) => {
              const { countStr, membersText } = memberCountText(group.memberCount);
              const roleText = group.role === 'admin' ? 'Admin' : 'Member';
              
              return (
                <TouchableOpacity
                  key={group.id}
                  style={dynamicStyles.myGroupCard}
                  onPress={() => handleOpenGroupChat(group.id)}
                  activeOpacity={0.7}
                >
                  <View style={dynamicStyles.myGroupIcon}>
                    <IconSymbol
                      ios_icon_name="person.3.fill"
                      android_material_icon_name="group"
                      size={32}
                      color={colors.primary}
                    />
                  </View>

                  <View style={dynamicStyles.myGroupContent}>
                    <View style={dynamicStyles.myGroupHeader}>
                      <Text style={dynamicStyles.myGroupName}>{group.name}</Text>
                      {group.isPrivate && (
                        <View style={dynamicStyles.privateBadge}>
                          <IconSymbol
                            ios_icon_name="lock.fill"
                            android_material_icon_name="lock"
                            size={12}
                            color={colors.background}
                          />
                          <Text style={dynamicStyles.privateBadgeText}>Private</Text>
                        </View>
                      )}
                    </View>

                    {group.description && (
                      <Text style={dynamicStyles.myGroupDescription} numberOfLines={1}>
                        {group.description}
                      </Text>
                    )}

                    <View style={dynamicStyles.myGroupFooter}>
                      <View style={dynamicStyles.memberCountContainer}>
                        <Text style={dynamicStyles.myGroupMemberCount}>{countStr}</Text>
                        <Text style={dynamicStyles.myGroupMemberCount}> </Text>
                        <Text style={dynamicStyles.myGroupMemberCount}>{membersText}</Text>
                      </View>
                      <View style={dynamicStyles.roleBadge}>
                        <Text style={dynamicStyles.roleBadgeText}>{roleText}</Text>
                      </View>
                    </View>
                  </View>

                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="chevron-right"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Discover Groups Section */}
        <View style={dynamicStyles.discoverHeader}>
          <Text style={dynamicStyles.discoverTitle}>Discover Groups</Text>
          <TouchableOpacity 
            style={dynamicStyles.createButton}
            onPress={handleCreatePrivateGroup}
          >
            <IconSymbol 
              ios_icon_name="plus" 
              android_material_icon_name="add" 
              size={18} 
              color={colors.text} 
            />
            <Text style={dynamicStyles.createButtonText}>Private Group</Text>
          </TouchableOpacity>
        </View>

        {discoverGroups.length === 0 ? (
          <View style={dynamicStyles.emptyState}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={dynamicStyles.emptyStateText}>No groups to discover</Text>
            <Text style={dynamicStyles.emptyStateSubtext}>Check back later for new groups</Text>
          </View>
        ) : (
          discoverGroups.map((group) => {
            const { countStr, membersText } = memberCountText(group.memberCount);
            return (
              <View key={group.id} style={dynamicStyles.groupCard}>
                <Image 
                  source={{ uri: group.imageUrl }} 
                  style={dynamicStyles.groupImage}
                />
                
                <View style={dynamicStyles.groupContent}>
                  <View style={dynamicStyles.groupHeader}>
                    <Text style={dynamicStyles.groupName}>{group.name}</Text>
                    <View style={dynamicStyles.memberAvatars}>
                      {group.memberAvatars.slice(0, 3).map((avatar, index) => (
                        <Image 
                          key={index}
                          source={{ uri: avatar }} 
                          style={[dynamicStyles.memberAvatar, { marginLeft: index > 0 ? -8 : 0 }]}
                        />
                      ))}
                    </View>
                  </View>
                  
                  <View style={dynamicStyles.memberCountContainer}>
                    <Text style={dynamicStyles.memberCount}>{countStr}</Text>
                    <Text style={dynamicStyles.memberCount}> </Text>
                    <Text style={dynamicStyles.memberCount}>{membersText}</Text>
                  </View>
                  
                  <Text style={dynamicStyles.groupDescription}>{group.description}</Text>
                </View>

                <TouchableOpacity 
                  style={dynamicStyles.joinButton}
                  onPress={() => handleJoinGroup(group.id, group.name)}
                >
                  <IconSymbol 
                    ios_icon_name="plus" 
                    android_material_icon_name="add" 
                    size={16} 
                    color={colors.text} 
                  />
                  <Text style={dynamicStyles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={dynamicStyles.bottomPadding} />
      </ScrollView>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Error</Text>
            <Text style={dynamicStyles.modalMessage}>{errorModalMessage}</Text>
            <TouchableOpacity
              style={dynamicStyles.modalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={dynamicStyles.modalButtonText}>OK</Text>
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
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Success</Text>
            <Text style={dynamicStyles.modalMessage}>{successModalMessage}</Text>
            <TouchableOpacity
              style={dynamicStyles.modalButton}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={dynamicStyles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
