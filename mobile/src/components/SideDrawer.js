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
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/authStore';
import { Roles } from '../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;

export const SideDrawer = ({ visible, onClose, navigation, currentRoute = 'Home' }) => {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { user, logout } = useAuthStore();

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

  // Standard Menu Items (For Members, etc.)
  const primaryMenu = [
    { name: 'Home', label: 'Home', icon: 'home', route: 'Root' },
    { name: 'MyDonation', label: 'My Donation', icon: 'heart', route: 'DonationHistory' },
    { name: 'ReportProblem', label: 'Report a Problem', icon: 'warning', route: 'ReportProblem' },
    { name: 'Events', label: 'Events', icon: 'calendar', route: 'Events' },
    { name: 'MyProfile', label: 'My Profile', icon: 'person', route: 'Profile' },
  ];

  // Exact Staff Menu Items based on screenshot reference
  const staffMenu = [
    { name: 'Home', label: 'Home', icon: 'home', route: 'Root' },
    { name: 'MyDonation', label: 'My Donation', icon: 'heart', route: 'StaffDonationsList' }, // Using StaffDonations for staff
    { name: 'ReportProblem', label: 'Report a Problem', icon: 'warning', route: 'StaffComplaints' },
    { name: 'Events', label: 'Events', icon: 'calendar', route: 'Events' },
    { name: 'Attendance', label: 'Attendance', icon: 'calendar', route: 'StaffAttendance' },
    { name: 'SalaryAdvance', label: 'Salary Advance', icon: 'cash', route: 'StaffPaymentAdvance' },
    { name: 'UploadReport', label: 'Upload Report', icon: 'cloud-upload', route: 'UploadEvent' },
  ];

  // Group 2 Menu Items (Shared)
  const secondaryMenu = [
    { name: 'AboutUs', label: 'About Us', icon: 'information-circle-outline', route: 'AboutUs' },
    { name: 'ContactUs', label: 'Contact Us', icon: 'call-outline', route: 'ContactUs' },
    { name: 'Settings', label: 'Settings', icon: 'settings-outline', route: 'Profile' },
  ];

  const isStaffOrManager = user?.role === Roles.STAFF || user?.role === Roles.MANAGER;
  
  // Decide which primary menu to use
  const activePrimaryMenu = isStaffOrManager ? staffMenu : primaryMenu;

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
            
            {/* Top Bar with X Close Button */}
            <View style={styles.topCloseRow}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#17202A" />
              </TouchableOpacity>
            </View>

            {/* Organization Branding */}
            <View style={styles.brandContainer}>
              <View style={styles.logoRing}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandTextGroup}>
                <Text style={styles.brandTitle}>SREELAKSHMI</Text>
                <Text style={styles.brandSubtitle}>CHARITABLE TRUST</Text>
              </View>
            </View>

            {/* Navigation List */}
            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
              
              {/* Group 1 */}
              {activePrimaryMenu.map((item) => {
                const isActive = currentRoute === item.route || (item.name === 'Home' && currentRoute === 'Home');
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => navigateTo(item.route)}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isActive ? '#1689D8' : '#1689D8'} // Keep icons blue as per screenshot
                      style={styles.menuIcon}
                    />
                    <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                      {item.label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={isActive ? '#1689D8' : '#A0AEC0'}
                      style={{ opacity: isActive ? 1 : 0 }} // Only show arrow on active (Home) as per screenshot
                    />
                  </TouchableOpacity>
                );
              })}

              {/* Staff / Manager Special Upload Action is now integrated in staffMenu, so we remove the extra conditional render */}

              {/* Divider 1 */}
              <View style={styles.divider} />

              {/* Group 2 */}
              {secondaryMenu.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={styles.menuItem}
                  onPress={() => navigateTo(item.route)}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color="#17202A"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#A0AEC0" />
                </TouchableOpacity>
              ))}

              {/* Divider 2 */}
              <View style={styles.divider} />

              {/* Logout Item */}
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#17202A" style={styles.menuIcon} />
                <Text style={styles.menuLabel}>Logout</Text>
                <Ionicons name="chevron-forward" size={16} color="#A0AEC0" />
              </TouchableOpacity>

            </ScrollView>

            {/* Bottom Wave Decoration & Charity Message */}
            <View style={styles.footerContainer}>
              {/* Soft Wave Overlays */}
              <View style={styles.waveLayer1} />
              <View style={styles.waveLayer2} />

              {/* Center Quote & Heart */}
              <View style={styles.quoteBox}>
                <Text style={styles.scriptTextMain}>Together</Text>
                <Text style={styles.scriptTextSub}>for a Better Tomorrow</Text>
                <Ionicons name="heart" size={18} color="#1689D8" style={{ marginTop: 6 }} />
              </View>
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
    backgroundColor: 'rgba(23, 32, 42, 0.4)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topCloseRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  logoRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#1689D8',
    alignItems: 'center',
    justify: 'center',
    overflow: 'hidden',
    backgroundColor: '#F5FBFF',
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  brandTextGroup: {
    justify: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1689D8',
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1689D8',
    letterSpacing: 0.5,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#EAF7FF',
  },
  menuIcon: {
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#17202A',
  },
  menuLabelActive: {
    color: '#1689D8',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 10,
    marginHorizontal: 8,
  },
  footerContainer: {
    height: 130,
    position: 'relative',
    justify: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  waveLayer1: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    right: -40,
    height: 100,
    backgroundColor: '#EAF7FF',
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
  },
  waveLayer2: {
    position: 'absolute',
    bottom: -15,
    left: -20,
    right: -20,
    height: 80,
    backgroundColor: '#BAE6FD',
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    opacity: 0.5,
  },
  quoteBox: {
    alignItems: 'center',
    zIndex: 2,
    marginBottom: 10,
  },
  scriptTextMain: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1689D8',
    fontStyle: 'italic',
  },
  scriptTextSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1689D8',
    fontStyle: 'italic',
    marginTop: -2,
  },
});

export default SideDrawer;
