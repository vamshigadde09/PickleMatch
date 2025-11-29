import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/colors.js';
import { API_BASE_URL } from '../api.js';
import { Confetti } from '../components/Confetti.js';

// Helper function to get auth headers
const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
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

const medalEmojis = {
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
};

const medalColors = {
    gold: {
        primary: '#FFD700',
        light: '#FFE55C',
        badgeBg: '#FF8C00',
        chipBg: '#FFF9C4'
    },
    silver: {
        primary: '#C0C0C0',
        light: '#E8E8E8',
        badgeBg: '#9CA3AF',
        chipBg: '#F3F4F6'
    },
    bronze: {
        primary: '#CD7F32',
        light: '#EDC9AF',
        badgeBg: '#F97316',
        chipBg: '#FED7AA'
    },
};

export const GameResultsScreen = ({ route, navigation }) => {
    const { gameId, roomId, roomName, gameFormat, completedMatches = [] } = route.params || {};

    const [game, setGame] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showConfetti, setShowConfetti] = useState(true);

    useEffect(() => {
        fetchGameResults();
    }, [gameId]);

    useEffect(() => {
        // Show confetti for 3 seconds when component mounts
        const timer = setTimeout(() => {
            setShowConfetti(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    const fetchGameResults = async () => {
        try {
            setIsLoading(true);
            const headers = await getAuthHeaders();
            const response = await axios.get(`${API_BASE_URL}/api/v1/game/${gameId}`, { headers });

            if (response.data?.success && response.data.game) {
                const gameData = response.data.game;
                // Ensure matches is always an array
                if (!gameData.matches) {
                    gameData.matches = [];
                }
                setGame(gameData);
            } else {
                Alert.alert('Error', 'Failed to load game results.');
                navigation?.goBack();
            }
        } catch (error) {
            console.log('Error fetching game results:', error?.response?.data || error?.message);
            Alert.alert('Error', 'Failed to load game results. Please try again.');
            navigation?.goBack();
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareResults = async () => {
        try {
            if (!game) return;

            const winners = [];
            const gameType = gameFormat || game?.type;
            const isSimpleFormat = gameType === 'one-vs-one' || gameType === 'two-vs-two';

            if (game.medals?.gold?.team) {
                const goldTeam = game.teams?.find(t => t.letter === game.medals.gold.team);
                if (isSimpleFormat && goldTeam?.players) {
                    const playerNames = goldTeam.players.map(p => p.name).join(' & ');
                    winners.push(`🥇 Winner: ${playerNames || `Team ${game.medals.gold.team}`}`);
                } else {
                    winners.push(`🥇 Gold: Team ${game.medals.gold.team}`);
                }
            }
            if (game.medals?.silver?.team) {
                const silverTeam = game.teams?.find(t => t.letter === game.medals.silver.team);
                if (isSimpleFormat && silverTeam?.players) {
                    const playerNames = silverTeam.players.map(p => p.name).join(' & ');
                    winners.push(`🥈 Runner-up: ${playerNames || `Team ${game.medals.silver.team}`}`);
                } else {
                    winners.push(`🥈 Silver: Team ${game.medals.silver.team}`);
                }
            }
            if (game.medals?.bronze?.team && !isSimpleFormat) {
                winners.push(`🥉 Bronze: Team ${game.medals.bronze.team}`);
            }

            const message = `🏆 ${roomName || 'Game'} Results\n\n${winners.join('\n')}\n\nPowered by PickleMatch`;

            await Share.share({
                message: message,
                title: 'Game Results',
            });
        } catch (error) {
            console.log('Error sharing results:', error);
        }
    };

    const handleStartNewGame = () => {
        if (navigation?.navigate && roomId) {
            navigation.navigate('ChooseGameFormat', {
                roomId: roomId,
                roomName: roomName,
            });
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={styles.loadingText}>Loading results...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!game) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>No game data available.</Text>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation?.goBack()}
                    >
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const goldTeam = game?.teams?.find((t) => t.letter === game?.medals?.gold?.team);
    const silverTeam = game?.teams?.find((t) => t.letter === game?.medals?.silver?.team);
    const bronzeTeam = game?.teams?.find((t) => t.letter === game?.medals?.bronze?.team);

    // Get matches from game or use completedMatches from params
    const matches = (game?.matches && Array.isArray(game.matches) && game.matches.length > 0)
        ? game.matches
        : (completedMatches && Array.isArray(completedMatches) && completedMatches.length > 0)
            ? completedMatches
            : [];

    // Get game format display name
    const getGameFormatDisplayName = (formatType) => {
        const formatNames = {
            'pickle': 'Pickle Format',
            'round-robin': 'Round Robin',
            'quick-knockout': 'Quick Knockout',
            'one-vs-one': '1 vs 1',
            'two-vs-two': '2 vs 2',
        };
        return formatNames[formatType] || formatType || 'Game';
    };

    const formatDisplayName = getGameFormatDisplayName(gameFormat || game?.type);
    const isSimpleFormat = gameFormat === 'one-vs-one' || gameFormat === 'two-vs-two' || game?.type === 'one-vs-one' || game?.type === 'two-vs-two';

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <Confetti visible={showConfetti} duration={3000} />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation?.goBack()}
                    style={styles.backButtonIcon}
                >
                    <Feather name="arrow-left" size={24} color={palette.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Game Results</Text>
                    <Text style={styles.headerSubtitle}>{formatDisplayName} • {roomName || 'Game'}</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Medal Winners Section */}
                <View style={styles.medalsSection}>
                    <Text style={styles.sectionTitle}>
                        {isSimpleFormat ? '🏆 Match Result' : '🏆 Final Standings'}
                    </Text>

                    {/* Simple format display for 1v1 and 2v2 - just names and points */}
                    {isSimpleFormat ? (
                        (() => {
                            // Get match data to extract scores and team info
                            let team1, team2, score1 = 0, score2 = 0;
                            const match = matches.length > 0 ? matches[0] : null;

                            // First, try to get teams from game.teams (most reliable for simple formats)
                            if (game.teams && game.teams.length >= 2) {
                                team1 = game.teams[0];
                                team2 = game.teams[1];
                            } else if (goldTeam && silverTeam) {
                                // Use medal teams if game.teams not available
                                team1 = goldTeam;
                                team2 = silverTeam;
                            }

                            // Get scores from match if available
                            if (match && match.teamA && match.teamB) {
                                // Match scores are available - determine which team is which
                                const matchTeamA = match.teamA;
                                const matchTeamB = match.teamB;

                                // Find which team corresponds to match teamA and teamB
                                if (team1 && team1.letter === matchTeamA.letter) {
                                    score1 = match.scoreA !== undefined && match.scoreA !== null ? match.scoreA : 0;
                                    score2 = match.scoreB !== undefined && match.scoreB !== null ? match.scoreB : 0;
                                } else if (team1 && team1.letter === matchTeamB.letter) {
                                    score1 = match.scoreB !== undefined && match.scoreB !== null ? match.scoreB : 0;
                                    score2 = match.scoreA !== undefined && match.scoreA !== null ? match.scoreA : 0;
                                } else {
                                    // Use match scores as-is
                                    score1 = match.scoreA !== undefined && match.scoreA !== null ? match.scoreA : 0;
                                    score2 = match.scoreB !== undefined && match.scoreB !== null ? match.scoreB : 0;
                                }

                                // Update teams from match if they have more complete player data
                                const matchTeam1 = game.teams?.find(t => t.letter === matchTeamA.letter) || matchTeamA;
                                const matchTeam2 = game.teams?.find(t => t.letter === matchTeamB.letter) || matchTeamB;
                                if (matchTeam1 && matchTeam1.players) team1 = matchTeam1;
                                if (matchTeam2 && matchTeam2.players) team2 = matchTeam2;
                            }

                            if (!team1 || !team2) {
                                // No data available - show empty state
                                return (
                                    <View style={styles.simpleResultCard}>
                                        <Text style={styles.simpleResultName}>No results available yet</Text>
                                    </View>
                                );
                            }

                            // Get players - prefer from match, then from teams
                            const team1Players = (match?.teamA?.players || team1.players || []).filter(p => p && p.name);
                            const team2Players = (match?.teamB?.players || team2.players || []).filter(p => p && p.name);

                            // Determine winner and loser based on scores
                            const isTeam1Winner = score1 > score2;
                            const winnerTeam = isTeam1Winner ? team1 : team2;
                            const loserTeam = isTeam1Winner ? team2 : team1;
                            const winnerPlayers = isTeam1Winner ? team1Players : team2Players;
                            const loserPlayers = isTeam1Winner ? team2Players : team1Players;
                            const winnerScore = isTeam1Winner ? score1 : score2;
                            const loserScore = isTeam1Winner ? score2 : score1;

                            return (
                                <View style={styles.simpleResultCard}>
                                    <View style={styles.simpleResultRow}>
                                        <Text style={styles.simpleResultName}>
                                            {winnerPlayers.length > 0
                                                ? winnerPlayers.map(p => p.name).join(' & ')
                                                : (winnerTeam.letter || 'Winner')
                                            }
                                        </Text>
                                        <Text style={styles.simpleResultPoints}>{winnerScore}</Text>
                                    </View>
                                    <View style={styles.simpleResultRow}>
                                        <Text style={styles.simpleResultName}>
                                            {loserPlayers.length > 0
                                                ? loserPlayers.map(p => p.name).join(' & ')
                                                : (loserTeam.letter || 'Runner-up')
                                            }
                                        </Text>
                                        <Text style={styles.simpleResultPoints}>{loserScore}</Text>
                                    </View>
                                </View>
                            );
                        })()
                    ) : (
                        <>
                            {/* Gold Medal */}
                            {goldTeam && (
                                <LinearGradient
                                    colors={[medalColors.gold.primary, medalColors.gold.light]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.medalCard}
                                >
                                    <View style={styles.medalHeader}>
                                        <View style={[styles.medalBadge, { backgroundColor: medalColors.gold.badgeBg }]}>
                                            <Text style={styles.medalBadgeNumber}>1</Text>
                                        </View>
                                        <Text style={styles.medalLabel}>Gold</Text>
                                    </View>
                                    <Text style={styles.teamName}>
                                        {isSimpleFormat
                                            ? goldTeam.players.map(p => p.name).join(' & ') || `Team ${goldTeam.letter}`
                                            : `Team ${goldTeam.letter}`
                                        }
                                    </Text>
                                    <View style={styles.playersList}>
                                        {goldTeam.players.map((player, index) => (
                                            <View key={`gold-${player.userId || index}`} style={[styles.playerChip, { backgroundColor: medalColors.gold.chipBg }]}>
                                                {player.avatar ? (
                                                    <Image
                                                        source={{ uri: player.avatar }}
                                                        style={styles.playerChipAvatar}
                                                    />
                                                ) : (
                                                    <View style={[styles.playerChipAvatarPlaceholder, { backgroundColor: 'rgba(255, 255, 255, 0.8)' }]}>
                                                        <Text style={[styles.playerChipInitials, { color: medalColors.gold.primary }]}>
                                                            {getInitials(player.name)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={[styles.playerChipName, { color: '#111827' }]}>{player.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </LinearGradient>
                            )}

                            {/* Silver Medal */}
                            {silverTeam && (
                                <LinearGradient
                                    colors={[medalColors.silver.primary, medalColors.silver.light]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.medalCard}
                                >
                                    <View style={styles.medalHeader}>
                                        <View style={[styles.medalBadge, { backgroundColor: medalColors.silver.badgeBg }]}>
                                            <Text style={styles.medalBadgeNumber}>2</Text>
                                        </View>
                                        <Text style={styles.medalLabel}>Silver</Text>
                                    </View>
                                    <Text style={styles.teamName}>
                                        {isSimpleFormat
                                            ? silverTeam.players.map(p => p.name).join(' & ') || `Team ${silverTeam.letter}`
                                            : `Team ${silverTeam.letter}`
                                        }
                                    </Text>
                                    <View style={styles.playersList}>
                                        {silverTeam.players.map((player, index) => (
                                            <View key={`silver-${player.userId || index}`} style={[styles.playerChip, { backgroundColor: medalColors.silver.chipBg }]}>
                                                {player.avatar ? (
                                                    <Image
                                                        source={{ uri: player.avatar }}
                                                        style={styles.playerChipAvatar}
                                                    />
                                                ) : (
                                                    <View style={[styles.playerChipAvatarPlaceholder, { backgroundColor: 'rgba(255, 255, 255, 0.8)' }]}>
                                                        <Text style={[styles.playerChipInitials, { color: medalColors.silver.primary }]}>
                                                            {getInitials(player.name)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={[styles.playerChipName, { color: '#111827' }]}>{player.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </LinearGradient>
                            )}

                            {/* Bronze Medal */}
                            {bronzeTeam && (
                                <LinearGradient
                                    colors={[medalColors.bronze.primary, medalColors.bronze.light]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.medalCard}
                                >
                                    <View style={styles.medalHeader}>
                                        <View style={[styles.medalBadge, { backgroundColor: medalColors.bronze.badgeBg }]}>
                                            <Text style={styles.medalBadgeNumber}>3</Text>
                                        </View>
                                        <Text style={styles.medalLabel}>Bronze</Text>
                                    </View>
                                    <Text style={styles.teamName}>Team {bronzeTeam.letter}</Text>
                                    <View style={styles.playersList}>
                                        {bronzeTeam.players.map((player, index) => (
                                            <View key={`bronze-${player.userId || index}`} style={[styles.playerChip, { backgroundColor: medalColors.bronze.chipBg }]}>
                                                {player.avatar ? (
                                                    <Image
                                                        source={{ uri: player.avatar }}
                                                        style={styles.playerChipAvatar}
                                                    />
                                                ) : (
                                                    <View style={[styles.playerChipAvatarPlaceholder, { backgroundColor: 'rgba(255, 255, 255, 0.8)' }]}>
                                                        <Text style={[styles.playerChipInitials, { color: medalColors.bronze.primary }]}>
                                                            {getInitials(player.name)}
                                                        </Text>
                                                    </View>
                                                )}
                                                <Text style={[styles.playerChipName, { color: '#111827' }]}>{player.name}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </LinearGradient>
                            )}
                        </>
                    )}
                </View>

                {/* Match Breakdown Section */}
                {matches && matches.length > 0 && (
                    <View style={styles.matchesSection}>
                        <Text style={styles.sectionTitle}>
                            {isSimpleFormat ? '📋 Match Details' : '📋 Match Breakdown'}
                        </Text>
                        {matches
                            .filter((match) => {
                                // Filter out bye matches (where teamA === teamB or isBye flag is true)
                                const teamALetter = match.teamA?.letter || match.teamA;
                                const teamBLetter = match.teamB?.letter || match.teamB;
                                const isByeMatch = match.isBye === true ||
                                    (teamALetter && teamBLetter && teamALetter === teamBLetter) ||
                                    !teamBLetter || !teamALetter;
                                return !isByeMatch; // Only show valid matches (exclude bye matches)
                            })
                            .sort((a, b) => {
                                // Sort by round number first, then match number
                                const roundA = a.roundNumber || 1;
                                const roundB = b.roundNumber || 1;
                                if (roundA !== roundB) return roundA - roundB;
                                const matchNumA = a.matchNumber || 1;
                                const matchNumB = b.matchNumber || 1;
                                return matchNumA - matchNumB;
                            })
                            .map((match, index) => {
                                // Handle both API match format (from populate) and completedMatches format
                                const scoreA = match.scoreA !== undefined && match.scoreA !== null ? match.scoreA : 0;
                                const scoreB = match.scoreB !== undefined && match.scoreB !== null ? match.scoreB : 0;
                                const winnerLetter = typeof match.winner === 'string' ? match.winner : (match.winner?.letter || (scoreA > scoreB ? match.teamA?.letter : match.teamB?.letter));
                                const teamALetter = match.teamA?.letter || 'A';
                                const teamBLetter = match.teamB?.letter || 'B';
                                const roundNum = match.roundNumber || 1;
                                const matchNum = match.matchNumber || (index + 1);

                                // Get player names for display in 1v1 and 2v2 formats
                                const teamAPlayers = match.teamA?.players || [];
                                const teamBPlayers = match.teamB?.players || [];
                                const teamANames = isSimpleFormat
                                    ? teamAPlayers.map(p => p.name).join(' & ') || `Team ${teamALetter}`
                                    : `Team ${teamALetter}`;
                                const teamBNames = isSimpleFormat
                                    ? teamBPlayers.map(p => p.name).join(' & ') || `Team ${teamBLetter}`
                                    : `Team ${teamBLetter}`;

                                // Get winner name for simple formats
                                const winnerName = isSimpleFormat && winnerLetter
                                    ? (winnerLetter === teamALetter ? teamANames : teamBNames)
                                    : null;

                                return (
                                    <View key={`match-${match._id || index}`} style={styles.matchCard}>
                                        <View style={styles.matchHeader}>
                                            <Text style={styles.matchNumber}>
                                                {isSimpleFormat
                                                    ? 'Final Match'
                                                    : `Round ${roundNum}, Match ${matchNum}`
                                                }
                                            </Text>
                                            {winnerLetter && (
                                                <View style={styles.winnerBadge}>
                                                    <Text style={styles.winnerBadgeText}>
                                                        {isSimpleFormat && winnerName
                                                            ? `Winner: ${winnerName}`
                                                            : `Winner: Team ${winnerLetter}`
                                                        }
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.matchScores}>
                                            <View style={styles.matchTeam}>
                                                <Text style={styles.matchTeamLabel}>{teamANames}</Text>
                                                <Text style={[
                                                    styles.matchScore,
                                                    scoreA > scoreB && styles.winningScore
                                                ]}>
                                                    {scoreA}
                                                </Text>
                                            </View>
                                            <Text style={styles.matchVS}>VS</Text>
                                            <View style={styles.matchTeam}>
                                                <Text style={styles.matchTeamLabel}>{teamBNames}</Text>
                                                <Text style={[
                                                    styles.matchScore,
                                                    scoreB > scoreA && styles.winningScore
                                                ]}>
                                                    {scoreB}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                    </View>
                )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShareResults}
                    activeOpacity={0.8}
                >
                    <Feather name="share-2" size={18} color={palette.textPrimary} />
                    <Text style={styles.shareButtonText}>Share Results</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.newGameButton}
                    onPress={handleStartNewGame}
                    activeOpacity={0.8}
                >
                    <Feather name="plus-circle" size={18} color="#ffffff" />
                    <Text style={styles.newGameButtonText}>Start New Game</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.homeButton}
                    onPress={() => navigation?.navigate('Home')}
                    activeOpacity={0.8}
                >
                    <Feather name="home" size={18} color={palette.textPrimary} />
                    <Text style={styles.homeButtonText}>Home</Text>
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
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 16,
    },
    errorText: {
        fontSize: 16,
        color: palette.textSecondary,
        textAlign: 'center',
    },
    backButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: palette.accent,
        borderRadius: 12,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    backButtonIcon: {
        padding: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 21,
        fontWeight: '700',
        color: palette.textPrimary,
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        fontSize: 14,
        color: palette.textSecondary,
        marginTop: 4,
        fontWeight: '500',
    },
    headerSpacer: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        gap: 24,
        paddingBottom: 140,
    },
    medalsSection: {
        gap: 0,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: palette.textPrimary,
        marginBottom: 20,
    },
    simpleResultCard: {
        backgroundColor: palette.card,
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: palette.border,
        gap: 12,
    },
    simpleResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    simpleResultName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
        flex: 1,
    },
    simpleResultPoints: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
        marginLeft: 16,
    },
    medalCard: {
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
        marginBottom: 16,
    },
    medalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    medalBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    medalBadgeNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    medalLabel: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    teamName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    playersList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    playerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    playerChipAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    playerChipAvatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    playerChipInitials: {
        fontSize: 13,
        fontWeight: '700',
    },
    playerChipName: {
        fontSize: 15,
        fontWeight: '600',
    },
    matchesSection: {
        gap: 8,
        marginTop: 8,
    },
    matchCard: {
        backgroundColor: palette.card,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: palette.border,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    matchNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    winnerBadge: {
        backgroundColor: palette.accent,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    winnerBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    matchScores: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 16,
    },
    matchTeam: {
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    matchTeamLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.textSecondary,
    },
    matchScore: {
        fontSize: 24,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    winningScore: {
        color: palette.accent,
    },
    matchVS: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textSecondary,
    },
    matchPlayersContainer: {
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    matchPlayerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: palette.border,
    },
    matchPlayerAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: palette.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    matchPlayerInitials: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    matchPlayerName: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.textPrimary,
        maxWidth: 120,
    },
    winningPlayerName: {
        color: palette.accent,
        fontWeight: '700',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: palette.card,
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        flexDirection: 'row',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    shareButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: palette.border,
    },
    shareButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    newGameButton: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: palette.accent,
        paddingVertical: 14,
        borderRadius: 14,
        shadowColor: palette.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    newGameButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },
    homeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: palette.border,
    },
    homeButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.textPrimary,
    },
});

export default GameResultsScreen;

