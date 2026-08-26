// screens/member/MembershipPaymentScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Image
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Button, Input, Card, Header } from '../../components/shared';
import { membershipApi } from '../../api';
import Toast from 'react-native-toast-message';

const MembershipPaymentScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('ONLINE'); // ONLINE | OFFICE
  const [upiId, setUpiId] = useState('');
  const [amount] = useState('100'); // Assuming ₹100/month default

  const handlePayment = async () => {
    if (method === 'ONLINE' && !upiId.trim()) {
      Alert.alert(t('common.required', 'Required'), t('member.req_upi_id', 'Please enter your UPI ID or Reference Number.'));
      return;
    }

    setLoading(true);
    try {
      if (method === 'OFFICE') {
        await membershipApi.markPaidOffice();
        Toast.show({ type: 'success', text1: t('member.request_sent', 'Request Sent'), text2: t('member.office_admin_verify', 'Office admin will verify your payment.') });
        navigation.goBack();
      } else {
        await membershipApi.payOnline({ amount: Number(amount), upi_ref: upiId });
        Toast.show({ type: 'success', text1: t('member.payment_success'), text2: t('member.payment_recorded') });
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err.response?.data?.detail || t('errors.failed_record_payment', 'Failed to record payment. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('member.pay_membership')} showBack />
      
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.amountCard} padding={24}>
          <Text style={styles.amountLabel}>{t('member.monthly_due', 'Monthly Due Amount')}</Text>
          <Text style={styles.amountValue}>₹{amount}</Text>
        </Card>

        <Text style={styles.sectionTitle}>{t('member.select_payment_method', 'Select Payment Method')}</Text>
        
        <View style={styles.methodRow}>
          <TouchableOpacity
            style={[styles.methodBtn, method === 'ONLINE' && styles.methodActive]}
            onPress={() => setMethod('ONLINE')}
          >
            <Ionicons name="phone-portrait" size={24} color={method === 'ONLINE' ? Colors.white : Colors.primary} />
            <Text style={[styles.methodLabel, method === 'ONLINE' && styles.methodLabelActive]}>{t('member.pay_online', 'Pay Online')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.methodBtn, method === 'OFFICE' && styles.methodActive]}
            onPress={() => setMethod('OFFICE')}
          >
            <Ionicons name="business" size={24} color={method === 'OFFICE' ? Colors.white : Colors.primary} />
            <Text style={[styles.methodLabel, method === 'OFFICE' && styles.methodLabelActive]}>{t('member.pay_office', 'Pay at Office')}</Text>
          </TouchableOpacity>
        </View>

        {method === 'ONLINE' ? (
          <Card style={styles.detailsCard}>
            <View style={styles.upiBox}>
              <Text style={styles.upiTitle}>{t('member.our_upi_details', 'Our UPI Details')}</Text>
              <Text style={styles.upiValue}>sreelakshmitrust@okicici</Text>
              <Text style={styles.upiValue}>Name: Sree Lakshmi Trust</Text>
            </View>
            <Text style={styles.infoText}>{t('member.transfer_amount_upi', 'Please transfer ₹{{amount}} to the above UPI ID and enter the reference number below to verify your payment.', { amount })}</Text>
            <Input
              label={t('member.upi_ref_txn', 'UPI Ref / Transaction ID')}
              value={upiId}
              onChangeText={setUpiId}
              placeholder={t('member.eg_upi_ref', 'e.g., 20394857482')}
              required
            />
          </Card>
        ) : (
          <Card style={styles.detailsCard}>
            <Ionicons name="information-circle" size={32} color={Colors.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.infoText}>{t('member.office_payment_info')}</Text>
            <Text style={[styles.infoText, { marginTop: 8 }]}>{t('member.office_payment_confirm', 'By clicking confirm, you notify the Trust that you have handed over the cash. Your membership will be updated once the admin verifies the receipt.')}</Text>
          </Card>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={method === 'ONLINE' ? t('member.verify_payment', 'Verify Payment of ₹{{amount}}', { amount }) : t('member.confirm_office_payment', 'Confirm Office Payment')}
          onPress={handlePayment}
          loading={loading}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 16 },
  amountCard: { alignItems: 'center', backgroundColor: Colors.primaryLight },
  amountLabel: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  amountValue: { fontSize: 36, fontWeight: '800', color: Colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  methodRow: { flexDirection: 'row', gap: 12 },
  methodBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 20, borderRadius: 14,
    borderWidth: 2, borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  methodActive: { backgroundColor: Colors.primary },
  methodLabel: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  methodLabelActive: { color: Colors.white },
  detailsCard: { marginTop: 8 },
  upiBox: { backgroundColor: Colors.gray50, padding: 16, borderRadius: 12, marginBottom: 16 },
  upiTitle: { fontSize: 12, color: Colors.gray500, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  upiValue: { fontSize: 16, color: Colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  infoText: { fontSize: 14, color: Colors.gray600, lineHeight: 22, marginBottom: 16 },
  footer: { padding: 16, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.gray200 },
});

export default MembershipPaymentScreen;
