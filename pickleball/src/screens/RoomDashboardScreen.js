import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
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
import { MatchTimeline } from '../components/MatchTimeline.js';

// Helper function to get auth headers
const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

export const RoomDashboardScreen = ({ route, navigation }) => {
    const { roomId, roomName } = route.params || {};
    const [roomData, setRoomData] = useState(null);
    const [activeGame, setActiveGame] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [topPlayers, setTopPlayers] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const [showPlayersModal, setShowPlayersModal] = useState(false);

    // Helper function to check if current user is a member
    const isCurrentUserMember = () => {
        if (!roomData || !currentUserId || !roomData.members) return false;
        return roomData.members.some((member) => {
            const memberId = member._id ? member._id.toString() : member.toString();
            return memberId === currentUserId.toString();
        });
    };

    // Helper function to check if current user is the creator
    const isCurrentUserCreator = () => {
        if (!roomData || !currentUserId || !roomData.createdBy) return false;
        const creatorId = roomData.createdBy._id ? roomData.createdBy._id.toString() : roomData.createdBy.toString();
        return creatorId === currentUserId.toString();
    };

    const fetchLeaderboard = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            console.log('🏆 [RoomDashboard] Fetching leaderboard for room:', roomId);
            const leaderboardResponse = await axios.get(`${API_BASE_URL}/api/v1/room/${roomId}/leaderboard`, { headers });
            console.log('🏆 [RoomDashboard] Leaderboard response:', leaderboardResponse?.data);
            if (leaderboardResponse?.data?.success && leaderboardResponse.data.leaderboard) {
                console.log('🏆 [RoomDashboard] Setting top players:', leaderboardResponse.data.leaderboard);
                setTopPlayers(leaderboardResponse.data.leaderboard);
            } else {
                console.log('🏆 [RoomDashboard] No leaderboard data or empty');
                setTopPlayers([]);
            }
        } catch (error) {
            console.error('🏆 [RoomDashboard] Leaderboard fetch error:', error?.response?.data || error?.message);
            setTopPlayers([]);
        }
    }, [roomId]);

    // Get current user ID
    React.useEffect(() => {
        const getCurrentUserId = async () => {
            try {
                const userDataStr = await AsyncStorage.getItem('userData');
                if (userDataStr) {
                    const userData = JSON.parse(userDataStr);
                    setCurrentUserId(userData._id || userData.id);
                }
            } catch (error) {
                console.log('Error getting user ID:', error);
            }
        };
        getCurrentUserId();
    }, []);

    const fetchRoomData = useCallback(
        async (showLoader = true) => {
            if (showLoader) {
                setIsLoading(true);
            }
            setErrorMessage('');

            try {
                const headers = await getAuthHeaders();

                // Fetch room details
                const roomResponse = await axios.get(`${API_BASE_URL}/api/v1/room/${roomId}`, { headers });

                if (roomResponse?.data?.success && roomResponse.data.room) {
                    setRoomData(roomResponse.data.room);
                }

                // Fetch active game for this room
                try {
                    const gameResponse = await axios.get(`${API_BASE_URL}/api/v1/game/room/${roomId}/active`, { headers });

                    if (gameResponse?.data?.success) {
                        if (gameResponse.data.hasActiveGame && gameResponse.data.game) {
                            setActiveGame(gameResponse.data.game);
                            setTopPlayers([]); // Clear leaderboard when active game exists
                        } else {
                            setActiveGame(null);
                            // Fetch leaderboard when there's no active game
                            fetchLeaderboard();
                        }
                    } else {
                        setActiveGame(null);
                        // Fetch leaderboard when there's no active game
                        fetchLeaderboard();
                    }
                } catch (gameError) {
                    console.log('Active game fetch error:', gameError?.response?.data || gameError?.message);
                    // If error, set to null (no active game)
                    setActiveGame(null);
                    // Fetch leaderboard when there's no active game
                    fetchLeaderboard();
                }
            } catch (error) {
                console.log('Room dashboard fetch failed:', error?.response?.data || error?.message);
                if (error.response?.status === 401) {
                    setErrorMessage('Please log in again.');
                } else if (error.response?.status === 404) {
                    setErrorMessage('Room not found.');
                } else {
                    setErrorMessage('Unable to load room data. Please check your connection and try again.');
                }
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [roomId, fetchLeaderboard],
    );

    useFocusEffect(
        useCallback(() => {
            fetchRoomData(true);
        }, [fetchRoomData]),
    );

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchRoomData(false);
    }, [fetchRoomData]);

    const handleCopyRoomCode = async (roomCode) => {
        try {
            await Clipboard.setStringAsync(roomCode);
            // Silently copy to clipboard - no alert
        } catch (error) {
            console.error('Error copying room code:', error);
            // Silent failure - no alert
        }
    };

    const handleToggleRoomStatus = async () => {
        if (!roomData) return;

        const newStatus = roomData.status === 'active' ? 'inactive' : 'active';
        const actionText = newStatus === 'active' ? 'activate' : 'deactivate';

        Alert.alert(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Room`,
            `Are you sure you want to ${actionText} this room?`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
                    style: newStatus === 'inactive' ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            setIsTogglingStatus(true);
                            const headers = await getAuthHeaders();
                            const response = await axios.patch(
                                `${API_BASE_URL}/api/v1/room/${roomId}/toggle-status`,
                                {},
                                { headers }
                            );

                            if (response.data?.success) {
                                setRoomData(response.data.room);
                                Alert.alert(
                                    'Success',
                                    `Room has been ${actionText}d successfully.`,
                                    [{ text: 'OK' }]
                                );
                            } else {
                                throw new Error(response.data?.message || 'Failed to toggle room status');
                            }
                        } catch (error) {
                            console.error('Error toggling room status:', error?.response?.data || error?.message);
                            Alert.alert(
                                'Error',
                                error?.response?.data?.message || 'Failed to toggle room status. Please try again.'
                            );
                        } finally {
                            setIsTogglingStatus(false);
                        }
                    },
                },
            ]
        );
    };

    const handleCreateNewGame = () => {
        console.log('📊 [RoomDashboard] Create New Game Button Pressed');
        console.log('📊 [RoomDashboard] Room Data:', {
            roomId,
            roomName: roomName || roomData?.name,
            totalMembers: roomData?.members?.length || 0,
            totalPlayers: roomData?.players?.length || 0,
            hasActiveGame: !!activeGame,
        });

        // Check if there's already an active game
        if (activeGame && activeGame._id) {
            Alert.alert(
                'Active Game Exists',
                'There is already an active game in this room. Would you like to continue the existing game?',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Continue Game',
                        onPress: () => handleContinueGame(),
                    },
                ]
            );
            return;
        }

        if (navigation?.navigate) {
            const params = {
                roomId: roomId,
                roomName: roomName || roomData?.name,
            };
            console.log('📊 [RoomDashboard] Navigating to SelectMembers with:', params);
            navigation.navigate('SelectMembers', params);
        }
    };

    const handleContinueGame = async () => {
        console.log('📊 [RoomDashboard] Continue Game Button Pressed');
        console.log('📊 [RoomDashboard] Active Game:', {
            gameId: activeGame?._id,
            gameType: activeGame?.type,
            status: activeGame?.status,
        });
        if (!activeGame) return;

        try {
            const headers = await getAuthHeaders();

            // Always fetch fresh game data to ensure we have the latest match statuses
            console.log('📊 [RoomDashboard] Fetching fresh game data...');
            const gameResponse = await axios.get(`${API_BASE_URL}/api/v1/game/${activeGame._id}`, { headers });

            if (!gameResponse?.data?.success || !gameResponse.data.game) {
                Alert.alert('Error', 'Unable to load game data. Please try again.');
                return;
            }

            const freshGame = gameResponse.data.game;
            const freshMatches = Array.isArray(freshGame.matches) ? freshGame.matches : [];
            console.log('📊 [RoomDashboard] Fresh game data loaded:', {
                gameId: freshGame._id,
                status: freshGame.status,
                currentRound: freshGame.currentRound,
                totalMatches: freshMatches.length,
            });

            // Filter for pending or live matches
            const pendingMatches = freshMatches.filter(m => {
                if (!m) return false;
                const status = m.status || '';
                return status === 'pending' || status === 'live' || (!status && !m.scoreA && !m.scoreB);
            });
            console.log('📊 [RoomDashboard] Pending matches:', pendingMatches.length);

            // Check if all matches are finished
            if (pendingMatches.length === 0 && freshMatches.length > 0) {
                // All matches completed
                if (freshGame.status === 'completed') {
                    // Game already completed, navigate to results
                    navigation.navigate('GameResults', {
                        gameId: freshGame._id,
                    });
                } else {
                    // All matches finished but game not marked as completed - calculate results
                    await calculateAndShowResults(freshGame._id, headers);
                }
                return;
            }

            // If there are pending matches, navigate to the first one
            if (pendingMatches.length > 0) {
                const nextMatch = pendingMatches[0];
                const matchIndex = freshMatches.findIndex(m => m._id === nextMatch._id);

                navigation.navigate('ActiveMatch', {
                    gameId: freshGame._id,
                    roomId: roomId,
                    roomName: roomName || roomData?.name,
                    gameFormat: freshGame.type,
                    teams: freshGame.teams || [],
                    matches: freshMatches,
                    currentMatchIndex: matchIndex >= 0 ? matchIndex : 0,
                    roundNumber: nextMatch.roundNumber || freshGame.currentRound || 1,
                });
                return;
            }

            // No matches at all - shouldn't happen, but handle gracefully
            if (freshMatches.length === 0) {
                Alert.alert('No Matches', 'This game has no matches yet. Please contact support.');
                return;
            }

        } catch (error) {
            console.log('Error continuing game:', error?.response?.data || error?.message);
            Alert.alert(
                'Error',
                error?.response?.data?.message || 'Unable to continue game. Please try again.'
            );
        }
    };

    const calculateAndShowResults = async (gameId, headers) => {
        try {
            setIsLoading(true);

            // Calculate winners
            const calcResponse = await axios.post(
                `${API_BASE_URL}/api/v1/game/${gameId}/calculate-winners`,
                {},
                { headers }
            );

            if (calcResponse?.data?.success) {
                // Assign points
                await axios.post(
                    `${API_BASE_URL}/api/v1/game/${gameId}/assign-points`,
                    {},
                    { headers }
                );

                setIsLoading(false);

                // Navigate to results screen
                navigation.navigate('GameResults', {
                    gameId: gameId,
                });
            } else {
                throw new Error(calcResponse?.data?.message || 'Failed to calculate winners');
            }
        } catch (error) {
            setIsLoading(false);
            console.log('Error calculating results:', error?.response?.data || error?.message);
            Alert.alert(
                'Error',
                error?.response?.data?.message || 'Unable to calculate results. Please try again.'
            );
        }
    };

    const handleViewResults = () => {
        if (activeGame?._id && navigation?.navigate) {
            navigation.navigate('GameResults', {
                gameId: activeGame._id,
            });
        }
    };

    const getGameTypeDisplayName = (type) => {
        const names = {
            'pickle': 'Pickle Format',
            'round-robin': 'Round Robin',
            'quick-knockout': 'Quick Knockout',
        };
        return names[type] || type;
    };

    const getGameStatusBadge = (status) => {
        switch (status) {
            case 'live':
                return { text: 'In Progress', color: '#10b981', bg: '#d1fae5' };
            case 'pending':
                return { text: 'Pending Start', color: '#f59e0b', bg: '#fef3c7' };
            case 'completed':
                return { text: 'Completed', color: '#6366f1', bg: '#e0e7ff' };
            default:
                return { text: status || 'Unknown', color: palette.textSecondary, bg: palette.accentLight };
        }
    };

    if (isLoading && !roomData) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={styles.loadingText}>Loading room...</Text>
                </View>
            </SafeAreaView>
        );
    }

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
                    <Text style={styles.headerTitle}>{roomName || roomData?.name || 'Room'}</Text>
                    {roomData?.code && (
                        <TouchableOpacity
                            onPress={() => handleCopyRoomCode(roomData.code)}
                            style={styles.roomCodeContainer}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.headerSubtitle}>Room Code: {roomData.code}</Text>
                            <Feather name="copy" size={14} color={palette.accent} style={styles.copyIcon} />
                        </TouchableOpacity>
                    )}
                </View>
                {/* Header Action Buttons */}
                <View style={styles.headerActions}>
                    {/* Add Members Button - Visible to all members */}
                    {isCurrentUserMember() ? (
                        <TouchableOpacity
                            onPress={() => {
                                if (navigation?.navigate) {
                                    navigation.navigate('AddPlayersToRoom', {
                                        roomId: roomId,
                                        roomName: roomName || roomData?.name,
                                    });
                                }
                            }}
                            style={styles.headerAddButton}
                            activeOpacity={0.7}
                        >
                            <Feather name="user-plus" size={20} color={palette.accent} />
                        </TouchableOpacity>
                    ) : null}

                    {/* Deactivate/Activate Button - Only visible to room creator */}
                    {isCurrentUserCreator() ? (
                        <TouchableOpacity
                            onPress={handleToggleRoomStatus}
                            disabled={isTogglingStatus}
                            style={styles.headerStatusButton}
                            activeOpacity={0.7}
                        >
                            {isTogglingStatus ? (
                                <ActivityIndicator size="small" color={roomData.status === 'active' ? '#ef4444' : '#10b981'} />
                            ) : (
                                <Feather
                                    name="power"
                                    size={20}
                                    color={roomData.status === 'active' ? '#ef4444' : '#10b981'}
                                />
                            )}
                        </TouchableOpacity>
                    ) : null}

                    {/* Spacer if no buttons visible */}
                    {!isCurrentUserMember() && !isCurrentUserCreator() && (
                        <View style={styles.headerSpacer} />
                    )}
                </View>
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
                {/* Room Info Card */}
                {roomData && (
                    <View style={styles.roomInfoCard}>
                        <View style={styles.roomInfoRow}>
                            <TouchableOpacity
                                style={styles.roomInfoItem}
                                activeOpacity={0.8}
                                onPress={() => roomData?.members?.length && setShowPlayersModal(true)}
                            >
                                <Feather name="users" size={20} color={palette.accent} />
                                <Text style={styles.roomInfoLabel}>Players</Text>
                                <Text style={styles.roomInfoValue}>{roomData.players?.length || 0}</Text>
                            </TouchableOpacity>
                            <View style={styles.roomInfoDivider} />
                            <View style={styles.roomInfoItem}>
                                <Feather name="user-check" size={20} color={palette.accent} />
                                <Text style={styles.roomInfoLabel}>Members</Text>
                                <Text style={styles.roomInfoValue}>{roomData.members?.length || 0}</Text>
                            </View>
                            <View style={styles.roomInfoDivider} />
                            <View style={styles.roomInfoItem}>
                                <Feather name="award" size={20} color={palette.accent} />
                                <Text style={styles.roomInfoLabel}>Games</Text>
                                <Text style={styles.roomInfoValue}>{roomData.history?.length || 0}</Text>
                            </View>
                        </View>
                    </View>
                )}


                {/* Active Game Card */}
                {activeGame && activeGame._id ? (
                    <TouchableOpacity
                        style={styles.activeGameCard}
                        onPress={handleContinueGame}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={['#8b5cf6', '#7c3aed']}
                            style={styles.activeGameGradient}
                        >
                            <View style={styles.activeGameHeader}>
                                <View>
                                    <Text style={styles.activeGameLabel}>
                                        Active Game
                                    </Text>
                                    <Text style={styles.activeGameTitle}>
                                        {getGameTypeDisplayName(activeGame.type)}
                                    </Text>
                                    <Text style={styles.inProcessText}>In Process</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: getGameStatusBadge(activeGame.status).bg }]}>
                                    <Text style={[styles.statusBadgeText, { color: getGameStatusBadge(activeGame.status).color }]}>
                                        {getGameStatusBadge(activeGame.status).text}
                                    </Text>
                                </View>
                            </View>

                            {/* Game Stats */}
                            <View style={styles.gameStatsRow}>
                                <View style={styles.gameStatItem}>
                                    <Text style={styles.gameStatLabel}>Round</Text>
                                    <Text style={styles.gameStatValue}>{activeGame.currentRound || 1}</Text>
                                </View>
                                <View style={styles.gameStatDivider} />
                                <View style={styles.gameStatItem}>
                                    <Text style={styles.gameStatLabel}>Teams</Text>
                                    <Text style={styles.gameStatValue}>{activeGame.teams?.length || 0}</Text>
                                </View>
                                <View style={styles.gameStatDivider} />
                                <View style={styles.gameStatItem}>
                                    <Text style={styles.gameStatLabel}>Matches</Text>
                                    <Text style={styles.gameStatValue}>
                                        {activeGame.matches?.filter(m => m && m.status === 'finished').length || 0} / {activeGame.matches?.length || 0}
                                    </Text>
                                </View>
                            </View>

                            {/* Match Timeline - Show for active games */}
                            {activeGame.matches && activeGame.matches.length > 0 && (
                                <View style={styles.timelineSection}>
                                    <MatchTimeline
                                        matches={activeGame.matches || []}
                                        currentRound={activeGame.currentRound || 1}
                                        maxMatchesToShow={5}
                                    />
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.gameActions}>
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={handleContinueGame}
                                    activeOpacity={0.8}
                                >
                                    <Feather name="play-circle" size={20} color="#fff" />
                                    <Text style={styles.primaryButtonText}>Continue Game</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : !isLoading ? (
                    <View style={styles.noActiveGameContainer}>
                        {/* Top Scores Podium */}
                        {topPlayers && topPlayers.length > 0 ? (
                            <View style={styles.podiumContainer}>
                                <Text style={styles.podiumTitle}>Top Scores</Text>
                                <View style={styles.podium}>
                                    {/* 2nd Place (Left) */}
                                    {topPlayers.length >= 2 && topPlayers[1] ? (
                                        <View style={styles.podiumPlace}>
                                            <View style={[styles.podiumBase, styles.podiumSecond]}>
                                                <View style={styles.podiumAvatarContainer}>
                                                    {topPlayers[1].avatar ? (
                                                        <Image source={{ uri: topPlayers[1].avatar }} style={styles.podiumAvatar} />
                                                    ) : (
                                                        <View style={[styles.podiumAvatarPlaceholder, { backgroundColor: '#C0C0C0' }]}>
                                                            <Text style={styles.podiumAvatarText}>
                                                                {topPlayers[1].name.substring(0, 2).toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.podiumName} numberOfLines={1}>{topPlayers[1].name}</Text>
                                                <Text style={styles.podiumPoints}>{topPlayers[1].points || 0} pts</Text>
                                                <View style={[styles.podiumMedal, { backgroundColor: '#C0C0C0' }]}>
                                                    <Text style={styles.podiumMedalNumber}>2</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ) : <View style={styles.podiumPlace} />}

                                    {/* 1st Place (Center) */}
                                    {topPlayers.length >= 1 && topPlayers[0] ? (
                                        <View style={styles.podiumPlace}>
                                            <View style={[styles.podiumBase, styles.podiumFirst]}>
                                                <View style={styles.podiumAvatarContainer}>
                                                    {topPlayers[0].avatar ? (
                                                        <Image source={{ uri: topPlayers[0].avatar }} style={styles.podiumAvatar} />
                                                    ) : (
                                                        <View style={[styles.podiumAvatarPlaceholder, { backgroundColor: '#FFD700' }]}>
                                                            <Text style={styles.podiumAvatarText}>
                                                                {topPlayers[0].name.substring(0, 2).toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.podiumName} numberOfLines={1}>{topPlayers[0].name}</Text>
                                                <Text style={styles.podiumPoints}>{topPlayers[0].points || 0} pts</Text>
                                                <View style={[styles.podiumMedal, { backgroundColor: '#FFD700' }]}>
                                                    <Text style={styles.podiumMedalNumber}>1</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ) : <View style={styles.podiumPlace} />}

                                    {/* 3rd Place (Right) */}
                                    {topPlayers.length >= 3 && topPlayers[2] ? (
                                        <View style={styles.podiumPlace}>
                                            <View style={[styles.podiumBase, styles.podiumThird]}>
                                                <View style={styles.podiumAvatarContainer}>
                                                    {topPlayers[2].avatar ? (
                                                        <Image source={{ uri: topPlayers[2].avatar }} style={styles.podiumAvatar} />
                                                    ) : (
                                                        <View style={[styles.podiumAvatarPlaceholder, { backgroundColor: '#CD7F32' }]}>
                                                            <Text style={styles.podiumAvatarText}>
                                                                {topPlayers[2].name.substring(0, 2).toUpperCase()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.podiumName} numberOfLines={1}>{topPlayers[2].name}</Text>
                                                <Text style={styles.podiumPoints}>{topPlayers[2].points || 0} pts</Text>
                                                <View style={[styles.podiumMedal, { backgroundColor: '#CD7F32' }]}>
                                                    <Text style={styles.podiumMedalNumber}>3</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ) : <View style={styles.podiumPlace} />}
                                </View>
                            </View>
                        ) : (
                            <View style={styles.podiumContainer}>
                                <Text style={styles.podiumTitle}>Top Scores</Text>
                                <View style={styles.noScoresContainer}>
                                    <Feather name="award" size={48} color={palette.textSecondary} />
                                    <Text style={styles.noScoresText}>No scores yet</Text>
                                    <Text style={styles.noScoresSubtext}>Play games to see top players here</Text>
                                </View>
                            </View>
                        )}

                        {/* Create Game Button - Only show if no active game */}
                        {!activeGame || !activeGame._id ? (
                            <TouchableOpacity
                                style={styles.createGameButton}
                                onPress={handleCreateNewGame}
                                activeOpacity={0.8}
                            >
                                <Feather name="plus-circle" size={20} color="#fff" />
                                <Text style={styles.createGameButtonText}>Create New Game</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : null}

                {/* Recent Games Section - Only show if there are games */}
                {roomData?.history && Array.isArray(roomData.history) && roomData.history.length > 0 && (
                    <View style={styles.recentGamesSection}>
                        <Text style={styles.sectionTitle}>Recent Games</Text>
                        {roomData.history
                            .slice()
                            .sort((a, b) => {
                                const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                                const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                                return dateB - dateA; // Sort descending (newest first)
                            })
                            .slice(0, 5)
                            .map((game, index) => {
                                if (!game || !game.type) return null;
                                const gameDate = game.createdAt ? new Date(game.createdAt) : null;
                                const formattedDate = gameDate ? gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
                                const formattedTime = gameDate ? gameDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.recentGameItem}
                                        onPress={() => {
                                            if (game._id && navigation?.navigate) {
                                                navigation.navigate('GameResults', {
                                                    gameId: game._id,
                                                    roomId: roomId,
                                                    roomName: roomName || roomData?.name,
                                                    gameFormat: game.type,
                                                });
                                            }
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.recentGameInfo}>
                                            <Text style={styles.recentGameType}>
                                                {getGameTypeDisplayName(game.type)}
                                            </Text>
                                            <Text style={styles.recentGameDate}>
                                                {formattedDate} {formattedTime && `• ${formattedTime}`}
                                            </Text>
                                        </View>
                                        {game.status && (
                                            <View style={[styles.recentGameStatus, { backgroundColor: getGameStatusBadge(game.status).bg }]}>
                                                <Text style={[styles.recentGameStatusText, { color: getGameStatusBadge(game.status).color }]}>
                                                    {getGameStatusBadge(game.status).text}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                    </View>
                )}

                {errorMessage ? (
                    <View style={styles.errorCard}>
                        <Feather name="alert-circle" size={20} color={palette.warning} />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                ) : null}
            </ScrollView>

            {/* Players Modal */}
            <Modal
                visible={showPlayersModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPlayersModal(false)}
            >
                <View style={styles.playersModalOverlay}>
                    <View style={styles.playersModalContainer}>
                        <View style={styles.playersModalHeader}>
                            <Text style={styles.playersModalTitle}>Players in Room</Text>
                            <TouchableOpacity onPress={() => setShowPlayersModal(false)}>
                                <Feather name="x" size={24} color={palette.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.playersModalBody}>
                            {roomData?.players && roomData.players.length > 0 ? (
                                <>
                                    {roomData.players.map((player, index) => {
                                        // Check if player is registered (has userId)
                                        const isRegistered = player.userId && player.userId !== null;

                                        // For registered players, find their member data to get username and points
                                        const memberData = isRegistered && roomData?.members ?
                                            roomData.members.find((member) => {
                                                const memberId = member._id ? member._id.toString() : member.toString();
                                                const playerUserId = player.userId._id ? player.userId._id.toString() : player.userId.toString();
                                                return memberId === playerUserId;
                                            }) : null;

                                        // Get display name - use username for registered, system-generated name for unregistered
                                        const displayName = isRegistered && memberData ?
                                            (memberData.username || 'user') :
                                            (player.name || 'Player');

                                        // Get initials for avatar
                                        const initials = displayName.slice(0, 2).toUpperCase();

                                        return (
                                            <View
                                                key={player.userId?._id?.toString() || player.userId?.toString() || `player-${index}`}
                                                style={styles.playerRow}
                                            >
                                                <View style={styles.playerAvatar}>
                                                    <Text style={styles.playerAvatarText}>
                                                        {initials}
                                                    </Text>
                                                </View>
                                                <View style={styles.playerInfoColumn}>
                                                    {isRegistered && memberData ? (
                                                        <>
                                                            <Text style={styles.playerUsername}>
                                                                @{memberData.username || 'user'}
                                                            </Text>
                                                            <Text style={styles.playerPoints}>
                                                                Individual Points: {memberData.individualPoints || 0}
                                                            </Text>
                                                        </>
                                                    ) : (
                                                        <Text style={styles.playerName}>
                                                            {player.name || 'Player'}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </>
                            ) : (
                                <View style={styles.playersEmptyState}>
                                    <Feather name="users" size={40} color={palette.border} />
                                    <Text style={styles.playersEmptyText}>
                                        No players in room yet.
                                    </Text>
                                    <Text style={styles.playersEmptySubtext}>
                                        Share the room code so others can join this room.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    backButton: {
        padding: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    headerSubtitle: {
        fontSize: 12,
        color: palette.textSecondary,
        marginTop: 2,
    },
    roomCodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 2,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    copyIcon: {
        marginLeft: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerAddButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 36,
        minHeight: 36,
        opacity: 0.8,
    },
    headerSpacer: {
        width: 32,
    },
    headerStatusButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 36,
        minHeight: 36,
        opacity: 0.8,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        gap: 20,
        paddingBottom: 40,
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
    roomInfoCard: {
        backgroundColor: palette.card,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        borderWidth: 1,
        borderColor: palette.border,
    },
    roomInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    roomInfoItem: {
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    roomInfoLabel: {
        fontSize: 12,
        color: palette.textSecondary,
        fontWeight: '500',
    },
    roomInfoValue: {
        fontSize: 24,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    roomInfoDivider: {
        width: 1,
        height: 40,
        backgroundColor: palette.border,
    },
    statusToggleButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    statusToggleButtonInactive: {
        shadowColor: '#10b981',
    },
    statusToggleGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    statusToggleText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    activeGameCard: {
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#8b5cf6',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    activeGameGradient: {
        padding: 24,
        gap: 20,
    },
    activeGameHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    activeGameLabel: {
        color: '#ede9fe',
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 4,
    },
    activeGameTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    goldWinnerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFD700',
        marginTop: 6,
    },
    medalsSummary: {
        marginTop: 8,
        gap: 6,
    },
    medalText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFD700',
    },
    inProcessText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#c4b5fd',
        marginTop: 6,
    },
    timelineSection: {
        marginTop: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 16,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    gameStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        padding: 16,
    },
    gameStatItem: {
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    gameStatLabel: {
        color: '#c4b5fd',
        fontSize: 12,
        textTransform: 'uppercase',
    },
    gameStatValue: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
    },
    gameStatDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    gameActions: {
        marginTop: 8,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    noActiveGameContainer: {
        gap: 24,
    },
    podiumContainer: {
        backgroundColor: palette.card,
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        borderWidth: 1,
        borderColor: palette.border,
    },
    podiumTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
        textAlign: 'center',
        marginBottom: 24,
    },
    podium: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 8,
        minHeight: 200,
    },
    podiumPlace: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    podiumBase: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 8,
        borderRadius: 16,
        position: 'relative',
    },
    podiumFirst: {
        backgroundColor: '#FFF9E6',
        minHeight: 180,
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    podiumSecond: {
        backgroundColor: '#F5F5F5',
        minHeight: 140,
        borderWidth: 2,
        borderColor: '#C0C0C0',
    },
    podiumThird: {
        backgroundColor: '#FFF8F0',
        minHeight: 120,
        borderWidth: 2,
        borderColor: '#CD7F32',
    },
    podiumAvatarContainer: {
        marginBottom: 8,
    },
    podiumAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: '#fff',
    },
    podiumAvatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    podiumAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    podiumName: {
        fontSize: 12,
        fontWeight: '600',
        color: palette.textPrimary,
        marginBottom: 4,
        textAlign: 'center',
        maxWidth: '100%',
    },
    podiumPoints: {
        fontSize: 14,
        fontWeight: '700',
        color: palette.accent,
        marginBottom: 8,
    },
    podiumMedal: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: -16,
        borderWidth: 2,
        borderColor: '#fff',
    },
    podiumMedalNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    noScoresContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    noScoresText: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    noScoresSubtext: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
    },
    createGameButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: palette.accent,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    createGameButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    recentGamesSection: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
        marginBottom: 4,
    },
    recentGameItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: palette.border,
    },
    recentGameInfo: {
        flex: 1,
        gap: 4,
    },
    recentGameType: {
        fontSize: 15,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    recentGameDate: {
        fontSize: 12,
        color: palette.textSecondary,
    },
    recentGameStatus: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    recentGameStatusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff7ed',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    errorText: {
        flex: 1,
        color: palette.warning,
        fontSize: 14,
    },
    playersModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    playersModalContainer: {
        width: '100%',
        maxHeight: '70%',
        backgroundColor: palette.card,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
        borderWidth: 1,
        borderColor: palette.border,
    },
    playersModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    playersModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    playersModalBody: {
        marginTop: 4,
        gap: 12,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    playerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    playerAvatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    playerInfoColumn: {
        flex: 1,
    },
    playerUsername: {
        fontSize: 14,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    playerName: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    playerPoints: {
        fontSize: 13,
        color: palette.textSecondary,
        marginTop: 2,
    },
    playersEmptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    playersEmptyText: {
        fontSize: 15,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    playersEmptySubtext: {
        fontSize: 13,
        color: palette.textSecondary,
        textAlign: 'center',
    },
});

export default RoomDashboardScreen;

