import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';
import { paymentApi, authApi } from '../../api';

const QUICK_AMOUNTS_ONETIME = [200, 500, 1000, 2500, 5000, 10000];
const QUICK_AMOUNTS_MONTHLY = [100, 250, 500, 1000, 2000, 5000];

const PURPOSES = [
  { id: 'GENERAL', label: 'General Donation', icon: 'heart-outline' },
  { id: 'MEDICAL', label: 'Medical Relief', icon: 'medkit-outline' },
  { id: 'EDUCATION', label: 'Child Education', icon: 'school-outline' },
  { id: 'ANNADANAM', label: 'Food & Annadanam', icon: 'restaurant-outline' },
  { id: 'DISABILITY', label: 'Disability & Elderly', icon: 'hand-left-outline' },
];

const DonateScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Auth');
    }
  }, [isAuthenticated]);

  // Mode: 'ONETIME' or 'MONTHLY'
  const initialMode = route.params?.mode || 'ONETIME';
  const initialAmount = route.params?.amount ? String(route.params.amount) : '500';

  const [paymentMode, setPaymentMode] = useState(initialMode);
  const [selectedAmount, setSelectedAmount] = useState(initialAmount);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const [selectedPurpose, setSelectedPurpose] = useState('GENERAL');
  const [donorName, setDonorName] = useState(user?.full_name || user?.name || '');
  const [donorPhone, setDonorPhone] = useState(user?.phone_number || user?.phone || '');
  const [donorEmail, setDonorEmail] = useState(user?.email || '');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Existing active subscription
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);

  // Checkout WebView Modal state
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [activeSubscriptionId, setActiveSubscriptionId] = useState(null);

  // Success Modal state
  const [successVisible, setSuccessVisible] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  // Fetch member's active monthly autopay if any
  const fetchActiveSubscription = async () => {
    try {
      setLoadingSub(true);
      const res = await paymentApi.getMySubscription();
      if (res.data?.has_active_subscription) {
        setActiveSubscription(res.data.subscription);
      } else {
        setActiveSubscription(null);
      }
    } catch (e) {
      // not logged in or endpoint unavailable
      setActiveSubscription(null);
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    fetchActiveSubscription();
  }, []);

  const effectiveAmount = isCustom ? Number(customAmount) : Number(selectedAmount);

  const handleSelectQuickAmount = (amt) => {
    setIsCustom(false);
    setSelectedAmount(String(amt));
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    setIsCustom(true);
  };

  // Handle Cancel Existing Autopay
  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Monthly Autopay',
      'Are you sure you want to stop your monthly recurring donation? You can set up a new one anytime.',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingSub(true);
              await paymentApi.cancelSubscription();
              Toast.show({
                type: 'success',
                text1: 'Autopay Cancelled',
                text2: 'Your monthly donation autopay has been stopped.',
              });
              await fetchActiveSubscription();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to cancel autopay.');
            } finally {
              setCancellingSub(false);
            }
          },
        },
      ]
    );
  };

  // Initiate Payment / Autopay
  const handleProceed = async () => {
    const amountVal = effectiveAmount;
    const minAmount = paymentMode === 'MONTHLY' ? 50 : 10;

    if (!amountVal || isNaN(amountVal) || amountVal < minAmount) {
      Alert.alert(
        'Invalid Amount',
        `Please enter a valid donation amount of at least ₹${minAmount}.`
      );
      return;
    }

    if (!donorName.trim() && !isAnonymous) {
      Alert.alert('Required', 'Please enter your donor name.');
      return;
    }

    if (!donorPhone.trim() && !isAnonymous) {
      Alert.alert('Required', 'Please provide your contact / WhatsApp number for the e-receipt.');
      return;
    }

    setCreatingPayment(true);

    try {
      if (paymentMode === 'ONETIME') {
        // 1. Create One-time order
        const res = await paymentApi.createDonationOrder({
          amount: amountVal,
          purpose: selectedPurpose,
          donor_name: isAnonymous ? 'Anonymous Donor' : donorName.trim(),
          donor_phone: donorPhone.trim(),
          donor_email: donorEmail.trim(),
          is_anonymous: isAnonymous,
        });

        const data = res.data;
        setActiveOrderId(data.order_id);
        setActiveSubscriptionId(null);

        // Build checkout URL
        const url = paymentApi.getCheckoutUrl({
          order_id: data.order_id,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'Sree Lakshmi Charitable Trust',
          description: `${selectedPurpose} Donation`,
          prefill_name: isAnonymous ? '' : donorName,
          prefill_contact: donorPhone,
          prefill_email: donorEmail,
          key_id: data.key_id,
          recurring: false,
        });

        setCheckoutUrl(url);
        setCheckoutVisible(true);
      } else {
        // 2. Create Monthly Subscription
        const res = await paymentApi.createSubscription({
          amount: amountVal,
          purpose: selectedPurpose,
          donor_name: isAnonymous ? 'Anonymous Donor' : donorName.trim(),
          donor_phone: donorPhone.trim(),
          donor_email: donorEmail.trim(),
        });

        const data = res.data;
        setActiveSubscriptionId(data.subscription_id);
        setActiveOrderId(null);

        // Build checkout URL for recurring
        const url = paymentApi.getCheckoutUrl({
          subscription_id: data.subscription_id,
          amount: amountVal,
          currency: 'INR',
          name: 'Sree Lakshmi Charitable Trust',
          description: `Monthly Donation - ${selectedPurpose}`,
          prefill_name: isAnonymous ? '' : donorName,
          prefill_contact: donorPhone,
          prefill_email: donorEmail,
          key_id: data.key_id,
          recurring: true,
        });

        setCheckoutUrl(url);
        setCheckoutVisible(true);
      }
    } catch (err) {
      console.error('Payment initiation error:', err);
      Alert.alert(
        'Unable to Start Payment',
        err.response?.data?.error || 'Could not initiate secure gateway. Please try again.'
      );
    } finally {
      setCreatingPayment(false);
    }
  };

  // Handle messages received from the WebView
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
          if (paymentMode === 'ONETIME') {
            const verifyRes = await paymentApi.verifyDonationPayment({
              order_id: orderId,
              payment_id: orderId,
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
              signature: signature,
            });

            setPaymentResult({
              type: 'ONETIME',
              receipt_no: verifyRes.data?.receipt_number || 'Pending',
              amount: effectiveAmount,
              payment_id: data.payment_id,
              message: verifyRes.data?.message || 'Thank you for your generous donation!',
            });
            setSuccessVisible(true);
            try {
              const prof = await authApi.getProfile();
              if (prof.data) useAuthStore.getState().updateUser(prof.data);
            } catch (_) {}
          } else {
            const verifyRes = await paymentApi.verifySubscription({
              subscription_id: subscriptionId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
              signature: signature,
            });

            setPaymentResult({
              type: 'MONTHLY',
              subscription_id: data.subscription_id || activeSubscriptionId,
              amount: effectiveAmount,
              next_charge_date: verifyRes.data?.subscription?.next_charge_date,
              message: verifyRes.data?.message || 'Monthly Autopay setup successfully!',
            });
            setSuccessVisible(true);
            fetchActiveSubscription();
            try {
              const prof = await authApi.getProfile();
              if (prof.data) useAuthStore.getState().updateUser(prof.data);
            } catch (_) {}
          }
        } catch (verifyErr) {
          Alert.alert(
            'Payment Verification',
            verifyErr.response?.data?.error ||
              'Payment was received, but server verification is pending. Our team will verify and send your receipt.'
          );
        }
      }
    } catch (e) {
      console.log('Error parsing WebView message:', e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Make a Donation</Text>
          <Text style={styles.headerSubtitle}>Sree Lakshmi Charitable Trust</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Active Autopay Card if already subscribed */}
          {activeSubscription && (
            <View style={styles.activeSubCard}>
              <View style={styles.activeSubHeader}>
                <View style={styles.activeSubBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                  <Text style={styles.activeSubBadgeText}>AUTOPAY ACTIVE</Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelSubBtn}
                  onPress={handleCancelSubscription}
                  disabled={cancellingSub}
                >
                  {cancellingSub ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={styles.cancelSubBtnText}>Stop Autopay</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.activeSubAmount}>
                ₹{Number(activeSubscription.amount).toLocaleString()}
                <Text style={styles.activeSubFrequency}> / month</Text>
              </Text>
              <Text style={styles.activeSubPurpose}>
                Purpose: {activeSubscription.purpose || 'General Trust Contribution'}
              </Text>

              {activeSubscription.next_charge_date && (
                <View style={styles.activeSubNextRow}>
                  <Ionicons name="calendar-outline" size={14} color="#0369a1" />
                  <Text style={styles.activeSubNextText}>
                    Next scheduled charge: {activeSubscription.next_charge_date}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Mode Switch Tabs: One-Time vs Monthly Autopay */}
          <View style={styles.modeTabsWrap}>
            <TouchableOpacity
              style={[styles.modeTab, paymentMode === 'ONETIME' && styles.modeTabActive]}
              onPress={() => {
                setPaymentMode('ONETIME');
                setSelectedAmount('500');
                setIsCustom(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="gift-outline"
                size={18}
                color={paymentMode === 'ONETIME' ? '#0284c7' : Colors.gray500}
              />
              <Text
                style={[
                  styles.modeTabText,
                  paymentMode === 'ONETIME' && styles.modeTabTextActive,
                ]}
              >
                One-Time Gift
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, paymentMode === 'MONTHLY' && styles.modeTabActive]}
              onPress={() => {
                setPaymentMode('MONTHLY');
                setSelectedAmount('500');
                setIsCustom(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="repeat-outline"
                size={18}
                color={paymentMode === 'MONTHLY' ? '#0284c7' : Colors.gray500}
              />
              <Text
                style={[
                  styles.modeTabText,
                  paymentMode === 'MONTHLY' && styles.modeTabTextActive,
                ]}
              >
                Monthly Autopay
              </Text>
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Amount Selection Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>
              {paymentMode === 'MONTHLY'
                ? 'Select Monthly Amount'
                : 'Select Donation Amount'}
            </Text>

            {/* Quick Pills */}
            <View style={styles.quickAmountGrid}>
              {(paymentMode === 'MONTHLY'
                ? QUICK_AMOUNTS_MONTHLY
                : QUICK_AMOUNTS_ONETIME
              ).map((amt) => {
                const isSelected = !isCustom && selectedAmount === String(amt);
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.quickAmountBtn,
                      isSelected && styles.quickAmountBtnActive,
                    ]}
                    onPress={() => handleSelectQuickAmount(amt)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.quickAmountText,
                        isSelected && styles.quickAmountTextActive,
                      ]}
                    >
                      ₹{amt.toLocaleString()}
                      {paymentMode === 'MONTHLY' ? '/mo' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Amount Field */}
            <View style={styles.customAmountWrap}>
              <Text style={styles.rupeePrefix}>₹</Text>
              <TextInput
                style={styles.customAmountInput}
                placeholder="Or enter custom amount"
                placeholderTextColor={Colors.gray400}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={handleCustomAmountChange}
              />
            </View>

            {/* Monthly Autopay Info Note */}
            {paymentMode === 'MONTHLY' && (
              <View style={styles.monthlyInfoBox}>
                <Ionicons name="information-circle-outline" size={18} color="#0284c7" />
                <Text style={styles.monthlyInfoText}>
                  UPI Autopay: ₹{effectiveAmount || 0} will be automatically contributed
                  every month on this date. You can cancel or pause anytime directly in the app.
                </Text>
              </View>
            )}
          </View>

          {/* Purpose of Donation */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Choose Cause / Purpose</Text>
            <View style={styles.purposeList}>
              {PURPOSES.map((item) => {
                const isSelected = selectedPurpose === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.purposeChip,
                      isSelected && styles.purposeChipActive,
                    ]}
                    onPress={() => setSelectedPurpose(item.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isSelected ? Colors.white : '#0284c7'}
                    />
                    <Text
                      style={[
                        styles.purposeChipText,
                        isSelected && styles.purposeChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Donor Information */}
          <View style={styles.card}>
            <View style={styles.donorHeaderRow}>
              <Text style={styles.cardSectionLabel}>Donor Information</Text>
              <View style={styles.anonToggleWrap}>
                <Text style={styles.anonToggleLabel}>Anonymous</Text>
                <Switch
                  value={isAnonymous}
                  onValueChange={setIsAnonymous}
                  trackColor={{ false: Colors.gray200, true: '#7dd3fc' }}
                  thumbColor={isAnonymous ? '#0284c7' : '#f4f3f4'}
                />
              </View>
            </View>

            {!isAnonymous && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your name"
                    value={donorName}
                    onChangeText={setDonorName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>WhatsApp / Contact Number</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    value={donorPhone}
                    onChangeText={setDonorPhone}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email (Optional, for 80G receipt)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="your.email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={donorEmail}
                    onChangeText={setDonorEmail}
                  />
                </View>
              </>
            )}

            {isAnonymous && (
              <View style={styles.anonInfoBox}>
                <Ionicons name="eye-off-outline" size={18} color={Colors.gray600} />
                <Text style={styles.anonInfoText}>
                  Your name will be hidden from public records. An e-receipt will still be
                  registered in your account.
                </Text>
              </View>
            )}
          </View>

          {/* 80G Tax Benefit Banner */}
          <View style={styles.taxBenefitCard}>
            <View style={styles.taxShieldCircle}>
              <Ionicons name="shield-checkmark" size={24} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.taxBenefitTitle}>80G Tax Exemption Eligible</Text>
              <Text style={styles.taxBenefitDesc}>
                All charitable contributions to Sree Lakshmi Charitable Trust qualify for 50%
                tax deduction under Section 80G of the Income Tax Act.
              </Text>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Sticky Action Footer */}
      <View style={styles.footer}>
        <View style={styles.footerAmountWrap}>
          <Text style={styles.footerLabel}>
            {paymentMode === 'MONTHLY' ? 'Monthly Commitment' : 'Total Donation'}
          </Text>
          <Text style={styles.footerAmount}>
            ₹{effectiveAmount || 0}
            {paymentMode === 'MONTHLY' ? (
              <Text style={styles.footerAmountSub}> /month</Text>
            ) : null}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.payBtn}
          onPress={handleProceed}
          disabled={creatingPayment}
          activeOpacity={0.85}
        >
          {creatingPayment ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={styles.payBtnText}>
                {paymentMode === 'MONTHLY'
                  ? 'Setup Monthly Autopay'
                  : 'Proceed to Pay'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* In-App WebView Checkout Modal */}
      <Modal
        visible={checkoutVisible}
        animationType="slide"
        onRequestClose={() => {
          Alert.alert(
            'Cancel Payment',
            'Do you want to exit the payment screen?',
            [
              { text: 'No', style: 'cancel' },
              { text: 'Yes, Exit', onPress: () => setCheckoutVisible(false) },
            ]
          );
        }}
      >
        <View style={[styles.modalContainer, { paddingTop: Math.max(insets.top, 14) }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                Alert.alert(
                  'Cancel Payment',
                  'Do you want to exit the payment screen?',
                  [
                    { text: 'Stay & Pay', style: 'cancel' },
                    { text: 'Exit', style: 'destructive', onPress: () => setCheckoutVisible(false) },
                  ]
                );
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>

            <View style={styles.modalHeaderCenter}>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                Razorpay Secure Checkout
              </Text>
              <View style={styles.modalHeaderSubRow}>
                <Ionicons name="shield-checkmark" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                <Text style={styles.modalHeaderSub}>
                  {paymentMode === 'MONTHLY' ? 'Monthly Autopay' : 'One-Time Donation'} &bull; 256-Bit SSL
                </Text>
              </View>
            </View>

            <View style={styles.modalHeaderRightPlaceholder} />
          </View>

          {checkoutUrl ? (
            <WebView
              source={{ uri: checkoutUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
              mixedContentMode="always"
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              setSupportMultipleWindows={false}
              javaScriptCanOpenWindowsAutomatically={true}
              onShouldStartLoadWithRequest={(req) => {
                const u = req.url;
                if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('about:blank') || u.startsWith('data:')) {
                  return true;
                }
                Linking.canOpenURL(u).then((sup) => {
                  if (sup) Linking.openURL(u);
                  else Alert.alert('Payment App', 'No compatible app found to complete this transaction.');
                }).catch(() => {});
                return false;
              }}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webViewLoader}>
                  <ActivityIndicator size="large" color="#0284c7" />
                  <Text style={styles.webViewLoaderText}>Connecting to Razorpay...</Text>
                </View>
              )}
              onMessage={handleWebViewMessage}
            />
          ) : null}
        </View>
      </Modal>

      {/* Success / Thank You Modal */}
      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
            </View>

            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successSubtitle}>
              {paymentResult?.type === 'MONTHLY'
                ? 'Monthly Autopay Setup Successfully'
                : 'Donation Received Successfully'}
            </Text>

            <View style={styles.successDetailsBox}>
              <View style={styles.successDetailRow}>
                <Text style={styles.successDetailLabel}>Amount</Text>
                <Text style={styles.successDetailValue}>
                  ₹{paymentResult?.amount?.toLocaleString()}
                  {paymentResult?.type === 'MONTHLY' ? ' / month' : ''}
                </Text>
              </View>

              {paymentResult?.receipt_no && (
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>Receipt No</Text>
                  <Text style={[styles.successDetailValue, { color: '#0284c7' }]}>
                    {paymentResult.receipt_no}
                  </Text>
                </View>
              )}

              {paymentResult?.next_charge_date && (
                <View style={styles.successDetailRow}>
                  <Text style={styles.successDetailLabel}>Next Autopay Date</Text>
                  <Text style={styles.successDetailValue}>
                    {paymentResult.next_charge_date}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.whatsappReceiptBox}>
              <Ionicons name="logo-whatsapp" size={18} color="#16a34a" />
              <Text style={styles.whatsappReceiptText}>
                An official 80G e-receipt has been generated and dispatched to your WhatsApp.
              </Text>
            </View>

            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.viewDonationsBtn}
                onPress={() => {
                  setSuccessVisible(false);
                  navigation.navigate('DonationHistory');
                }}
              >
                <Text style={styles.viewDonationsBtnText}>View My Donations</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  setSuccessVisible(false);
                  navigation.goBack();
                }}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#e0f2fe',
    fontWeight: '500',
    marginTop: 2,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },

  // Active Subscription
  activeSubCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#7dd3fc',
    borderRadius: 16,
    padding: 16,
  },
  activeSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeSubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeSubBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  cancelSubBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cancelSubBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },
  activeSubAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0369a1',
  },
  activeSubFrequency: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0284c7',
  },
  activeSubPurpose: {
    fontSize: 12,
    color: Colors.gray600,
    marginTop: 2,
  },
  activeSubNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0f2fe',
  },
  activeSubNextText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
  },

  // Mode Switch Tabs
  modeTabsWrap: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    position: 'relative',
  },
  modeTabActive: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray600,
  },
  modeTabTextActive: {
    color: '#0284c7',
    fontWeight: '800',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recommendedBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },

  // Cards
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  // Quick Amount Grid
  quickAmountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAmountBtn: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  quickAmountBtnActive: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0284c7',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray700,
  },
  quickAmountTextActive: {
    color: '#0284c7',
    fontWeight: '800',
  },

  // Custom Amount
  customAmountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#ffffff',
  },
  rupeePrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0284c7',
    marginRight: 6,
  },
  customAmountInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  monthlyInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  monthlyInfoText: {
    flex: 1,
    fontSize: 11,
    color: '#0369a1',
    lineHeight: 16,
  },

  // Purpose Chips
  purposeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  purposeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  purposeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  purposeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray700,
  },
  purposeChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  // Donor form
  donorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  anonToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anonToggleLabel: {
    fontSize: 12,
    color: Colors.gray600,
    fontWeight: '600',
  },
  inputGroup: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
    marginBottom: 4,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#f8fafc',
  },
  anonInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  anonInfoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.gray600,
    lineHeight: 18,
  },

  // Tax Exemption Banner
  taxBenefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 14,
    borderRadius: 14,
  },
  taxShieldCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taxBenefitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
  },
  taxBenefitDesc: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    lineHeight: 16,
  },

  // Sticky Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  footerAmountWrap: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray500,
    textTransform: 'uppercase',
  },
  footerAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284c7',
  },
  footerAmountSub: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray600,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },

  // WebView Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    minHeight: 58,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  modalHeaderSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  modalHeaderSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  modalHeaderRightPlaceholder: {
    width: 36,
  },
  webViewLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewLoaderText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.gray600,
  },

  // Success Modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
  },
  successIconCircle: {
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  successSubtitle: {
    fontSize: 13,
    color: Colors.gray600,
    marginTop: 4,
    textAlign: 'center',
  },
  successDetailsBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
    gap: 8,
  },
  successDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successDetailLabel: {
    fontSize: 12,
    color: Colors.gray500,
    fontWeight: '600',
  },
  successDetailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  whatsappReceiptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  whatsappReceiptText: {
    flex: 1,
    fontSize: 11,
    color: '#15803d',
    lineHeight: 16,
  },
  successActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  viewDonationsBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  viewDonationsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0284c7',
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
});

export default DonateScreen;

