import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from './src/theme';
import { isPaired } from './src/api';

// Main screens
import DashboardScreen from './src/screens/DashboardScreen';
import NodeDetailsScreen from './src/screens/NodeDetailsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

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
function TabIcon({ label, focused }) {
  const iconMap = { 'Dashboard': '◉', 'Settings': '⚙' };
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={[tabStyles.icon, { color: focused ? colors.accent : colors.textMuted }]}>
        {iconMap[label] || '●'}
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  icon: { fontSize: 20, fontWeight: '900' },
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
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} />
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
      <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
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

  useEffect(() => {
    checkPairing();
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
    <NavigationContainer theme={NexusTheme}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      {paired ? (
        <MainTabs onUnpair={handleUnpair} />
      ) : (
        <AuthFlow onPairingComplete={handlePairingComplete} />
      )}
    </NavigationContainer>
  );
}

