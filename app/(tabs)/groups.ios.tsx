
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  imageUrl: string;
  memberAvatars: string[];
}

export default function GroupsScreen() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = () => {
    console.log('Loading groups...');
    // Mock data for now - will be replaced with API call
    setTimeout(() => {
      const mockGroups: Group[] = [
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
      setGroups(mockGroups);
      setLoading(false);
    }, 500);
  };

  const handleJoinGroup = (groupId: string) => {
    console.log('User tapped Join button for group:', groupId);
    // TODO: Backend Integration - POST /api/groups/:id/join to join a group
  };

  const handleCreatePrivateGroup = () => {
    console.log('User tapped Create Private Group button');
    // TODO: Backend Integration - Navigate to create group screen
  };

  const memberCountText = (count: number) => {
    const countStr = count.toString();
    const membersText = 'members';
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
        <TouchableOpacity style={styles.notificationButton}>
          <IconSymbol 
            ios_icon_name="bell.fill" 
            android_material_icon_name="notifications" 
            size={24} 
            color={colors.text} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

        {groups.map((group) => {
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
                        key={index}
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
                onPress={() => handleJoinGroup(group.id)}
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

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  discoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
});
