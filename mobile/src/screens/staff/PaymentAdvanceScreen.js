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
  RefreshControl,
  Platform,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { paymentAdvanceApi } from '../../api';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PaymentAdvanceScreen({ navigation, route }) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [advances, setAdvances] = useState([]);
  const [salaryData, setSalaryData] = useState({ salary: 0, balance: 0, total_advances: 0 });
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
  const [amount, setAmount] = useState('');
  const [neededByDate, setNeededByDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [askForMore, setAskForMore] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());

  const loadData = useCallback(async () => {
    try {
      const [advRes, balRes] = await Promise.all([
        paymentAdvanceApi.list(),
        paymentAdvanceApi.balance()
      ]);
      setAdvances(advRes.data.results || advRes.data);
      setSalaryData(balRes.data);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load advance requests' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateAdvance = async () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Please enter a valid requested amount' });
      return;
    }
    if (amt > salaryData.balance && !askForMore) {
      Toast.show({ type: 'error', text1: 'Amount Exceeds Balance', text2: 'Requested amount exceeds your available balance. Check "Ask for More" to proceed.' });
      return;
    }
    
    // Validate DD/MM/YYYY date
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = neededByDate.match(dateRegex);
    if (!match) {
      Toast.show({ type: 'error', text1: 'Invalid Date Format', text2: 'Please use DD/MM/YYYY format' });
      return;
    }
    const formattedDate = `${match[3]}-${match[2]}-${match[1]}`; // YYYY-MM-DD

    // Reason is now optional

    setSubmitting(true);
    try {
      await paymentAdvanceApi.create({
        amount: amt,
        needed_by_date: formattedDate,
        reason: askForMore ? `[ASK FOR MORE] ${reason.trim()}` : reason.trim(),
      });
      Toast.show({ type: 'success', text1: 'Request Sent', text2: 'Payment advance request sent to HR dashboard' });
      setAmount('');
      setNeededByDate('');
      setReason('');
      setAskForMore(false);
      setModalVisible(false);
      loadData();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to submit advance request' });
    } finally {
      setSubmitting(false);
    }
  };

  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateObj(selectedDate);
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const yyyy = selectedDate.getFullYear();
      setNeededByDate(`${dd}/${mm}/${yyyy}`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#fef3c7', text: '#d97706', label: 'Pending HR Review' };
      case 'APPROVED':
        return { bg: '#dbeafe', text: '#2563eb', label: 'Approved by HR' };
      case 'DISBURSED':
        return { bg: '#dcfce7', text: '#16a34a', label: 'Paid / Disbursed' };
      case 'REJECTED':
        return { bg: '#fee2e2', text: '#dc2626', label: 'Rejected' };
      default:
        return { bg: '#f3f4f6', text: '#6b7280', label: status };
    }
  };

  const renderItem = ({ item }) => {
    const badge = getStatusBadge(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.reqId}>{item.request_id}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>REQUESTED AMOUNT</Text>
          <Text style={styles.amountValue}>₹{parseFloat(item.amount).toLocaleString('en-IN')}</Text>
        </View>

        <View style={styles.dateGrid}>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>DATE NEEDED BY STAFF</Text>
            <Text style={styles.dateVal}>📅 {item.needed_by_date ? item.needed_by_date.split('-').reverse().join('/') : 'Not specified'}</Text>
          </View>

          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>HR SCHEDULED PAYOUT DATE</Text>
            <Text style={[styles.dateVal, item.payout_date ? { color: '#2563eb', fontWeight: '800' } : {}]}>
              📅 {item.payout_date ? item.payout_date.split('-').reverse().join('/') : 'Pending HR Date'}
            </Text>
          </View>
        </View>

        <Text style={styles.reasonText}>Reason: {item.reason}</Text>

        {item.hr_remarks ? (
          <View style={styles.remarksBox}>
            <Text style={styles.remarksHeader}>HR Remarks:</Text>
            <Text style={styles.remarksText}>{item.hr_remarks}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top || Platform.OS === 'ios' ? 40 : 20, paddingBottom: 10 }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Advance</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Salary Overview Card */}
      {!loading && (
        <View style={styles.salaryOverviewCard}>
          <View style={styles.salaryColumn}>
            <Text style={styles.salaryOverviewLabel}>Actual Net Salary / Month</Text>
            <Text style={styles.salaryOverviewVal}>₹{salaryData.salary.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.salaryDivider} />
          <View style={styles.salaryColumn}>
            <Text style={styles.salaryOverviewLabel}>Available Balance</Text>
            <Text style={[styles.salaryOverviewVal, { color: Colors.primary }]}>₹{salaryData.balance.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      )}

      {/* Main Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={advances}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cash-outline" size={60} color={Colors.gray400} />
              <Text style={styles.emptyTitle}>No Salary Advance Requests</Text>
              <Text style={styles.emptySub}>Need salary advance? Tap '+' button above to request amount & set date needed.</Text>
            </View>
          }
        />
      )}

      {/* New Advance Request Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Salary Advance</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={Colors.gray400} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBalanceBox}>
              <Text style={styles.modalBalanceText}>Your Balance: ₹{salaryData.balance.toLocaleString('en-IN')}</Text>
            </View>

            <Text style={styles.inputLabel}>Advance Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g., 5000"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            {parseFloat(amount) > salaryData.balance && (
              <TouchableOpacity style={styles.checkboxContainer} onPress={() => setAskForMore(!askForMore)}>
                <Ionicons name={askForMore ? "checkbox" : "square-outline"} size={22} color={Colors.primary} />
                <Text style={styles.checkboxLabel}>Ask for More (Amount exceeds balance)</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.inputLabel}>Date Needed *</Text>
            <TouchableOpacity 
              style={[styles.input, { justifyContent: 'center' }]} 
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: neededByDate ? '#0f172a' : '#94a3b8' }}>
                {neededByDate || "Select Date from Calendar"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onChangeDate}
              />
            )}

            <Text style={styles.inputLabel}>Reason for Advance *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Explain why you need this salary advance..."
              multiline
              numberOfLines={3}
              value={reason}
              onChangeText={setReason}
            />

            <TouchableOpacity style={styles.submitBtn} disabled={submitting} onPress={handleCreateAdvance}>
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request to HR</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="StaffPaymentAdvance"
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  salaryOverviewCard: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  salaryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  salaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#cbd5e1',
  },
  salaryOverviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  salaryOverviewVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reqId: {
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
  amountBox: {
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#16a34a',
    marginTop: 2,
  },
  dateGrid: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  dateBox: {
    marginBottom: 6,
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },
  dateVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  reasonText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
  },
  remarksBox: {
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  remarksHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0369a1',
  },
  remarksText: {
    fontSize: 12,
    color: '#0f172a',
    marginTop: 2,
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
  modalBalanceBox: {
    backgroundColor: '#e0f2fe',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  modalBalanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0369a1',
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
    height: 70,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
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
});

