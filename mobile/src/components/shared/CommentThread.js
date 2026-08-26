// components/shared/CommentThread.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { assessmentApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

const CommentThread = ({ assessmentId, onNewComment }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => { fetchComments(); }, [assessmentId]);

  const fetchComments = async () => {
    try {
      const res = await assessmentApi.getComments(assessmentId);
      setComments(res.data.results || res.data || []);
    } catch (_) {} finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await assessmentApi.addComment(assessmentId, text.trim());
      setComments(prev => [...prev, res.data]);
      setText('');
      onNewComment && onNewComment(res.data);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (_) {} finally { setSending(false); }
  };

  const renderComment = ({ item }) => {
    const isMe = item.user?.id === user?.id || item.user?.username === user?.username;
    return (
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
        {!isMe && (
          <Text style={styles.author}>{item.user?.full_name || item.user?.username}</Text>
        )}
        <Text style={[styles.text, isMe && styles.myText]}>{item.text}</Text>
        <Text style={[styles.time, isMe && styles.myTime]}>
          {item.created_at ? format(new Date(item.created_at), 'dd MMM, HH:mm') : ''}
        </Text>
      </View>
    );
  };

  if (loading) return <ActivityIndicator size="small" color={Colors.primary} style={{ margin: 16 }} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <FlatList
        ref={listRef}
        data={comments}
        keyExtractor={(item, i) => String(item.id || i)}
        renderItem={renderComment}
        contentContainerStyle={styles.list}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={styles.empty}>No comments yet. Be the first to add one.</Text>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t('common.add_comment')}
          placeholderTextColor={Colors.gray400}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Ionicons name="send" size={18} color={Colors.white} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  bubble: {
    maxWidth: '80%', borderRadius: 14,
    padding: 10, marginBottom: 4,
  },
  myBubble: { backgroundColor: Colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: Colors.gray100, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  author: { fontSize: 11, color: Colors.gray500, fontWeight: '600', marginBottom: 3 },
  text: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  myText: { color: Colors.white },
  time: { fontSize: 10, color: Colors.gray400, marginTop: 4, alignSelf: 'flex-end' },
  myTime: { color: 'rgba(255,255,255,0.7)' },
  empty: { textAlign: 'center', color: Colors.gray400, fontSize: 13, marginTop: 24 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, borderTopWidth: 1, borderTopColor: Colors.gray200,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.gray200,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, maxHeight: 100, color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
});

export default CommentThread;
