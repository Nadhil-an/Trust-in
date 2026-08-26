import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { Roles } from '../constants/Config';
import { changeLanguage } from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;

export const SideDrawer = ({ visible, onClose, navigation, currentRoute = 'Home' }) => {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'en';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!visible) return null;

  const navigateTo = (screenName) => {
    onClose();
    setTimeout(() => {
      navigation.navigate(screenName, { fromDashboard: false });
    }, 150);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const staffMenu = [
    { name: 'Home', label: 'Home Dashboard', icon: 'home', route: 'Root' },
    { name: 'Complaints', label: 'Complaint Desk', icon: 'chatbubbles', route: 'StaffComplaints' },
    { name: 'Reports', label: 'Report Submission', icon: 'document-text', route: 'StaffReports' },
    { name: 'Attendance', label: 'Daily Attendance', icon: 'calendar-number', route: 'StaffAttendance' },
    { name: 'Advance', label: 'Payment Advance', icon: 'cash', route: 'StaffPaymentAdvance' },
    { name: 'Points', label: 'Achieved Points', icon: 'trophy', route: 'StaffAchievedPoints' },
  ];

  const managerMenu = [
    { name: 'Home', label: 'Home Dashboard', icon: 'home', route: 'Root' },
    { name: 'Members', label: 'Staff Members', icon: 'people', route: 'StaffMembersList' },
    { name: 'Attendance', label: 'Staff Attendance', icon: 'calendar-number', route: 'StaffAttendance' },
    { name: 'Complaints', label: 'Complaints Overview', icon: 'chatbubbles', route: 'StaffComplaints' },
  ];

  const memberMenu = [
    { name: 'Home', label: 'Home Dashboard', icon: 'home', route: 'Root' },
    { name: 'NewAssessment', label: 'New Assessment', icon: 'clipboard', route: 'NewAssessment' },
    { name: 'Payment', label: 'Membership Payment', icon: 'card', route: 'MembershipPayment' },
  ];

  const basicMenu = [
    { name: 'Home', label: 'Home Dashboard', icon: 'home', route: 'Root' },
  ];

  let menuItems = staffMenu;
  if (user?.role === Roles.MANAGER) menuItems = managerMenu;
  else if (user?.role === Roles.MEMBER) menuItems = memberMenu;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlayContainer}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Drawer Container */}
        <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <SafeAreaView style={styles.safeArea}>
            {/* Header / Profile Card */}
            <View style={styles.drawerHeader}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.full_name || 'Staff Member'}
                </Text>
                <Text style={styles.userRole}>
                  {user?.role ? user.role.replace(/_/g, ' ') : 'Sree Lakshmi Staff'}
                </Text>
              </View>
            </View>

            {/* Menu List */}
            <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionHeader}>NAVIGATION MENU</Text>
              {menuItems.map((item) => {
                const isActive = currentRoute === item.route || currentRoute === item.name;
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => navigateTo(item.route)}
                  >
                    <View style={[styles.iconCircle, isActive && styles.iconCircleActive]}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={isActive ? Colors.primary : Colors.gray600}
                      />
                    </View>
                    <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                      {item.label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={isActive ? Colors.primary : Colors.gray400}
                    />
                  </TouchableOpacity>
                );
              })}

              <View style={styles.divider} />

              {/* Language Switcher */}
              <View style={styles.langContainer}>
                <View style={styles.langHeaderRow}>
                  <Ionicons name="globe-outline" size={18} color={Colors.gray600} style={{ marginRight: 8 }} />
                  <Text style={styles.langTitle}>{currentLang.startsWith('ml') ? 'ഭാഷ തിരഞ്ഞെടുക്കുക' : 'Language'}</Text>
                </View>
                <View style={styles.langToggleBox}>
                  <TouchableOpacity
                    style={[styles.langBtn, !currentLang.startsWith('ml') && styles.langBtnActive]}
                    onPress={() => changeLanguage('en', user?.id)}
                  >
                    <Text style={[styles.langBtnText, !currentLang.startsWith('ml') && styles.langBtnTextActive]}>English</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.langBtn, currentLang.startsWith('ml') && styles.langBtnActive]}
                    onPress={() => changeLanguage('ml', user?.id)}
                  >
                    <Text style={[styles.langBtnText, currentLang.startsWith('ml') && styles.langBtnTextActive]}>മലയാളം</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('Profile')}>
                <View style={styles.iconCircle}>
                  <Ionicons name="person-outline" size={20} color={Colors.gray600} />
                </View>
                <Text style={styles.menuText}>My Profile</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Logout Footer */}
            <View style={styles.drawerFooter}>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={styles.logoutText}>Logout Account</Text>
              </TouchableOpacity>
              <Text style={styles.versionText}>Sree Lakshmi Trust • v1.0.0</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  safeArea: {
    flex: 1,
  },
  drawerHeader: {
    backgroundColor: Colors.navy,
    padding: 20,
    paddingTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  userRole: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.gray400,
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  menuItemActive: {
    backgroundColor: 'rgba(27, 47, 107, 0.08)',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCircleActive: {
    backgroundColor: 'rgba(27, 47, 107, 0.15)',
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gray700,
  },
  menuTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray200,
    marginVertical: 12,
    marginHorizontal: 8,
  },
  langContainer: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  langHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  langTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray700,
  },
  langToggleBox: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: 10,
    padding: 3,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  langBtnActive: {
    backgroundColor: Colors.navy,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
  },
  langBtnTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 10,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default SideDrawer;
