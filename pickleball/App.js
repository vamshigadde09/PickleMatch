import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProtectedRoute from './src/context/ProtectedRoute';
import PublicRoute from './src/context/PublicRoute';
import { MainTabs } from './src/navigation/MainTabs';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CreateRoomScreen from './src/screens/CreateRoomScreen';
import RoomDashboardScreen from './src/screens/RoomDashboardScreen';
import SelectMembersScreen from './src/screens/SelectMembersScreen';
import ChooseGameFormatScreen from './src/screens/ChooseGameFormatScreen';
import TeamAssignmentScreen from './src/screens/TeamAssignmentScreen';
import ActiveMatchScreen from './src/screens/ActiveMatchScreen';
import GameResultsScreen from './src/screens/GameResultsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import AddPlayersToRoomScreen from './src/screens/AddPlayersToRoomScreen';
import UserProfileViewScreen from './src/screens/UserProfileViewScreen';

const Stack = createNativeStackNavigator();

const ProtectedScreen = (ScreenComponent) => {
  return (props) => (
    <ProtectedRoute>
      <ScreenComponent {...props} />
    </ProtectedRoute>
  );
};

const PublicScreen = (ScreenComponent) => {
  return (props) => (
    <PublicRoute>
      <ScreenComponent {...props} />
    </PublicRoute>
  );
};



export default function App() {
  const [initialRoute, setInitialRoute] = useState('Login');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          setInitialRoute('HomePage');

        } else {
          setInitialRoute('Login');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setInitialRoute('Login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen
            name="Login"
            component={PublicScreen(LoginScreen)}
          />
          <Stack.Screen
            name="Register"
            component={PublicScreen(RegisterScreen)}
          />
          <Stack.Screen
            name="HomePage"
            component={ProtectedScreen(MainTabs)}
          />
          <Stack.Screen
            name="CreateRoom"
            component={ProtectedScreen(CreateRoomScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RoomDashboard"
            component={ProtectedScreen(RoomDashboardScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SelectMembers"
            component={ProtectedScreen(SelectMembersScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ChooseGameFormat"
            component={ProtectedScreen(ChooseGameFormatScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TeamAssignment"
            component={ProtectedScreen(TeamAssignmentScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ActiveMatch"
            component={ProtectedScreen(ActiveMatchScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="GameResults"
            component={ProtectedScreen(GameResultsScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="History"
            component={ProtectedScreen(HistoryScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AddPlayersToRoom"
            component={ProtectedScreen(AddPlayersToRoomScreen)}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="UserProfileView"
            component={ProtectedScreen(UserProfileViewScreen)}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: StatusBar.currentHeight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
});
