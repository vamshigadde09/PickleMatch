import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/colors.js';

export const MatchTimeline = ({ matches = [], currentRound = 1, maxMatchesToShow = 5 }) => {
    if (!matches || matches.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>No matches yet</Text>
            </View>
        );
    }

    // Sort matches by round and match number
    const sortedMatches = [...matches].sort((a, b) => {
        if (a.roundNumber !== b.roundNumber) {
            return a.roundNumber - b.roundNumber;
        }
        return (a.matchNumber || 0) - (b.matchNumber || 0);
    });

    // Group matches by round
    const matchesByRound = {};
    sortedMatches.forEach(match => {
        const round = match.roundNumber || 1;
        if (!matchesByRound[round]) {
            matchesByRound[round] = [];
        }
        matchesByRound[round].push(match);
    });

    // Get rounds in order
    const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

    // Show only recent matches (last few matches)
    const recentMatches = sortedMatches.slice(-maxMatchesToShow);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Match Timeline</Text>
            <View style={styles.timelineContainer}>
                {recentMatches.map((match, index) => {
                    const isFinished = match.status === 'finished';
                    const isPending = match.status === 'pending' || !match.status;
                    const isLive = match.status === 'live';
                    
                    const teamALetter = match.teamA?.letter || 'A';
                    const teamBLetter = match.teamB?.letter || 'B';
                    const roundNum = match.roundNumber || 1;
                    const matchNum = match.matchNumber || (index + 1);

                    // Determine winner for finished matches
                    let winnerLetter = null;
                    if (isFinished && match.winner) {
                        winnerLetter = typeof match.winner === 'string' ? match.winner : (match.winner?.letter || (match.scoreA > match.scoreB ? teamALetter : teamBLetter));
                    }

                    return (
                        <View key={`match-${match._id || match.id || index}`} style={styles.timelineItem}>
                            {/* Timeline Line */}
                            {index < recentMatches.length - 1 && (
                                <View style={[styles.timelineLine, isFinished && styles.timelineLineCompleted]} />
                            )}
                            
                            {/* Match Icon */}
                            <View style={[
                                styles.iconContainer,
                                isFinished && styles.iconContainerCompleted,
                                isLive && styles.iconContainerLive,
                                isPending && styles.iconContainerPending,
                            ]}>
                                {isFinished ? (
                                    <Feather name="check" size={14} color="#fff" />
                                ) : isLive ? (
                                    <Feather name="activity" size={14} color="#fff" />
                                ) : (
                                    <Feather name="circle" size={10} color="#fff" />
                                )}
                            </View>

                            {/* Match Info */}
                            <View style={styles.matchInfo}>
                                <View style={styles.matchHeader}>
                                    <Text style={styles.matchLabel}>
                                        Round {roundNum} • Match {matchNum}
                                    </Text>
                                    {isLive && (
                                        <View style={styles.liveBadge}>
                                            <View style={styles.liveDot} />
                                            <Text style={styles.liveText}>LIVE</Text>
                                        </View>
                                    )}
                                    {isPending && (
                                        <Text style={styles.pendingText}>Upcoming</Text>
                                    )}
                                </View>
                                <Text style={styles.matchTeams}>
                                    Team {teamALetter} vs Team {teamBLetter}
                                </Text>
                                {isFinished && winnerLetter && (
                                    <View style={styles.winnerContainer}>
                                        <Feather name="award" size={12} color={palette.accent} />
                                        <Text style={styles.winnerText}>
                                            Winner: Team {winnerLetter}
                                        </Text>
                                        {match.scoreA !== undefined && match.scoreB !== undefined && (
                                            <Text style={styles.scoreText}>
                                                ({match.scoreA} - {match.scoreB})
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
            {sortedMatches.length > maxMatchesToShow && (
                <Text style={styles.moreText}>
                    +{sortedMatches.length - maxMatchesToShow} more matches
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 16,
        marginBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
        marginBottom: 16,
    },
    timelineContainer: {
        position: 'relative',
        paddingLeft: 24,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 20,
        position: 'relative',
    },
    timelineLine: {
        position: 'absolute',
        left: 11,
        top: 24,
        width: 2,
        height: 36,
        backgroundColor: palette.border,
    },
    timelineLineCompleted: {
        backgroundColor: palette.accent,
        opacity: 0.5,
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        zIndex: 1,
    },
    iconContainerCompleted: {
        backgroundColor: palette.accent,
    },
    iconContainerLive: {
        backgroundColor: '#10b981',
    },
    iconContainerPending: {
        backgroundColor: palette.textSecondary,
        opacity: 0.6,
    },
    matchInfo: {
        flex: 1,
        paddingBottom: 4,
    },
    matchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    matchLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.textSecondary,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    pendingText: {
        fontSize: 11,
        fontWeight: '500',
        color: palette.textSecondary,
        fontStyle: 'italic',
    },
    matchTeams: {
        fontSize: 15,
        fontWeight: '600',
        color: palette.textPrimary,
        marginBottom: 4,
    },
    winnerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    winnerText: {
        fontSize: 13,
        fontWeight: '600',
        color: palette.accent,
    },
    scoreText: {
        fontSize: 12,
        color: palette.textSecondary,
    },
    emptyText: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        paddingVertical: 20,
    },
    moreText: {
        fontSize: 12,
        color: palette.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
});

