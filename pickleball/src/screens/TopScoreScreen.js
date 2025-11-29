/**
 * Top Scores Screen
 * Displays global leaderboards and top scores - Redesigned with focus on Points & Wins
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/colors.js';
import { API_BASE_URL } from '../api.js';

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

export const TopScoreScreen = () => {
    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState('individual');
    const [sortBy, setSortBy] = useState('points'); // 'points' or 'wins'

    const [topPlayers, setTopPlayers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Search state
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [isAddingFriend, setIsAddingFriend] = useState(false);

    // Fetch top individual players
    const fetchTopPlayers = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await axios.get(
                `${API_BASE_URL}/api/v1/top-scores/individual?sortBy=${sortBy}&limit=50`,
                { headers }
            );
            if (response?.data?.success && response.data.players) {
                setTopPlayers(response.data.players);
            } else {
                // If response doesn't have expected structure, set empty array
                console.warn('Unexpected response structure:', response?.data);
                setTopPlayers([]);
            }
        } catch (error) {
            console.error('Error fetching top players:', error);
            // Set empty array on error to prevent infinite loading
            setTopPlayers([]);
        }
    }, [sortBy]);

    // Load data
    const loadData = useCallback(async (showLoader = true) => {
        if (showLoader) {
            setIsLoading(true);
        }
        try {
            await fetchTopPlayers();
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [fetchTopPlayers]);

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [loadData]),
    );

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        loadData(false);
    }, [loadData]);

    // Search users
    const handleSearch = useCallback(async (query) => {
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            setSearchError('');
            return;
        }

        const cleanQuery = query.trim().replace(/[\s\-+()]/g, '');
        const isPhoneNumber = /^\d+$/.test(cleanQuery);

        if (isPhoneNumber && cleanQuery.length < 7) {
            setSearchError('Please enter at least 7 digits to search by phone number');
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        setSearchError('');

        try {
            const headers = await getAuthHeaders();
            const response = await axios.get(
                `${API_BASE_URL}/api/v1/user/search?q=${encodeURIComponent(query.trim())}`,
                { headers }
            );

            if (response?.data?.success && response.data.users) {
                setSearchResults(response.data.users);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Error searching users:', error);
            setSearchError(
                error?.response?.data?.message ||
                'Failed to search. Please try again.'
            );
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounce search query
    const searchTimeoutRef = useRef(null);
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!searchQuery || searchQuery.trim().length === 0) {
            setSearchResults([]);
            setSearchError('');
            return;
        }

        searchTimeoutRef.current = setTimeout(() => {
            handleSearch(searchQuery);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, handleSearch]);

    const handleSearchInputChange = useCallback((text) => {
        setSearchQuery(text);
        setSearchError('');
    }, []);

    // Handle add friend from search results
    const handleAddFriend = useCallback(async (user) => {
        setIsAddingFriend(true);
        try {
            const headers = await getAuthHeaders();
            const response = await axios.post(
                `${API_BASE_URL}/api/v1/user/friends/add`,
                { username: user.username },
                { headers }
            );

            if (response?.data?.success) {
                setSearchResults(prevResults =>
                    prevResults.map(item =>
                        item._id.toString() === user._id.toString()
                            ? { ...item, isFriend: true }
                            : item
                    )
                );
            }
        } catch (error) {
            console.error('Error adding friend:', error);
        } finally {
            setIsAddingFriend(false);
        }
    }, []);

    // Render search result card
    const renderSearchResultCard = ({ item }) => {
        const displayName = item.displayName || item.username || 'User';
        const initials = getInitials(displayName);

        return (
            <View style={styles.searchResultCard}>
                <View style={styles.searchResultLeft}>
                    <View style={styles.searchAvatarContainer}>
                        {item.avatarUrl ? (
                            <Image source={{ uri: item.avatarUrl }} style={styles.searchAvatar} />
                        ) : (
                            <View style={styles.searchAvatarPlaceholder}>
                                <Text style={styles.searchAvatarText}>{initials}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName} numberOfLines={1}>
                            {displayName}
                        </Text>
                        <Text style={styles.searchResultUsername} numberOfLines={1}>
                            @{item.username}
                        </Text>
                    </View>
                </View>

                <View style={styles.searchResultActions}>
                    {item.isSelf ? (
                        <TouchableOpacity
                            style={[styles.searchActionButton, styles.searchActionButtonDisabled]}
                            disabled
                        >
                            <Text style={styles.searchActionButtonText}>You</Text>
                        </TouchableOpacity>
                    ) : item.isFriend ? (
                        <TouchableOpacity
                            style={[styles.searchActionButton, styles.searchActionButtonSecondary]}
                            onPress={() => {
                                if (navigation?.navigate) {
                                    navigation.navigate('UserProfileView', { userId: item._id });
                                }
                            }}
                        >
                            <Feather name="user" size={16} color={palette.accent} />
                            <Text style={[styles.searchActionButtonText, { color: palette.accent }]}>View Profile</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.searchActionButton, styles.searchActionButtonPrimary]}
                            onPress={() => handleAddFriend(item)}
                            disabled={isAddingFriend}
                        >
                            {isAddingFriend ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Feather name="user-plus" size={16} color="#fff" />
                                    <Text style={styles.searchActionButtonText}>Add Friend</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    // Render player card - Simplified with focus on Points & Wins
    const renderPlayerCard = ({ item, index }) => {
        const rank = index + 1;
        const isTopThree = rank <= 3;

        let rankIcon = null;
        let rankBadgeStyle = styles.rankBadge;

        if (rank === 1) {
            rankIcon = '🥇';
            rankBadgeStyle = styles.rankBadgeGold;
        } else if (rank === 2) {
            rankIcon = '🥈';
            rankBadgeStyle = styles.rankBadgeSilver;
        } else if (rank === 3) {
            rankIcon = '🥉';
            rankBadgeStyle = styles.rankBadgeBronze;
        }

        return (
            <View style={styles.playerCard}>
                <View style={styles.playerCardLeft}>
                    <View style={rankBadgeStyle}>
                        {rankIcon ? (
                            <Text style={styles.rankIcon}>{rankIcon}</Text>
                        ) : (
                            <Text style={styles.rankText}>#{rank}</Text>
                        )}
                    </View>

                    <View style={styles.avatarContainer}>
                        {item.avatarUrl ? (
                            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                        ) : (
                            <LinearGradient
                                colors={[palette.accent, '#9f7aea']}
                                style={styles.avatarPlaceholder}
                            >
                                <Text style={styles.avatarText}>
                                    {getInitials(item.displayName || item.username)}
                                </Text>
                            </LinearGradient>
                        )}
                    </View>

                    <View style={styles.playerInfo}>
                        <Text style={styles.playerName} numberOfLines={1}>
                            {item.displayName || item.username}
                        </Text>
                        <Text style={styles.playerUsername} numberOfLines={1}>
                            @{item.username}
                        </Text>
                    </View>
                </View>

                <View style={styles.playerStats}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{item.points || 0}</Text>
                        <Text style={styles.statLabel}>Points</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{item.wins || 0}</Text>
                        <Text style={styles.statLabel}>Wins</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar style="light" />

            {/* Header */}
            <LinearGradient
                colors={[palette.accent, '#9f7aea']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <View style={styles.headerTitleContainer}>
                        <Feather name="award" size={28} color="#fff" />
                        <Text style={styles.headerTitle}>Top Scores</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowSearchModal(true)}
                        style={styles.searchButton}
                        activeOpacity={0.7}
                    >
                        <View style={styles.searchButtonInner}>
                            <Feather name="search" size={20} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'individual' && styles.tabActive]}
                    onPress={() => {
                        setActiveTab('individual');
                        loadData(true);
                    }}
                    activeOpacity={0.7}
                >
                    <View style={styles.tabContent}>
                        <Feather
                            name="users"
                            size={18}
                            color={activeTab === 'individual' ? '#fff' : palette.textSecondary}
                        />
                        <Text style={[styles.tabText, activeTab === 'individual' && styles.tabTextActive]}>
                            Top Players
                        </Text>
                    </View>
                    {activeTab === 'individual' && <View style={styles.tabIndicator} />}
                </TouchableOpacity>
            </View>

            {/* Filters - Simplified to just Points and Wins */}
            <View style={styles.filtersContainer}>
                <View style={styles.segmentedControl}>
                    <TouchableOpacity
                        style={[styles.segmentedButton, sortBy === 'points' && styles.segmentedButtonActive]}
                        onPress={() => {
                            setSortBy('points');
                            loadData(true);
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.segmentedButtonText, sortBy === 'points' && styles.segmentedButtonTextActive]}>
                            Points
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.segmentedButton, sortBy === 'wins' && styles.segmentedButtonActive]}
                        onPress={() => {
                            setSortBy('wins');
                            loadData(true);
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.segmentedButtonText, sortBy === 'wins' && styles.segmentedButtonTextActive]}>
                            Wins
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={styles.loadingText}>Loading leaderboard...</Text>
                </View>
            ) : (
                <FlatList
                    data={topPlayers}
                    renderItem={renderPlayerCard}
                    keyExtractor={(item, index) => item._id?.toString() || item.userId?.toString() || `player-${index}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={palette.accent}
                            colors={[palette.accent]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <Feather name="award" size={48} color={palette.accent} />
                            </View>
                            <Text style={styles.emptyText}>No players yet</Text>
                            <Text style={styles.emptySubtext}>
                                Start playing games to see leaderboards here!
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Search Modal - Bottom Sheet Style */}
            <Modal
                visible={showSearchModal}
                transparent
                animationType="slide"
                statusBarTranslucent={true}
                onRequestClose={() => {
                    setShowSearchModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setSearchError('');
                }}
            >
                <TouchableOpacity
                    style={styles.searchModalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setShowSearchModal(false);
                        setSearchQuery('');
                        setSearchResults([]);
                        setSearchError('');
                    }}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <SafeAreaView style={styles.searchModalContainer} edges={['bottom']}>
                            <View style={styles.searchModalHandle} />
                            <View style={styles.searchModalHeader}>
                                <Text style={styles.searchModalTitle}>Search Players</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowSearchModal(false);
                                        setSearchQuery('');
                                        setSearchResults([]);
                                        setSearchError('');
                                    }}
                                    style={styles.searchModalCloseButton}
                                >
                                    <Feather name="x" size={24} color={palette.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.searchInputContainer}>
                                <Feather name="search" size={20} color={palette.textSecondary} style={styles.searchInputIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search by name, username, or phone (min 7 digits)"
                                    placeholderTextColor={palette.textSecondary}
                                    value={searchQuery}
                                    onChangeText={handleSearchInputChange}
                                    autoFocus
                                    autoCapitalize="none"
                                    keyboardType="default"
                                    returnKeyType="search"
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setSearchQuery('');
                                            setSearchResults([]);
                                            setSearchError('');
                                        }}
                                        style={styles.searchInputClearButton}
                                    >
                                        <Feather name="x" size={18} color={palette.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {searchError ? (
                                <View style={styles.searchErrorContainer}>
                                    <Feather name="alert-circle" size={16} color={palette.warning} />
                                    <Text style={styles.searchErrorText}>{searchError}</Text>
                                </View>
                            ) : null}

                            {isSearching ? (
                                <View style={styles.searchLoadingContainer}>
                                    <ActivityIndicator size="small" color={palette.accent} />
                                    <Text style={styles.searchLoadingText}>Searching...</Text>
                                </View>
                            ) : searchQuery.length > 0 ? (
                                searchResults.length > 0 ? (
                                    <FlatList
                                        data={searchResults}
                                        renderItem={renderSearchResultCard}
                                        keyExtractor={(item, index) => item._id?.toString() || `search-result-${index}`}
                                        contentContainerStyle={styles.searchResultsList}
                                        showsVerticalScrollIndicator={false}
                                    />
                                ) : !isSearching && searchQuery.length > 0 && !searchError ? (
                                    <View style={styles.searchEmptyContainer}>
                                        <Feather name="user-x" size={48} color={palette.textSecondary} />
                                        <Text style={styles.searchEmptyText}>No players found</Text>
                                        <Text style={styles.searchEmptySubtext}>
                                            Try a different search term
                                        </Text>
                                    </View>
                                ) : null
                            ) : (
                                <View style={styles.searchEmptyContainer}>
                                    <Feather name="search" size={48} color={palette.textSecondary} />
                                    <Text style={styles.searchEmptyText}>Start typing to search</Text>
                                    <Text style={styles.searchEmptySubtext}>
                                        Search by name, username, or phone number{'\n'}
                                        (minimum 7 digits for phone search)
                                    </Text>
                                </View>
                            )}
                        </SafeAreaView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    searchButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    searchButtonInner: {
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: palette.card,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        marginHorizontal: 4,
    },
    tabActive: {
        backgroundColor: palette.accent,
    },
    tabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tabIndicator: {
        height: 3,
        width: '60%',
        backgroundColor: '#fff',
        borderRadius: 2,
        marginTop: 6,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: palette.textSecondary,
    },
    tabTextActive: {
        color: '#fff',
        fontWeight: '700',
    },
    filtersContainer: {
        backgroundColor: palette.card,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: palette.background,
        borderRadius: 30,
        padding: 4,
        gap: 4,
    },
    segmentedButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentedButtonActive: {
        backgroundColor: palette.accent,
    },
    segmentedButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.textSecondary,
    },
    segmentedButtonTextActive: {
        color: '#ffffff',
        fontWeight: '700',
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
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    playerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    playerCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    rankBadge: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: palette.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankBadgeGold: {
        backgroundColor: '#FFD70020',
    },
    rankBadgeSilver: {
        backgroundColor: '#C0C0C020',
    },
    rankBadgeBronze: {
        backgroundColor: '#CD7F3220',
    },
    rankIcon: {
        fontSize: 18,
    },
    rankText: {
        fontSize: 12,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    avatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        shadowColor: palette.accent,
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    playerInfo: {
        flex: 1,
        gap: 2,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    playerUsername: {
        fontSize: 13,
        color: palette.textSecondary,
        marginTop: 2,
    },
    playerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statItem: {
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        minWidth: 60,
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    statLabel: {
        fontSize: 11,
        color: palette.textSecondary,
        marginTop: 4,
        fontWeight: '500',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        gap: 16,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.accentLight,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
        marginTop: 8,
    },
    emptySubtext: {
        fontSize: 15,
        color: palette.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 22,
    },
    // Search Modal Styles
    searchModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    searchModalContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: palette.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 8,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
        elevation: 20,
    },
    searchModalHandle: {
        width: 40,
        height: 4,
        backgroundColor: palette.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 8,
    },
    searchModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    searchModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    searchModalCloseButton: {
        padding: 8,
        borderRadius: 8,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: palette.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
    },
    searchInputIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: palette.textPrimary,
        padding: 0,
    },
    searchInputClearButton: {
        padding: 4,
        marginLeft: 8,
    },
    searchErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: palette.errorLight,
        borderRadius: 8,
        gap: 8,
    },
    searchErrorText: {
        flex: 1,
        fontSize: 14,
        color: palette.error,
    },
    searchLoadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    searchLoadingText: {
        fontSize: 16,
        color: palette.textSecondary,
    },
    searchResultsList: {
        padding: 20,
        paddingBottom: 40,
    },
    searchEmptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    searchEmptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: palette.textPrimary,
        marginTop: 16,
        textAlign: 'center',
    },
    searchEmptySubtext: {
        fontSize: 14,
        color: palette.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    searchResultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: palette.card,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: palette.border,
    },
    searchResultLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    searchAvatarContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
    },
    searchAvatar: {
        width: '100%',
        height: '100%',
    },
    searchAvatarPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: palette.accentLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.accent,
    },
    searchResultInfo: {
        flex: 1,
        gap: 4,
    },
    searchResultName: {
        fontSize: 16,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    searchResultUsername: {
        fontSize: 14,
        color: palette.textSecondary,
    },
    searchResultActions: {
        marginLeft: 12,
    },
    searchActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    searchActionButtonPrimary: {
        backgroundColor: palette.accent,
    },
    searchActionButtonSecondary: {
        backgroundColor: palette.background,
        borderWidth: 1,
        borderColor: palette.accent,
    },
    searchActionButtonDisabled: {
        backgroundColor: palette.background,
        borderWidth: 1,
        borderColor: palette.border,
        opacity: 0.6,
    },
    searchActionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});

export default TopScoreScreen;
