import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { API_BASE_URL } from '../api.js';
const PublicRoute = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const navigation = useNavigation();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) {
                    setIsLoading(false);
                    return;
                }

                // Verify token by making a request to a protected endpoint
                try {
                    await axios.get(`${API_BASE_URL}/api/v1/user/user`);
                    setIsAuthenticated(true);
                    navigation.replace('HomePage');
                } catch (error) {
                    // If token is invalid, clear storage
                    if (error.response?.status === 401) {
                        await AsyncStorage.removeItem('token');
                        await AsyncStorage.removeItem('userData');
                    }
                }
            } catch (error) {
                console.error('Auth check error:', error);
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

    return !isAuthenticated ? children : null;
};

export default PublicRoute; 