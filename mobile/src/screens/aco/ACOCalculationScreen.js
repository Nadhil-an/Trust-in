// screens/aco/ACOCalculationScreen.js — Cost estimation with inventory
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors } from '../../constants/Colors';
import { Button, Input, Card, Badge } from '../../components/shared';
import { LineItemTable } from '../../components/shared';
import { acoApi, inventoryApi, assessmentApi } from '../../api';

// ── Collapsible Section (re-used pattern) ─────────────────────────
const Section = ({ title, icon, color = Colors.orange, children, filled }) => {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <View style={[styles.sectionIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {filled && <Ionicons name="checkmark-circle" size={20} color={Colors.success} style={{ marginLeft: 'auto', marginRight: 4 }} />}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray400} />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
};

// ── Inventory Modal ────────────────────────────────────────────────
const InventoryModal = ({ visible, onClose, items }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>📦 Charity Inventory</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={Colors.gray600} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <View style={styles.invRow}>
              <View style={styles.invLeft}>
                <Text style={styles.invName}>{item.item_name}</Text>
                <Text style={styles.invCat}>{item.category}</Text>
              </View>
              <View style={styles.invRight}>
                <Text style={styles.invQty}>{item.quantity_available}</Text>
                <Text style={styles.invUnit}>{item.unit}</Text>
              </View>
              <View style={[
                styles.invStock,
                item.quantity_available === 0 && { backgroundColor: Colors.errorLight }
              ]}>
                <Text style={[styles.invStockText, item.quantity_available === 0 && { color: Colors.error }]}>
                  {item.quantity_available > 0 ? 'IN STOCK' : 'OUT'}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.invEmpty}>
              <Ionicons name="archive-outline" size={36} color={Colors.gray300} />
              <Text style={styles.invEmptyText}>No inventory items found</Text>
            </View>
          }
        />
      </View>
    </View>
  </Modal>
);

// ── FAO Summary Panel ──────────────────────────────────────────────
const FAOSummaryPanel = ({ report }) => {
  if (!report) return null;
  return (
    <View style={styles.faoPanel}>
      <View style={styles.faoPanelHeader}>
        <Ionicons name="clipboard" size={16} color={Colors.warning} />
        <Text style={styles.faoPanelTitle}>FAO Field Report Summary</Text>
      </View>
      <View style={styles.faoPanelRow}>
        <Text style={styles.faoPanelLabel}>Eligibility</Text>
        <View style={[
          styles.eligBadge,
          { backgroundColor: report.eligibility === 'ELIGIBLE' ? Colors.successLight : Colors.errorLight }
        ]}>
          <Text style={[
            styles.eligBadgeText,
            { color: report.eligibility === 'ELIGIBLE' ? Colors.success : Colors.error }
          ]}>{report.eligibility}</Text>
        </View>
      </View>
      {report.urgency_assessment && (
        <View style={styles.faoPanelRow}>
          <Text style={styles.faoPanelLabel}>FAO Urgency</Text>
          <Text style={styles.faoPanelValue}>{report.urgency_assessment}</Text>
        </View>
      )}
      {report.officer_findings && (
        <Text style={styles.faoFindings} numberOfLines={3}>{report.officer_findings}</Text>
      )}
    </View>
  );
};

// ── Main Screen ────────────────────────────────────────────────────
const ACOCalculationScreen = ({ route, navigation }) => {
  const { assessmentId, mode } = route.params;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [faoReport, setFaoReport] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [invModalVisible, setInvModalVisible] = useState(false);

  const [lineItems, setLineItems] = useState([]);
  const [hasRecurring, setHasRecurring] = useState(false);
  const [recurringMonthly, setRecurringMonthly] = useState('');
  const [recurringMonths, setRecurringMonths] = useState('');
  const [recommendedAmount, setRecommendedAmount] = useState('');
  const [justification, setJustification] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [assRes, invRes] = await Promise.all([
          assessmentApi.get(assessmentId),
          inventoryApi.list({ is_active: true }),
        ]);
        setAssessment(assRes.data);
        setFaoReport(assRes.data.fao_report_summary);
        setInventory(invRes.data.results || invRes.data || []);

        // Load existing ACO calculation if exists
        try {
          const calcRes = await acoApi.getCalculation(assessmentId);
          const c = calcRes.data;
          if (c.line_items && Array.isArray(c.line_items)) {
            setLineItems(c.line_items.map((item, i) => ({ ...item, id: item.id || String(i) })));
          }
          setHasRecurring(c.has_recurring_cost || false);
          setRecurringMonthly(c.recurring_monthly_cost ? String(c.recurring_monthly_cost) : '');
          setRecurringMonths(c.recurring_duration_months ? String(c.recurring_duration_months) : '');
          setRecommendedAmount(c.recommended_amount ? String(c.recommended_amount) : '');
          setJustification(c.justification || '');
          setNotes(c.notes || '');
        } catch (_) { /* No existing calculation */ }
      } catch (err) {
        Alert.alert('Error', 'Could not load assessment.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assessmentId]);

  // Auto-calculate totals
  const oneTimeTotal = lineItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const recurringTotal = hasRecurring
    ? (parseFloat(recurringMonthly) || 0) * (parseFloat(recurringMonths) || 0)
    : 0;
  const grandTotal = oneTimeTotal + recurringTotal;

  // Auto-suggest recommended amount
  useEffect(() => {
    if (grandTotal > 0 && !recommendedAmount) {
      setRecommendedAmount(String(Math.round(grandTotal)));
    }
  }, [grandTotal]);

  const validate = (validItems) => {
    if (validItems.length === 0) {
      Alert.alert('Required', 'Please add at least one valid cost line item.');
      return false;
    }
    const incomplete = validItems.find(i => !i.item.trim() || i.unit_cost === '' || i.unit_cost == null);
    if (incomplete) {
      Alert.alert('Incomplete', 'Please fill in all line item fields (item name & cost).');
      return false;
    }
    if (!recommendedAmount || parseFloat(recommendedAmount) <= 0) {
      Alert.alert('Required', 'Please enter the recommended support amount.');
      return false;
    }
    if (!justification.trim()) {
      Alert.alert('Required', 'Please provide justification for your calculation.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    // Filter out completely empty rows (where name is blank AND cost is empty/0)
    const validItems = lineItems.filter(i => i.item.trim() !== '' || (i.unit_cost !== '' && i.unit_cost !== 0 && i.unit_cost !== '0.00'));
    
    if (!validate(validItems)) return;
    setSubmitting(true);
    try {
      const payload = {
        line_items: validItems.map(({ id, ...rest }) => rest),
        has_recurring_cost: hasRecurring,
        recurring_monthly_cost: hasRecurring ? parseFloat(recurringMonthly) || 0 : null,
        recurring_duration_months: hasRecurring ? parseInt(recurringMonths) || 0 : null,
        recurring_total: recurringTotal || null,
        total_one_time_cost: oneTimeTotal,
        total_estimated_cost: grandTotal,
        recommended_amount: parseFloat(recommendedAmount),
        justification,
        notes,
      };
      await acoApi.submitCalculation(assessmentId, payload);
      Toast.show({
        type: 'success',
        text1: 'ACO Calculation Submitted ✅',
        text2: `Recommended ₹${recommendedAmount} — forwarded to Manager`,
      });
      navigation.goBack();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Submission failed.';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerLoader}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.loadingText}>Loading Case...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Cost Estimation</Text>
            <Text style={styles.headerSub}>{assessment?.request_number}</Text>
          </View>
          <TouchableOpacity
            style={styles.invBtn}
            onPress={() => setInvModalVisible(true)}
          >
            <Ionicons name="archive" size={16} color={Colors.orange} />
            <Text style={styles.invBtnText}>Stock</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Beneficiary summary */}
          <View style={styles.beneficiaryBar}>
            <Ionicons name="person-circle" size={28} color={Colors.orange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bName}>{assessment?.beneficiary_name}</Text>
              <Text style={styles.bAddr} numberOfLines={1}>{assessment?.beneficiary_address}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Badge status={assessment?.priority} size="sm" />
              <Text style={{ fontSize: 11, color: Colors.orange, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' }}>
                {assessment?.category}
              </Text>
            </View>
          </View>

          {/* FAO Report Summary */}
          <FAOSummaryPanel report={faoReport} />

          {/* ── Section 1: Inventory Overview */}
          <Section title="Charity Stock Available" icon="archive" color={Colors.success} filled={inventory.length > 0}>
            {inventory.length > 0 ? (
              <View>
                <View style={styles.invSummaryRow}>
                  {['MEDICINE', 'EQUIPMENT', 'FOOD'].map(cat => {
                    const items = inventory.filter(i => i.category === cat && i.quantity_available > 0);
                    return (
                      <View key={cat} style={styles.invSummaryCard}>
                        <Text style={styles.invSumCat}>{cat === 'MEDICINE' ? '💊' : cat === 'EQUIPMENT' ? '🦽' : '🍚'}</Text>
                        <Text style={styles.invSumCount}>{items.length}</Text>
                        <Text style={styles.invSumLabel}>{cat}</Text>
                      </View>
                    );
                  })}
                </View>
                <TouchableOpacity style={styles.viewAllInvBtn} onPress={() => setInvModalVisible(true)}>
                  <Ionicons name="list" size={14} color={Colors.primary} />
                  <Text style={styles.viewAllInvText}>View All {inventory.length} Items in Stock</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noInvText}>No inventory items available. All items will be purchased.</Text>
            )}
          </Section>

          {/* ── Section 2: Line Item Cost Breakdown */}
          <Section title="Cost Breakdown" icon="calculator" color={Colors.orange} filled={lineItems.length > 0}>
            <Text style={styles.sectionHint}>
              Add each item/service needed. Toggle "Stock" to mark items coming from charity's inventory.
            </Text>
            <LineItemTable
              items={lineItems}
              onChange={setLineItems}
              inventoryItems={inventory}
            />
          </Section>

          {/* ── Section 3: Recurring Costs */}
          <Section title="Recurring / Monthly Support" icon="repeat" color={Colors.purple} filled={hasRecurring && recurringMonthly}>
            <View style={styles.recurringToggle}>
              <View>
                <Text style={styles.fieldLabel}>Monthly recurring support needed?</Text>
                <Text style={styles.fieldHint}>e.g. monthly medicines, dialysis, etc.</Text>
              </View>
              <Switch
                value={hasRecurring}
                onValueChange={setHasRecurring}
                trackColor={{ false: Colors.gray200, true: Colors.purple + '80' }}
                thumbColor={hasRecurring ? Colors.purple : Colors.gray300}
              />
            </View>
            {hasRecurring && (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Monthly Cost (₹)"
                    value={recurringMonthly}
                    onChangeText={setRecurringMonthly}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 5000"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Duration (months)"
                    value={recurringMonths}
                    onChangeText={setRecurringMonths}
                    keyboardType="numeric"
                    placeholder="e.g. 12"
                  />
                </View>
              </View>
            )}
            {hasRecurring && recurringMonthly && recurringMonths && (
              <View style={styles.recurringTotal}>
                <Text style={styles.recurringTotalLabel}>Recurring Total</Text>
                <Text style={styles.recurringTotalValue}>₹{recurringTotal.toFixed(0)}</Text>
              </View>
            )}
          </Section>

          {/* ── Section 4: Final Recommendation */}
          <Section title="Final Recommendation" icon="briefcase" color={Colors.primary} filled={recommendedAmount && justification}>
            {/* Grand total display */}
            <View style={styles.grandTotalCard}>
              <View style={styles.grandTotalRow}>
                <Text style={styles.gtLabel}>One-time Cost</Text>
                <Text style={styles.gtValue}>₹{oneTimeTotal.toFixed(0)}</Text>
              </View>
              {hasRecurring && (
                <View style={styles.grandTotalRow}>
                  <Text style={styles.gtLabel}>Recurring Total</Text>
                  <Text style={styles.gtValue}>₹{recurringTotal.toFixed(0)}</Text>
                </View>
              )}
              <View style={[styles.grandTotalRow, styles.gtTotalRow]}>
                <Text style={styles.gtTotalLabel}>Total Estimated</Text>
                <Text style={styles.gtTotalValue}>₹{grandTotal.toFixed(0)}</Text>
              </View>
            </View>

            <Input
              label="Recommended Support Amount (₹)"
              value={recommendedAmount}
              onChangeText={setRecommendedAmount}
              keyboardType="decimal-pad"
              placeholder="Final amount to recommend"
              required
            />
            <Text style={styles.fieldHint}>
              This may be less than total estimated cost. Enter what the trust should actually provide.
            </Text>
            <Input
              label="Justification"
              value={justification}
              onChangeText={setJustification}
              type="multiline"
              placeholder="Explain how you arrived at this recommendation..."
              required
            />
            <Input
              label="Additional Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              type="multiline"
              placeholder="Any other notes for the manager..."
            />
          </Section>

          {/* Submit */}
          <View style={styles.submitArea}>
            <Button
              title={submitting ? (mode === 'edit' ? 'Updating...' : 'Submitting...') : (mode === 'edit' ? 'Update Calculation' : 'Submit to Manager')}
              onPress={handleSubmit}
              loading={submitting}
              variant="primary"
            />
            <Text style={styles.submitNote}>
              {mode === 'edit' ? 'Updating will overwrite the previously submitted calculation.' : 'Submitting will forward this assessment with your cost estimate to the Manager for final decision.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <InventoryModal
        visible={invModalVisible}
        onClose={() => setInvModalVisible(false)}
        items={inventory}
      />
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.gray500 },

  header: {
    backgroundColor: Colors.orange, paddingHorizontal: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  invBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.white, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  invBtnText: { fontSize: 12, fontWeight: '700', color: Colors.orange },

  beneficiaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, padding: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  bName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  bAddr: { fontSize: 12, color: Colors.gray500, marginTop: 2 },

  faoPanel: {
    backgroundColor: Colors.warningLight, borderRadius: 12, padding: 14,
    borderLeftWidth: 4, borderLeftColor: Colors.warning, marginBottom: 12, marginTop: 8,
  },
  faoPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  faoPanelTitle: { fontSize: 13, fontWeight: '700', color: Colors.warning },
  faoPanelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  faoPanelLabel: { fontSize: 12, color: Colors.gray600, width: 90 },
  faoPanelValue: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  eligBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  eligBadgeText: { fontSize: 11, fontWeight: '700' },
  faoFindings: { fontSize: 12, color: Colors.gray700, marginTop: 6, lineHeight: 18 },

  scroll: { padding: 16, paddingBottom: 40 },

  section: {
    backgroundColor: Colors.white, borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
  },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionHint: { fontSize: 12, color: Colors.gray500, marginBottom: 12 },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray700, marginBottom: 4 },
  fieldHint: { fontSize: 12, color: Colors.gray500, marginBottom: 12, marginTop: -8 },

  invSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  invSummaryCard: {
    flex: 1, backgroundColor: Colors.gray50, borderRadius: 12, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.gray200,
  },
  invSumCat: { fontSize: 22, marginBottom: 4 },
  invSumCount: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  invSumLabel: { fontSize: 10, fontWeight: '600', color: Colors.gray500, textTransform: 'uppercase' },
  viewAllInvBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', padding: 10,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 10, borderStyle: 'dashed',
  },
  viewAllInvText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  noInvText: { fontSize: 13, color: Colors.gray500 },

  recurringToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  recurringTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.purpleLight, borderRadius: 10, padding: 12, marginTop: 4,
  },
  recurringTotalLabel: { fontSize: 14, fontWeight: '600', color: Colors.purple },
  recurringTotalValue: { fontSize: 16, fontWeight: '800', color: Colors.purple },

  grandTotalCard: {
    backgroundColor: Colors.gray50, borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.gray200,
  },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  gtLabel: { fontSize: 13, color: Colors.gray600 },
  gtValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  gtTotalRow: { borderTopWidth: 1, borderTopColor: Colors.gray300, paddingTop: 10, marginTop: 4, marginBottom: 0 },
  gtTotalLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  gtTotalValue: { fontSize: 18, fontWeight: '900', color: Colors.orange },

  submitArea: { marginTop: 8, gap: 12 },
  submitNote: { fontSize: 12, color: Colors.gray500, textAlign: 'center', lineHeight: 18 },

  // Inventory Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  invRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  invLeft: { flex: 1 },
  invName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  invCat: { fontSize: 11, color: Colors.gray500, marginTop: 2, textTransform: 'uppercase' },
  invRight: { alignItems: 'center', marginHorizontal: 12 },
  invQty: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
  invUnit: { fontSize: 10, color: Colors.gray500 },
  invStock: {
    backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  invStockText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  invEmpty: { alignItems: 'center', padding: 40, gap: 8 },
  invEmptyText: { fontSize: 14, color: Colors.gray500 },
});

export default ACOCalculationScreen;
