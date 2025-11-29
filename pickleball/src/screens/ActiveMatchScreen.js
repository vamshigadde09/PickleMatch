import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// Generate initials from name
const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

// Helper function to generate match schedule for round robin style
const generateMatchSchedule = (allTeams) => {
    if (!allTeams || allTeams.length < 2) return [];

    const matches = [];
    // Pair teams sequentially: A vs B, C vs D, E vs F, etc.
    for (let i = 0; i < allTeams.length; i += 2) {
        if (i + 1 < allTeams.length) {
            matches.push({
                teamA: allTeams[i],
                teamB: allTeams[i + 1],
                matchNumber: Math.floor(i / 2) + 1,
            });
        }
    }
    return matches;
};

export const ActiveMatchScreen = ({ route, navigation }) => {
    const {
        teams,
        roomId,
        roomName,
        gameFormat,
        gameId,
        currentMatchIndex = 0,
        completedMatches = [],
        roundNumber = 1,
        matches = [],
    } = route.params || {};
    console.log('🏓 [ActiveMatch] Screen Loaded with params:', {
        gameId,
        gameFormat,
        roomId,
        roomName,
        currentMatchIndex,
        roundNumber,
        matchCount: matches?.length || 0,
        teamCount: teams?.length || 0,
    });

    // Handle Android hardware back button - navigate to dashboard if game has started
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            // If game has started, navigate to dashboard instead of going back
            if (gameId && roomId && navigation?.navigate) {
                navigation.navigate('RoomDashboard', {
                    roomId: roomId,
                    roomName: roomName,
                });
                return true; // Prevent default back behavior
            }
            return false; // Allow default back behavior
        });

        return () => backHandler.remove();
    }, [gameId, roomId, roomName, navigation]);

    // Generate match schedule as fallback
    const matchSchedule = generateMatchSchedule(teams || []);

    // Filter matches by current round and get only pending/live matches first
    const currentRoundMatches = matches && matches.length > 0
        ? matches.filter((m) => {
            if (!m || typeof m !== 'object') return false;
            const matchRound = m.roundNumber !== undefined ? m.roundNumber : roundNumber;
            return matchRound === roundNumber;
        }).sort((a, b) => {
            // Sort by match number
            const matchNumA = a.matchNumber || 0;
            const matchNumB = b.matchNumber || 0;
            return matchNumA - matchNumB;
        })
        : [];

    console.log('🏓 [ActiveMatch] Loading match for display:', {
        roundNumber,
        currentMatchIndex,
        totalMatches: matches?.length || 0,
        currentRoundMatchesCount: currentRoundMatches.length,
        currentRoundMatches: currentRoundMatches.map(m => ({
            id: m._id?.toString() || m.id?.toString(),
            round: m.roundNumber,
            match: m.matchNumber,
            teamA: m.teamA?.letter,
            teamB: m.teamB?.letter,
            status: m.status,
        })),
    });

    // Use matches from API if available, otherwise use generated schedule
    let currentMatch = null;
    let matchId = null;

    // Helper function to check if a match is valid (not a bye match)
    const isValidMatch = (matchData) => {
        if (!matchData) return false;
        const teamALetter = matchData.teamA?.letter || matchData.teamA;
        const teamBLetter = matchData.teamB?.letter || matchData.teamB;
        // Invalid if teamB is missing or teamA === teamB (bye match)
        if (!teamBLetter || teamALetter === teamBLetter) return false;
        return true;
    };

    // Find the first pending match in current round, or use the one at currentMatchIndex
    if (currentRoundMatches.length > 0) {
        // First try to find a valid pending match (not finished, not bye)
        const pendingMatch = currentRoundMatches.find(m => {
            const isPending = m.status === 'pending' || m.status === 'live' || !m.status;
            return isPending && isValidMatch(m);
        });

        if (pendingMatch) {
            const matchData = pendingMatch;
            currentMatch = {
                teamA: teams?.find(t => t.letter === matchData.teamA?.letter) || matchData.teamA,
                teamB: teams?.find(t => t.letter === matchData.teamB?.letter) || matchData.teamB,
            };
            matchId = matchData._id || matchData.id;
            console.log('🏓 [ActiveMatch] Using pending match:', {
                matchId: matchId?.toString(),
                teamA: currentMatch.teamA?.letter,
                teamB: currentMatch.teamB?.letter,
            });
        } else if (currentRoundMatches[currentMatchIndex]) {
            // Fallback to match at index - but check if it's finished or a bye match
            const matchData = currentRoundMatches[currentMatchIndex];
            const isByeMatch = !isValidMatch(matchData);

            // If the match at index is finished or a bye match, try to find a valid pending match
            if (matchData.status === 'finished' || isByeMatch) {
                console.log('🏓 [ActiveMatch] Match at index is finished or bye match, looking for valid pending match...', {
                    status: matchData.status,
                    isBye: isByeMatch,
                    teamA: matchData.teamA?.letter,
                    teamB: matchData.teamB?.letter,
                });
                const pendingInRound = currentRoundMatches.find(m => {
                    const isPending = m.status === 'pending' || m.status === 'live' || !m.status;
                    return isPending && isValidMatch(m);
                });

                if (pendingInRound) {
                    currentMatch = {
                        teamA: teams?.find(t => t.letter === pendingInRound.teamA?.letter) || pendingInRound.teamA,
                        teamB: teams?.find(t => t.letter === pendingInRound.teamB?.letter) || pendingInRound.teamB,
                    };
                    matchId = pendingInRound._id || pendingInRound.id;
                    console.log('🏓 [ActiveMatch] Found valid pending match instead:', {
                        matchId: matchId?.toString(),
                        teamA: currentMatch.teamA?.letter,
                        teamB: currentMatch.teamB?.letter,
                    });
                } else {
                    // All matches in this round are finished or bye matches - don't set currentMatch
                    console.log('🏓 [ActiveMatch] ⚠️ Match at index is invalid (bye match or finished), no valid pending matches found');
                    // Will trigger error handler below
                }
            } else {
                // Match at index is not finished and is valid, use it
                if (isValidMatch(matchData)) {
                    currentMatch = {
                        teamA: teams?.find(t => t.letter === matchData.teamA?.letter) || matchData.teamA,
                        teamB: teams?.find(t => t.letter === matchData.teamB?.letter) || matchData.teamB,
                    };
                    matchId = matchData._id || matchData.id;
                    console.log('🏓 [ActiveMatch] Using match at index:', {
                        matchId: matchId?.toString(),
                        index: currentMatchIndex,
                    });
                }
            }
        }
    } else if (matchSchedule && matchSchedule[currentMatchIndex]) {
        currentMatch = matchSchedule[currentMatchIndex];
        console.log('🏓 [ActiveMatch] Using match from schedule');
    }

    const teamA = currentMatch?.teamA || null;
    const teamB = currentMatch?.teamB || null;

    // Get current match data to check status
    const currentMatchData = currentRoundMatches.find(m => {
        const mId = m._id?.toString() || m.id?.toString();
        const cId = matchId?.toString();
        return mId === cId;
    });

    const [teamAScore, setTeamAScore] = useState('');
    const [teamBScore, setTeamBScore] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate total matches in current round
    const totalMatchesInRound = currentRoundMatches.length || matchSchedule?.length || 0;
    const currentMatchNumber = currentMatchIndex + 1;

    // Reset scores when match changes
    useEffect(() => {
        setTeamAScore('');
        setTeamBScore('');
    }, [currentMatchIndex]);

    const handleSubmitResult = async () => {
        // Prevent submitting if current match is already finished
        if (currentMatchData?.status === 'finished') {
            Alert.alert('Match Already Finished', 'This match has already been completed. Please navigate to the next match.');
            return;
        }

        // Validate scores
        if (!teamAScore.trim() || !teamBScore.trim()) {
            Alert.alert('Missing Scores', 'Please enter scores for both teams.');
            return;
        }

        const scoreA = parseInt(teamAScore, 10);
        const scoreB = parseInt(teamBScore, 10);

        if (isNaN(scoreA) || isNaN(scoreB)) {
            Alert.alert('Invalid Scores', 'Please enter valid numbers for scores.');
            return;
        }

        if (scoreA === scoreB) {
            Alert.alert('Tie Not Allowed', 'The scores cannot be equal. Please enter different scores.');
            return;
        }

        // Helper function to handle game completion
        const handleGameCompletion = async (headers, completedMatchesList) => {
            try {
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

                    // Navigate to results screen
                    console.log('🏓 [ActiveMatch] ✅ handleGameCompletion: Navigating to GameResults...');
                    if (navigation?.replace) {
                        console.log('🏓 [ActiveMatch] Navigation.replace available, navigating with params:', {
                            gameId,
                            roomId,
                            roomName,
                            gameFormat,
                        });
                        navigation.replace('GameResults', {
                            gameId: gameId,
                            roomId: roomId,
                            roomName: roomName,
                            gameFormat: gameFormat,
                            completedMatches: completedMatchesList,
                        });
                    } else if (navigation?.navigate) {
                        console.log('🏓 [ActiveMatch] Navigation.navigate available, navigating...');
                        navigation.navigate('GameResults', {
                            gameId: gameId,
                            roomId: roomId,
                            roomName: roomName,
                            gameFormat: gameFormat,
                            completedMatches: completedMatchesList,
                        });
                    } else {
                        console.log('🏓 [ActiveMatch] ⚠️ Navigation not available!');
                    }
                }
            } catch (error) {
                console.log('Error completing game:', error);
                Alert.alert('Error', 'Unable to calculate results. Please try again.');
            }
        };

        try {
            setIsSubmitting(true);
            console.log('🏓 [ActiveMatch] Submit Result Button Pressed');
            console.log('🏓 [ActiveMatch] Match Details:', {
                matchId,
                gameId,
                roundNumber,
                currentMatchIndex,
                teamAScore: scoreA,
                teamBScore: scoreB,
                teamA: teamA?.letter,
                teamB: teamB?.letter,
            });

            if (!matchId) {
                throw new Error('Match ID is missing');
            }

            // Submit match result to backend API
            const headers = await getAuthHeaders();
            console.log('🏓 [ActiveMatch] Submitting result to backend:', { matchId, scoreA, scoreB });
            const response = await axios.put(
                `${API_BASE_URL}/api/v1/game/match/${matchId}/result`,
                { scoreA, scoreB },
                { headers }
            );
            console.log('🏓 [ActiveMatch] Result submitted successfully:', {
                allRoundFinished: response.data?.allRoundMatchesFinished,
                nextRoundCreated: response.data?.nextRoundCreated,
                newMatchesCount: response.data?.newMatches?.length || 0,
                gameStatus: response.data?.game?.status,
            });

            if (response.data?.success) {
                const matchResult = {
                    teamA: teamA,
                    teamB: teamB,
                    scoreA: scoreA,
                    scoreB: scoreB,
                    winner: scoreA > scoreB ? teamA : teamB,
                    matchNumber: currentMatchNumber,
                    roundNumber: roundNumber,
                };

                const updatedCompletedMatches = [...(completedMatches || []), matchResult];

                // Get updated game data
                const updatedGame = response.data?.game || null;
                const allRoundFinished = response.data?.allRoundMatchesFinished || false;
                const nextRoundCreated = response.data?.nextRoundCreated || false;
                const newMatches = response.data?.newMatches || [];
                console.log('🏓 [ActiveMatch] After submit - navigation check:', {
                    allRoundFinished,
                    nextRoundCreated,
                    newMatchesCount: newMatches.length,
                    newMatchesDetails: newMatches.map(m => ({
                        id: m._id?.toString() || m.id?.toString(),
                        round: m.roundNumber,
                        match: m.matchNumber,
                        teamA: m.teamA?.letter,
                        teamB: m.teamB?.letter,
                        status: m.status,
                    })),
                    currentRound: roundNumber,
                    updatedGameStatus: updatedGame?.status,
                    responseGameStatus: response.data?.game?.status,
                    updatedGameCurrentRound: updatedGame?.currentRound,
                });

                // Get updated matches list (including newly created ones) - ensure it's populated
                let allMatches = [];
                if (updatedGame?.matches && Array.isArray(updatedGame.matches)) {
                    allMatches = updatedGame.matches;
                } else {
                    // Fallback: fetch fresh game data
                    try {
                        const gameResponse = await axios.get(`${API_BASE_URL}/api/v1/game/${gameId}`, { headers });
                        if (gameResponse?.data?.success && gameResponse.data.game) {
                            allMatches = gameResponse.data.game.matches || [];
                        }
                    } catch (e) {
                        console.log('Error fetching game:', e);
                        allMatches = matches || [];
                    }
                }

                // Filter matches for current round and sort by matchNumber
                const currentRoundMatchesList = allMatches
                    .filter((m) => {
                        if (!m || typeof m !== 'object') return false;
                        const matchRound = m.roundNumber !== undefined ? m.roundNumber : roundNumber;
                        return matchRound === roundNumber;
                    })
                    .sort((a, b) => {
                        const matchNumA = a.matchNumber || 0;
                        const matchNumB = b.matchNumber || 0;
                        return matchNumA - matchNumB;
                    });

                // Find current match in the list
                const currentMatchInList = currentRoundMatchesList.find((m) => {
                    return m._id === matchId || m.id === matchId;
                });
                const currentMatchPosition = currentMatchInList
                    ? currentRoundMatchesList.indexOf(currentMatchInList)
                    : currentMatchIndex;

                console.log('🏓 [ActiveMatch] Checking for next match:', {
                    currentRound: roundNumber,
                    currentRoundMatchesCount: currentRoundMatchesList.length,
                    currentMatchPosition,
                    matchId: matchId?.toString(),
                });

                // IMPORTANT: Check for next round FIRST before checking same round matches
                // This ensures we navigate to next round when it's created, not get stuck in current round
                const shouldNavigateToNextRound = allRoundFinished && (nextRoundCreated || (updatedGame?.currentRound && updatedGame.currentRound > roundNumber));

                // Check if there's a next match in current round (only if not navigating to next round)
                const nextMatchPosition = currentMatchPosition + 1;
                const hasNextMatchInRound = !shouldNavigateToNextRound && nextMatchPosition < currentRoundMatchesList.length;

                console.log('🏓 [ActiveMatch] Navigation decision:', {
                    shouldNavigateToNextRound,
                    hasNextMatchInRound,
                    allRoundFinished,
                    nextRoundCreated,
                    updatedGameCurrentRound: updatedGame?.currentRound,
                    currentRound: roundNumber,
                    newMatchesCount: newMatches.length,
                });

                // PRIORITY 1: Navigate to next round if round is finished and next round was created
                if (shouldNavigateToNextRound) {
                    // Round is finished and new round was created - navigate to first match of new round
                    console.log('🏓 [ActiveMatch] ✅ Round finished condition met:', {
                        allRoundFinished,
                        nextRoundCreated,
                        newMatchesCount: newMatches.length,
                        updatedGameCurrentRound: updatedGame?.currentRound,
                        currentRound: roundNumber,
                    });

                    // Determine next round number - use updatedGame.currentRound if available, otherwise calculate
                    const nextRound = updatedGame?.currentRound || (newMatches.length > 0 ? newMatches[0]?.roundNumber : null) || (roundNumber + 1);
                    console.log('🏓 [ActiveMatch] ✅ Determined next round:', nextRound);
                    console.log('🏓 [ActiveMatch] All matches by round:', allMatches.map(m => ({
                        id: m._id?.toString() || m.id?.toString(),
                        round: m.roundNumber,
                        match: m.matchNumber,
                        status: m.status,
                    })));

                    // Find first VALID (pending, non-bye) match of next round in allMatches
                    const nextRoundMatches = allMatches
                        .filter((m) => {
                            if (!m || typeof m !== 'object') return false;
                            const matchRound = m.roundNumber !== undefined ? m.roundNumber : nextRound;
                            if (matchRound !== nextRound) return false;

                            // Filter out finished matches
                            if (m.status === 'finished') return false;

                            // Filter out bye matches (teamA === teamB or teamB is missing)
                            const teamALetter = m.teamA?.letter || m.teamA;
                            const teamBLetter = m.teamB?.letter || m.teamB;
                            if (!teamBLetter || teamALetter === teamBLetter) return false;

                            return true;
                        })
                        .sort((a, b) => {
                            // Sort by match number
                            const matchNumA = a.matchNumber || 0;
                            const matchNumB = b.matchNumber || 0;
                            return matchNumA - matchNumB;
                        });

                    console.log('🏓 [ActiveMatch] Next round matches found (filtered):', nextRoundMatches.length);
                    console.log('🏓 [ActiveMatch] Next round matches details:', nextRoundMatches.map(m => ({
                        id: m._id?.toString() || m.id?.toString(),
                        round: m.roundNumber,
                        match: m.matchNumber,
                        teamA: m.teamA?.letter,
                        teamB: m.teamB?.letter,
                        status: m.status,
                    })));

                    if (nextRoundMatches.length > 0) {
                        const firstNextRoundMatch = nextRoundMatches[0];
                        const nextMatchIndexInAll = allMatches.findIndex((m) => {
                            const matchId = m._id?.toString() || m.id?.toString();
                            const targetId = firstNextRoundMatch._id?.toString() || firstNextRoundMatch.id?.toString();
                            return matchId === targetId;
                        });

                        console.log('🏓 [ActiveMatch] ✅ Navigating to first valid match of next round:', {
                            nextRound,
                            nextMatchIndex: nextMatchIndexInAll,
                            matchId: firstNextRoundMatch._id?.toString() || firstNextRoundMatch.id?.toString(),
                            teamA: firstNextRoundMatch.teamA?.letter,
                            teamB: firstNextRoundMatch.teamB?.letter,
                            status: firstNextRoundMatch.status,
                        });

                        console.log('🏓 [ActiveMatch] 🚀 About to navigate to Round', nextRound, 'Match', firstNextRoundMatch.matchNumber);
                        setIsSubmitting(false); // Reset submitting state before navigating
                        navigation?.replace('ActiveMatch', {
                            teams: teams,
                            roomId: roomId,
                            roomName: roomName,
                            gameFormat: gameFormat,
                            gameId: gameId,
                            currentMatchIndex: nextMatchIndexInAll >= 0 ? nextMatchIndexInAll : 0,
                            completedMatches: updatedCompletedMatches,
                            roundNumber: nextRound,
                            matches: allMatches,
                        });
                        return; // Important: return early to prevent further execution
                    } else {
                        // No valid pending matches in next round - check if all matches are finished/bye matches
                        const allNextRoundMatches = allMatches.filter((m) => {
                            if (!m || typeof m !== 'object') return false;
                            const matchRound = m.roundNumber !== undefined ? m.roundNumber : nextRound;
                            return matchRound === nextRound;
                        });

                        console.log('🏓 [ActiveMatch] No valid pending matches found in next round');
                        console.log('🏓 [ActiveMatch] All matches in next round:', allNextRoundMatches.map(m => ({
                            id: m._id?.toString() || m.id?.toString(),
                            round: m.roundNumber,
                            match: m.matchNumber,
                            teamA: m.teamA?.letter,
                            teamB: m.teamB?.letter,
                            status: m.status,
                        })));

                        // If all matches in next round are finished, check if game is complete
                        const allFinished = allNextRoundMatches.every(m => m.status === 'finished');
                        if (allFinished) {
                            console.log('🏓 [ActiveMatch] All matches in next round are finished, checking game completion...');
                            // Fetch fresh game data to check if game is completed
                            try {
                                const gameResponse = await axios.get(`${API_BASE_URL}/api/v1/game/${gameId}`, { headers });
                                if (gameResponse?.data?.success && gameResponse.data.game) {
                                    const freshGame = gameResponse.data.game;
                                    if (freshGame.status === 'completed') {
                                        console.log('🏓 [ActiveMatch] Game is completed, navigating to results...');
                                        await handleGameCompletion(headers, updatedCompletedMatches);
                                        return;
                                    }
                                }
                            } catch (e) {
                                console.log('Error fetching fresh game data:', e);
                            }
                        }
                        console.log('🏓 [ActiveMatch] WARNING: No matches found in next round despite newMatches.length > 0');
                        console.log('🏓 [ActiveMatch] allMatches:', allMatches.map(m => ({
                            id: m._id?.toString() || m.id?.toString(),
                            round: m.roundNumber,
                            match: m.matchNumber,
                            status: m.status,
                        })));
                        console.log('🏓 [ActiveMatch] newMatches:', newMatches);
                        console.log('🏓 [ActiveMatch] nextRound:', nextRound);
                        // Fallback: game completed
                        if (updatedGame?.status === 'completed') {
                            await handleGameCompletion(headers, updatedCompletedMatches);
                        } else {
                            Alert.alert('Round Complete', 'Next round is being prepared...');
                        }
                    }
                } else if (hasNextMatchInRound) {
                    // PRIORITY 2: Navigate to next match in current round
                    console.log('🏓 [ActiveMatch] Navigating to next match in same round');
                    const nextMatch = currentRoundMatchesList[nextMatchPosition];
                    // Find the index in allMatches array
                    const nextMatchIndexInAll = allMatches.findIndex((m) => {
                        return m._id === nextMatch._id || m.id === nextMatch.id || m._id?.toString() === nextMatch._id?.toString();
                    });

                    navigation?.replace('ActiveMatch', {
                        teams: teams,
                        roomId: roomId,
                        roomName: roomName,
                        gameFormat: gameFormat,
                        gameId: gameId,
                        currentMatchIndex: nextMatchIndexInAll >= 0 ? nextMatchIndexInAll : nextMatchPosition,
                        completedMatches: updatedCompletedMatches,
                        roundNumber: roundNumber,
                        matches: allMatches,
                    });
                    return; // Return early to prevent further execution
                }

                // PRIORITY 3: Check if game is completed (must check after all other navigation options)
                const gameStatusFromResponse = response.data?.game?.status;
                const gameStatusFromGameData = response.data?.gameStatus;
                const isGameCompleted = updatedGame?.status === 'completed' ||
                    gameStatusFromResponse === 'completed' ||
                    gameStatusFromGameData === 'completed';

                console.log('🏓 [ActiveMatch] Checking game completion status:', {
                    allRoundFinished,
                    updatedGameStatus: updatedGame?.status,
                    responseGameStatus: gameStatusFromResponse,
                    responseGameStatusFromGameData: gameStatusFromGameData,
                    isGameCompleted,
                    shouldNavigateToResults: allRoundFinished && isGameCompleted,
                    fullResponseData: {
                        hasGame: !!response.data?.game,
                        gameKeys: response.data?.game ? Object.keys(response.data.game) : [],
                        gameStatusDirect: response.data?.game?.status,
                    },
                });

                // CRITICAL: Check game completion - this should ALWAYS be checked after round navigation
                if (allRoundFinished && isGameCompleted) {
                    console.log('🏓 [ActiveMatch] ✅✅✅ GAME COMPLETED! Calling handleGameCompletion...');
                    setIsSubmitting(false); // Reset submitting state
                    // All matches completed - calculate winners and show results
                    await handleGameCompletion(headers, updatedCompletedMatches);
                    console.log('🏓 [ActiveMatch] handleGameCompletion finished, should have navigated to GameResults');
                    return; // Return early after handling completion
                } else if (allRoundFinished) {
                    // Round finished but game not completed - might need to wait
                    console.log('🏓 [ActiveMatch] Round finished but game not completed yet, game status:', updatedGame?.status);
                    // Try fetching fresh game data to check if backend has marked it as completed
                    try {
                        const gameResponse = await axios.get(`${API_BASE_URL}/api/v1/game/${gameId}`, { headers });
                        if (gameResponse?.data?.success && gameResponse.data.game) {
                            const freshGame = gameResponse.data.game;
                            console.log('🏓 [ActiveMatch] Fresh game status:', freshGame.status);
                            if (freshGame.status === 'completed') {
                                console.log('🏓 [ActiveMatch] Game is now completed, navigating to results...');
                                await handleGameCompletion(headers, updatedCompletedMatches);
                                return;
                            }
                        }
                    } catch (e) {
                        console.log('Error fetching fresh game data:', e);
                    }
                    Alert.alert('Round Complete', 'All matches in this round are finished.');
                } else {
                    // Should not happen - reload and try again
                    console.log('Unexpected state - reloading game data');
                    // Fetch fresh game and navigate to next match
                    try {
                        const gameResponse = await axios.get(`${API_BASE_URL}/api/v1/game/${gameId}`, { headers });
                        if (gameResponse?.data?.success && gameResponse.data.game) {
                            const freshGame = gameResponse.data.game;
                            const freshMatches = freshGame.matches || [];

                            // Find next pending match
                            const pendingMatches = freshMatches.filter(m =>
                                m && (m.status === 'pending' || m.status === 'live')
                            );

                            if (pendingMatches.length > 0) {
                                const nextMatch = pendingMatches[0];
                                const nextMatchIndex = freshMatches.findIndex(m =>
                                    m._id === nextMatch._id || m.id === nextMatch.id
                                );

                                navigation?.replace('ActiveMatch', {
                                    teams: teams,
                                    roomId: roomId,
                                    roomName: roomName,
                                    gameFormat: gameFormat,
                                    gameId: gameId,
                                    currentMatchIndex: nextMatchIndex >= 0 ? nextMatchIndex : 0,
                                    completedMatches: updatedCompletedMatches,
                                    roundNumber: nextMatch.roundNumber || roundNumber,
                                    matches: freshMatches,
                                });
                            } else if (freshGame.status === 'completed') {
                                await handleGameCompletion(headers, updatedCompletedMatches);
                            }
                        }
                    } catch (e) {
                        console.log('Error reloading game:', e);
                        Alert.alert('Error', 'Unable to proceed to next match. Please try again.');
                    }
                }
            } else {
                throw new Error(response.data?.message || 'Failed to submit match result');
            }
        } catch (error) {
            console.log('Error submitting result:', error?.response?.data || error?.message);
            Alert.alert(
                'Error',
                error?.response?.data?.message || 'Failed to submit result. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    // Check if match is invalid (missing teams or bye match where teamA === teamB)
    const teamALetter = teamA?.letter || teamA;
    const teamBLetter = teamB?.letter || teamB;
    const isByeMatch = teamALetter && teamBLetter && teamALetter === teamBLetter;
    const isInvalidMatch = !teamA || !teamB || isByeMatch;

    if (isInvalidMatch) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                        {isByeMatch ? 'This is a bye match (auto-completed).' : 'Invalid match data. Please try again.'}
                    </Text>
                    <Text style={styles.errorSubtext}>
                        {isByeMatch
                            ? 'The game will automatically progress. If all matches are complete, check results.'
                            : 'This match cannot be played. The game may be completed or there was an error.'}
                    </Text>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => {
                            // Try to go to dashboard instead of just going back
                            if (navigation?.navigate && roomId) {
                                navigation.navigate('RoomDashboard', {
                                    roomId: roomId,
                                    roomName: roomName,
                                });
                            } else {
                                navigation?.goBack();
                            }
                        }}
                    >
                        <Text style={styles.backButtonText}>Go to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            // If game has started, navigate to dashboard instead of going back
                            if (gameId && roomId && navigation?.navigate) {
                                navigation.navigate('RoomDashboard', {
                                    roomId: roomId,
                                    roomName: roomName,
                                });
                            } else {
                                navigation?.goBack();
                            }
                        }}
                        style={styles.backButtonIcon}
                    >
                        <Feather name="arrow-left" size={24} color={palette.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Active Match</Text>
                        <Text style={styles.headerSubtitle}>Round {roundNumber} - Match {currentMatchNumber}</Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Team A Card */}
                    <View style={styles.teamCard}>
                        <View style={styles.teamHeader}>
                            <Text style={styles.teamTitle}>Team {teamA?.letter || 'A'}</Text>
                            <View style={[styles.teamBadge, { backgroundColor: teamA.color?.primary || '#10b981' }]}>
                                <Text style={styles.teamBadgeText}>Team {teamA?.letter || 'A'}</Text>
                            </View>
                        </View>

                        <View style={styles.playersList}>
                            {teamA.players.map((player, index) => (
                                <View key={`teamA-${player.id}-${index}`} style={styles.playerRow}>
                                    <View style={[styles.playerAvatar, { backgroundColor: teamA.color?.primary || '#10b981' }]}>
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
                                    <Text style={styles.playerName}>{player.name}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.scoreInputContainer}>
                            <TextInput
                                style={styles.scoreInput}
                                placeholder="Score"
                                placeholderTextColor={palette.textSecondary}
                                value={teamAScore}
                                onChangeText={setTeamAScore}
                                keyboardType="number-pad"
                                returnKeyType="done"
                            />
                        </View>
                    </View>

                    {/* VS Separator */}
                    <View style={styles.vsContainer}>
                        <View style={styles.vsBadge}>
                            <Text style={styles.vsText}>VS</Text>
                        </View>
                    </View>

                    {/* Team B Card */}
                    <View style={styles.teamCard}>
                        <View style={styles.teamHeader}>
                            <Text style={styles.teamTitle}>Team {teamB?.letter || 'B'}</Text>
                            <View style={[styles.teamBadge, { backgroundColor: teamB.color?.primary || '#f97316' }]}>
                                <Text style={styles.teamBadgeText}>Team {teamB?.letter || 'B'}</Text>
                            </View>
                        </View>

                        <View style={styles.playersList}>
                            {teamB.players.map((player, index) => (
                                <View key={`teamB-${player.id}-${index}`} style={styles.playerRow}>
                                    <View style={[styles.playerAvatar, { backgroundColor: teamB.color?.primary || '#f97316' }]}>
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
                                    <Text style={styles.playerName}>{player.name}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.scoreInputContainer}>
                            <TextInput
                                style={styles.scoreInput}
                                placeholder="Score"
                                placeholderTextColor={palette.textSecondary}
                                value={teamBScore}
                                onChangeText={setTeamBScore}
                                keyboardType="number-pad"
                                returnKeyType="done"
                            />
                        </View>
                    </View>
                </ScrollView>

                {/* Submit Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (isSubmitting || !teamAScore.trim() || !teamBScore.trim() || Math.abs(parseInt(teamAScore || 0) - parseInt(teamBScore || 0)) === 0) && styles.submitButtonDisabled
                        ]}
                        onPress={handleSubmitResult}
                        disabled={isSubmitting || !teamAScore.trim() || !teamBScore.trim() || Math.abs(parseInt(teamAScore || 0) - parseInt(teamBScore || 0)) === 0}
                        activeOpacity={0.8}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <>
                                <Feather name="check" size={18} color="#ffffff" />
                                <Text style={styles.submitButtonText}>
                                    {Math.abs(parseInt(teamAScore || 0) - parseInt(teamBScore || 0)) === 0
                                        ? 'Enter Different Scores'
                                        : 'Submit Result & Continue'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.background,
    },
    keyboardView: {
        flex: 1,
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
    errorSubtext: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
        opacity: 0.8,
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
        paddingVertical: 16,
        backgroundColor: palette.card,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    backButtonIcon: {
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
        paddingBottom: 100,
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
    teamTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    teamBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    teamBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    playersList: {
        gap: 12,
        marginBottom: 16,
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
    playerName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
        flex: 1,
    },
    scoreInputContainer: {
        marginTop: 8,
    },
    scoreInput: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
        borderWidth: 1,
        borderColor: palette.border,
    },
    vsContainer: {
        alignItems: 'center',
        marginVertical: 8,
    },
    vsBadge: {
        backgroundColor: palette.textSecondary,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    vsText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: palette.accent,
        paddingVertical: 16,
        borderRadius: 12,
    },
    submitButtonDisabled: {
        backgroundColor: palette.border,
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
});

export default ActiveMatchScreen;

