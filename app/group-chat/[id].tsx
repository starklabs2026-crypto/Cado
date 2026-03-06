
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

interface Message {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  isAdmin: boolean;
}

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [messageText, setMessageText] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [inviteLinkModalVisible, setInviteLinkModalVisible] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadChatData();
    }
  }, [id]);

  const loadChatData = useCallback(async () => {
    if (!id) return;

    console.log('[GroupChat] Loading chat data for group:', id);
    try {
      setLoading(true);

      // Fetch group info and messages in parallel
      const [groupData, messagesData] = await Promise.all([
        authenticatedGet<{
          id: string;
          name: string;
          description: string | null;
          isPrivate: boolean;
          members: { userId: string; role: string; joinedAt: string }[];
          createdAt: string;
        }>(`/api/groups/${id}`),
        authenticatedGet<Message[]>(`/api/groups/${id}/messages`),
      ]);

      console.log('[GroupChat] Loaded group info:', groupData.name, 'messages:', messagesData.length);

      // Check if current user is admin
      const currentUserMember = groupData.members?.find((m) => m.userId === user?.id);
      const isUserAdmin = currentUserMember?.role === 'admin';

      setGroupInfo({
        id: groupData.id,
        name: groupData.name,
        description: groupData.description,
        memberCount: groupData.members?.length ?? 0,
        isAdmin: isUserAdmin,
      });
      setMessages(messagesData || []);
    } catch (error: any) {
      console.error('[GroupChat] Error loading chat data:', error);
      setErrorModalMessage(error.message || 'Failed to load chat');
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !id) return;

    console.log('User tapped Send button - sending message:', messageText);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const messageToSend = messageText.trim();
    setMessageText('');

    try {
      setSending(true);
      console.log('[GroupChat] Sending message to group:', id);
      const newMessage = await authenticatedPost<Message>(
        `/api/groups/${id}/messages`,
        { content: messageToSend }
      );
      console.log('[GroupChat] Message sent successfully:', newMessage.id);

      setMessages((prev) => [...prev, newMessage]);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setErrorModalMessage(error.message || 'Failed to send message');
      setErrorModalVisible(true);
      setMessageText(messageToSend);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    if (!id) return;

    console.log('Admin tapped Add Member button - generating invite link');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      setGeneratingLink(true);
      setLinkCopied(false);
      console.log('[GroupChat] Generating invite link for group:', id);

      console.log('[GroupChat] Calling POST /api/groups/:id/generate-invite-link');
      const response = await authenticatedPost<{ inviteLink: string; inviteToken: string }>(
        `/api/groups/${id}/generate-invite-link`,
        {}
      );

      console.log('[GroupChat] Invite link generated:', response.inviteLink, 'token:', response.inviteToken);
      // Use the inviteLink from the backend (format: calo://group-invite/{token})
      setInviteLink(response.inviteLink);
      setInviteLinkModalVisible(true);
    } catch (error: any) {
      console.error('Error generating invite link:', error);
      setErrorModalMessage(error.message || 'Failed to generate invite link');
      setErrorModalVisible(true);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyInviteLink = async () => {
    console.log('User tapped Copy Link button');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await Clipboard.setString(inviteLink);
      setLinkCopied(true);
      console.log('[GroupChat] Invite link copied to clipboard');

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setLinkCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const formatTime = (dateString: string) => {
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
      const minsText = diffMins === 1 ? 'min' : 'mins';
      return `${diffMins} ${minsText} ago`;
    }
    if (diffHours < 24) {
      const hoursText = diffHours === 1 ? 'hour' : 'hours';
      return `${diffHours} ${hoursText} ago`;
    }
    if (diffDays < 7) {
      const daysText = diffDays === 1 ? 'day' : 'days';
      return `${daysText} ago`;
    }
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Loading...',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const groupName = groupInfo?.name || 'Group Chat';
  const memberCountText = groupInfo ? `${groupInfo.memberCount} members` : '';
  const isAdmin = groupInfo?.isAdmin ?? false;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: groupName,
          headerBackTitle: 'Groups',
          headerRight: isAdmin
            ? () => (
                <TouchableOpacity
                  onPress={handleGenerateInviteLink}
                  disabled={generatingLink}
                  style={styles.headerButton}
                >
                  {generatingLink ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <IconSymbol
                      ios_icon_name="person.badge.plus"
                      android_material_icon_name="person-add"
                      size={24}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.memberCountBanner}>
          <Text style={styles.memberCountText}>{memberCountText}</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="message"
                android_material_icon_name="chat"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>No messages yet</Text>
              <Text style={styles.emptyStateSubtext}>Be the first to send a message!</Text>
            </View>
          ) : (
            messages.map((message) => {
              const isCurrentUser = user ? message.userId === user.id : false;
              const timeText = formatTime(message.createdAt);

              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    isCurrentUser ? styles.messageRowRight : styles.messageRowLeft,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
                    ]}
                  >
                    {!isCurrentUser && (
                      <Text style={styles.messageSender}>{message.userName}</Text>
                    )}
                    <Text
                      style={[
                        styles.messageText,
                        isCurrentUser ? styles.messageTextRight : styles.messageTextLeft,
                      ]}
                    >
                      {message.content}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isCurrentUser ? styles.messageTimeRight : styles.messageTimeLeft,
                      ]}
                    >
                      {timeText}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <IconSymbol
                ios_icon_name="arrow.up"
                android_material_icon_name="send"
                size={20}
                color={colors.background}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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

      <Modal
        visible={inviteLinkModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteLinkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inviteLinkModalContent}>
            <View style={styles.inviteLinkHeader}>
              <Text style={styles.inviteLinkTitle}>Invite Link</Text>
              <TouchableOpacity
                onPress={() => {
                  setInviteLinkModalVisible(false);
                  setLinkCopied(false);
                }}
                style={styles.closeButton}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.inviteLinkDescription}>
              Share this link with anyone to let them join this group. Anyone with the link can join.
            </Text>

            <View style={styles.linkContainer}>
              <Text style={styles.linkText} numberOfLines={2}>
                {inviteLink}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.copyButton, linkCopied && styles.copyButtonSuccess]}
              onPress={handleCopyInviteLink}
            >
              <IconSymbol
                ios_icon_name={linkCopied ? 'checkmark' : 'doc.on.doc'}
                android_material_icon_name={linkCopied ? 'check' : 'content-copy'}
                size={20}
                color={colors.background}
              />
              <Text style={styles.copyButtonText}>
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </Text>
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
  headerButton: {
    marginRight: 16,
    padding: 4,
  },
  keyboardAvoid: {
    flex: 1,
  },
  memberCountBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  memberCountText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleLeft: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextLeft: {
    color: colors.text,
  },
  messageTextRight: {
    color: colors.background,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeLeft: {
    color: colors.textSecondary,
  },
  messageTimeRight: {
    color: colors.background,
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
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
  inviteLinkModalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  inviteLinkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteLinkTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  inviteLinkDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  linkContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  copyButtonSuccess: {
    backgroundColor: '#4CAF50',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
