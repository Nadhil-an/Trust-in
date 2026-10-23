// screens/member/MembershipPaymentScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import Toast from 'react-native-toast-message';

import { Colors } from '../../constants/Colors';
import { Input, Card, Header } from '../../components/shared';
import { membershipApi, paymentApi, authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const TRUST_UPI_ID = 'sreelakshmitrust@okicici';
const TRUST_NAME = 'Sree Lakshmi Charitable Trust';

const MembershipPaymentScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const [userProfile, setUserProfile] = useState(user);

  const initialAmount = route.params?.monthlyFee || user?.monthly_fee || 100;
  const [amount] = useState(String(initialAmount));
  const [method, setMethod] = useState('ONLINE'); // ONLINE | MANUAL_UPI | OFFICE
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);

  // Razorpay Gateway State
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [paymentSuccessDetails, setPaymentSuccessDetails] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await authApi.getProfile();
      if (res.data) {
        setUserProfile(res.data);
        updateUser(res.data);
      }
    } catch (_) {}
  };

  const activeUser = userProfile || user;
  const memberId = activeUser?.member_id || activeUser?.username || 'N/A';
  const memberName = activeUser?.member_name || activeUser?.full_name || 'Member';
  const validUpto = activeUser?.valid_upto || 'N/A';
  const isExpired = Boolean(activeUser?.is_subscription_expired);
  const memberSince = activeUser?.member_since && activeUser?.member_since !== 'N/A'
    ? activeUser.member_since
    : 'Registered Member';

  // Copy UPI ID to clipboard
  const handleCopyUpi = async () => {
    await Clipboard.setStringAsync(TRUST_UPI_ID);
    Toast.show({
      type: 'success',
      text1: 'UPI ID Copied',
      text2: `${TRUST_UPI_ID} copied to clipboard.`,
      visibilityTime: 2000,
    });
  };

  // Launch third-party UPI app directly
  const handleOpenUpiApp = async () => {
    const upiUrl = `upi://pay?pa=${encodeURIComponent(TRUST_UPI_ID)}&pn=${encodeURIComponent(
      TRUST_NAME
    )}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(
      `Membership Fee - ID ${memberId}`
    )}`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        // Attempt opening anyway or fallback to copying
        await Linking.openURL(upiUrl);
      }
    } catch (_) {
      handleCopyUpi();
      Alert.alert(
        'UPI App',
        `Please open Google Pay, PhonePe, or Paytm and transfer ₹${amount} to ${TRUST_UPI_ID}, then enter the transaction reference number below.`
      );
    }
  };

  // Initiate Instant Online Payment via Razorpay
  const handlePayWithRazorpay = async (recurring = false) => {
    setLoading(true);
    setIsRecurring(recurring);

    try {
      const donorName = activeUser?.full_name || activeUser?.username || 'Trust Member';
      const donorPhone = activeUser?.phone || '';
      const donorEmail = activeUser?.email || '';

      if (recurring) {
        // Recurring monthly autopay
        const res = await paymentApi.createSubscription({
          amount: Number(amount),
          purpose: 'Membership Fee',
          donor_name: donorName,
          donor_phone: donorPhone,
          donor_email: donorEmail,
        });

        const data = res.data;
        setActiveSubscriptionId(data.subscription_id);
        setActiveOrderId(null);

        const url = paymentApi.getCheckoutUrl({
          subscription_id: data.subscription_id,
          amount: Number(amount),
          currency: 'INR',
          name: 'Sree Lakshmi Charitable Trust',
          description: `Monthly Membership Subscription - ID: ${memberId}`,
          prefill_name: donorName,
          prefill_contact: donorPhone,
          prefill_email: donorEmail,
          key_id: data.key_id,
          recurring: true,
        });

        setCheckoutUrl(url);
        setCheckoutVisible(true);
      } else {
        // One-time monthly fee payment
        const res = await paymentApi.createDonationOrder({
          amount: Number(amount),
          purpose: 'Membership Fee',
          donor_name: donorName,
          donor_phone: donorPhone,
          donor_email: donorEmail,
          is_anonymous: false,
        });

        const data = res.data;
        setActiveOrderId(data.order_id);
        setActiveSubscriptionId(null);

        const url = paymentApi.getCheckoutUrl({
          order_id: data.order_id,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'Sree Lakshmi Charitable Trust',
          description: `Membership Fee Renewal - ID: ${memberId}`,
          prefill_name: donorName,
          prefill_contact: donorPhone,
          prefill_email: donorEmail,
          key_id: data.key_id,
          recurring: false,
        });

        setCheckoutUrl(url);
        setCheckoutVisible(true);
      }
    } catch (err) {
      console.error('Membership payment initiation error:', err);
      Alert.alert(
        'Unable to Start Payment',
        err.response?.data?.error || 'Could not connect to payment gateway. Please try again or use direct UPI.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle messages received from the Razorpay WebView
  const handleWebViewMessage = async (event) => {
    try {
      const raw = event.nativeEvent.data;
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

      const isSuccess = data?.status === 'SUCCESS' || data?.event === 'SUCCESS';
      const isCancelled = data?.status === 'CANCELLED' || data?.event === 'CANCEL' || data?.event === 'DISMISSED';

      if (isCancelled) {
        setCheckoutVisible(false);
        Toast.show({
          type: 'info',
          text1: 'Payment Cancelled',
          text2: 'You cancelled the payment transaction.',
        });
        return;
      }

      if (isSuccess) {
        setCheckoutVisible(false);

        const orderId = data.order_id || data.razorpay_order_id || data.data?.order_id || activeOrderId;
        const paymentId = data.razorpay_payment_id || data.payment_id || data.data?.razorpay_payment_id || data.data?.payment_id;
        const signature = data.razorpay_signature || data.signature || data.data?.razorpay_signature || data.data?.signature || 'test_signature_mock';
        const subscriptionId = data.subscription_id || data.razorpay_subscription_id || data.data?.subscription_id || activeSubscriptionId;

        // Verify with backend
        try {
          let verifyRes;
          if (isRecurring) {
            verifyRes = await paymentApi.verifySubscription({
              subscription_id: subscriptionId,
              payment_id: paymentId,
              signature: signature,
            });
          } else {
            verifyRes = await paymentApi.verifyDonationPayment({
              order_id: orderId,
              payment_id: paymentId,
              signature: signature,
            });
          }

          // Refresh user profile to activate membership card immediately
          await fetchProfile();

          setPaymentSuccessDetails({
            receipt: verifyRes?.data?.receipt_number || 'SLCT-MBR',
            amount: amount,
            recurring: isRecurring,
          });
          setSuccessModalVisible(true);
        } catch (verifyErr) {
          console.error('Verification error:', verifyErr);
          await fetchProfile();
          Toast.show({
            type: 'success',
            text1: 'Payment Received',
            text2: 'Your membership is being processed.',
          });
          navigation.goBack();
        }
      }
    } catch (e) {
      console.error('WebView message parsing error:', e);
    }
  };

  // Submit Manual UPI Reference Number
  const handleSubmitManualUpi = async () => {
    if (!upiId.trim()) {
      Alert.alert('Required', 'Please enter your UPI Reference / UTR Number.');
      return;
    }

    setLoading(true);
    try {
      const res = await membershipApi.payOnline({ amount: Number(amount), upi_ref: upiId.trim() });
      await fetchProfile();
      setPaymentSuccessDetails({
        receipt: res.data?.receipt_number || 'SLCT-MBR',
        amount: amount,
        recurring: false,
      });
      setSuccessModalVisible(true);
    } catch (err) {
      Alert.alert(
        'Submission Failed',
        err.response?.data?.detail || 'Failed to submit payment reference. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Submit Cash payment notification at Office
  const handleConfirmOfficePayment = async () => {
    setLoading(true);
    try {
      const res = await membershipApi.markPaidOffice({ amount: Number(amount) });
      await fetchProfile();
      setPaymentSuccessDetails({
        receipt: res.data?.receipt_number || 'SLCT-OFFICE',
        amount: amount,
        recurring: false,
      });
      setSuccessModalVisible(true);
    } catch (err) {
      Alert.alert(
        'Error',
        err.response?.data?.detail || 'Failed to submit office payment notification.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Screen Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Membership Subscription</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAwareScrollView
        enableOnAndroid={true}
        extraScrollHeight={30}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Member Status Badge & ID Card Header */}
        <View style={styles.memberStatusCard}>
          <View style={styles.statusTopRow}>
            <View style={styles.memberAvatarWrap}>
              <Ionicons name="person" size={22} color="#0284c7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{memberName}</Text>
              <Text style={styles.memberIdText}>Member ID: {memberId}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isExpired ? styles.statusBadgeExpired : styles.statusBadgeActive,
              ]}
            >
              <Ionicons
                name={isExpired ? 'alert-circle' : 'checkmark-circle'}
                size={13}
                color={isExpired ? '#dc2626' : '#16a34a'}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isExpired ? '#dc2626' : '#16a34a' },
                ]}
              >
                {isExpired ? 'RENEWAL DUE' : 'ACTIVE'}
              </Text>
            </View>
          </View>

          <View style={styles.validityRow}>
            <View style={styles.validityCol}>
              <Text style={styles.validityLabel}>Member Since</Text>
              <Text style={styles.validityVal}>{memberSince}</Text>
            </View>
            <View style={styles.validityDivider} />
            <View style={styles.validityCol}>
              <Text style={styles.validityLabel}>Valid Upto</Text>
              <Text
                style={[
                  styles.validityVal,
                  isExpired && { color: '#dc2626', fontWeight: '800' },
                ]}
              >
                {validUpto}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Subscription Plan Pricing Box */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={styles.planBadge}>
              <Ionicons name="sparkles" size={13} color="#0284c7" />
              <Text style={styles.planBadgeText}>MONTHLY TRUST MEMBERSHIP</Text>
            </View>
            <Text style={styles.planTitle}>Individual Member Subscription</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceSymbol}>₹</Text>
              <Text style={styles.priceAmount}>{amount}</Text>
              <Text style={styles.pricePeriod}>/ month</Text>
            </View>
          </View>

          <View style={styles.planDivider} />

          {/* Benefits Checklist */}
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
              <Text style={styles.benefitText}>Official Verified Digital Trust ID Card unlocked</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
              <Text style={styles.benefitText}>Submit & vote on Community Petitions & Public Issues</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
              <Text style={styles.benefitText}>Instant digital e-Receipt with 80G tax benefit reference</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#0284c7" />
              <Text style={styles.benefitText}>Voting and representation in Annual Trust Initiatives</Text>
            </View>
          </View>
        </View>

        {/* 3. Payment Method Tabs */}
        <Text style={styles.sectionHeading}>Choose Payment Option</Text>
        <View style={styles.methodTabsRow}>
          <TouchableOpacity
            style={[styles.methodTab, method === 'ONLINE' && styles.methodTabActive]}
            onPress={() => setMethod('ONLINE')}
            activeOpacity={0.85}
          >
            <Image
              source={require('../../../assets/gpay.png')}
              style={styles.gpayTabIcon}
              resizeMode="contain"
            />
            <Text style={[styles.methodTabText, method === 'ONLINE' && styles.methodTabTextActive]}>
              Instant Online
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodTab, method === 'OFFICE' && styles.methodTabActive]}
            onPress={() => setMethod('OFFICE')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="business-outline"
              size={18}
              color={method === 'OFFICE' ? '#0284c7' : Colors.gray500}
            />
            <Text style={[styles.methodTabText, method === 'OFFICE' && styles.methodTabTextActive]}>
              Pay at Office
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. Tab 1 Content: Instant Online Gateway */}
        {method === 'ONLINE' && (
          <View style={styles.methodCard}>
            <View style={styles.onlineBadgeRow}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={styles.onlineBadgeText}>Instant Automated Activation</Text>
            </View>
            <Text style={styles.onlineCardDesc}>
              Pay securely via UPI (Google Pay, PhonePe, Paytm), Credit/Debit Card, or Netbanking. Your membership is renewed instantly.
            </Text>

            {/* Instant Pay One-Time Month */}
            <TouchableOpacity
              style={styles.payNowPrimaryBtn}
              onPress={() => handlePayWithRazorpay(false)}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading && !isRecurring ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color={Colors.white} />
                  <Text style={styles.payNowPrimaryBtnText}>Pay ₹{amount} (1-Month Renewal)</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR SET & FORGET</Text>
              <View style={styles.orLine} />
            </View>

            {/* Recurring Autopay Button */}
            <TouchableOpacity
              style={styles.autopaySecondaryBtn}
              onPress={() => handlePayWithRazorpay(true)}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading && isRecurring ? (
                <ActivityIndicator color="#0284c7" />
              ) : (
                <>
                  <Ionicons name="repeat" size={18} color="#0284c7" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.autopayTitle}>Enable Monthly Autopay (₹{amount}/mo)</Text>
                    <Text style={styles.autopaySub}>Auto-renews every 30 days. Cancel anytime with 1 tap.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#0284c7" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 4. Tab 2 Content: Pay at Office */}
        {method === 'OFFICE' && (
          <View style={styles.methodCard}>
            <View style={styles.officeInfoBox}>
              <Ionicons name="business" size={32} color="#0284c7" style={{ marginBottom: 8 }} />
              <Text style={styles.officeTitle}>Cash Payment at Trust Office</Text>
              <Text style={styles.officeDesc}>
                You can hand over the monthly membership fee of ₹{amount} in cash to our registered Trust office in Thamarassery / Mukkam or to an authorized staff field collector.
              </Text>
              <Text style={styles.officeNote}>
                Clicking the button below will register an official cash collection request. Once verified by our accountant, your digital membership card will be activated.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.payNowPrimaryBtn}
              onPress={handleConfirmOfficePayment}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                  <Text style={styles.payNowPrimaryBtnText}>Notify Trust Office of Cash Payment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* 7. Full-Screen Razorpay Checkout WebView Modal */}
      <Modal
        visible={checkoutVisible}
        animationType="slide"
        onRequestClose={() => setCheckoutVisible(false)}
      >
        <SafeAreaView style={styles.webViewContainer} edges={['top', 'bottom']}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              style={styles.webViewCloseBtn}
              onPress={() => {
                Alert.alert('Cancel Payment', 'Are you sure you want to cancel the membership payment?', [
                  { text: 'Continue Payment', style: 'cancel' },
                  { text: 'Yes, Cancel', style: 'destructive', onPress: () => setCheckoutVisible(false) },
                ]);
              }}
            >
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.webViewTitle}>Razorpay Secure Checkout</Text>
              <Text style={styles.webViewSub}>Sree Lakshmi Charitable Trust</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          {Boolean(checkoutUrl) && (
            <WebView
              source={{ uri: checkoutUrl }}
              style={styles.webView}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
              mixedContentMode="always"
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoader}>
                  <ActivityIndicator size="large" color="#0284c7" />
                  <Text style={styles.webViewLoaderText}>Connecting to Razorpay Secure Gateway...</Text>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* 8. Success Celebration Modal */}
      <Modal visible={successModalVisible} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="shield-checkmark" size={44} color="#16a34a" />
            </View>
            <Text style={styles.successTitle}>Membership Activated!</Text>
            <Text style={styles.successMessage}>
              Thank you for subscribing to Sree Lakshmi Charitable Trust. Your digital membership card is now active.
            </Text>

            <View style={styles.successDetailsBox}>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Member ID:</Text>
                <Text style={styles.successValue}>{memberId}</Text>
              </View>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Amount Paid:</Text>
                <Text style={styles.successValue}>₹{paymentSuccessDetails?.amount || amount}</Text>
              </View>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>Receipt Ref:</Text>
                <Text style={styles.successValue}>{paymentSuccessDetails?.receipt || 'CONFIRMED'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={() => {
                setSuccessModalVisible(false);
                navigation.navigate('DonationHistory');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.successDoneBtnText}>View My Membership & Donations</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 4,
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  // Member Status Card
  memberStatusCard: {
    backgroundColor: Colors.white,
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
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  memberIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeExpired: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  validityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  validityCol: {
    alignItems: 'center',
    flex: 1,
  },
  validityDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  validityLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  validityVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  // Subscription Plan Card
  planCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  planHeader: {
    alignItems: 'center',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceSymbol: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0284c7',
  },
  priceAmount: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0284c7',
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 4,
  },
  planDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  benefitsList: {
    gap: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },

  // Payment Option Tabs
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  methodTabsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  methodTabActive: {
    borderColor: '#0284c7',
    backgroundColor: '#F0F9FF',
  },
  gpayTabIcon: {
    width: 36,
    height: 22,
  },
  methodTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray600,
  },
  methodTabTextActive: {
    color: '#0284c7',
    fontWeight: '800',
  },

  // Method Cards
  methodCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  onlineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  onlineBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  onlineCardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  payNowPrimaryBtn: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  payNowPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  orText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  autopaySecondaryBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autopayTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  autopaySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Direct UPI Styles
  upiCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  upiCopyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  upiIdLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  upiIdValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  upiIdSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
  openUpiBtn: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  openUpiBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  utrHelperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },

  // Office payment
  officeInfoBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  officeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  officeDesc: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 10,
  },
  officeNote: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Razorpay WebView Modal
  webViewContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  webViewCloseBtn: {
    padding: 6,
  },
  webViewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  webViewSub: {
    fontSize: 11,
    color: '#64748B',
  },
  webView: {
    flex: 1,
  },
  webViewLoader: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  webViewLoaderText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '600',
  },

  // Success Modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  successMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  successDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  successValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  successDoneBtn: {
    backgroundColor: '#0284c7',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  successDoneBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  gpayTabIcon: {
    width: 22,
    height: 22,
    marginRight: 6,
  },
});

export default MembershipPaymentScreen;
