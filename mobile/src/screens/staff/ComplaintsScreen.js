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
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { complaintsApi } from '../../api';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ComplaintsScreen({ navigation, route }) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE');
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
  const [submitting, setSubmitting] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openNewModal = () => {
    setSelectedComplaint(null);
    setTitle('');
    setDescription('');
    setCanEdit(true);
    setIsEditing(true);
    setMenuOpen(false);
    setModalVisible(true);
  };

  const openViewModal = (complaint) => {
    setSelectedComplaint(complaint);
    setTitle(complaint.title);
    setDescription(complaint.description);
    setMenuOpen(false);
    setIsEditing(false);

    // Check if within 1 hour (3600000 ms)
    const createdAtTime = new Date(complaint.created_at).getTime();
    const now = Date.now();
    const isWithin1Hr = (now - createdAtTime) < 3600000;
    setCanEdit(isWithin1Hr);
    setModalVisible(true);
  };

  const handleToggleEdit = () => {
    if (!selectedComplaint) return;
    if (!isEditing) {
      setTitle(selectedComplaint.title);
      setDescription(selectedComplaint.description);
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
    setMenuOpen(false);
  };

  const loadComplaints = useCallback(async () => {
    try {
      const res = await complaintsApi.list();
      setComplaints(res.data.results || res.data);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load complaints' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const handleSubmitComplaint = async () => {
    if (!title.trim() || !description.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter title and description' });
      return;
    }
    const safeTitle = title.trim();
    const safeDesc = description.trim();
    setSubmitting(true);
    try {
      if (selectedComplaint) {
        await complaintsApi.update(selectedComplaint.id, { title: safeTitle, description: safeDesc });
        Toast.show({ type: 'success', text1: 'Updated', text2: 'Complaint updated successfully.' });
      } else {
        await complaintsApi.create({ title: safeTitle, description: safeDesc });
        Toast.show({ type: 'success', text1: 'Complaint Raised', text2: 'Your issue has been reported.' });
      }
      setModalVisible(false);
      loadComplaints();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save complaint' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#fef3c7', text: '#d97706', label: 'Pending' };
      case 'IN_PROGRESS':
        return { bg: '#dbeafe', text: '#2563eb', label: 'In Progress' };
      case 'RESOLVED':
        return { bg: '#dcfce7', text: '#16a34a', label: 'Resolved' };
      case 'REJECTED':
        return { bg: '#fee2e2', text: '#dc2626', label: 'Rejected' };
      default:
        return { bg: '#f3f4f6', text: '#6b7280', label: status };
    }
  };

  const filteredComplaints = complaints.filter((item) => {
    if (activeTab === 'RESOLVED') {
      return item.status === 'RESOLVED' || item.status === 'REJECTED';
    }
    return item.status === 'PENDING' || item.status === 'IN_PROGRESS';
  });

  const renderItem = ({ item }) => {
    const badge = getStatusBadge(item.status);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openViewModal(item)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.complaintId}>{item.complaint_id}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            📅 {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top || (Platform.OS === 'ios' ? 40 : 20), paddingBottom: 10 }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaint Desk</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNewModal}>
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Tabs Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ACTIVE' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ACTIVE')}
        >
          <Text style={[styles.tabText, activeTab === 'ACTIVE' && styles.tabTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'RESOLVED' && styles.tabButtonActive]}
          onPress={() => setActiveTab('RESOLVED')}
        >
          <Text style={[styles.tabText, activeTab === 'RESOLVED' && styles.tabTextActive]}>Resolved</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredComplaints}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadComplaints} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={60} color={Colors.gray400} />
              <Text style={styles.emptyTitle}>
                {activeTab === 'RESOLVED' ? 'No Resolved Complaints' : 'No Active Complaints'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'RESOLVED'
                  ? 'Complaints marked as resolved will appear here.'
                  : "Facing any issue? Click '+' above to submit a complaint to HR."}
              </Text>
            </View>
          }
        />
      )}

      {/* Complaint View / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setMenuOpen(false);
            setModalVisible(false);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={() => {
              if (menuOpen) setMenuOpen(false);
            }}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.modalTitle}>
                  {!selectedComplaint ? 'Submit Complaint to HR' : (isEditing ? 'Edit Complaint' : 'View Complaint')}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {selectedComplaint && canEdit && (
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={styles.threeDotBtn}
                      onPress={() => setMenuOpen(!menuOpen)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={22} color="#0f172a" />
                    </TouchableOpacity>

                    {menuOpen && (
                      <View style={styles.dropdownMenu}>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={handleToggleEdit}
                        >
                          <Ionicons
                            name={isEditing ? "eye-outline" : "create-outline"}
                            size={18}
                            color={Colors.primary}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.dropdownItemText}>{isEditing ? 'View Mode' : 'Edit'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close-circle" size={26} color={Colors.gray400} />
                </TouchableOpacity>
              </View>
            </View>

            {isEditing ? (
              <>
                <Text style={styles.inputLabel}>Title / Subject *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="E.g., Payroll discrepancy for current month"
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={styles.inputLabel}>Complaint Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your issue in detail for HR..."
                  multiline
                  numberOfLines={4}
                  value={description}
                  onChangeText={setDescription}
                />

                <TouchableOpacity style={styles.submitBtn} disabled={submitting} onPress={handleSubmitComplaint}>
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>{selectedComplaint ? 'Save Changes' : 'Submit Complaint to HR'}</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : selectedComplaint ? (
              <View style={styles.readDetailsContainer}>
                {/* Status & ID Badge Meta Row */}
                <View style={styles.metaRow}>
                  <View style={styles.metaBadgeGroup}>
                    <Text style={styles.readMetaId}>{selectedComplaint.complaint_id}</Text>
                    {(() => {
                      const badge = getStatusBadge(selectedComplaint.status);
                      return (
                        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      );
                    })()}
                  </View>
                  <Text style={styles.readDateText}>
                    📅 {new Date(selectedComplaint.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>

                {/* Subject / Title */}
                <View style={styles.readSection}>
                  <Text style={styles.readLabel}>TITLE / SUBJECT</Text>
                  <Text style={styles.readTitleText}>{selectedComplaint.title}</Text>
                </View>

                {/* Description Body */}
                <View style={styles.readSection}>
                  <Text style={styles.readLabel}>COMPLAINT DETAILS</Text>
                  <View style={styles.readDescBox}>
                    <Text style={styles.readDescText}>{selectedComplaint.description}</Text>
                  </View>
                </View>

                {!canEdit && (
                  <View style={styles.lockNotice}>
                    <Ionicons name="information-circle-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                    <Text style={styles.lockNoticeText}>
                      Editing is only allowed within 1 hour of submission.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="StaffComplaints"
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
    backgroundColor: Colors.primary,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
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
  complaintId: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
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
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  threeDotBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 100,
    minWidth: 110,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
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
  submitBtn: {
    backgroundColor: Colors.primary,
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
  readDetailsContainer: {
    paddingVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  metaBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readMetaId: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  readDateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  readSection: {
    marginBottom: 14,
  },
  readLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  readTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22,
  },
  readDescBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 80,
  },
  readDescText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  lockNoticeText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
});

