import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { API_BASE_URL } from '../api.js';

// Cache authentication status until app closes
let authCache = {
    isAuthenticated: false,
    hasChecked: false,
};

// Function to clear auth cache (can be called from logout)
export const clearAuthCache = () => {
    authCache.isAuthenticated = false;
    authCache.hasChecked = false;
};

const ProtectedRoute = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const navigation = useNavigation();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) {
                    navigation.replace('Login');
                    return;
                }

                // Check if we have already verified authentication in this app session
                if (authCache.hasChecked && authCache.isAuthenticated) {
                    setIsAuthenticated(true);
                    setIsLoading(false);
                    return;
                }

                // Verify token by making a request to a protected endpoint
                try {
                    await axios.get(`${API_BASE_URL}/api/v1/user/user`);
                    authCache.isAuthenticated = true;
                    authCache.hasChecked = true;
                    setIsAuthenticated(true);
                } catch (error) {
                    // If token is invalid, clear storage and redirect to login
                    if (error.response?.status === 401) {
                        await AsyncStorage.removeItem('token');
                        await AsyncStorage.removeItem('userData');
                        authCache.isAuthenticated = false;
                        authCache.hasChecked = false;
                        navigation.replace('Login');
                        return;
                    }
                    // For other errors, we'll still consider the user authenticated
                    // as the token might be valid but the endpoint might be down
                    authCache.isAuthenticated = true;
                    authCache.hasChecked = true;
                    setIsAuthenticated(true);
                }
            } catch (error) {
                console.error('Auth check error:', error);
                authCache.isAuthenticated = false;
                authCache.hasChecked = false;
                navigation.replace('Login');
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [navigation]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#06a6f7" />
            </View>
        );
    }

    return isAuthenticated ? children : null;
};

export default ProtectedRoute; 