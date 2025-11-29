/**
 * User Profile View Screen
 * Displays another user's profile with stats and contact information
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/colors.js';
import { API_BASE_URL } from '../api.js';
import { useAlert } from '../utils/alertUtils.js';

// Helper function to get auth headers
const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

// Helper to get user initials for avatar
const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

export const UserProfileViewScreen = ({ route, navigation }) => {
    const { userId } = route.params || {};
    const { showAlert, AlertComponent } = useAlert();

    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isAddingFriend, setIsAddingFriend] = useState(false);
    const isFetchingRef = useRef(false);

    // Fetch user profile data
    const fetchProfileData = useCallback(async (showLoader = true) => {
        if (!userId || isFetchingRef.current) return;

        isFetchingRef.current = true;

        if (showLoader) {
            setIsLoading(true);
        }

        try {
            const headers = await getAuthHeaders();
            const response = await axios.get(
                `${API_BASE_URL}/api/v1/user/profile/${userId}`,
                { headers }
            );

            if (response?.data?.success && response.data.profile) {
                setProfileData(response.data.profile);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            showAlert(
                'Error',
                error?.response?.data?.message || 'Failed to load profile',
                [{ text: 'OK' }]
            );
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            isFetchingRef.current = false;
        }
    }, [userId]);

    // Fetch data on mount and when userId changes - only fetch once per userId
    useEffect(() => {
        if (!userId) return;

        let isMounted = true;
        isFetchingRef.current = true;
        setIsLoading(true);

        const loadProfile = async () => {
            try {
                const headers = await getAuthHeaders();
                const response = await axios.get(
                    `${API_BASE_URL}/api/v1/user/profile/${userId}`,
                    { headers }
                );

                if (isMounted && response?.data?.success && response.data.profile) {
                    setProfileData(response.data.profile);
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
                if (isMounted) {
                    showAlert(
                        'Error',
                        error?.response?.data?.message || 'Failed to load profile',
                        [{ text: 'OK' }]
                    );
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    isFetchingRef.current = false;
                }
            }
        };

        loadProfile();

        // Cleanup function
        return () => {
            isMounted = false;
            isFetchingRef.current = false;
        };
    }, [userId]); // Only depend on userId

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchProfileData(false);
    }, [fetchProfileData]);

    // Handle add friend
    const handleAddFriend = useCallback(async () => {
        if (!profileData) return;

        setIsAddingFriend(true);
        try {
            const headers = await getAuthHeaders();
            const response = await axios.post(
                `${API_BASE_URL}/api/v1/user/friends/add`,
                { username: profileData.username },
                { headers }
            );

            if (response?.data?.success) {
                showAlert('Success', 'Friend added successfully!', [{ text: 'OK' }]);
                // Refresh profile to update friend status
                await fetchProfileData(false);
            }
        } catch (error) {
            console.error('Error adding friend:', error);
            showAlert(
                'Error',
                error?.response?.data?.message || 'Failed to add friend',
                [{ text: 'OK' }]
            );
        } finally {
            setIsAddingFriend(false);
        }
    }, [profileData, fetchProfileData]); // Removed showAlert from dependencies

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!profileData) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.errorContainer}>
                    <Feather name="user-x" size={48} color={palette.textSecondary} />
                    <Text style={styles.errorText}>Profile not found</Text>
                    <TouchableOpacity
                        onPress={() => navigation?.goBack()}
                        style={styles.errorBackButton}
                        activeOpacity={0.7}
                    >
                        <Feather name="arrow-left" size={20} color={palette.accent} />
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const displayName = profileData.displayName || profileData.username || 'User';
    const initials = getInitials(displayName);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <AlertComponent />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation?.goBack()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={24} color={palette.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={palette.accent}
                        colors={[palette.accent]}
                    />
                }
            >
                {/* Profile Header */}
                <LinearGradient
                    colors={[palette.accent, palette.accentLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileHeader}
                >
                    <View style={styles.avatarWrapper}>
                        <View style={styles.avatarContainer}>
                            {profileData.avatarUrl ? (
                                <Image
                                    source={{ uri: profileData.avatarUrl }}
                                    style={styles.avatar}
                                />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarText}>{initials}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={styles.displayName}>{displayName}</Text>
                    <Text style={styles.username}>@{profileData.username}</Text>

                    {/* Add Friend Button */}
                    {!profileData.isSelf && !profileData.isFriend && (
                        <TouchableOpacity
                            onPress={handleAddFriend}
                            disabled={isAddingFriend}
                            style={styles.addFriendButton}
                            activeOpacity={0.8}
                        >
                            {isAddingFriend ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Feather name="user-plus" size={18} color="#fff" />
                                    <Text style={styles.addFriendButtonText}>Add Friend</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {profileData.isFriend && (
                        <View style={styles.friendBadge}>
                            <Feather name="check" size={16} color="#fff" />
                            <Text style={styles.friendBadgeText}>Friends</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* Stats Section */}
                <View style={styles.statsContainer}>
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <View style={styles.statIconContainer}>
                                <Feather name="award" size={20} color={palette.accent} />
                            </View>
                            <Text style={styles.statValue}>{profileData.points || 0}</Text>
                            <Text style={styles.statLabel}>Points</Text>
                        </View>
                        <View style={styles.statCard}>
                            <View style={styles.statIconContainer}>
                                <Feather name="trophy" size={20} color={palette.accent} />
                            </View>
                            <Text style={styles.statValue}>{profileData.wins || 0}</Text>
                            <Text style={styles.statLabel}>Wins</Text>
                        </View>
                        <View style={styles.statCard}>
                            <View style={styles.statIconContainer}>
                                <Feather name="activity" size={20} color={palette.accent} />
                            </View>
                            <Text style={styles.statValue}>{profileData.games || 0}</Text>
                            <Text style={styles.statLabel}>Games</Text>
                        </View>
                        <View style={styles.statCard}>
                            <View style={styles.statIconContainer}>
                                <Feather name="zap" size={20} color={palette.accent} />
                            </View>
                            <Text style={styles.statValue}>{profileData.streak || 0}</Text>
                            <Text style={styles.statLabel}>Streak</Text>
                        </View>
                    </View>

                    <View style={styles.winRateCard}>
                        <View style={styles.winRateIconContainer}>
                            <Feather name="target" size={24} color={palette.accent} />
                        </View>
                        <Text style={styles.winRateLabel}>Win Rate</Text>
                        <Text style={styles.winRateValue}>{profileData.winPercentage || 0}%</Text>
                    </View>
                </View>

                {/* Contact Information */}
                {profileData.mobile && (
                    <View style={styles.infoSection}>
                        <View style={styles.sectionHeader}>
                            <Feather name="phone" size={20} color={palette.accent} />
                            <Text style={styles.sectionTitle}>Contact</Text>
                        </View>
                        <View style={styles.infoCard}>
                            <View style={styles.infoIconContainer}>
                                <Feather name="phone" size={20} color={palette.accent} />
                            </View>
                            <Text style={styles.infoText}>{profileData.mobile}</Text>
                        </View>
                    </View>
                )}

                {/* Empty space at bottom */}
                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 16,
        color: palette.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        gap: 16,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: palette.textPrimary,
        textAlign: 'center',
    },
    errorBackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: palette.accentLight,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 8,
        borderWidth: 1,
        borderColor: palette.accent,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.accent,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: palette.background,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
        flex: 1,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    profileHeader: {
        padding: 32,
        paddingBottom: 40,
        alignItems: 'center',
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        marginBottom: 4,
    },
    avatarWrapper: {
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    avatarContainer: {
        borderRadius: 60,
        overflow: 'hidden',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    avatarText: {
        fontSize: 42,
        fontWeight: '700',
        color: '#fff',
    },
    displayName: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 6,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    username: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.95)',
        marginBottom: 20,
        fontWeight: '500',
    },
    addFriendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    addFriendButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    friendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 4,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    friendBadgeText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    statsContainer: {
        padding: 20,
        gap: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: palette.card,
        padding: 16,
        paddingTop: 20,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    statIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.accentLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontSize: 26,
        fontWeight: '700',
        color: palette.accent,
        marginBottom: 6,
    },
    statLabel: {
        fontSize: 12,
        color: palette.textSecondary,
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    winRateCard: {
        backgroundColor: palette.card,
        padding: 24,
        paddingTop: 28,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    winRateIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: palette.accentLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    winRateLabel: {
        fontSize: 14,
        color: palette.textSecondary,
        marginBottom: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    winRateValue: {
        fontSize: 36,
        fontWeight: '700',
        color: palette.accent,
    },
    infoSection: {
        paddingHorizontal: 20,
        marginTop: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: palette.card,
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    infoIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.accentLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 17,
        color: palette.textPrimary,
        flex: 1,
        fontWeight: '600',
    },
    bottomSpacer: {
        height: 40,
    },
});

export default UserProfileViewScreen;

