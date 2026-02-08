import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from './src/theme';

import DashboardScreen from './src/screens/DashboardScreen';
import NodeDetailsScreen from './src/screens/NodeDetailsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Dark theme for navigation
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

// Tab icon component
function TabIcon({ label, focused }) {
  const iconMap = {
    'Dashboard': '◉',
    'Settings': '⚙',
  };

  return (
    <View style={tabStyles.iconContainer}>
      <Text style={[
        tabStyles.icon,
        { color: focused ? colors.accent : colors.textMuted }
      ]}>
        {iconMap[label] || '●'}
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  icon: {
    fontSize: 20,
    fontWeight: '900',
  },
});

// Dashboard stack (Dashboard + NodeDetails)
function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 14,
          letterSpacing: 2,
          textTransform: 'uppercase',
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="DashboardHome"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NodeDetails"
        component={NodeDetailsScreen}
        options={({ route }) => ({
          title: route.params?.hostname || 'Node',
          headerBackTitle: 'Back',
        })}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={NexusTheme}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bgCard,
            borderTopColor: colors.border,
            borderTopWidth: 2,
            paddingBottom: 6,
            paddingTop: 4,
            height: 60,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 2,
            textTransform: 'uppercase',
          },
          tabBarIcon: ({ focused }) => (
            <TabIcon label={route.name} focused={focused} />
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardStack} />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerTitle: '',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

