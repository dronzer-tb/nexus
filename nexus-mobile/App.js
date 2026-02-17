import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LayoutDashboard, Settings, Circle, CircleCheck, Bell } from 'lucide-react-native';
import { colors } from './src/theme';
import { isPaired } from './src/api';
import {
  registerForPushNotifications,
  startAlertPolling,
  stopAlertPolling,
  addNotificationResponseListener,
  getUnreadCount,
} from './src/notifications';

// Main screens
import DashboardScreen from './src/screens/DashboardScreen';
import NodeDetailsScreen from './src/screens/NodeDetailsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AlertFeedScreen from './src/screens/AlertFeedScreen';

// Auth flow screens
import QRScannerScreen from './src/screens/QRScannerScreen';
import OTPEntryScreen from './src/screens/OTPEntryScreen';
import LoginScreen from './src/screens/LoginScreen';
import TwoFactorScreen from './src/screens/TwoFactorScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();

// Dark theme
const NexusTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgCard,
    text: colors.text,
    border: colors.border,
    notification: colors.pink,
  },
};

// Tab icon
function TabIcon({ label, focused, badge }) {
  const iconMap = { 'Dashboard': LayoutDashboard, 'Alerts': Bell, 'Settings': Settings };
  const Icon = iconMap[label] || Circle;
  return (
    <View style={tabStyles.iconContainer}>
      <Icon size={20} color={focused ? colors.accent : colors.textMuted} strokeWidth={2.5} />
      {badge > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  badge: {
    position: 'absolute', top: -2, right: -12,
    backgroundColor: colors.pink || '#ff2d7b',
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff', fontSize: 9, fontWeight: '900',
  },
});

// ─── Dashboard Stack (Dashboard → NodeDetails) ───
function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '900', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="NodeDetails"
        component={NodeDetailsScreen}
        options={({ route }) => ({ title: route.params?.hostname || 'Node', headerBackTitle: 'Back' })}
      />
    </Stack.Navigator>
  );
}

// ─── Main Tab Navigator (shown when paired) ───
function MainTabs({ onUnpair }) {
  const [unreadCount, setUnreadCount] = useState(0);

  // Refresh unread count every 5 seconds
  useEffect(() => {
    const refresh = () => getUnreadCount().then(setUnreadCount).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const SettingsWithUnpair = useCallback(
    () => <SettingsScreen onUnpair={onUnpair} />,
    [onUnpair]
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          paddingBottom: 6, paddingTop: 4, height: 60,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 9, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase',
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon
            label={route.name}
            focused={focused}
            badge={route.name === 'Alerts' ? unreadCount : 0}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
      <Tab.Screen name="Alerts" component={AlertFeedScreen} />
      <Tab.Screen
        name="Settings"
        component={SettingsWithUnpair}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitle: '',
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Pairing Complete Screen ───
function PairingCompleteScreen({ route }) {
  const onComplete = route.params?.onComplete;
  useEffect(() => {
    const timer = setTimeout(() => { if (onComplete) onComplete(); }, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
      <CircleCheck size={48} color={colors.accent} strokeWidth={2} style={{ marginBottom: 16 }} />
      <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '900', letterSpacing: 2 }}>
        PAIRED
      </Text>
      <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 16 }} />
    </View>
  );
}

// ─── Auth Flow Navigator (shown when not paired) ───
function AuthFlow({ onPairingComplete }) {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '900', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <AuthStack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{ title: 'Scan QR Code', headerShown: false }}
      />
      <AuthStack.Screen
        name="OTPEntry"
        component={OTPEntryScreen}
        options={{ title: 'Enter OTP', headerBackTitle: 'Back' }}
      />
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Login', headerBackTitle: 'Back' }}
      />
      <AuthStack.Screen
        name="TwoFactor"
        component={TwoFactorScreen}
        options={{ title: '2FA Verify', headerBackTitle: 'Back' }}
      />
      <AuthStack.Screen
        name="PairingComplete"
        options={{ headerShown: false }}
      >
        {(props) => <PairingCompleteScreen {...props} route={{ ...props.route, params: { ...props.route.params, onComplete: onPairingComplete } }} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

// ─── Root App ───
export default function App() {
  const [checking, setChecking] = useState(true);
  const [paired, setPaired] = useState(false);
  const navigationRef = useRef(null);
  const stopPollingRef = useRef(null);

  useEffect(() => {
    checkPairing();
    // Register for local notification permissions
    registerForPushNotifications().catch(() => {});
  }, []);

  // Start/stop alert polling based on pairing state
  useEffect(() => {
    if (paired) {
      stopPollingRef.current = startAlertPolling();
    } else {
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
      stopAlertPolling();
    }
    return () => {
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
    };
  }, [paired]);

  // Handle notification taps — navigate to Alerts tab
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification?.request?.content?.data;
      if (navigationRef.current) {
        // Navigate to Alerts tab
        navigationRef.current.navigate('Alerts');
      }
    });
    return () => subscription?.remove();
  }, []);

  const checkPairing = async () => {
    try {
      const result = await isPaired();
      setPaired(result);
    } catch {
      setPaired(false);
    } finally {
      setChecking(false);
    }
  };

  const handlePairingComplete = useCallback(() => {
    setPaired(true);
  }, []);

  const handleUnpair = useCallback(() => {
    setPaired(false);
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 11, fontWeight: '700', letterSpacing: 3 }}>
          NEXUS
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={NexusTheme} ref={navigationRef}>
        <StatusBar style="light" backgroundColor={colors.bg} />
        {paired ? (
          <MainTabs onUnpair={handleUnpair} />
        ) : (
          <AuthFlow onPairingComplete={handlePairingComplete} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

