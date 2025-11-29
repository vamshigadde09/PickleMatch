import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, KeyboardAvoidingView, Platform, Keyboard, StatusBar, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../api.js';

// Optional imports - handle gracefully if not available
let SignInHeader = null;


// Create axios instance with interceptor
const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add request interceptor
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for token expiration
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('userData');
            // You might want to navigate to login screen here
        }
        return Promise.reject(error);
    }
);

const LoginScreen = () => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showWelcome, setShowWelcome] = useState(false);
    const [welcomeOpacity] = useState(new Animated.Value(0));
    const navigation = useNavigation();

    const storeUserData = async (user) => {
        try {
            await AsyncStorage.setItem("userData", JSON.stringify(user));
        } catch (error) {
            console.error("Error storing user data:", error);
        }
    };

    const showWelcomeMessage = async () => {
        setShowWelcome(true);
        Animated.sequence([
            Animated.timing(welcomeOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(1000),
            Animated.timing(welcomeOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setShowWelcome(false);
            // Navigate to home page
            if (navigation?.replace) {
                navigation.replace('HomePage');
            }
        });
    };

    const handlePhoneChange = (text) => {
        // Remove any non-digit characters
        const digits = text.replace(/\D/g, '');
        // Take only the first 10 digits
        const formattedPhone = digits.slice(0, 10);
        setPhone(formattedPhone);
        setError('');
    };

    const validateForm = () => {
        if (!phone) {
            setError('Phone number is required');
            return false;
        }
        if (phone.length !== 10) {
            setError('Phone number must be 10 digits');
            return false;
        }
        if (!/^[6-9]/.test(phone)) {
            setError('Phone number must start with 6, 7, 8, or 9');
            return false;
        }
        if (!password) {
            setError('Password is required');
            return false;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }
        return true;
    };

    const handleLogin = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            const response = await api.post('/api/v1/user/login', {
                mobile: phone,
                password: password
            });

            console.log('Login response:', response.data);

            if (!response.data.success) {
                throw new Error(response.data.message || 'Login failed');
            }

            // Store both token and user data from server response
            await AsyncStorage.setItem('token', response.data.token);
            await storeUserData(response.data.user);

            // Log user data and token
            console.log('User Data:', response.data.user);
            console.log('Token:', response.data.token);

            // Show welcome message with animation
            showWelcomeMessage();
        } catch (error) {
            console.error("Login error:", error);
            let errorMessage = "Login failed";

            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = "User not found. Please register first.";
                } else if (error.response.data?.message) {
                    errorMessage = error.response.data.message;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#8b5cf6" />

            {/* Welcome Message Overlay */}
            {showWelcome && (
                <Animated.View style={[styles.welcomeOverlay, { opacity: welcomeOpacity }]}>
                    <View style={styles.welcomeMessage}>
                        <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                        <Text style={styles.welcomeText}>Welcome Back!</Text>
                        <Text style={styles.welcomeSubtext}>Login successful</Text>
                    </View>
                </Animated.View>
            )}

            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
            >
                <View style={styles.contentContainer}>
                    <View style={styles.card}>
                        <View style={styles.welcomeSection}>
                            {SignInHeader && (
                                <View style={styles.headerImageContainer}>
                                    <SignInHeader width={width * 0.5} height={45} />
                                </View>
                            )}
                            <Text style={styles.subtitle}>Enter your credentials to access your account</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <View style={styles.inputContainer}>
                                <MaterialIcons name="phone" size={20} color="#8b5cf6" style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter 10-digit mobile number"
                                    placeholderTextColor="#9ca3af"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    autoCapitalize="none"
                                    onBlur={() => Keyboard.dismiss()}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <View style={styles.inputContainer}>
                                <Feather name="lock" size={20} color="#8b5cf6" style={styles.icon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#9ca3af"
                                    value={password}
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        setError('');
                                    }}
                                    secureTextEntry={!isPasswordVisible}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                    style={styles.eyeIcon}
                                >
                                    <Feather
                                        name={isPasswordVisible ? 'eye' : 'eye-off'}
                                        size={20}
                                        color="#8b5cf6"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <TouchableOpacity
                            style={[styles.button, (isLoading || phone.length !== 10 || !password) && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading || phone.length !== 10 || !password}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={(isLoading || phone.length !== 10 || !password) ? ['#9ca3af', '#6b7280'] : ['#3b82f6', '#2563eb']}
                                style={styles.buttonGradient}
                            >
                                <View style={styles.buttonContent}>
                                    {isLoading && <Ionicons name="hourglass-outline" size={20} color="#ffffff" style={styles.buttonIcon} />}
                                    <Text style={styles.buttonText}>
                                        {isLoading ? 'Signing In...' : 'Sign In'}
                                    </Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.linkContainer}>
                            <Text style={styles.linkText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => {
                                if (navigation?.navigate) {
                                    navigation.navigate('Register');
                                }
                            }} activeOpacity={0.7}>
                                <Text style={styles.link}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    keyboardContainer: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingBottom: 30,
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        paddingVertical: 32,
        paddingHorizontal: 24,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.1)',
    },
    welcomeSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    headerImageContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        height: 56,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1f2937',
        backgroundColor: 'transparent',
    },
    icon: {
        marginRight: 12,
    },
    button: {
        borderRadius: 16,
        marginTop: 24,
        marginBottom: 16,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonGradient: {
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonIcon: {
        marginRight: 8,
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    buttonDisabled: {
        shadowOpacity: 0.1,
    },
    linkContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    linkText: {
        color: '#6b7280',
        fontSize: 15,
    },
    link: {
        color: '#8b5cf6',
        fontWeight: 'bold',
        fontSize: 15,
        marginLeft: 4,
    },
    error: {
        color: '#ef4444',
        fontSize: 15,
        marginBottom: 16,
        textAlign: 'center',
        backgroundColor: '#fef2f2',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fecaca',
        fontWeight: '500',
    },
    eyeIcon: {
        padding: 8,
    },
    welcomeOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    welcomeMessage: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 16,
        minWidth: 280,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginTop: 16,
        marginBottom: 8,
    },
    welcomeSubtext: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
    },
});

export default LoginScreen;
export { LoginScreen };
