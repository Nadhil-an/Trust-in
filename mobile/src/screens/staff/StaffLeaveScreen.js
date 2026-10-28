import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { leaveApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import Toast from 'react-native-toast-message';
import SideDrawer from '../../components/SideDrawer';

const LEAVE_TYPES = [
  { label: 'Casual Leave', value: 'CASUAL', desc: 'Standard monthly personal leave' },
  { label: 'Sick Leave', value: 'SICK', desc: 'Medical or health recuperation' },
  { label: 'Emergency Leave', value: 'EMERGENCY', desc: 'Urgent unplanned events' },
  { label: 'Earned Leave', value: 'EARNED', desc: 'Annual accumulated leave' },
  { label: 'Unpaid Leave', value: 'UNPAID', desc: 'Leave without pay' },
];

const STATUS_OPTIONS = [
  { label: 'All Requests', value: 'ALL', icon: 'layers-outline', color: '#0284c7', bg: '#E0F2FE' },
  { label: 'Pending Approval', value: 'PENDING', icon: 'time-outline', color: '#B45309', bg: '#FEF3C7' },
  { label: 'Approved Leaves', value: 'APPROVED', icon: 'checkmark-circle-outline', color: '#15803D', bg: '#DCFCE7' },
  { label: 'Rejected Leaves', value: 'REJECTED', icon: 'close-circle-outline', color: '#DC2626', bg: '#FEE2E2' },
];

function CalendarPickerModal({ visible, onClose, selectedDate, onSelectDate, title, minDate }) {
  const parseDate = (dStr) => {
    if (!dStr) return new Date();
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const parsed = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  const initial = parseDate(selectedDate);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (visible && selectedDate) {
      const d = parseDate(selectedDate);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, selectedDate]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.calendarOverlay}>
        <View style={styles.calendarContainer}>
          {/* Header */}
          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.calendarHeaderTitle}>{title || 'Select Date'}</Text>
              <Text style={styles.calendarHeaderSub}>
                {selectedDate ? `Selected: ${selectedDate}` : 'Tap a date on the calendar'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Month Selector Row */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={handlePrev} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.monthNavTitle}>
              {monthNames[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={handleNext} style={styles.monthNavBtn}>
              <Ionicons name="chevron-forward" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Day of Week Labels */}
          <View style={styles.daysHeaderRow}>
            {dayLabels.map((lbl, idx) => (
              <Text
                key={idx}
                style={[
                  styles.dayLabelText,
                  (idx === 0 || idx === 6) && { color: '#EF4444' }
                ]}
              >
                {lbl}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {cells.map((dayNum, idx) => {
              if (dayNum === null) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }
              const mStr = String(viewMonth + 1).padStart(2, '0');
              const dStr = String(dayNum).padStart(2, '0');
              const dateStr = `${viewYear}-${mStr}-${dStr}`;
              const isSelected = selectedDate === dateStr;
              const isToday = todayStr === dateStr;
              const isDisabled = minDate ? dateStr < minDate : false;

              return (
                <TouchableOpacity
                  key={`day-${dayNum}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                    isDisabled && styles.dayCellDisabled,
                  ]}
                  disabled={isDisabled}
                  onPress={() => {
                    onSelectDate(dateStr);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      isSelected && styles.dayCellTextSelected,
                      isToday && !isSelected && styles.dayCellTextToday,
                      isDisabled && styles.dayCellTextDisabled,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Actions */}
          <View style={styles.calendarFooter}>
            <TouchableOpacity
              style={styles.calendarTodayBtn}
              onPress={() => {
                onSelectDate(todayStr);
                onClose();
              }}
            >
              <Text style={styles.calendarTodayBtnText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calendarCloseBtn} onPress={onClose}>
              <Text style={styles.calendarCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function StaffLeaveScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'manager'
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [balanceSummary, setBalanceSummary] = useState(null);
  const [managerLeaves, setManagerLeaves] = useState([]);

  // Apply Modal state
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Dropdown states
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [leaveTypeDropdownOpen, setLeaveTypeDropdownOpen] = useState(false);

  // Calendar Picker state
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('from'); // 'from' | 'to'
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [reapplicationOf, setReapplicationOf] = useState(null);

  // Manager Decision Modal
  const [actionModal, setActionModal] = useState(null); // { leave, action: 'approve' | 'reject' }
  const [rejectionReason, setRejectionReason] = useState('');
  const [acting, setActing] = useState(false);

  // Format today as YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const loadLeaveData = useCallback(async () => {
    try {
      // 1. Load my leaves & balance
      const res = await leaveApi.myLeaves(statusFilter !== 'ALL' ? { status: statusFilter } : {});
      setMyLeaves(res.data.results || []);
      setBalanceSummary(res.data.balance_summary || null);

      // 2. If Manager/Admin, load pending leaves for approval
      if (isManagerOrAdmin) {
        const mgrRes = await leaveApi.allLeaves({ status: 'PENDING' });
        setManagerLeaves(mgrRes.data.results || mgrRes.data || []);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load leave records' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, isManagerOrAdmin]);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  const handleOpenApply = (reapplyTarget = null) => {
    const today = getTodayStr();
    setLeaveType('CASUAL');
    setFromDate(today);
    setToDate(today);
    setReason(reapplyTarget ? `Reapplication: ${reapplyTarget.reason}` : '');
    setDescription('');
    setReapplicationOf(reapplyTarget);
    setLeaveTypeDropdownOpen(false);
    setApplyModalVisible(true);
  };

  const handleDateSelected = (dateStr) => {
    if (pickerTarget === 'from') {
      setFromDate(dateStr);
      if (toDate && dateStr > toDate) {
        setToDate(dateStr);
      }
    } else {
      if (fromDate && dateStr < fromDate) {
        Alert.alert('Invalid Date', 'To Date cannot be earlier than From Date.');
        return;
      }
      setToDate(dateStr);
    }
  };

  // Calculate projected days and advance notice dynamically
  const calculateDaysAndNotice = () => {
    if (!fromDate || !toDate) return { totalDays: 0, noticeDays: 0, exceeds: false };
    try {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const today = new Date(getTodayStr());

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return { totalDays: 0, noticeDays: 0, exceeds: false };
      }

      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = diffDays;

      const noticeDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
      const approvedThisMonth = balanceSummary?.approved_days || 0;
      const exceeds = (approvedThisMonth + totalDays) > 2.0;

      return { totalDays, noticeDays, exceeds };
    } catch {
      return { totalDays: 0, noticeDays: 0, exceeds: false };
    }
  };

  const { totalDays, noticeDays, exceeds } = calculateDaysAndNotice();

  const handleSubmitApplication = async () => {
    if (!fromDate.trim() || !toDate.trim()) {
      return Alert.alert('Validation Error', 'Please enter valid From Date and To Date (YYYY-MM-DD).');
    }
    if (!reason.trim()) {
      return Alert.alert('Validation Error', 'Please provide a reason for your leave.');
    }

    setSubmitting(true);
    try {
      const payload = {
        leave_type: leaveType,
        from_date: fromDate.trim(),
        to_date: toDate.trim(),
        is_half_day: false,
        half_day_session: '',
        reason: reason.trim(),
        description: description.trim(),
        reapplication_of: reapplicationOf ? reapplicationOf.id : undefined,
      };

      await leaveApi.apply(payload);
      Toast.show({
        type: 'success',
        text1: 'Application Submitted',
        text2: 'Your leave application has been submitted for Manager review.',
      });
      setApplyModalVisible(false);
      loadLeaveData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit leave application.';
      Alert.alert('Leave Validation', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelApplication = (leave) => {
    Alert.alert(
      'Cancel Leave Application',
      `Are you sure you want to cancel your leave request for ${leave.from_date}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveApi.cancel(leave.id);
              Toast.show({ type: 'success', text1: 'Cancelled', text2: 'Leave application cancelled.' });
              loadLeaveData();
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Error', text2: err.response?.data?.error || 'Failed to cancel.' });
            }
          },
        },
      ]
    );
  };

  // Manager Approve / Reject
  const handleManagerDecision = async () => {
    if (!actionModal) return;
    const { leave, action } = actionModal;

    if (action === 'reject' && !rejectionReason.trim()) {
      return Alert.alert('Required', 'A rejection reason is mandatory when rejecting a leave request.');
    }

    setActing(true);
    try {
      await leaveApi.action(leave.id, {
        action,
        reason: action === 'reject' ? rejectionReason.trim() : '',
      });
      Toast.show({
        type: 'success',
        text1: action === 'approve' ? 'Leave Approved' : 'Leave Rejected',
        text2: `Application for ${leave.employee_name} has been ${action}d.`,
      });
      setActionModal(null);
      setRejectionReason('');
      loadLeaveData();
    } catch (err) {
      Alert.alert('Action Error', err.response?.data?.error || 'Failed to process decision.');
    } finally {
      setActing(false);
    }
  };

  const renderLeaveCard = ({ item }) => {
    const isApproved = item.status === 'APPROVED';
    const isRejected = item.status === 'REJECTED';
    const isPending = item.status === 'PENDING';
    const isCancelled = item.status === 'CANCELLED';

    const statusBg = isApproved ? '#DCFCE7' : isRejected ? '#FEE2E2' : isPending ? '#FEF3C7' : '#F1F5F9';
    const statusColor = isApproved ? '#15803D' : isRejected ? '#DC2626' : isPending ? '#B45309' : '#64748B';

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{item.leave_type}</Text>
            </View>
            {item.is_half_day && (
              <View style={[styles.typeBadge, { backgroundColor: '#F3E8FF' }]}>
                <Text style={[styles.typeBadgeText, { color: '#7E22CE' }]}>
                  Half Day ({item.half_day_session === 'SECOND_HALF' ? 'Afternoon' : 'Morning'})
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        {/* Manager Review info (if on manager tab) */}
        {activeTab === 'manager' && (
          <View style={styles.staffInfoRow}>
            <Ionicons name="person-circle-outline" size={18} color="#0284c7" />
            <Text style={styles.staffInfoText}>
              Staff: <Text style={{ fontWeight: '700' }}>{item.employee_name}</Text> ({item.staff_uid || item.employee_code})
            </Text>
          </View>
        )}

        {/* Dates & Duration */}
        <View style={styles.datesRow}>
          <Ionicons name="calendar-outline" size={18} color="#64748B" />
          <Text style={styles.datesText}>
            {item.from_date} {item.from_date !== item.to_date ? `to ${item.to_date}` : ''}
          </Text>
          <Text style={styles.durationBadge}>({item.total_days || item.number_of_days} Day)</Text>
        </View>

        {/* Reason */}
        <View style={styles.reasonRow}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>

        {Boolean(item.description) && (
          <Text style={styles.descriptionText} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Exceeds Quota Notice */}
        {item.exceeds_monthly_limit && (
          <View style={styles.quotaNoticeBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
            <Text style={styles.quotaNoticeText}>
              Exceeds 2-day limit ({item.notice_days} days advance notice provided)
            </Text>
          </View>
        )}

        {/* Decision Result */}
        {isApproved && (
          <View style={styles.decisionApprovedBox}>
            <Ionicons name="checkmark-circle" size={16} color="#15803D" />
            <Text style={styles.decisionApprovedText}>
              Approved by Manager ({item.approved_by_name || 'Management'})
            </Text>
          </View>
        )}

        {isRejected && (
          <View style={styles.decisionRejectedBox}>
            <Ionicons name="close-circle" size={16} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.decisionRejectedTitle}>Rejected by Manager:</Text>
              <Text style={styles.decisionRejectedReason}>{item.rejection_reason || 'No reason specified'}</Text>
            </View>
          </View>
        )}

        {/* HR Communications (Visible to Staff) */}
        {item.hr_communications && item.hr_communications.length > 0 && (
          <View style={styles.commBox}>
            <Ionicons name="mail-outline" size={15} color="#0284c7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.commTitle}>Message from HR:</Text>
              <Text style={styles.commText}>{item.hr_communications[item.hr_communications.length - 1].message}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.cardActionsRow}>
          {isPending && activeTab === 'my' && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancelApplication(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
              <Text style={styles.cancelBtnText}>Cancel Request</Text>
            </TouchableOpacity>
          )}

          {isRejected && activeTab === 'my' && (
            <TouchableOpacity
              style={styles.reapplyBtn}
              onPress={() => handleOpenApply(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="repeat-outline" size={16} color="#0284c7" />
              <Text style={styles.reapplyBtnText}>Reapply for Different Dates</Text>
            </TouchableOpacity>
          )}

          {/* Manager Action Buttons on Manager Tab */}
          {activeTab === 'manager' && isPending && (
            <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.mgrDecisionBtn, { backgroundColor: '#16A34A', flex: 1 }]}
                onPress={() => setActionModal({ leave: item, action: 'approve' })}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" />
                <Text style={styles.mgrDecisionBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mgrDecisionBtn, { backgroundColor: '#DC2626', flex: 1 }]}
                onPress={() => {
                  setActionModal({ leave: item, action: 'reject' });
                  setRejectionReason('');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="close-outline" size={18} color="#FFFFFF" />
                <Text style={styles.mgrDecisionBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const dataList = activeTab === 'manager' ? managerLeaves : myLeaves;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : setDrawerVisible(true))}
        >
          <Ionicons
            name={navigation.canGoBack() ? 'arrow-back-outline' : 'menu-outline'}
            size={24}
            color="#0F172A"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Management</Text>
        <TouchableOpacity
          style={styles.applyTopBtn}
          onPress={() => handleOpenApply()}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.applyTopBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      {/* ── Monthly Allowance Card ──────────────────────────────────── */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceTopRow}>
          <View>
            <Text style={styles.balanceSubTitle}>MONTHLY ALLOWANCE</Text>
            <Text style={styles.balanceMainText}>
              {balanceSummary?.approved_days ?? 0.0} / 2.0{' '}
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#64748B' }}>Days Approved</Text>
            </Text>
          </View>
          <View style={styles.balanceRightBox}>
            <Text style={styles.remainingVal}>{balanceSummary?.remaining_standard_days ?? 2.0}</Text>
            <Text style={styles.remainingLabel}>Remaining</Text>
          </View>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.policyRow}>
          <Ionicons name="information-circle-outline" size={16} color="#0284c7" />
          <Text style={styles.policyText}>
            Max 2 approved days per month. Additional days require 15 days advance notice.
          </Text>
        </View>
      </View>

      {/* ── Manager / My Tab Bar (if user is Manager) ───────────────── */}
      {isManagerOrAdmin && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'my' && styles.tabItemActive]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabItemText, activeTab === 'my' && styles.tabItemTextActive]}>
              My Applications
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'manager' && styles.tabItemActive]}
            onPress={() => setActiveTab('manager')}
          >
            <Text style={[styles.tabItemText, activeTab === 'manager' && styles.tabItemTextActive]}>
              Manager Approvals ({managerLeaves.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Status Filter Dropdown List ──────────────────────────────────────── */}
      {activeTab === 'my' && (
        <View style={styles.statusDropdownSection}>
          <TouchableOpacity
            style={styles.statusDropdownBtn}
            activeOpacity={0.8}
            onPress={() => setStatusDropdownOpen(!statusDropdownOpen)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={STATUS_OPTIONS.find(o => o.value === statusFilter)?.icon || 'layers-outline'}
                size={18}
                color={STATUS_OPTIONS.find(o => o.value === statusFilter)?.color || '#0284c7'}
              />
              <Text style={styles.statusDropdownSelectedText}>
                {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label || 'All Requests'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={[
                  styles.statusMiniBadge,
                  { backgroundColor: STATUS_OPTIONS.find(o => o.value === statusFilter)?.bg || '#E0F2FE' },
                ]}
              >
                <Text
                  style={[
                    styles.statusMiniBadgeText,
                    { color: STATUS_OPTIONS.find(o => o.value === statusFilter)?.color || '#0284c7' },
                  ]}
                >
                  {statusFilter}
                </Text>
              </View>
              <Ionicons
                name={statusDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#64748B"
              />
            </View>
          </TouchableOpacity>

          {statusDropdownOpen && (
            <View style={styles.statusDropdownMenu}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = statusFilter === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusDropdownItem,
                      isSelected && styles.statusDropdownItemActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => {
                      setStatusFilter(opt.value);
                      setStatusDropdownOpen(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={opt.icon} size={18} color={opt.color} />
                      <Text
                        style={[
                          styles.statusDropdownItemText,
                          isSelected && { fontWeight: '800', color: opt.color },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
                    ) : (
                      <View style={[styles.statusMiniBadge, { backgroundColor: opt.bg }]}>
                        <Text style={[styles.statusMiniBadgeText, { color: opt.color }]}>
                          {opt.value}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── List Content ────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Loading leave records...</Text>
        </View>
      ) : (
        <FlatList
          data={dataList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLeaveCard}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, paddingTop: 6 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadLeaveData();
              }}
              colors={['#0284c7']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>
                {activeTab === 'manager' ? 'No Pending Approvals' : 'No Leave Applications'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'manager'
                  ? 'All staff leave requests have been reviewed.'
                  : 'Tap "+ Apply" to submit a new leave application.'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Apply / Reapply Leave Modal ──────────────────────────────── */}
      <Modal visible={applyModalVisible} animationType="slide" transparent onRequestClose={() => setApplyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {reapplicationOf ? 'Reapply for Leave' : 'Leave Application'}
                </Text>
                <Text style={styles.modalSub}>
                  {reapplicationOf ? 'Submit for new dates after rejection' : 'Request leave from management'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setApplyModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Leave Type Dropdown Model */}
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.inputLabel}>Leave Type *</Text>
                <TouchableOpacity
                  style={styles.leaveTypeDropdownBtn}
                  activeOpacity={0.8}
                  onPress={() => setLeaveTypeDropdownOpen(!leaveTypeDropdownOpen)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="briefcase-outline" size={18} color="#0284c7" />
                    <Text style={styles.leaveTypeSelectedText}>
                      {LEAVE_TYPES.find((t) => t.value === leaveType)?.label || 'Select Leave Type'}
                    </Text>
                  </View>
                  <Ionicons
                    name={leaveTypeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {leaveTypeDropdownOpen && (
                  <View style={styles.leaveTypeDropdownMenu}>
                    {LEAVE_TYPES.map((t) => {
                      const isSelected = leaveType === t.value;
                      return (
                        <TouchableOpacity
                          key={t.value}
                          style={[
                            styles.leaveTypeDropdownItem,
                            isSelected && styles.leaveTypeDropdownItemActive,
                          ]}
                          activeOpacity={0.75}
                          onPress={() => {
                            setLeaveType(t.value);
                            setLeaveTypeDropdownOpen(false);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.leaveTypeItemTitle,
                                isSelected && styles.leaveTypeItemTitleActive,
                              ]}
                            >
                              {t.label}
                            </Text>
                            {t.desc ? (
                              <Text style={styles.leaveTypeItemDesc}>{t.desc}</Text>
                            ) : null}
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Dates Row with Calendar Date Picker */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>From Date *</Text>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPickerTarget('from');
                      setCalendarModalVisible(true);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="calendar-outline" size={18} color="#0284c7" />
                      <Text style={styles.datePickerBtnText}>{fromDate || 'Select Date'}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>To Date *</Text>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPickerTarget('to');
                      setCalendarModalVisible(true);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="calendar-outline" size={18} color="#0284c7" />
                      <Text style={styles.datePickerBtnText}>{toDate || 'Select Date'}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dynamic Quota & Notice Calculation Box */}
              {totalDays > 0 && (
                <View style={[styles.calcBox, exceeds ? styles.calcBoxWarning : styles.calcBoxSuccess]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={exceeds ? 'alert-circle' : 'checkmark-circle'}
                      size={18}
                      color={exceeds ? '#B45309' : '#15803D'}
                    />
                    <Text style={[styles.calcTitle, { color: exceeds ? '#B45309' : '#15803D' }]}>
                      Total: {totalDays} Day(s) • Notice: {noticeDays} Day(s)
                    </Text>
                  </View>
                  <Text style={[styles.calcSub, { color: exceeds ? '#92400E' : '#166534' }]}>
                    {exceeds
                      ? noticeDays >= 15
                        ? `✓ 15-day advance notice requirement satisfied (${noticeDays} days notice provided).`
                        : `⚠️ Exceeds 2-day limit: Requires 15 days advance notice (only ${noticeDays} days provided). Application may be rejected.`
                      : '✓ Within the standard 2-day monthly allowance.'}
                  </Text>
                </View>
              )}

              {/* Reason Input */}
              <Text style={styles.inputLabel}>Reason *</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Medical appointment, family function"
                placeholderTextColor="#94A3B8"
              />

              {/* Detailed Description */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Detailed Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add any specific context for your manager..."
                placeholderTextColor="#94A3B8"
                multiline
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitApplyBtn}
                onPress={handleSubmitApplication}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitApplyBtnText}>Submit Leave Application</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Manager Decision Modal ───────────────────────────────────── */}
      {actionModal && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setActionModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.decisionModalCard}>
              <Text style={styles.decisionModalTitle}>
                {actionModal.action === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </Text>
              <Text style={styles.decisionModalSub}>
                Staff: <Text style={{ fontWeight: '700' }}>{actionModal.leave.employee_name}</Text>
                {'\n'}Dates: {actionModal.leave.from_date} to {actionModal.leave.to_date} ({actionModal.leave.total_days} Day(s))
              </Text>

              {actionModal.action === 'approve' && (
                <View style={styles.approveNoticeBox}>
                  <Text style={styles.approveNoticeText}>
                    Approving will automatically mark attendance as LEAVE for the requested dates and notify the staff member immediately.
                  </Text>
                </View>
              )}

              {actionModal.action === 'reject' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.inputLabel}>Rejection Reason *</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder="Enter reason for rejection (required)..."
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { flex: 1, justifyContent: 'center' }]}
                  onPress={() => setActionModal(null)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.mgrDecisionBtn,
                    {
                      backgroundColor: actionModal.action === 'approve' ? '#16A34A' : '#DC2626',
                      flex: 1,
                      justifyContent: 'center',
                    },
                  ]}
                  onPress={handleManagerDecision}
                  disabled={acting}
                >
                  {acting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.mgrDecisionBtnText}>
                      {actionModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* SideDrawer */}
      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        currentRoute="StaffLeave"
      />

      {/* Calendar Date Picker Modal */}
      <CalendarPickerModal
        visible={calendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        selectedDate={pickerTarget === 'from' ? fromDate : toDate}
        minDate={pickerTarget === 'to' ? fromDate : undefined}
        title={pickerTarget === 'from' ? 'Select From Date' : 'Select To Date'}
        onSelectDate={handleDateSelected}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerIconBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  applyTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  applyTopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceSubTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  balanceMainText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0284c7',
    marginTop: 2,
  },
  balanceRightBox: {
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  remainingVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0369A1',
  },
  remainingLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0284c7',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  policyText: {
    fontSize: 11.5,
    color: '#475569',
    flex: 1,
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#0284c7',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284c7',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  typeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  staffInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  staffInfoText: {
    fontSize: 13,
    color: '#334155',
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  datesText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  durationBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  reasonText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    flex: 1,
  },
  descriptionText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  quotaNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  quotaNoticeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  decisionApprovedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  decisionApprovedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  decisionRejectedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  decisionRejectedTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#991B1B',
  },
  decisionRejectedReason: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 1,
  },
  commBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  commTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  commText: {
    fontSize: 12,
    color: '#0F172A',
    marginTop: 1,
  },
  cardActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  reapplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
  },
  reapplyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  mgrDecisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  mgrDecisionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 7,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  typeSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  typeSelectPillActive: {
    backgroundColor: '#0284c7',
  },
  typeSelectPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  typeSelectPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  halfDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  halfDayToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  sessionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  sessionBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  sessionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  sessionBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calcBox: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
  },
  calcBoxSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  calcBoxWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  calcTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  calcSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  submitApplyBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  submitApplyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  decisionModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 'auto',
    marginTop: 'auto',
    padding: 22,
  },
  decisionModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  decisionModalSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  approveNoticeBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
  },
  approveNoticeText: {
    fontSize: 12.5,
    color: '#166534',
    lineHeight: 18,
  },

  /* ── Status Dropdown Styles ──────────────── */
  statusDropdownSection: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    position: 'relative',
    zIndex: 100,
  },
  statusDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusDropdownSelectedText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusMiniBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  statusMiniBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusDropdownMenu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  statusDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  statusDropdownItemActive: {
    backgroundColor: '#F0F9FF',
  },
  statusDropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },

  /* ── Leave Type Dropdown Model ──────────────── */
  leaveTypeDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  leaveTypeSelectedText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  leaveTypeDropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 6,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  leaveTypeDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  leaveTypeDropdownItemActive: {
    backgroundColor: '#F0F9FF',
  },
  leaveTypeItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  leaveTypeItemTitleActive: {
    fontWeight: '800',
    color: '#0284c7',
  },
  leaveTypeItemDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },

  /* ── Date Picker Button ──────────────── */
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  datePickerBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* ── Calendar Modal Styles ──────────────── */
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  calendarHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  calendarHeaderSub: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 2,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  monthNavBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  monthNavTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayLabelText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 20,
  },
  dayCellSelected: {
    backgroundColor: '#0284c7',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayCellTextToday: {
    color: '#0284c7',
    fontWeight: '800',
  },
  dayCellTextDisabled: {
    color: '#94A3B8',
  },
  calendarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calendarTodayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
  },
  calendarTodayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  calendarCloseBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  calendarCloseBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});
