import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Platform,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { staffReportsApi } from '../../api';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StaffReportsScreen({ navigation, route }) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Root');
    }
  };

  // Hardware Back Press -> Return controlled based on origin (Dashboard vs SideDrawer)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, route?.params?.fromDashboard])
  );

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isEditable, setIsEditable] = useState(false);

  const openNewModal = () => {
    setSelectedReport(null);
    setTitle('');
    setDescription('');
    setAttachment(null);
    setIsEditable(true);
    setModalVisible(true);
  };

  const openEditModal = (report) => {
    setSelectedReport(report);
    setTitle(report.title);
    setDescription(report.description);
    setAttachment(report.file ? { name: 'Existing File attached (Upload new to replace)' } : null);
    
    // Check if within 1 hour (3600000 ms)
    const createdAtTime = new Date(report.created_at || report.report_date).getTime();
    const now = Date.now();
    setIsEditable((now - createdAtTime) < 3600000);
    
    setModalVisible(true);
  };

  const loadReports = useCallback(async () => {
    try {
      const res = await staffReportsApi.list();
      setReports(res.data.results || res.data);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load reports' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.type === 'success' || !result.canceled) {
        const file = result.assets ? result.assets[0] : result;
        // Validation: Ensure file is not too large (e.g. 10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          Toast.show({ type: 'error', text1: 'File Too Large', text2: 'Please upload a file smaller than 10MB' });
          return;
        }
        setAttachment(file);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not pick file' });
    }
  };

  const handleSubmitReport = async () => {
    if (!title.trim() || !description.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter report title and description' });
      return;
    }
    // Sanitization: simple trim for strings
    const safeTitle = title.trim();
    const safeDescription = description.trim();

    setSubmitting(true);
    try {
      if (selectedReport) {
        await staffReportsApi.update(selectedReport.id, {
          title: safeTitle,
          description: safeDescription,
          file: attachment && attachment.uri ? attachment : undefined, // Only pass if it's a newly uploaded file
        });
        Toast.show({ type: 'success', text1: 'Updated', text2: 'Report updated successfully' });
      } else {
        await staffReportsApi.submit({
          title: safeTitle,
          description: safeDescription,
          file: attachment,
        });
        Toast.show({ type: 'success', text1: 'Report Submitted', text2: 'Submitted to administration for review' });
      }
      setModalVisible(false);
      loadReports();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save report' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#fef3c7', text: '#d97706', label: 'Pending' };
      case 'UNDER_REVIEW':
        return { bg: '#dbeafe', text: '#2563eb', label: 'Under Review' };
      case 'APPROVED':
        return { bg: '#dcfce7', text: '#16a34a', label: 'Approved' };
      case 'REJECTED':
        return { bg: '#fee2e2', text: '#dc2626', label: 'Rejected' };
      default:
        return { bg: '#f3f4f6', text: '#6b7280', label: status };
    }
  };

  const renderItem = ({ item }) => {
    const badge = getStatusBadge(item.status);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openEditModal(item)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.reportId}>{item.report_id}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc}>{item.description}</Text>

        {item.file ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="document-attach" size={16} color={'#1A74EE'} />
            <Text style={{ marginLeft: 6, fontSize: 12, color: '#1A74EE' }}>Attachment Included</Text>
          </View>
        ) : null}

        {item.admin_notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesHeader}>HR / Admin Feedback:</Text>
            <Text style={styles.notesText}>{item.admin_notes}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            📅 {new Date(item.created_at || item.report_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top || Platform.OS === 'ios' ? 40 : 20, paddingBottom: 10 }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Reports</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNewModal}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={'#1A74EE'} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadReports} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={60} color={Colors.gray400} />
              <Text style={styles.emptyTitle}>No Reports Submitted</Text>
              <Text style={styles.emptySub}>Submit requested reports to administration by clicking + icon above.</Text>
            </View>
          }
        />
      )}

      {/* Submit Report Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedReport ? (isEditable ? 'Edit Report' : 'View Report') : 'Submit Administration Report'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={Colors.gray400} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Report Title *</Text>
            <TextInput
              style={[styles.input, !isEditable && { backgroundColor: '#f1f5f9', color: '#64748b' }]}
              placeholder="E.g., Monthly Field Assessment Summary"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              editable={isEditable}
            />

            <Text style={styles.inputLabel}>Report Details & Summary *</Text>
            <TextInput
              style={[styles.input, styles.textArea, !isEditable && { backgroundColor: '#f1f5f9', color: '#64748b' }]}
              placeholder="Enter key details or report findings..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              editable={isEditable}
            />

            <Text style={styles.inputLabel}>Attachment (Optional)</Text>
            <TouchableOpacity style={[styles.uploadBtn, !isEditable && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]} onPress={isEditable ? handlePickFile : null}>
              <Ionicons name="cloud-upload-outline" size={20} color={isEditable ? '#1A74EE' : Colors.gray400} />
              <Text style={[styles.uploadBtnText, !isEditable && { color: Colors.gray400 }]}>
                {attachment ? attachment.name : 'Upload File or Image'}
              </Text>
            </TouchableOpacity>

            {isEditable ? (
              <TouchableOpacity style={styles.submitBtn} disabled={submitting} onPress={handleSubmitReport}>
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>{selectedReport ? 'Save Changes' : 'Submit Report'}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: 20, alignItems: 'center' }}>
                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                  Editing is only allowed within 1 hour of submission.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="StaffReports"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    minHeight: 60,
    backgroundColor: '#1A74EE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
  },
  menuBtn: {
    padding: 6,
  },
  addBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportId: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A74EE',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  notesBox: {
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1A74EE',
    marginBottom: 10,
  },
  notesHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369a1',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 12,
    color: '#0f172a',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  uploadBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A74EE',
    marginLeft: 8,
  },
  submitBtn: {
    backgroundColor: '#1A74EE',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

