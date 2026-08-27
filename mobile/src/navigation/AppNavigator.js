import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuthStore } from '../store/authStore';
import { LoadingScreen } from '../components/shared';
import { View, Text } from 'react-native';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Staff Screens
import StaffHomeScreen from '../screens/staff/HomeScreen';
import AddMemberScreen from '../screens/staff/AddMemberScreen';
import CollectDonationScreen from '../screens/staff/CollectDonationScreen';
import StaffMembersListScreen from '../screens/staff/StaffMembersListScreen';
import StaffDonationsListScreen from '../screens/staff/StaffDonationsListScreen';
import StaffAssessmentsListScreen from '../screens/staff/StaffAssessmentsListScreen';
import ComplaintsScreen from '../screens/staff/ComplaintsScreen';
import StaffReportsScreen from '../screens/staff/StaffReportsScreen';
import AttendanceScreen from '../screens/staff/AttendanceScreen';
import PaymentAdvanceScreen from '../screens/staff/PaymentAdvanceScreen';
import AchievedPointsScreen from '../screens/staff/AchievedPointsScreen';

// Manager Screens
import ManagerHomeScreen from '../screens/manager/ManagerHomeScreen';

// Member Screens
import MemberHomeScreen from '../screens/member/MemberHomeScreen';
import MembershipPaymentScreen from '../screens/member/MembershipPaymentScreen';

// FAO Screens
import FAOHomeScreen from '../screens/fao/FAOHomeScreen';
import FAOReportScreen from '../screens/fao/FAOReportScreen';

// ACO Screens
import ACOHomeScreen from '../screens/aco/ACOHomeScreen';
import ACOCalculationScreen from '../screens/aco/ACOCalculationScreen';

// GEO Screens
import GEOHomeScreen from '../screens/geo/GEOHomeScreen';
import GEOReportScreen from '../screens/geo/GEOReportScreen';

// Shared Screens
import ProfileScreen from '../screens/shared/ProfileScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';

// Assessment Screens
import NewAssessmentScreen from '../screens/assessment/NewAssessmentScreen';
import AssessmentDetailScreen from '../screens/assessment/AssessmentDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Temporary placeholders for missing tabs
const Placeholder = ({ name }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>{name}</Text></View>
);

const sharedTabOptions = ({ route }) => ({
  headerShown: false,
  tabBarIcon: ({ focused, color, size }) => {
    const icons = {
      Home: focused ? 'home' : 'home-outline',
      Members: focused ? 'people' : 'people-outline',
      Assessments: focused ? 'clipboard' : 'clipboard-outline',
      Cases: focused ? 'file-tray-full' : 'file-tray-full-outline',
      Inbox: focused ? 'mail' : 'mail-outline',
      Profile: focused ? 'person' : 'person-outline',
    };
    return <Ionicons name={icons[route.name]} size={size} color={color} />;
  },
  tabBarActiveTintColor: Colors.primary,
  tabBarInactiveTintColor: Colors.gray400,
  tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60, elevation: 10 },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginBottom: 5 },
});

const CasesTab = () => <Placeholder name="My Cases Tab" />;

const StaffTabs = () => (
  <Tab.Navigator screenOptions={sharedTabOptions}>
    <Tab.Screen name="Home" component={StaffHomeScreen} />
    <Tab.Screen name="Members" component={StaffMembersListScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const ManagerTabs = () => (
  <Tab.Navigator screenOptions={sharedTabOptions}>
    <Tab.Screen name="Home" component={ManagerHomeScreen} />
    <Tab.Screen name="Members" component={StaffMembersListScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const MemberTabs = () => (
  <Tab.Navigator screenOptions={sharedTabOptions}>
    <Tab.Screen name="Home" component={MemberHomeScreen} />
    <Tab.Screen name="Cases" component={CasesTab} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const FAOTabs = () => (
  <Tab.Navigator screenOptions={sharedTabOptions}>
    <Tab.Screen name="Home" component={FAOHomeScreen} options={{ tabBarLabel: 'Inbox' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const ACOTabs = () => (
  <Tab.Navigator screenOptions={sharedTabOptions}>
    <Tab.Screen name="Home" component={ACOHomeScreen} options={{ tabBarLabel: 'Inbox' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const GEOTabs = () => (
  <Tab.Navigator screenOptions={sharedTabOptions}>
    <Tab.Screen name="Home" component={GEOHomeScreen} options={{ tabBarLabel: 'Inbox' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const MainStack = () => {
  const { isStaff, isMember, isFAO, isACO, isGEO, isManager } = useAuthStore();
  
  let HomeTabs = StaffTabs;
  if (isMember()) HomeTabs = MemberTabs;
  if (isManager()) HomeTabs = ManagerTabs;
  if (isFAO()) HomeTabs = FAOTabs;
  if (isACO()) HomeTabs = ACOTabs;
  if (isGEO()) HomeTabs = GEOTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 280 }}>
      <Stack.Screen name="Root" component={HomeTabs} options={{ animation: 'slide_from_left' }} />
      
      {/* Staff Actions */}
      <Stack.Screen name="AddMember" component={AddMemberScreen} />
      <Stack.Screen name="CollectDonation" component={CollectDonationScreen} />
      <Stack.Screen name="StaffMembersList" component={StaffMembersListScreen} />
      <Stack.Screen name="StaffDonationsList" component={StaffDonationsListScreen} />
      <Stack.Screen name="StaffAssessmentsList" component={StaffAssessmentsListScreen} />

      {/* Staff Drawer Features */}
      <Stack.Screen name="StaffComplaints" component={ComplaintsScreen} />
      <Stack.Screen name="StaffReports" component={StaffReportsScreen} />
      <Stack.Screen name="StaffAttendance" component={AttendanceScreen} />
      <Stack.Screen name="StaffPaymentAdvance" component={PaymentAdvanceScreen} />
      <Stack.Screen name="StaffAchievedPoints" component={AchievedPointsScreen} />

      
      {/* Member Actions */}
      <Stack.Screen name="MembershipPayment" component={MembershipPaymentScreen} />
      
      {/* Assessments (Staff/Member) */}
      <Stack.Screen name="NewAssessment" component={NewAssessmentScreen} />
      <Stack.Screen name="AssessmentDetail" component={AssessmentDetailScreen} />

      {/* FAO — Field Report */}
      <Stack.Screen name="FAOReport" component={FAOReportScreen} />

      {/* ACO — Cost Calculation */}
      <Stack.Screen name="ACOCalculation" component={ACOCalculationScreen} />

      {/* GEO — Verification Report */}
      <Stack.Screen name="GEOReport" component={GEOReportScreen} />
      {/* Shared Screens */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
};

export const AppNavigator = () => {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [init, setInit] = useState(false);

  useEffect(() => {
    initialize().then(() => setInit(true));
  }, [initialize]);

  if (!init || isLoading) {
    return <LoadingScreen message="Initializing App..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Auth Stack — Login + Signup share a stack so navigation.navigate() works between them
          <>
            <Stack.Screen name="Auth" component={LoginScreen} options={{ animationTypeForReplace: 'pop' }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <Stack.Screen name="Main" component={MainStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
