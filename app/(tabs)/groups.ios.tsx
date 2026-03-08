
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
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

export default function GroupsScreen() {
  const router = useRouter();
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
    console.log('Loading groups...');
    try {
      // TODO: Backend Integration - GET /api/groups to fetch myGroups and discoverGroups
      
      // Mock data for now
      const mockMyGroups: MyGroup[] = [
        {
          id: 'my-1',
          name: 'My Fitness Journey',
          description: 'Private group for tracking progress',
          memberCount: 3,
          isPrivate: true,
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
      ];

      const mockDiscoverGroups: DiscoverGroup[] = [
        {
          id: '1',
          name: 'Fitness & Workouts',
          description: 'Share workouts that match your calorie goals.',
          memberCount: 113,
          imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400',
          memberAvatars: ['https://i.pravatar.cc/150?img=1', 'https://i.pravatar.cc/150?img=2', 'https://i.pravatar.cc/150?img=3'],
        },
        {
          id: '2',
          name: 'New to Calorie Tracking',
          description: 'Beginner questions, tips, and first wins.',
          memberCount: 161,
          imageUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400',
          memberAvatars: ['https://i.pravatar.cc/150?img=4', 'https://i.pravatar.cc/150?img=5', 'https://i.pravatar.cc/150?img=6'],
        },
        {
          id: '3',
          name: 'New Year\'s Resolutions',
          description: 'Share your resolutions, stay on track, celebrate wins.',
          memberCount: 88,
          imageUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400',
          memberAvatars: ['https://i.pravatar.cc/150?img=7', 'https://i.pravatar.cc/150?img=8', 'https://i.pravatar.cc/150?img=9'],
        },
        {
          id: '4',
          name: 'Muscle Gain & Bulking',
          description: 'Eat in a surplus and build muscle together.',
          memberCount: 198,
          imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400',
          memberAvatars: ['https://i.pravatar.cc/150?img=10', 'https://i.pravatar.cc/150?img=11', 'https://i.pravatar.cc/150?img=12'],
        },
        {
          id: '5',
          name: 'Weight Loss Support',
          description: 'Stay accountable, share progress, and support each other.',
          memberCount: 219,
          imageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
          memberAvatars: ['https://i.pravatar.cc/150?img=13', 'https://i.pravatar.cc/150?img=14', 'https://i.pravatar.cc/150?img=15'],
        },
      ];

      setMyGroups(mockMyGroups);
      setDiscoverGroups(mockDiscoverGroups);
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
    console.log('User tapped Join button for group:', groupId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // TODO: Backend Integration - POST /api/groups/:id/join to join a group
      
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <TouchableOpacity style={styles.notificationButton} onPress={handleNotifications}>
          <IconSymbol 
            ios_icon_name="bell.fill" 
            android_material_icon_name="notifications" 
            size={24} 
            color={colors.text} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* My Groups Section */}
        {myGroups.length > 0 && (
          <React.Fragment>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Groups</Text>
            </View>

            {myGroups.map((group) => {
              const { countStr, membersText } = memberCountText(group.memberCount);
              const roleText = group.role === 'admin' ? 'Admin' : 'Member';
              
              return (
                <TouchableOpacity
                  key={group.id}
                  style={styles.myGroupCard}
                  onPress={() => handleOpenGroupChat(group.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.myGroupIcon}>
                    <IconSymbol
                      ios_icon_name="person.3.fill"
                      android_material_icon_name="group"
                      size={32}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.myGroupContent}>
                    <View style={styles.myGroupHeader}>
                      <Text style={styles.myGroupName}>{group.name}</Text>
                      {group.isPrivate && (
                        <View style={styles.privateBadge}>
                          <IconSymbol
                            ios_icon_name="lock.fill"
                            android_material_icon_name="lock"
                            size={12}
                            color={colors.background}
                          />
                          <Text style={styles.privateBadgeText}>Private</Text>
                        </View>
                      )}
                    </View>

                    {group.description && (
                      <Text style={styles.myGroupDescription} numberOfLines={1}>
                        {group.description}
                      </Text>
                    )}

                    <View style={styles.myGroupFooter}>
                      <View style={styles.memberCountContainer}>
                        <Text style={styles.myGroupMemberCount}>{countStr}</Text>
                        <Text style={styles.myGroupMemberCount}> </Text>
                        <Text style={styles.myGroupMemberCount}>{membersText}</Text>
                      </View>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{roleText}</Text>
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
          </React.Fragment>
        )}

        {/* Discover Groups Section */}
        <View style={styles.discoverHeader}>
          <Text style={styles.discoverTitle}>Discover Groups</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={handleCreatePrivateGroup}
          >
            <IconSymbol 
              ios_icon_name="plus" 
              android_material_icon_name="add" 
              size={18} 
              color={colors.text} 
            />
            <Text style={styles.createButtonText}>Private Group</Text>
          </TouchableOpacity>
        </View>

        {discoverGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateText}>No groups to discover</Text>
            <Text style={styles.emptyStateSubtext}>Check back later for new groups</Text>
          </View>
        ) : (
          <React.Fragment>
            {discoverGroups.map((group) => {
              const { countStr, membersText } = memberCountText(group.memberCount);
              return (
                <View key={group.id} style={styles.groupCard}>
                  <Image 
                    source={{ uri: group.imageUrl }} 
                    style={styles.groupImage}
                  />
                  
                  <View style={styles.groupContent}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupName}>{group.name}</Text>
                      <View style={styles.memberAvatars}>
                        {group.memberAvatars.slice(0, 3).map((avatar, index) => (
                          <Image 
                            key={`${group.id}-avatar-${index}`}
                            source={{ uri: avatar }} 
                            style={[styles.memberAvatar, { marginLeft: index > 0 ? -8 : 0 }]}
                          />
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.memberCountContainer}>
                      <Text style={styles.memberCount}>{countStr}</Text>
                      <Text style={styles.memberCount}> </Text>
                      <Text style={styles.memberCount}>{membersText}</Text>
                    </View>
                    
                    <Text style={styles.groupDescription}>{group.description}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.joinButton}
                    onPress={() => handleJoinGroup(group.id, group.name)}
                  >
                    <IconSymbol 
                      ios_icon_name="plus" 
                      android_material_icon_name="add" 
                      size={16} 
                      color={colors.text} 
                    />
                    <Text style={styles.joinButtonText}>Join</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </React.Fragment>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalMessage}>{errorModalMessage}</Text>
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
            <Text style={styles.modalTitle}>Success</Text>
            <Text style={styles.modalMessage}>{successModalMessage}</Text>
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

const styles = StyleSheet.create({
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
