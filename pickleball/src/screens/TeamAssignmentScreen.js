import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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

// Team colors
const teamColors = {
    A: { primary: '#10b981', light: '#d1fae5' }, // Green
    B: { primary: '#f97316', light: '#fed7aa' }, // Orange/Coral
    C: { primary: '#eab308', light: '#fef3c7' }, // Yellow
    D: { primary: '#10b981', light: '#d1fae5' }, // Green (matches image)
};

// Generate initials from name
const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

// Shuffle array utility
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export const TeamAssignmentScreen = ({ route, navigation }) => {
    const { roomId, roomName, gameFormat, selectedPlayers } = route.params || {};
    console.log('👥 [TeamAssignment] Screen Loaded with params:', {
        roomId,
        roomName,
        gameFormat,
        selectedPlayersCount: selectedPlayers?.length || 0,
    });
    const [room, setRoom] = useState(null);
    const [teams, setTeams] = useState([]);
    const [oddPlayer, setOddPlayer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingGame, setIsCreatingGame] = useState(false);

    // Fetch room data and generate teams
    useEffect(() => {
        fetchRoomAndGenerateTeams();
    }, [roomId, selectedPlayers]);

    const fetchRoomAndGenerateTeams = async () => {
        try {
            setIsLoading(true);

            // If selectedPlayers are provided, use them directly
            if (selectedPlayers && selectedPlayers.length > 0) {
                // Fetch room data for context, but use selectedPlayers for team generation
                const headers = await getAuthHeaders();
                const response = await axios.get(`${API_BASE_URL}/api/v1/room/${roomId}`, { headers });

                if (response.data?.success && response.data.room) {
                    const roomData = response.data.room;
                    setRoom(roomData);

                    // Map selectedPlayers with member data for points
                    const allPlayers = selectedPlayers.map((player) => {
                        // If player has userId, try to find user data in members array
                        if (player.userId) {
                            const member = (roomData.members || []).find(
                                (m) => {
                                    const memberId = m._id?.toString() || m.id?.toString();
                                    const playerUserId = player.userId?.toString();
                                    return memberId === playerUserId;
                                }
                            );
                            if (member) {
                                return {
                                    ...player,
                                    individualPoints: member.individualPoints || 0,
                                    avatarUrl: member.avatarUrl || null,
                                };
                            }
                        }
                        return {
                            ...player,
                            individualPoints: 0,
                            avatarUrl: null,
                        };
                    });

                    // Store all players in state for shuffling
                    setRoom({ ...roomData, allPlayers });
                    generateTeams(allPlayers);
                }
            } else {
                // Fallback: fetch all room players (original behavior)
                const headers = await getAuthHeaders();
                const response = await axios.get(`${API_BASE_URL}/api/v1/room/${roomId}`, { headers });

                if (response.data?.success && response.data.room) {
                    const roomData = response.data.room;
                    setRoom(roomData);

                    // Generate teams from room players
                    // Combine room players with populated member data for points
                    const allPlayers = (roomData.players || []).map((player) => {
                        // If player has userId, try to find user data in members array
                        if (player.userId) {
                            const member = (roomData.members || []).find(
                                (m) => {
                                    const memberId = m._id?.toString() || m.id?.toString();
                                    const playerUserId = player.userId?.toString();
                                    return memberId === playerUserId;
                                }
                            );
                            if (member) {
                                return {
                                    ...player,
                                    individualPoints: member.individualPoints || 0,
                                    avatarUrl: member.avatarUrl || null,
                                };
                            }
                        }
                        return {
                            ...player,
                            individualPoints: 0,
                            avatarUrl: null,
                        };
                    });

                    // Store all players in state for shuffling
                    setRoom({ ...roomData, allPlayers });
                    generateTeams(allPlayers);
                }
            }
        } catch (error) {
            console.log('Error fetching room:', error?.response?.data || error?.message);
            Alert.alert('Error', 'Failed to load room data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const generateTeams = (players) => {
        console.log('👥 [TeamAssignment] generateTeams called with', players?.length || 0, 'players');
        if (!players || players.length < 2) {
            console.log('👥 [TeamAssignment] Not enough players to generate teams');
            Alert.alert(
                'Not Enough Players',
                'You need at least 2 players to create teams. Please add more players to the room.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation?.goBack(),
                    },
                ]
            );
            return;
        }

        // Shuffle players randomly
        const shuffledPlayers = shuffleArray([...players]);
        console.log('👥 [TeamAssignment] Players shuffled:', shuffledPlayers.map(p => p.name || p.mobile));

        // Determine number of teams and players per team based on game format
        const numPlayers = shuffledPlayers.length;
        let numTeams;
        let playersPerTeam;
        let hasOddPlayer = false;

        if (gameFormat === 'one-vs-one') {
            // 1 vs 1: 2 teams with 1 player each
            if (numPlayers !== 2) {
                Alert.alert(
                    'Invalid Player Count',
                    '1 vs 1 format requires exactly 2 players.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation?.goBack(),
                        },
                    ]
                );
                return;
            }
            numTeams = 2;
            playersPerTeam = 1;
        } else if (gameFormat === 'two-vs-two') {
            // 2 vs 2: 2 teams with 2 players each
            if (numPlayers !== 4) {
                Alert.alert(
                    'Invalid Player Count',
                    '2 vs 2 format requires exactly 4 players.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation?.goBack(),
                        },
                    ]
                );
                return;
            }
            numTeams = 2;
            playersPerTeam = 2;
        } else {
            // Other formats: teams of 2 players each
            numTeams = Math.floor(numPlayers / 2);
            playersPerTeam = 2;
            hasOddPlayer = numPlayers % 2 !== 0;
        }

        if (numTeams < 1) {
            Alert.alert(
                'Not Enough Players',
                'You need at least 2 players to create teams. Please add more players to the room.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation?.goBack(),
                    },
                ]
            );
            return;
        }

        // Generate team letters (A, B, C, D, E, F, ...)
        const teamLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        const availableColors = [
            { primary: '#10b981', light: '#d1fae5' }, // Green
            { primary: '#f97316', light: '#fed7aa' }, // Orange
            { primary: '#eab308', light: '#fef3c7' }, // Yellow
            { primary: '#3b82f6', light: '#dbeafe' }, // Blue
            { primary: '#8b5cf6', light: '#ede9fe' }, // Purple
            { primary: '#ec4899', light: '#fce7f3' }, // Pink
            { primary: '#14b8a6', light: '#ccfbf1' }, // Teal
            { primary: '#f59e0b', light: '#fef3c7' }, // Amber
        ];

        const newTeams = [];
        let playerIndex = 0;
        const allAssignedPlayers = []; // Track all players assigned to teams

        // Create teams based on playersPerTeam
        for (let i = 0; i < numTeams; i++) {
            const teamPlayers = shuffledPlayers.slice(playerIndex, playerIndex + playersPerTeam);
            playerIndex += playersPerTeam;

            // Store all assigned players for potential reuse
            allAssignedPlayers.push(...teamPlayers);

            // Calculate total team points
            const totalPoints = teamPlayers.reduce((sum, player) => sum + (player.individualPoints || 0), 0);

            newTeams.push({
                letter: teamLetters[i],
                players: teamPlayers.map((player, playerIdx) => ({
                    id: `${player.userId || player._id || `player-${Date.now()}-${Math.random()}`}-team-${i}-${playerIdx}`,
                    name: player.name || 'Unknown Player',
                    mobile: player.mobile || null,
                    points: player.individualPoints || 0,
                    avatar: player.avatarUrl || null,
                    playsTwice: false, // Will be marked true if selected for last team
                    originalUserId: player.userId || player._id, // Store original ID for matching
                })),
                totalPoints,
                color: availableColors[i % availableColors.length],
            });
        }

        // Handle odd player: create a new team with odd player + one random player from previous teams
        let oddPlayerData = null;
        if (hasOddPlayer && shuffledPlayers[playerIndex]) {
            const oddPlayer = shuffledPlayers[playerIndex];

            // Select a random player from already assigned teams
            const randomIndex = Math.floor(Math.random() * allAssignedPlayers.length);
            const playerToPlayTwice = allAssignedPlayers[randomIndex];

            // Mark this player as playing twice in their original team
            const playerToPlayTwiceId = (playerToPlayTwice.userId || playerToPlayTwice._id)?.toString();
            newTeams.forEach((team) => {
                team.players.forEach((player) => {
                    // Match by originalUserId instead of id to avoid ID format issues
                    const playerOriginalId = player.originalUserId?.toString();
                    if (playerToPlayTwiceId && playerOriginalId === playerToPlayTwiceId) {
                        player.playsTwice = true;
                    }
                });
            });

            // Create the last team with odd player + selected player
            const lastTeamPlayers = [
                {
                    id: `${oddPlayer.userId || oddPlayer._id || `player-${Date.now()}-${Math.random()}`}-last-team-0`,
                    name: oddPlayer.name || 'Unknown Player',
                    mobile: oddPlayer.mobile || null,
                    points: oddPlayer.individualPoints || 0,
                    avatar: oddPlayer.avatarUrl || null,
                    playsTwice: false,
                    originalUserId: oddPlayer.userId || oddPlayer._id,
                },
                {
                    id: `${playerToPlayTwice.userId || playerToPlayTwice._id || `player-${Date.now()}-${Math.random()}`}-last-team-1`,
                    name: playerToPlayTwice.name || 'Unknown Player',
                    mobile: playerToPlayTwice.mobile || null,
                    points: playerToPlayTwice.individualPoints || 0,
                    avatar: playerToPlayTwice.avatarUrl || null,
                    playsTwice: true, // This player is in two teams
                    originalUserId: playerToPlayTwice.userId || playerToPlayTwice._id,
                }
            ];

            const lastTeamPoints = lastTeamPlayers.reduce((sum, player) => sum + (player.points || 0), 0);

            newTeams.push({
                letter: teamLetters[numTeams], // Next letter (e.g., Team D)
                players: lastTeamPlayers,
                totalPoints: lastTeamPoints,
                color: availableColors[numTeams % availableColors.length],
            });

            // Store odd player data for display (no longer needed separately, but keeping for compatibility)
            oddPlayerData = {
                id: oddPlayer.userId || oddPlayer._id,
                name: oddPlayer.name || 'Unknown Player',
                points: oddPlayer.individualPoints || 0,
                avatar: oddPlayer.avatarUrl || null,
            };
        }

        console.log('👥 [TeamAssignment] Teams generated:', {
            teamCount: newTeams.length,
            teams: newTeams.map(t => ({
                letter: t.letter,
                playerCount: t.players.length,
                players: t.players.map(p => p.name),
            })),
            hasOddPlayer: !!oddPlayerData,
        });
        setTeams(newTeams);
        setOddPlayer(oddPlayerData);
    };

    const handleShuffleTeams = () => {
        if (room?.allPlayers) {
            generateTeams(room.allPlayers);
        } else if (room?.players) {
            generateTeams(room.players);
        }
    };

    const handleAcceptAndStart = async () => {
        console.log('👥 [TeamAssignment] Accept & Start Game Button Pressed');
        console.log('👥 [TeamAssignment] Teams to create game with:', {
            teamCount: teams.length,
            gameFormat,
            roomId,
            roomName,
        });
        try {
            setIsCreatingGame(true);

            if (teams.length < 2) {
                console.log('👥 [TeamAssignment] Validation failed: Not enough teams');
                Alert.alert('Error', 'Not enough teams to start a match.');
                return;
            }

            // Create game via API endpoint
            const headers = await getAuthHeaders();
            const gameData = {
                roomId: roomId,
                gameType: gameFormat || 'pickle',
                teams: teams.map((team) => ({
                    letter: team.letter,
                    players: team.players.map((player) => ({
                        userId: player.originalUserId || null,
                        name: player.name,
                        mobile: player.mobile || null,
                        playsTwice: player.playsTwice || false,
                    })),
                    totalPoints: team.totalPoints || 0,
                    wins: 0,
                })),
            };
            console.log('👥 [TeamAssignment] Creating game with data:', {
                roomId: gameData.roomId,
                gameType: gameData.gameType,
                teamCount: gameData.teams.length,
            });

            const response = await axios.post(
                `${API_BASE_URL}/api/v1/game/create`,
                gameData,
                { headers }
            );

            if (response.data?.success && response.data?.game) {
                const game = response.data.game;
                console.log('👥 [TeamAssignment] Game created successfully:', {
                    gameId: game._id,
                    gameType: game.type,
                    matchCount: game.matches?.length || 0,
                    currentRound: game.currentRound,
                });

                // Navigate to active match screen with first match
                const navParams = {
                    teams: teams,
                    roomId: roomId,
                    roomName: roomName,
                    gameFormat: gameFormat,
                    gameId: game._id,
                    currentMatchIndex: 0, // Start with first match
                    completedMatches: [], // No matches completed yet
                    roundNumber: 1, // Start with round 1
                    matches: (game.matches && Array.isArray(game.matches)) ? game.matches : [],
                };
                console.log('👥 [TeamAssignment] Navigating to ActiveMatch with:', {
                    gameId: navParams.gameId,
                    gameFormat: navParams.gameFormat,
                    currentMatchIndex: navParams.currentMatchIndex,
                    matchCount: navParams.matches.length,
                });
                if (navigation?.replace) {
                    // Replace TeamAssignment with ActiveMatch so back button goes to dashboard
                    navigation.replace('ActiveMatch', navParams);
                } else if (navigation?.navigate) {
                    navigation.navigate('ActiveMatch', navParams);
                }
            } else {
                throw new Error(response.data?.message || 'Failed to create game');
            }
        } catch (error) {
            console.log('👥 [TeamAssignment] Error creating game:', error?.response?.data || error?.message);

            let errorMessage = 'Failed to create game. Please try again.';
            if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            }

            // If there's an existing game, offer to navigate to it
            if (error?.response?.status === 400 && error?.response?.data?.existingGameId) {
                Alert.alert(
                    'Active Game Exists',
                    errorMessage,
                    [
                        {
                            text: 'Stay Here',
                            style: 'cancel',
                        },
                        {
                            text: 'Go to Active Game',
                            onPress: async () => {
                                // Navigate back to dashboard which will show the active game
                                if (navigation?.navigate && roomId) {
                                    navigation.navigate('RoomDashboard', {
                                        roomId: roomId,
                                        roomName: roomName,
                                    });
                                }
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Error', errorMessage);
            }
        } finally {
            setIsCreatingGame(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={styles.loadingText}>Loading teams...</Text>
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
                    <Text style={styles.headerTitle}>Team Assignment</Text>
                    <Text style={styles.headerSubtitle}>
                        {teams.length} {teams.length === 1 ? 'team' : 'teams'} ready to play
                    </Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {teams.map((team) => (
                    <View key={team.letter} style={styles.teamCard}>
                        <View style={styles.teamHeader}>
                            <Text style={styles.teamLetter}>Team {team.letter}</Text>
                            <View style={[styles.teamPointsBadge, { backgroundColor: team.color.light }]}>
                                <Text style={[styles.teamPointsText, { color: team.color.primary }]}>
                                    {team.totalPoints} pts
                                </Text>
                            </View>
                        </View>

                        <View style={styles.playersList}>
                            {team.players.map((player, index) => {
                                // Ensure unique key by combining team letter, player ID, and index
                                const uniqueKey = `team-${team.letter}-player-${player.id || player.originalUserId || index}-idx-${index}`;
                                return (
                                    <View key={uniqueKey} style={styles.playerRow}>
                                        <View style={[styles.playerAvatar, { backgroundColor: team.color.primary }]}>
                                            {player.avatar ? (
                                                <Image
                                                    source={{ uri: player.avatar }}
                                                    style={styles.playerAvatarImage}
                                                />
                                            ) : (
                                                <Text style={styles.playerAvatarText}>
                                                    {getInitials(player.name)}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.playerInfo}>
                                            <View style={styles.playerNameRow}>
                                                <Text style={styles.playerName}>{player.name}</Text>
                                                {player.playsTwice && (
                                                    <View style={styles.playsTwiceBadge}>
                                                        <Feather name="repeat" size={12} color={palette.accent} />
                                                        <Text style={styles.playsTwiceText}>Plays twice</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.playerPoints}>{player.points} points</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ))}

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.shuffleButton}
                    onPress={handleShuffleTeams}
                    activeOpacity={0.8}
                >
                    <Feather name="shuffle" size={18} color={palette.textPrimary} />
                    <Text style={styles.shuffleButtonText}>Shuffle Teams</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={handleAcceptAndStart}
                    disabled={isCreatingGame || teams.length === 0}
                    activeOpacity={0.8}
                >
                    {isCreatingGame ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <>
                            <Feather name="check" size={18} color="#ffffff" />
                            <Text style={styles.acceptButtonText}>Accept & Start Game</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
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
        fontSize: 14,
        color: palette.textSecondary,
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
        fontSize: 13,
        color: palette.textSecondary,
        marginTop: 2,
    },
    headerSpacer: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        gap: 16,
        paddingBottom: 160,
    },
    teamCard: {
        backgroundColor: palette.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    teamHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    teamLetter: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    teamPointsBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    teamPointsText: {
        fontSize: 14,
        fontWeight: '600',
    },
    playersList: {
        gap: 12,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    playerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    playerAvatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    playerAvatarText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    playerInfo: {
        flex: 1,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    playerPoints: {
        fontSize: 13,
        color: palette.textSecondary,
        marginTop: 2,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: palette.card,
        paddingHorizontal: 24,
        paddingVertical: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    shuffleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#f3f4f6',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
    },
    shuffleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    acceptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10b981',
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    acceptButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    oddPlayerCard: {
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 24,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: palette.accent,
        borderStyle: 'dashed',
    },
    oddPlayerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    oddPlayerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.accent,
    },
    oddPlayerDescription: {
        fontSize: 13,
        color: palette.textSecondary,
        marginBottom: 16,
        lineHeight: 18,
    },
    oddPlayerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    oddPlayerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: palette.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    oddPlayerAvatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    oddPlayerAvatarText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    oddPlayerDetails: {
        flex: 1,
    },
    oddPlayerName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    oddPlayerPoints: {
        fontSize: 13,
        color: palette.textSecondary,
        marginTop: 2,
    },
    playerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    playsTwiceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: palette.accent + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    playsTwiceText: {
        fontSize: 11,
        fontWeight: '600',
        color: palette.accent,
    },
});

export default TeamAssignmentScreen;

