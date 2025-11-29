import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { JoinRoomModal } from '../components/JoinRoomModal.js';

// Helper function to get auth headers
const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};


const gameFlow = [
    { title: 'Room ready', icon: 'home', description: 'Create or join a room' },
    { title: 'Add players', icon: 'user-plus', description: 'Invite friends to play' },
    { title: 'Create game', icon: 'play-circle', description: 'Choose game format' },
    { title: 'Shuffle teams', icon: 'shuffle', description: 'Auto-generate teams' },
    { title: 'Play matches', icon: 'activity', description: 'Compete and score' },
    { title: 'Declare champion', icon: 'award', description: 'Celebrate winners' },
];

export const HomeScreen = () => {
    const navigation = useNavigation();
    const [homeSummary, setHomeSummary] = useState(null);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showRoomsModal, setShowRoomsModal] = useState(false);
    const [allRooms, setAllRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [roomGames, setRoomGames] = useState([]);
    const [isLoadingGames, setIsLoadingGames] = useState(false);

    const fetchHomeSummary = useCallback(
        async (showLoader = true) => {
            if (showLoader) {
                setIsLoading(true);
            }
            setErrorMessage('');

            try {
                const headers = await getAuthHeaders();

                // Fetch user's active rooms
                const roomsResponse = await axios.get(`${API_BASE_URL}/api/v1/room/user/rooms`, { headers });

                if (roomsResponse?.data?.success && roomsResponse.data.rooms) {
                    const rooms = roomsResponse.data.rooms;

                    // Get the first active room (most recent)
                    const activeRoom = rooms.length > 0 ? rooms[0] : null;

                    if (activeRoom) {
                        // Format the room data for the home summary
                        const formattedSummary = {
                            activeRoom: {
                                id: activeRoom._id || activeRoom.id,
                                name: activeRoom.name,
                                code: activeRoom.code,
                                players: activeRoom.players?.length || 0,
                                members: activeRoom.members?.length || 0,
                                createdBy: activeRoom.createdBy,
                                status: activeRoom.status,
                                createdAt: activeRoom.createdAt,
                            },
                            stats: {
                                gamesPlayed: 0, // Will be populated when games are added
                                winRate: '0%',
                                streak: 0,
                            },
                        };

                        setHomeSummary(formattedSummary);
                    } else {
                        setHomeSummary(null);
                    }
                } else {
                    setHomeSummary(null);
                }
            } catch (error) {
                console.log('Home summary fetch failed:', error?.response?.data || error?.message);
                if (error.response?.status === 401) {
                    setErrorMessage('Please log in again.');
                } else if (error.response?.status === 404) {
                    // No rooms found is okay, just set to null
                    setHomeSummary(null);
                } else {
                    setErrorMessage('Unable to load data. Please check your connection and try again.');
                    setHomeSummary(null);
                }
            }

            // Fetch recent games separately
            try {
                const headers = await getAuthHeaders();
                const gamesResponse = await axios.get(`${API_BASE_URL}/api/v1/game/user/recent?limit=5`, { headers });

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
            } catch (gamesError) {
                console.log('Recent games fetch failed:', gamesError?.response?.data || gamesError?.message);
                // Don't show error for games, just set empty array
                setHistory([]);
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [],
    );

    const handleJoinRoomSuccess = useCallback(
        (room) => {
            fetchHomeSummary(true);
            setShowJoinModal(false);
        },
        [fetchHomeSummary],
    );

    const fetchAllRooms = useCallback(async () => {
        setIsLoadingRooms(true);
        try {
            const headers = await getAuthHeaders();
            // Fetch ALL rooms (active and inactive) by passing includeInactive=true
            console.log('🏠 [HomeScreen] Fetching all rooms (including inactive)...');
            const roomsResponse = await axios.get(`${API_BASE_URL}/api/v1/room/user/rooms?includeInactive=true`, { headers });

            console.log('🏠 [HomeScreen] Rooms response:', {
                success: roomsResponse?.data?.success,
                count: roomsResponse?.data?.rooms?.length || 0
            });

            if (roomsResponse?.data?.success && roomsResponse.data.rooms) {
                const rooms = roomsResponse.data.rooms || [];
                setAllRooms(rooms);
                console.log('🏠 [HomeScreen] Rooms loaded:', rooms.length);
                console.log('🏠 [HomeScreen] Room details:', rooms.map(r => ({
                    name: r.name,
                    status: r.status,
                    membersCount: r.members?.length || 0,
                    isCreator: r.createdBy?._id || r.createdBy,
                    members: r.members?.map(m => ({
                        id: m._id || m,
                        name: m.displayName || m.username
                    })) || []
                })));
            } else {
                console.log('🏠 [HomeScreen] No rooms found or invalid response');
                setAllRooms([]);
            }
        } catch (error) {
            console.error('🏠 [HomeScreen] Error fetching rooms:', error?.response?.data || error?.message);
            setAllRooms([]);
        } finally {
            setIsLoadingRooms(false);
        }
    }, []);

    const handleViewRooms = useCallback(() => {
        console.log('🏠 [HomeScreen] My Rooms button pressed');
        setShowRoomsModal(true);
        setSelectedRoom(null);
        setRoomGames([]);
        fetchAllRooms();
        console.log('🏠 [HomeScreen] Modal state set to true, fetching rooms...');
    }, [fetchAllRooms]);

    const fetchRoomGames = useCallback(async (roomId) => {
        setIsLoadingGames(true);
        try {
            const headers = await getAuthHeaders();

            // Get the room details which includes history (game IDs)
            const roomResponse = await axios.get(`${API_BASE_URL}/api/v1/room/${roomId}`, { headers });
            const room = roomResponse?.data?.room;
            const roomCode = room?.code;

            if (!room) {
                setRoomGames([]);
                setIsLoadingGames(false);
                return;
            }

            // Fetch user's recent games and filter by room code
            // This is more efficient than fetching individual games from history
            const gamesResponse = await axios.get(`${API_BASE_URL}/api/v1/game/user/recent?limit=100`, { headers });

            if (gamesResponse?.data?.success && gamesResponse.data.games) {
                // Filter games for this specific room by matching room code
                const filteredGames = gamesResponse.data.games.filter(game =>
                    game.roomCode === roomCode
                ).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first
                setRoomGames(filteredGames);
            } else {
                setRoomGames([]);
            }
        } catch (error) {
            console.log('Error fetching room games:', error?.response?.data || error?.message);
            setRoomGames([]);
        } finally {
            setIsLoadingGames(false);
        }
    }, []);

    const handleRoomPress = useCallback((room) => {
        setSelectedRoom(room);
        fetchRoomGames(room._id || room.id);
    }, [fetchRoomGames]);

    const handleBackToRooms = useCallback(() => {
        setSelectedRoom(null);
        setRoomGames([]);
    }, []);

    const quickActions = useMemo(
        () => [
            {
                id: 'join',
                title: 'Join Room',
                description: 'Enter a room code to request access.',
                cta: 'Enter Code',
                icon: 'log-in',
                onPress: () => setShowJoinModal(true),
            },
            {
                id: 'create',
                title: 'Create Room',
                description: 'Name the room, add players, choose admin.',
                cta: 'Start Room',
                icon: 'plus-circle',
                onPress: () => {
                    console.log('🏠 [HomeScreen] Create Room Button Pressed');
                    if (navigation?.navigate) {
                        try {
                            console.log('🏠 [HomeScreen] Navigating to CreateRoom');
                            navigation.navigate('CreateRoom');
                        } catch (error) {
                            console.log('🏠 [HomeScreen] Navigation error:', error);
                            Alert.alert(
                                'Error',
                                'Unable to navigate to Create Room screen.',
                            );
                        }
                    }
                },
            },
            {
                id: 'rooms',
                title: 'My Rooms',
                description: 'View all rooms you joined or created.',
                cta: 'View All',
                icon: 'grid',
                onPress: () => {
                    console.log('🏠 [HomeScreen] My Rooms quick action pressed');
                    handleViewRooms();
                },
            },
            {
                id: 'history',
                title: 'History',
                description: 'View past games, winners, and stats.',
                cta: 'Browse',
                icon: 'clock',
                onPress: () => {
                    if (navigation?.navigate) {
                        try {
                            navigation.navigate('History');
                        } catch (error) {
                            Alert.alert(
                                'Coming Soon',
                                'History screen is not available yet.',
                            );
                        }
                    }
                },
            },
        ],
        [navigation, handleViewRooms],
    );

    useFocusEffect(
        useCallback(() => {
            fetchHomeSummary(true);
        }, [fetchHomeSummary]),
    );

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchHomeSummary(false);
    }, [fetchHomeSummary]);

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
            <StatusBar style="dark" />
            <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.homeContent}
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
                {homeSummary ? (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                            console.log('🏠 [HomeScreen] Active Room Card Pressed');
                            console.log('🏠 [HomeScreen] Active Room Data:', {
                                id: homeSummary.activeRoom?.id,
                                name: homeSummary.activeRoom?.name,
                                players: homeSummary.activeRoom?.players,
                                members: homeSummary.activeRoom?.members,
                            });
                            if (homeSummary.activeRoom?.id && navigation?.navigate) {
                                console.log('🏠 [HomeScreen] Navigating to RoomDashboard with:', {
                                    roomId: homeSummary.activeRoom.id,
                                    roomName: homeSummary.activeRoom.name,
                                });
                                navigation.navigate('RoomDashboard', {
                                    roomId: homeSummary.activeRoom.id,
                                    roomName: homeSummary.activeRoom.name,
                                });
                            }
                        }}
                    >
                        <LinearGradient
                            colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroCard}
                        >
                            <View style={styles.heroHeader}>
                                <View style={styles.heroTitleContainer}>
                                    <View style={styles.heroLabelContainer}>
                                        <Feather name="users" size={14} color="#ede9fe" />
                                        <Text style={styles.heroLabel}>Active Room</Text>
                                    </View>
                                    <Text style={styles.heroTitle}>{homeSummary.activeRoom?.name || 'No Active Room'}</Text>
                                </View>
                                {homeSummary.activeRoom?.code && (
                                    <View style={styles.badgeContainer}>
                                        <Text style={styles.badge}>{homeSummary.activeRoom.code}</Text>
                                    </View>
                                )}
                            </View>
                            {homeSummary.activeRoom && (
                                <View style={styles.heroInfoRow}>
                                    <View style={styles.heroInfoItem}>
                                        <Feather name="user" size={14} color="#c4b5fd" />
                                        <Text style={styles.heroSubtitle}>
                                            {homeSummary.activeRoom.players || 0} players
                                        </Text>
                                    </View>
                                    <View style={styles.heroInfoDivider} />
                                    <View style={styles.heroInfoItem}>
                                        <Feather name="user-check" size={14} color="#c4b5fd" />
                                        <Text style={styles.heroSubtitle}>
                                            {homeSummary.activeRoom.members || 0} members
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {homeSummary.stats && (
                                <View style={styles.heroStats}>
                                    <StatPill label="Games Played" value={homeSummary.stats.gamesPlayed || 0} icon="activity" />
                                    <View style={styles.statDivider} />
                                    <StatPill label="Win %" value={homeSummary.stats.winRate || '0%'} icon="trending-up" />
                                    <View style={styles.statDivider} />
                                    <StatPill label="Streak" value={homeSummary.stats.streak || '-'} icon="zap" />
                                </View>
                            )}
                            {homeSummary.activeRoom?.createdBy && (
                                <View style={styles.nextMatchCard}>
                                    <View style={styles.nextMatchHeader}>
                                        <Feather name="award" size={14} color="#c4b5fd" />
                                        <Text style={styles.nextMatchLabel}>Room Admin</Text>
                                    </View>
                                    <Text style={styles.nextMatchTeams}>
                                        {homeSummary.activeRoom.createdBy?.displayName || homeSummary.activeRoom.createdBy?.username || 'Admin'}
                                    </Text>
                                    {homeSummary.activeRoom.createdAt && (
                                        <Text style={styles.nextMatchTime}>
                                            Created {new Date(homeSummary.activeRoom.createdAt).toLocaleDateString()}
                                        </Text>
                                    )}
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    !isLoading && (
                        <LinearGradient
                            colors={['#f8fafc', '#f3f4f6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.emptyHeroCard}
                        >
                            <View style={styles.emptyHeroIconContainer}>
                                <LinearGradient
                                    colors={[palette.accent, '#9f7aea']}
                                    style={styles.emptyHeroIconGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Feather name="users" size={48} color="#fff" />
                                </LinearGradient>
                            </View>
                            <Text style={styles.emptyHeroText}>Ready to Play?</Text>
                            <Text style={styles.emptyHeroSubtext}>
                                Create your own room or join a friend's room to start organizing pickleball matches
                            </Text>
                            <View style={styles.emptyHeroTips}>
                                <View style={styles.emptyHeroTipItem}>
                                    <Feather name="check-circle" size={16} color={palette.accent} />
                                    <Text style={styles.emptyHeroTipText}>Organize matches easily</Text>
                                </View>
                                <View style={styles.emptyHeroTipItem}>
                                    <Feather name="check-circle" size={16} color={palette.accent} />
                                    <Text style={styles.emptyHeroTipText}>Track scores & stats</Text>
                                </View>
                                <View style={styles.emptyHeroTipItem}>
                                    <Feather name="check-circle" size={16} color={palette.accent} />
                                    <Text style={styles.emptyHeroTipText}>Compete on leaderboards</Text>
                                </View>
                            </View>
                            <View style={styles.emptyHeroHint}>
                                <Feather name="arrow-down" size={16} color={palette.textSecondary} />
                                <Text style={styles.emptyHeroHintText}>Use the quick actions below to get started</Text>
                            </View>
                        </LinearGradient>
                    )
                )}

                <SectionHeader
                    title="Quick Actions"
                    description="Start or join games in a tap."
                />
                <View style={styles.actionGrid}>
                    {quickActions.map((action) => (
                        <QuickActionCard key={action.id} {...action} />
                    ))}
                </View>

                <SectionHeader
                    title="Game Flow"
                    description="PickleMatch keeps the room cadence simple."
                />
                <View style={styles.flowContainer}>
                    {gameFlow.map((step, index) => (
                        <FlowStep
                            key={step.title}
                            step={index + 1}
                            title={step.title}
                            icon={step.icon}
                            description={step.description}
                            isLast={index === gameFlow.length - 1}
                        />
                    ))}
                </View>

                <SectionHeader
                    title="Recent Games"
                    description="History across every room you joined."
                    actionLabel={history.length > 0 ? "View All" : undefined}
                    onAction={history.length > 0 ? () => {
                        if (navigation?.navigate) {
                            try {
                                navigation.navigate('History');
                            } catch (error) {
                                Alert.alert('Coming Soon', 'History screen is not available yet.');
                            }
                        }
                    } : undefined}
                />
                {history.length > 0 ? (
                    <View style={styles.historyList}>
                        {history.map((entry) => (
                            <HistoryCard key={entry.id ?? entry.room} entry={entry} />
                        ))}
                    </View>
                ) : (
                    !isLoading && (
                        <View style={styles.emptyStateCard}>
                            <View style={styles.emptyStateIconContainer}>
                                <LinearGradient
                                    colors={[palette.accentLight, '#e9d5ff']}
                                    style={styles.emptyStateIconGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Feather name="clock" size={32} color={palette.accent} />
                                </LinearGradient>
                            </View>
                            <Text style={styles.emptyStateText}>No game history yet</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Start playing games to see your match history, wins, and statistics here
                            </Text>
                        </View>
                    )
                )}

                {errorMessage ? (
                    <View style={styles.inlineError}>
                        <Feather name="alert-circle" size={16} color={palette.warning} />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                ) : null}

                {isLoading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.loadingText}>Syncing live data…</Text>
                    </View>
                )}
            </ScrollView>
            <JoinRoomModal
                visible={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                onSuccess={handleJoinRoomSuccess}
            />

            {/* My Rooms Modal */}
            <Modal
                visible={showRoomsModal}
                transparent
                animationType="slide"
                statusBarTranslucent={true}
                onRequestClose={() => {
                    console.log('🏠 [HomeScreen] Modal onRequestClose called');
                    setShowRoomsModal(false);
                    setSelectedRoom(null);
                    setRoomGames([]);
                }}
            >
                <View style={styles.roomsModalOverlay}>
                    <SafeAreaView style={styles.roomsModalSafeArea} edges={['top', 'bottom']}>
                        <View style={styles.roomsModalContent}>
                            <View style={styles.roomsModalHeader}>
                                {selectedRoom ? (
                                    <TouchableOpacity
                                        onPress={handleBackToRooms}
                                        style={styles.roomsModalBackButton}
                                    >
                                        <Feather name="arrow-left" size={24} color={palette.textPrimary} />
                                    </TouchableOpacity>
                                ) : null}
                                <Text style={styles.roomsModalTitle}>
                                    {selectedRoom ? selectedRoom.name : 'My Rooms'}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowRoomsModal(false);
                                        setSelectedRoom(null);
                                        setRoomGames([]);
                                    }}
                                    style={styles.roomsModalCloseButton}
                                >
                                    <Feather name="x" size={24} color={palette.textPrimary} />
                                </TouchableOpacity>
                            </View>

                            {selectedRoom ? (
                                // Show games for selected room
                                <>
                                    {selectedRoom.code && (
                                        <View style={styles.roomsModalRoomInfo}>
                                            <Text style={styles.roomsModalRoomCode}>Room Code: {selectedRoom.code}</Text>
                                        </View>
                                    )}
                                    {isLoadingGames ? (
                                        <View style={styles.roomsModalLoading}>
                                            <ActivityIndicator size="large" color={palette.accent} />
                                            <Text style={styles.roomsModalLoadingText}>Loading games...</Text>
                                        </View>
                                    ) : roomGames.length > 0 ? (
                                        <ScrollView style={styles.roomsModalList} showsVerticalScrollIndicator={false}>
                                            {roomGames.map((game) => (
                                                <TouchableOpacity
                                                    key={game.id}
                                                    style={styles.roomsModalGameItem}
                                                    onPress={() => {
                                                        setShowRoomsModal(false);
                                                        setSelectedRoom(null);
                                                        setRoomGames([]);
                                                        if (navigation?.navigate) {
                                                            navigation.navigate('RoomDashboard', {
                                                                roomId: selectedRoom._id || selectedRoom.id,
                                                                roomName: selectedRoom.name,
                                                            });
                                                        }
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.roomsModalGameContent}>
                                                        <View style={styles.roomsModalGameHeader}>
                                                            <View style={[styles.roomsModalGameTypeBadge, { backgroundColor: getGameTypeColor(game.gameType) + '15' }]}>
                                                                <Text style={[styles.roomsModalGameTypeText, { color: getGameTypeColor(game.gameType) }]}>
                                                                    {game.gameType || 'Game'}
                                                                </Text>
                                                            </View>
                                                            <Text style={styles.roomsModalGameDate}>
                                                                {formatGameDate(game.date)}
                                                            </Text>
                                                        </View>
                                                        {game.winner && (
                                                            <View style={styles.roomsModalGameWinner}>
                                                                <Feather name="award" size={14} color={palette.accent} />
                                                                <Text style={styles.roomsModalGameWinnerText}>
                                                                    Winner: {game.winner}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        {game.userTeam && (
                                                            <Text style={styles.roomsModalGameTeam}>
                                                                Your Team: {game.userTeam}
                                                            </Text>
                                                        )}
                                                        {game.points > 0 && (
                                                            <View style={styles.roomsModalGamePoints}>
                                                                <Text style={styles.roomsModalGamePointsText}>
                                                                    +{game.points} points
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Feather name="chevron-right" size={20} color={palette.textSecondary} />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        <View style={styles.roomsModalEmpty}>
                                            <Feather name="activity" size={48} color={palette.textSecondary} />
                                            <Text style={styles.roomsModalEmptyText}>No games yet</Text>
                                            <Text style={styles.roomsModalEmptySubtext}>
                                                Start playing games in this room to see them here
                                            </Text>
                                        </View>
                                    )}
                                </>
                            ) : (
                                // Show list of rooms
                                <>
                                    {isLoadingRooms ? (
                                        <View style={styles.roomsModalLoading}>
                                            <ActivityIndicator size="large" color={palette.accent} />
                                            <Text style={styles.roomsModalLoadingText}>Loading rooms...</Text>
                                        </View>
                                    ) : allRooms.length > 0 ? (
                                        <>
                                            <ScrollView style={styles.roomsModalList} showsVerticalScrollIndicator={false}>
                                                {allRooms.map((room) => (
                                                    <TouchableOpacity
                                                        key={room._id || room.id}
                                                        style={styles.roomsModalItem}
                                                        onPress={() => handleRoomPress(room)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={styles.roomsModalItemContent}>
                                                            <View style={styles.roomsModalItemHeader}>
                                                                <View style={styles.roomsModalItemNameContainer}>
                                                                    <Text style={styles.roomsModalItemName}>{room.name}</Text>
                                                                    {room.status === 'inactive' && (
                                                                        <View style={styles.roomsModalItemStatusBadge}>
                                                                            <Text style={styles.roomsModalItemStatusText}>Inactive</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                {room.code && (
                                                                    <View style={styles.roomsModalItemCode}>
                                                                        <Text style={styles.roomsModalItemCodeText}>{room.code}</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <View style={styles.roomsModalItemInfo}>
                                                                <View style={styles.roomsModalItemStat}>
                                                                    <Feather name="user" size={14} color={palette.textSecondary} />
                                                                    <Text style={styles.roomsModalItemStatText}>
                                                                        {room.players?.length || 0} players
                                                                    </Text>
                                                                </View>
                                                                <View style={styles.roomsModalItemStat}>
                                                                    <Feather name="users" size={14} color={palette.textSecondary} />
                                                                    <Text style={styles.roomsModalItemStatText}>
                                                                        {room.members?.length || 0} members
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            {room.members && room.members.length > 0 && (
                                                                <View style={styles.roomsModalItemMembers}>
                                                                    <Text style={styles.roomsModalItemMembersLabel}>Members: </Text>
                                                                    <Text style={styles.roomsModalItemMembersList} numberOfLines={1}>
                                                                        {room.members
                                                                            .map(m => m.displayName || m.username || 'Unknown')
                                                                            .join(', ')}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            {room.createdBy && (
                                                                <Text style={styles.roomsModalItemCreator}>
                                                                    Created by {room.createdBy?.displayName || room.createdBy?.username || 'Admin'}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <Feather name="chevron-right" size={20} color={palette.textSecondary} />
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                            <View style={styles.roomsModalFooter}>
                                                <Text style={styles.roomsModalFooterText}>
                                                    {allRooms.length} {allRooms.length === 1 ? 'room' : 'rooms'} found
                                                </Text>
                                            </View>
                                        </>
                                    ) : (
                                        <View style={styles.roomsModalEmpty}>
                                            <Feather name="users" size={48} color={palette.textSecondary} />
                                            <Text style={styles.roomsModalEmptyText}>No rooms found</Text>
                                            <Text style={styles.roomsModalEmptySubtext}>
                                                You haven't joined or created any rooms yet.{'\n'}
                                                Create or join a room to get started
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.roomsModalEmptyButton}
                                                onPress={() => {
                                                    setShowRoomsModal(false);
                                                    if (navigation?.navigate) {
                                                        navigation.navigate('CreateRoom');
                                                    }
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.roomsModalEmptyButtonText}>Create Your First Room</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const QuickActionCard = ({ title, description, cta, icon, onPress }) => (
    <TouchableOpacity style={styles.actionCard} activeOpacity={0.85} onPress={onPress}>
        <LinearGradient
            colors={['#ffffff', '#faf5ff']}
            style={styles.actionCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <View style={styles.actionIcon}>
                <LinearGradient
                    colors={[palette.accent, '#9f7aea']}
                    style={styles.actionIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Feather name={icon} size={20} color="#fff" />
                </LinearGradient>
            </View>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionDescription}>{description}</Text>
            <View style={styles.actionCta}>
                <Text style={styles.actionCtaText}>{cta}</Text>
                <Feather name="arrow-right" size={12} color={palette.accent} style={styles.actionCtaIcon} />
            </View>
        </LinearGradient>
    </TouchableOpacity>
);

const StatPill = ({ label, value, icon }) => (
    <View style={styles.statPill}>
        {icon && (
            <Feather name={icon} size={12} color="#d8b4fe" style={styles.statIcon} />
        )}
        <View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    </View>
);

const SectionHeader = ({ title, description, actionLabel, onAction }) => (
    <View style={styles.sectionHeader}>
        <View>
            <Text style={styles.sectionTitle}>{title}</Text>
            {description ? <Text style={styles.sectionSubtitle}>{description}</Text> : null}
        </View>
        {actionLabel ? (
            <TouchableOpacity onPress={onAction}>
                <Text style={styles.sectionAction}>{actionLabel}</Text>
            </TouchableOpacity>
        ) : null}
    </View>
);

const FlowStep = ({ step, title, icon, description, isLast }) => (
    <View style={styles.flowStep}>
        <View style={styles.flowMarkerRow}>
            <View style={styles.flowMarkerWrapper}>
                <LinearGradient
                    colors={[palette.accent, '#9f7aea']}
                    style={styles.flowMarker}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Feather name={icon} size={18} color="#fff" />
                </LinearGradient>
                <View style={styles.flowStepNumber}>
                    <Text style={styles.flowStepNumberText}>{step}</Text>
                </View>
            </View>
            {!isLast && (
                <View style={styles.flowLineContainer}>
                    <View style={styles.flowLineDots}>
                        <View style={styles.flowDot} />
                        <View style={styles.flowDot} />
                        <View style={styles.flowDot} />
                    </View>
                </View>
            )}
        </View>
        <View style={styles.flowContent}>
            <Text style={styles.flowText}>{title}</Text>
            {description && (
                <Text style={styles.flowDescription}>{description}</Text>
            )}
        </View>
    </View>
);

// Helper functions for game display
const formatGameDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

const getGameTypeColor = (gameType) => {
    if (gameType?.includes('Pickle')) return '#8b5cf6';
    if (gameType?.includes('Round Robin')) return '#06b6d4';
    if (gameType?.includes('Knockout')) return '#f59e0b';
    if (gameType?.includes('1 vs 1') || gameType?.includes('1v1')) return '#10b981';
    if (gameType?.includes('2 vs 2') || gameType?.includes('2v2')) return '#3b82f6';
    return palette.accent;
};

const HistoryCard = ({ entry }) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    return (
        <TouchableOpacity style={styles.historyCard} activeOpacity={0.9}>
            <View style={styles.historyHeader}>
                <View style={styles.historyMain}>
                    <View style={styles.historyTop}>
                        <Text style={styles.historyRoom}>{entry.room}</Text>
                        {entry.roomCode && (
                            <Text style={styles.historyRoomCode}>{entry.roomCode}</Text>
                        )}
                    </View>
                    <View style={styles.historyMetaRow}>
                        <View style={[styles.gameTypeBadge, { backgroundColor: getGameTypeColor(entry.gameType) + '15' }]}>
                            <Text style={[styles.gameTypeText, { color: getGameTypeColor(entry.gameType) }]}>
                                {entry.gameType || 'Game'}
                            </Text>
                        </View>
                        <Text style={styles.historyDate}>{formatDate(entry.date)}</Text>
                    </View>
                </View>
                {entry.points > 0 && (
                    <View style={styles.pointsBadge}>
                        <Text style={styles.pointsValue}>{entry.points}</Text>
                        <Text style={styles.pointsLabel}>pts</Text>
                    </View>
                )}
            </View>
            <View style={styles.historyFooter}>
                {entry.userTeam && (
                    <View style={styles.historyFooterItem}>
                        <Text style={styles.historyFooterLabel}>Your Team</Text>
                        <Text style={styles.historyFooterValue}>{entry.userTeam}</Text>
                    </View>
                )}
                <View style={styles.historyFooterItem}>
                    <Text style={styles.historyWinnerLabel}>Winner</Text>
                    <Text style={styles.historyWinner}>{entry.winner || 'N/A'}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    screen: {
        flex: 1,
        backgroundColor: palette.background,
    },
    homeContent: {
        padding: 20,
        gap: 28,
        paddingBottom: 40,
    },
    heroCard: {
        borderRadius: 32,
        padding: 32,
        gap: 24,
        shadowColor: '#8b5cf6',
        shadowOpacity: 0.4,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 12,
        overflow: 'hidden',
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    heroTitleContainer: {
        flex: 1,
    },
    heroLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    heroLabel: {
        color: '#ede9fe',
        textTransform: 'uppercase',
        fontSize: 11,
        letterSpacing: 1.2,
        fontWeight: '600',
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        lineHeight: 34,
    },
    heroInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 16,
        padding: 12,
        gap: 12,
    },
    heroInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    heroInfoDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    heroSubtitle: {
        color: '#f5f3ff',
        fontSize: 14,
        fontWeight: '500',
    },
    heroStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        padding: 16,
        gap: 12,
    },
    statPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    statIcon: {
        marginTop: 2,
    },
    statLabel: {
        color: '#d8b4fe',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
        marginBottom: 2,
    },
    statValue: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 26,
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    badgeContainer: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    badge: {
        backgroundColor: '#ffffff',
        color: '#4c1d95',
        fontWeight: '800',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 999,
        fontSize: 13,
        letterSpacing: 1,
        overflow: 'hidden',
    },
    nextMatchCard: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        padding: 20,
        gap: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(10px)',
    },
    nextMatchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    nextMatchLabel: {
        color: '#c4b5fd',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: '600',
    },
    nextMatchTeams: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    nextMatchTime: {
        color: '#ede9fe',
        fontSize: 13,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: palette.textPrimary,
        letterSpacing: -0.8,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: palette.textSecondary,
        marginTop: 4,
        lineHeight: 18,
    },
    sectionAction: {
        color: palette.accent,
        fontWeight: '700',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    actionCard: {
        flexBasis: '47%',
        borderRadius: 24,
        shadowColor: '#8b5cf6',
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        overflow: 'hidden',
    },
    actionCardGradient: {
        padding: 20,
        gap: 12,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: palette.border,
    },
    actionIcon: {
        width: 44,
        height: 44,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        shadowColor: palette.accent,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        overflow: 'hidden',
    },
    actionIconGradient: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    actionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: palette.textPrimary,
        marginBottom: 2,
    },
    actionDescription: {
        fontSize: 12,
        color: palette.textSecondary,
        lineHeight: 16,
        marginBottom: 4,
    },
    actionCta: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: palette.accentLight,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        marginTop: 2,
        gap: 6,
    },
    actionCtaText: {
        color: palette.accent,
        fontWeight: '700',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    actionCtaIcon: {
        marginTop: 1,
    },
    flowContainer: {
        backgroundColor: palette.card,
        borderRadius: 28,
        padding: 24,
        gap: 24,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        borderWidth: 1.5,
        borderColor: palette.border,
    },
    flowStep: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
    },
    flowMarkerRow: {
        alignItems: 'center',
        minWidth: 56,
    },
    flowMarkerWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flowMarker: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: palette.accent,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    flowStepNumber: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#fff',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: palette.accent,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    flowStepNumberText: {
        color: palette.accent,
        fontWeight: '800',
        fontSize: 11,
    },
    flowLineContainer: {
        marginTop: 8,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
    },
    flowLineDots: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
    },
    flowDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: palette.accentLight,
    },
    flowContent: {
        flex: 1,
        paddingTop: 4,
        gap: 4,
    },
    flowText: {
        fontSize: 17,
        fontWeight: '700',
        color: palette.textPrimary,
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    flowDescription: {
        fontSize: 13,
        color: palette.textSecondary,
        lineHeight: 18,
        fontWeight: '400',
    },
    historyList: {
        gap: 12,
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
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    historyMain: {
        flex: 1,
        gap: 8,
    },
    historyTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    historyRoom: {
        fontSize: 17,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    historyRoomCode: {
        fontSize: 12,
        fontWeight: '600',
        color: palette.textSecondary,
        backgroundColor: palette.accentLight,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    historyMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    gameTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    gameTypeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    historyDate: {
        fontSize: 13,
        color: palette.textSecondary,
    },
    pointsBadge: {
        alignItems: 'center',
        backgroundColor: palette.accentLight,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 50,
    },
    pointsValue: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.accent,
    },
    pointsLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: palette.textSecondary,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    historyFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: palette.border,
        paddingTop: 12,
        gap: 16,
    },
    historyFooterItem: {
        flex: 1,
    },
    historyFooterLabel: {
        fontSize: 11,
        color: palette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
        marginBottom: 4,
    },
    historyFooterValue: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    historyWinnerLabel: {
        fontSize: 11,
        color: palette.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
        marginBottom: 4,
    },
    historyWinner: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.accent,
    },
    inlineError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fff7ed',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    errorText: {
        color: palette.warning,
        fontSize: 13,
    },
    loadingOverlay: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: palette.accent,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 999,
        shadowColor: palette.accent,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    loadingText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    emptyHeroCard: {
        borderRadius: 32,
        padding: 40,
        alignItems: 'center',
        gap: 20,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        borderWidth: 2,
        borderColor: palette.border,
        overflow: 'hidden',
    },
    emptyHeroIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        shadowColor: palette.accent,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        overflow: 'hidden',
    },
    emptyHeroIconGradient: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 50,
    },
    emptyHeroText: {
        fontSize: 26,
        fontWeight: '800',
        color: palette.textPrimary,
        marginTop: 8,
        letterSpacing: -0.5,
    },
    emptyHeroSubtext: {
        fontSize: 15,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    emptyHeroTips: {
        width: '100%',
        marginTop: 16,
        gap: 10,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: palette.border,
    },
    emptyHeroHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: palette.border,
    },
    emptyHeroHintText: {
        fontSize: 13,
        color: palette.textSecondary,
        fontStyle: 'italic',
    },
    emptyHeroTipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    emptyHeroTipText: {
        fontSize: 13,
        color: palette.textSecondary,
        fontWeight: '500',
    },
    emptyStateCard: {
        backgroundColor: palette.card,
        borderRadius: 24,
        padding: 36,
        alignItems: 'center',
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
        borderWidth: 1.5,
        borderColor: palette.border,
    },
    emptyStateIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        overflow: 'hidden',
    },
    emptyStateIconGradient: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 40,
    },
    emptyStateText: {
        fontSize: 19,
        fontWeight: '700',
        color: palette.textPrimary,
        marginTop: 4,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 8,
    },
    roomsModalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        elevation: 9999,
    },
    roomsModalSafeArea: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    roomsModalContent: {
        backgroundColor: palette.background || '#ffffff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '85%',
        minHeight: '40%',
        paddingTop: 20,
        paddingBottom: 0,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
        elevation: 20,
    },
    roomsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    roomsModalBackButton: {
        padding: 4,
        marginRight: 12,
    },
    roomsModalRoomInfo: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: palette.accentLight,
        marginBottom: 12,
    },
    roomsModalRoomCode: {
        fontSize: 13,
        fontWeight: '700',
        color: palette.accent,
        letterSpacing: 0.5,
    },
    roomsModalGameItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    roomsModalGameContent: {
        flex: 1,
        gap: 8,
    },
    roomsModalGameHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    roomsModalGameTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roomsModalGameTypeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    roomsModalGameDate: {
        fontSize: 12,
        color: palette.textSecondary,
    },
    roomsModalGameWinner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    roomsModalGameWinnerText: {
        fontSize: 13,
        color: palette.textPrimary,
        fontWeight: '600',
    },
    roomsModalGameTeam: {
        fontSize: 12,
        color: palette.textSecondary,
    },
    roomsModalGamePoints: {
        alignSelf: 'flex-start',
        backgroundColor: palette.accentLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginTop: 4,
    },
    roomsModalGamePointsText: {
        fontSize: 12,
        fontWeight: '700',
        color: palette.accent,
    },
    roomsModalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: palette.textPrimary,
        letterSpacing: -0.5,
    },
    roomsModalCloseButton: {
        padding: 4,
    },
    roomsModalLoading: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    roomsModalLoadingText: {
        fontSize: 14,
        color: palette.textSecondary,
    },
    roomsModalList: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    roomsModalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    roomsModalItemContent: {
        flex: 1,
        gap: 8,
    },
    roomsModalItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    roomsModalItemNameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    roomsModalItemName: {
        fontSize: 17,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    roomsModalItemStatusBadge: {
        backgroundColor: '#fef2f2',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    roomsModalItemStatusText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#dc2626',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    roomsModalItemCode: {
        backgroundColor: palette.accentLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roomsModalItemCodeText: {
        fontSize: 12,
        fontWeight: '700',
        color: palette.accent,
        letterSpacing: 0.5,
    },
    roomsModalItemInfo: {
        flexDirection: 'row',
        gap: 16,
    },
    roomsModalItemStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    roomsModalItemStatText: {
        fontSize: 13,
        color: palette.textSecondary,
        fontWeight: '500',
    },
    roomsModalItemMembers: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 2,
    },
    roomsModalItemMembersLabel: {
        fontSize: 12,
        color: palette.textSecondary,
        fontWeight: '600',
    },
    roomsModalItemMembersList: {
        fontSize: 12,
        color: palette.textSecondary,
        flex: 1,
    },
    roomsModalItemCreator: {
        fontSize: 12,
        color: palette.textSecondary,
        fontStyle: 'italic',
        marginTop: 2,
    },
    roomsModalEmpty: {
        padding: 48,
        alignItems: 'center',
        gap: 16,
    },
    roomsModalEmptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    roomsModalEmptySubtext: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
    },
    roomsModalEmptyButton: {
        marginTop: 20,
        backgroundColor: palette.accent,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    roomsModalEmptyButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
    },
    roomsModalFooter: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 0,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        backgroundColor: palette.background || '#ffffff',
    },
    roomsModalFooterText: {
        fontSize: 12,
        color: palette.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
    },
});

export default HomeScreen;

