import React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { palette } from '../theme/colors.js';

const gameFormats = [
    {
        id: 'one-vs-one',
        name: '1 vs 1',
        description: 'Direct one-on-one match. Perfect for quick duels and skill testing. Fast-paced and intense!',
        icon: 'users',
        iconColor: '#8b5cf6',
        requiredPlayers: 2,
        details: [
            'Direct head-to-head competition',
            'Single match format',
            'Winner takes all',
            'Perfect for quick games',
        ],
        medals: '🥇 Gold: Match winner | 🥈 Silver: Match runner-up',
        tags: ['Quick match', 'Head-to-head', '2 players'],
    },
    {
        id: 'two-vs-two',
        name: '2 vs 2',
        description: 'Classic doubles match. Two teams of two players each. Perfect for traditional pickleball doubles play.',
        icon: 'users',
        iconColor: '#06b6d4',
        requiredPlayers: 4,
        details: [
            'Two teams of two players each',
            'Classic doubles format',
            'Team coordination is key',
            'Traditional pickleball style',
        ],
        medals: '🥇 Gold: Winning team | 🥈 Silver: Runner-up team',
        tags: ['Doubles', 'Classic format', '4 players'],
    },
    {
        id: 'pickle',
        name: 'Pickle Format',
        description: 'Full tournament with winners bracket, losers bracket for comeback, and championship final. Perfect for competitive play where every match matters.',
        icon: 'award',
        iconColor: '#10b981',
        requiredPlayers: [4, 6, 8], // Multiple of 2, at least 4
        details: [
            'Round 1: Initial matches determine winners and losers',
            'Winners Bracket: Advancing teams compete',
            'Losers Bracket: Second chance for eliminated teams',
            'Championship: Final showdown between top teams',
        ],
        medals: '🥇 Gold: Final winner | 🥈 Silver: Final runner-up | 🥉 Bronze: Losers bracket champion',
        tags: ['Structured brackets', 'Second chance', 'Full tournament'],
    },
    {
        id: 'round-robin',
        name: 'Round Robin',
        description: 'Every team plays every other team exactly once. Fair and comprehensive - no one gets left out. Perfect for determining the best overall team.',
        icon: 'rotate-cw',
        iconColor: '#f97316',
        requiredPlayers: [4, 6, 8], // Multiple of 2, at least 4
        details: [
            'All teams face each other once',
            'Ranked by total wins and point differences',
            'Best overall performance wins',
            'Most balanced format for skill assessment',
        ],
        medals: '🥇 Gold: Most wins | 🥈 Silver: 2nd place | 🥉 Bronze: 3rd place',
        tags: ['All teams compete', 'Fair rotation', 'Comprehensive'],
    },
    {
        id: 'quick-knockout',
        name: 'Quick Knockout',
        description: 'Fast-paced single-elimination tournament. Win or go home! Perfect for time-limited sessions or quick competitive rounds.',
        icon: 'zap',
        iconColor: '#eab308',
        requiredPlayers: [4, 6, 8], // Multiple of 2, at least 4
        details: [
            'Quarterfinals → Semifinals → Final',
            'Single elimination: one loss and you\'re out',
            'Fast-paced tournament format',
            '3rd place playoff determines bronze',
        ],
        medals: '🥇 Gold: Final champion | 🥈 Silver: Final runner-up | 🥉 Bronze: 3rd place playoff winner',
        tags: ['Fast elimination', 'Quick games', 'Single loss'],
    },
];

export const ChooseGameFormatScreen = ({ route, navigation }) => {
    const { roomId, roomName, selectedPlayers } = route.params || {};
    const selectedPlayersCount = selectedPlayers?.length || 0;

    console.log('🎮 [ChooseGameFormat] Screen Loaded with params:', {
        roomId,
        roomName,
        selectedPlayersCount,
    });

    // Filter formats based on number of selected players
    const getAvailableFormats = () => {
        return gameFormats.filter((format) => {
            // Special handling for 1v1 - only show for exactly 2 players (hide other formats)
            if (format.id === 'one-vs-one') {
                return selectedPlayersCount === 2;
            }

            // Special handling for 2v2 - show for exactly 4 players (along with other formats)
            if (format.id === 'two-vs-two') {
                return selectedPlayersCount === 4;
            }

            // For other formats (pickle, round-robin, quick-knockout)
            // Show if player count is 4 or more (odd or even - system handles odd players)
            if (Array.isArray(format.requiredPlayers)) {
                const minPlayers = Math.min(...format.requiredPlayers);
                // Hide other formats when only 2 players (show only 1v1)
                if (selectedPlayersCount === 2) {
                    return false;
                }
                // Show for 4+ players (odd or even - system handles odd players with "plays twice")
                // Also hide if only 3 players (too few for meaningful tournament)
                if (selectedPlayersCount === 3) {
                    return false;
                }
                return selectedPlayersCount >= minPlayers;
            }

            // Default: don't show (for safety)
            return false;
        });
    };

    const availableFormats = getAvailableFormats();

    const handleSelectFormat = (formatId) => {
        console.log('🎮 [ChooseGameFormat] Format Selected:', formatId);
        const params = {
            roomId: roomId,
            roomName: roomName,
            gameFormat: formatId,
            selectedPlayers: selectedPlayers || [],
        };
        console.log('🎮 [ChooseGameFormat] Navigating to TeamAssignment with:', {
            ...params,
            selectedPlayersCount: params.selectedPlayers.length,
        });
        if (navigation?.navigate) {
            navigation.navigate('TeamAssignment', params);
        }
    };

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
                    <Text style={styles.headerTitle}>Choose Game Format</Text>
                    <Text style={styles.headerSubtitle}>Select tournament style</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {availableFormats.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Feather name="users" size={48} color={palette.textSecondary} />
                        <Text style={styles.emptyTitle}>No Formats Available</Text>
                        <Text style={styles.emptyText}>
                            Please select 2 players for 1v1, or 4+ players for tournament formats.
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Current selection: {selectedPlayersCount} {selectedPlayersCount === 1 ? 'player' : 'players'}
                        </Text>
                    </View>
                ) : (
                    availableFormats.map((format) => (
                        <TouchableOpacity
                            key={format.id}
                            style={styles.formatCard}
                            onPress={() => handleSelectFormat(format.id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.formatHeader}>
                                <View style={[styles.formatIcon, { backgroundColor: `${format.iconColor}15` }]}>
                                    <Feather name={format.icon} size={28} color={format.iconColor} />
                                </View>
                                <View style={styles.formatInfo}>
                                    <Text style={styles.formatName}>{format.name}</Text>
                                    <Text style={styles.formatDescription}>{format.description}</Text>
                                </View>
                            </View>

                            {format.details && (
                                <View style={styles.detailsContainer}>
                                    {format.details.map((detail, index) => (
                                        <View key={index} style={styles.detailRow}>
                                            <View style={[styles.detailBullet, { backgroundColor: format.iconColor }]} />
                                            <Text style={styles.detailText}>{detail}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {format.medals && (
                                <View style={[styles.medalsContainer, { borderLeftColor: format.iconColor }]}>
                                    <Text style={styles.medalsLabel}>Medal System:</Text>
                                    <Text style={styles.medalsText}>{format.medals}</Text>
                                </View>
                            )}

                            <View style={styles.formatTags}>
                                {format.tags.map((tag, index) => (
                                    <View key={index} style={[styles.tag, { borderColor: `${format.iconColor}30` }]}>
                                        <Text style={[styles.tagText, { color: format.iconColor }]}>{tag}</Text>
                                    </View>
                                ))}
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
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
        gap: 20,
    },
    formatCard: {
        backgroundColor: palette.card,
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    formatHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 16,
    },
    formatIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    formatInfo: {
        flex: 1,
    },
    formatName: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
        marginBottom: 6,
    },
    formatDescription: {
        fontSize: 14,
        color: palette.textSecondary,
        lineHeight: 20,
    },
    detailsContainer: {
        marginTop: 12,
        marginBottom: 12,
        gap: 10,
        paddingLeft: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    detailBullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 6,
        flexShrink: 0,
    },
    detailText: {
        fontSize: 13,
        color: palette.textSecondary,
        lineHeight: 18,
        flex: 1,
    },
    medalsContainer: {
        backgroundColor: '#f9fafb',
        padding: 12,
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 12,
        borderLeftWidth: 3,
    },
    medalsLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: palette.textPrimary,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    medalsText: {
        fontSize: 13,
        color: palette.textSecondary,
        lineHeight: 18,
    },
    formatTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    tag: {
        backgroundColor: '#f9fafb',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 16,
        minHeight: 300,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
        marginTop: 8,
    },
    emptyText: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    emptySubtext: {
        fontSize: 13,
        color: palette.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        fontWeight: '600',
    },
});

export default ChooseGameFormatScreen;

