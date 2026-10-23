import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { memberPostsApi } from '../../api';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';

export default function CommentsModal({ visible, postId, onClose, onCommentAdded }) {
  const navigation = useNavigation();
  const { isAuthenticated } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && postId) {
      loadComments();
    } else {
      setComments([]);
      setText('');
    }
  }, [visible, postId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await memberPostsApi.getComments(postId);
      setComments(res.data || []);
    } catch (_) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load comments' });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!isAuthenticated) {
      onClose();
      navigation.navigate('Auth');
      return;
    }
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await memberPostsApi.addComment(postId, text.trim());
      setComments((prev) => [...prev, res.data]);
      setText('');
      if (onCommentAdded) onCommentAdded();
    } catch (_) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to post comment' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={styles.sheetContainer}>
          {/* Header Handle */}
          <View style={styles.handleBar} />
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color="#0284c7" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>No comments yet. Start the conversation!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  {item.author?.photo ? (
                    <Image source={{ uri: item.author.photo }} style={styles.commentAvatar} />
                  ) : (
                    <View style={styles.commentAvatarPlaceholder}>
                      <Text style={styles.commentAvatarText}>
                        {(item.author?.full_name || item.author?.username || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.commentBubble}>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentAuthor}>{item.author?.full_name || item.author?.username}</Text>
                      <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
                    </View>
                    <Text style={styles.commentBody}>{item.text}</Text>
                  </View>
                </View>
              )}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            />
          )}

          {/* Sticky Input Bar (or Guest Sign-in CTA) */}
          {isAuthenticated ? (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                placeholder="Add a comment..."
                placeholderTextColor="#94A3B8"
                value={text}
                onChangeText={setText}
                multiline={false}
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.guestCommentBar}
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                navigation.navigate('Auth');
              }}
            >
              <Ionicons name="log-in-outline" size={18} color="#0284c7" />
              <Text style={styles.guestCommentText}>Log in to join the conversation</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: '40%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  loaderWrap: {
    flex: 1,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  commentTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  commentBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCommentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 14 : 8,
    marginTop: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  guestCommentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
});
