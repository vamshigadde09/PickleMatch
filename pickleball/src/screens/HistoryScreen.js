import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState, useMemo } from 'react';
import {
    ActivityIndicator,
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

// Helper function to get auth headers
const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

export const HistoryScreen = ({ navigation }) => {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all', 'won', 'lost', 'pickle', 'round-robin', 'quick-knockout', 'one-vs-one', 'two-vs-two'
    const [sortBy, setSortBy] = useState('date'); // 'date', 'points'

    const fetchHistory = useCallback(
        async (showLoader = true) => {
            if (showLoader) {
                setIsLoading(true);
            }
            setIsRefreshing(true);

            try {
                const headers = await getAuthHeaders();
                // Fetch all games (no limit)
                const gamesResponse = await axios.get(`${API_BASE_URL}/api/v1/game/user/recent?limit=1000`, { headers });

                if (gamesResponse?.data?.success && gamesResponse.data.games) {
                    const formattedHistory = gamesResponse.data.games.map(game => ({
                        id: game.id,
                        room: game.room,
                        roomCode: game.roomCode,
                        gameType: game.gameType,
                        date: game.date,
                        winner: game.winner || 'N/A',
                        points: game.points || 0,
                        userTeam: game.userTeam,
                        status: game.status,
                    }));
                    setHistory(formattedHistory);
                } else {
                    setHistory([]);
                }
            } catch (error) {
                console.log('History fetch failed:', error?.response?.data || error?.message);
                setHistory([]);
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [],
    );

    useFocusEffect(
        useCallback(() => {
            fetchHistory(true);
        }, [fetchHistory]),
    );

    const onRefresh = useCallback(() => {
        fetchHistory(false);
    }, [fetchHistory]);

    const filteredAndSortedHistory = useMemo(() => {
        let filtered = [...history];

        // Apply filter
        if (filter !== 'all') {
            if (filter === 'won') {
                filtered = filtered.filter(game => game.userTeam && game.winner === game.userTeam);
            } else if (filter === 'lost') {
                filtered = filtered.filter(game => game.userTeam && game.winner !== game.userTeam && game.winner !== 'N/A');
            } else {
                // Filter by game type
                const typeMap = {
                    'pickle': 'Pickle Format',
                    'round-robin': 'Round Robin',
                    'quick-knockout': 'Quick Knockout',
                    'one-vs-one': '1 vs 1',
                    'two-vs-two': '2 vs 2',
                };
                const filterType = typeMap[filter];
                filtered = filtered.filter(game => game.gameType === filterType);
            }
        }

        // Apply sort
        filtered.sort((a, b) => {
            if (sortBy === 'points') {
                return (b.points || 0) - (a.points || 0);
            } else {
                // Sort by date (newest first)
                return new Date(b.date) - new Date(a.date);
            }
        });

        return filtered;
    }, [history, filter, sortBy]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

        if (diffHours < 1) return 'Just now';
        if (diffDays === 0) {
            if (diffHours === 1) return '1 hour ago';
            return `${diffHours} hours ago`;
        }
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    const formatFullDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getGameTypeColor = (gameType) => {
        if (gameType?.includes('Pickle')) return '#8b5cf6';
        if (gameType?.includes('Round Robin')) return '#06b6d4';
        if (gameType?.includes('Knockout')) return '#f59e0b';
        if (gameType?.includes('1 vs 1')) return '#ec4899';
        if (gameType?.includes('2 vs 2')) return '#10b981';
        return palette.accent;
    };

    const handleGamePress = (game) => {
        // Use game.id (from API) or fallback to _id if available
        const gameId = game.id || game._id;
        if (gameId && navigation?.navigate) {
            navigation.navigate('GameResults', {
                gameId: gameId,
            });
        }
    };

    const filterOptions = [
        { id: 'all', label: 'All Games', icon: 'list' },
        { id: 'won', label: 'Won', icon: 'award' },
        { id: 'lost', label: 'Lost', icon: 'x-circle' },
        { id: 'pickle', label: 'Pickle', icon: 'target' },
        { id: 'round-robin', label: 'Round Robin', icon: 'refresh-cw' },
        { id: 'quick-knockout', label: 'Knockout', icon: 'zap' },
        { id: 'one-vs-one', label: '1 vs 1', icon: 'user' },
        { id: 'two-vs-two', label: '2 vs 2', icon: 'users' },
    ];

    const sortOptions = [
        { id: 'date', label: 'Newest First', icon: 'calendar' },
        { id: 'points', label: 'Most Points', icon: 'trending-up' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation?.goBack()}
                    style={styles.backButton}
                >
                    <Feather name="arrow-left" size={24} color={palette.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Game History</Text>
                    <Text style={styles.headerSubtitle}>{filteredAndSortedHistory.length} games</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            {/* Filters */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContainer}
            >
                {filterOptions.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.filterChip,
                            filter === option.id && styles.filterChipActive,
                        ]}
                        onPress={() => setFilter(option.id)}
                        activeOpacity={0.7}
                    >
                        <Feather
                            name={option.icon}
                            size={14}
                            color={filter === option.id ? '#fff' : palette.accent}
                        />
                        <Text
                            style={[
                                styles.filterChipText,
                                filter === option.id && styles.filterChipTextActive,
                            ]}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Sort Options */}
            <View style={styles.sortContainer}>
                <Text style={styles.sortLabel}>Sort by:</Text>
                {sortOptions.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.sortChip,
                            sortBy === option.id && styles.sortChipActive,
                        ]}
                        onPress={() => setSortBy(option.id)}
                        activeOpacity={0.7}
                    >
                        <Feather
                            name={option.icon}
                            size={12}
                            color={sortBy === option.id ? palette.accent : palette.textSecondary}
                        />
                        <Text
                            style={[
                                styles.sortChipText,
                                sortBy === option.id && styles.sortChipTextActive,
                            ]}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={palette.accent}
                        colors={[palette.accent]}
                    />
                }
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={palette.accent} />
                        <Text style={styles.loadingText}>Loading history...</Text>
                    </View>
                ) : filteredAndSortedHistory.length > 0 ? (
                    <View style={styles.historyList}>
                        {filteredAndSortedHistory.map((entry) => (
                            <HistoryCard
                                key={entry.id ?? entry.room}
                                entry={entry}
                                onPress={() => handleGamePress(entry)}
                                formatDate={formatDate}
                                formatFullDate={formatFullDate}
                                getGameTypeColor={getGameTypeColor}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <Feather name="clock" size={48} color={palette.accent} />
                        </View>
                        <Text style={styles.emptyTitle}>No games found</Text>
                        <Text style={styles.emptySubtitle}>
                            {filter !== 'all'
                                ? 'Try adjusting your filters to see more games.'
                                : 'Start playing games to see your history here.'}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const HistoryCard = ({ entry, onPress, formatDate, formatFullDate, getGameTypeColor }) => {
    const gameColor = getGameTypeColor(entry.gameType);
    const isWinner = entry.userTeam && entry.winner === entry.userTeam;

    return (
        <TouchableOpacity
            style={styles.historyCard}
            activeOpacity={0.85}
            onPress={onPress}
        >
            <View style={styles.historyCardHeader}>
                <View style={styles.historyCardMain}>
                    <View style={styles.historyCardTop}>
                        <Text style={styles.historyRoom}>{entry.room}</Text>
                        {entry.roomCode && (
                            <View style={styles.roomCodeBadge}>
                                <Text style={styles.roomCodeText}>{entry.roomCode}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.historyCardMeta}>
                        <View style={[styles.gameTypeBadge, { backgroundColor: gameColor + '15' }]}>
                            <Text style={[styles.gameTypeText, { color: gameColor }]}>
                                {entry.gameType || 'Game'}
                            </Text>
                        </View>
                        {isWinner && (
                            <View style={styles.winnerBadge}>
                                <Feather name="award" size={12} color="#f59e0b" />
                                <Text style={styles.winnerBadgeText}>Winner</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.historyDate}>{formatDate(entry.date)}</Text>
                    <Text style={styles.historyFullDate}>{formatFullDate(entry.date)}</Text>
                </View>
                {entry.points > 0 && (
                    <View style={styles.pointsContainer}>
                        <LinearGradient
                            colors={[palette.accent, '#9f7aea']}
                            style={styles.pointsBadge}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.pointsValue}>{entry.points}</Text>
                            <Text style={styles.pointsLabel}>pts</Text>
                        </LinearGradient>
                    </View>
                )}
            </View>
            <View style={styles.historyCardFooter}>
                {entry.userTeam && (
                    <View style={styles.footerItem}>
                        <Feather name="users" size={14} color={palette.textSecondary} />
                        <Text style={styles.footerLabel}>Your Team</Text>
                        <Text style={styles.footerValue}>{entry.userTeam}</Text>
                    </View>
                )}
                <View style={styles.footerDivider} />
                <View style={styles.footerItem}>
                    <Feather name="trophy" size={14} color={isWinner ? '#f59e0b' : palette.textSecondary} />
                    <Text style={styles.footerLabel}>Winner</Text>
                    <Text style={[styles.footerValue, isWinner && styles.footerValueWinner]}>
                        {entry.winner || 'N/A'}
                    </Text>
                </View>
            </View>
            <View style={styles.cardArrow}>
                <Feather name="chevron-right" size={20} color={palette.textSecondary} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: palette.accentLight,
    },
    headerContent: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: palette.textPrimary,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: palette.textSecondary,
        marginTop: 2,
    },
    headerSpacer: {
        width: 40,
    },
    filterScroll: {
        maxHeight: 60,
    },
    filterContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: palette.card,
        borderWidth: 1.5,
        borderColor: palette.border,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: palette.accent,
        borderColor: palette.accent,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.accent,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    sortContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    sortLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.textSecondary,
        marginRight: 4,
    },
    sortChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: palette.accentLight,
        borderWidth: 1,
        borderColor: palette.border,
    },
    sortChipActive: {
        backgroundColor: palette.accentLight,
        borderColor: palette.accent,
    },
    sortChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: palette.textSecondary,
    },
    sortChipTextActive: {
        color: palette.accent,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: palette.textSecondary,
    },
    historyList: {
        gap: 16,
    },
    historyCard: {
        backgroundColor: palette.card,
        borderRadius: 24,
        padding: 20,
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
        borderWidth: 1.5,
        borderColor: palette.border,
        position: 'relative',
    },
    historyCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    historyCardMain: {
        flex: 1,
        gap: 8,
    },
    historyCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    historyRoom: {
        fontSize: 18,
        fontWeight: '800',
        color: palette.textPrimary,
    },
    roomCodeBadge: {
        backgroundColor: palette.accentLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roomCodeText: {
        fontSize: 11,
        fontWeight: '700',
        color: palette.accent,
        letterSpacing: 0.5,
    },
    historyCardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    gameTypeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    gameTypeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    winnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fef3c7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    winnerBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#f59e0b',
    },
    historyDate: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    historyFullDate: {
        fontSize: 12,
        color: palette.textSecondary,
    },
    pointsContainer: {
        shadowColor: palette.accent,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    pointsBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minWidth: 60,
    },
    pointsValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
    },
    pointsLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
        opacity: 0.9,
    },
    historyCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: palette.border,
        paddingTop: 16,
        gap: 16,
    },
    footerItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerDivider: {
        width: 1,
        height: 30,
        backgroundColor: palette.border,
    },
    footerLabel: {
        fontSize: 11,
        color: palette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
    },
    footerValue: {
        fontSize: 14,
        fontWeight: '700',
        color: palette.textPrimary,
        marginLeft: 4,
    },
    footerValueWinner: {
        color: '#f59e0b',
    },
    cardArrow: {
        position: 'absolute',
        right: 20,
        top: '50%',
        marginTop: -10,
    },
    emptyState: {
        paddingVertical: 80,
        alignItems: 'center',
        gap: 16,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: palette.accentLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    emptySubtitle: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 40,
    },
});

export default HistoryScreen;
