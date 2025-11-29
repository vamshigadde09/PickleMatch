import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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

// Generate initials from name
const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

export const SelectMembersScreen = ({ route, navigation }) => {
    const { roomId, roomName, preSelectedPlayers } = route.params || {};
    console.log('👥 [SelectMembers] Screen Loaded with params:', { roomId, roomName, preSelectedPlayersCount: preSelectedPlayers?.length || 0 });
    const [players, setPlayers] = useState([]);
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const fetchRoomPlayers = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');

        try {
            const headers = await getAuthHeaders();
            const response = await axios.get(`${API_BASE_URL}/api/v1/room/${roomId}`, { headers });

            if (response?.data?.success && response.data.room) {
                const roomData = response.data.room;
                // Room players are already in the room.players array
                const roomPlayers = roomData.players || [];
                console.log('👥 [SelectMembers] Loaded room players:', roomPlayers.length);
                setPlayers(roomPlayers);

                // If preSelectedPlayers passed, use those; otherwise auto-select ALL players
                if (preSelectedPlayers && Array.isArray(preSelectedPlayers) && preSelectedPlayers.length > 0) {
                    console.log('👥 [SelectMembers] Using pre-selected players:', preSelectedPlayers.length);
                    setSelectedPlayers(preSelectedPlayers);
                } else if (roomPlayers.length >= 2) {
                    // Auto-select all players by default (minimum 2 required for game)
                    console.log('👥 [SelectMembers] Auto-selecting all players:', roomPlayers.length);
                    setSelectedPlayers([...roomPlayers]);
                }
            } else {
                setErrorMessage('Unable to load room players.');
            }
        } catch (error) {
            console.log('Error fetching room players:', error?.response?.data || error?.message);
            setErrorMessage('Failed to load room players. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [roomId]);

    useFocusEffect(
        useCallback(() => {
            fetchRoomPlayers();
        }, [fetchRoomPlayers]),
    );

    const togglePlayerSelection = (player) => {
        const playerId = player.userId || player._id || player.mobile;
        const isSelected = selectedPlayers.some(p => {
            const pId = p.userId || p._id || p.mobile;
            return pId === playerId;
        });

        if (isSelected) {
            setSelectedPlayers(selectedPlayers.filter(p => {
                const pId = p.userId || p._id || p.mobile;
                return pId !== playerId;
            }));
        } else {
            setSelectedPlayers([...selectedPlayers, player]);
        }
    };

    const handleContinue = () => {
        console.log('👥 [SelectMembers] Continue Button Pressed');
        console.log('👥 [SelectMembers] Selected Players Count:', selectedPlayers.length);
        if (selectedPlayers.length < 2) {
            console.log('👥 [SelectMembers] Validation failed: Need at least 2 players');
            Alert.alert(
                'Minimum Players Required',
                'Please select at least 2 players to create a game.',
            );
            return;
        }

        // Navigate to Choose Game Format with selected players
        const params = {
            roomId: roomId,
            roomName: roomName,
            selectedPlayers: selectedPlayers,
        };
        console.log('👥 [SelectMembers] Navigating to ChooseGameFormat with:', {
            roomId,
            roomName,
            selectedPlayersCount: selectedPlayers.length,
            selectedPlayerNames: selectedPlayers.map(p => p.name || p.mobile),
        });
        navigation.navigate('ChooseGameFormat', params);
    };

    const handleSelectAll = () => {
        if (selectedPlayers.length === players.length) {
            setSelectedPlayers([]);
        } else {
            setSelectedPlayers([...players]);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={styles.loadingText}>Loading players...</Text>
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
                    <Text style={styles.headerTitle}>Select Players</Text>
                    <Text style={styles.headerSubtitle}>
                        {selectedPlayers.length} of {players.length} selected
                    </Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            {errorMessage ? (
                <View style={styles.errorCard}>
                    <Feather name="alert-circle" size={20} color={palette.warning} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}

            <View style={styles.content}>
                <View style={styles.actionBar}>
                    <TouchableOpacity
                        style={styles.selectAllButton}
                        onPress={handleSelectAll}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.selectAllText}>
                            {selectedPlayers.length === players.length ? 'Deselect All' : 'Select All'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.minPlayersText}>
                        Minimum 2 players required (2 for 1v1, 4+ for tournaments)
                    </Text>
                </View>

                <FlatList
                    data={players}
                    keyExtractor={(item, index) => {
                        const id = item.userId || item._id || item.mobile || `player-${index}`;
                        return id.toString();
                    }}
                    renderItem={({ item: player }) => {
                        const playerId = player.userId || player._id || player.mobile;
                        const isSelected = selectedPlayers.some(p => {
                            const pId = p.userId || p._id || p.mobile;
                            return pId === playerId;
                        });

                        return (
                            <TouchableOpacity
                                style={[styles.playerCard, isSelected && styles.playerCardSelected]}
                                onPress={() => togglePlayerSelection(player)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.playerInfo}>
                                    <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                                        <Text style={styles.avatarText}>
                                            {getInitials(player.name)}
                                        </Text>
                                    </View>
                                    <View style={styles.playerDetails}>
                                        <Text style={styles.playerName}>{player.name}</Text>
                                        {player.mobile && (
                                            <Text style={styles.playerMobile}>{player.mobile}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                    {isSelected && (
                                        <Feather name="check" size={20} color="#fff" />
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.continueButton,
                        selectedPlayers.length < 2 && styles.continueButtonDisabled,
                    ]}
                    onPress={handleContinue}
                    disabled={selectedPlayers.length < 2}
                    activeOpacity={0.8}
                >
                    <Text style={styles.continueButtonText}>
                        Continue ({selectedPlayers.length})
                    </Text>
                    <Feather name="arrow-right" size={20} color="#fff" />
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
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff7ed',
        padding: 16,
        margin: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    errorText: {
        flex: 1,
        color: palette.warning,
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    selectAllButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    selectAllText: {
        color: palette.accent,
        fontSize: 14,
        fontWeight: '600',
    },
    minPlayersText: {
        color: palette.textSecondary,
        fontSize: 12,
    },
    listContent: {
        gap: 12,
        paddingBottom: 20,
    },
    playerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: palette.border,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    playerCardSelected: {
        borderColor: palette.accent,
        backgroundColor: palette.accentLight,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: palette.accentLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarSelected: {
        backgroundColor: palette.accent,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.accent,
    },
    playerDetails: {
        flex: 1,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
        marginBottom: 2,
    },
    playerMobile: {
        fontSize: 13,
        color: palette.textSecondary,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    checkboxSelected: {
        backgroundColor: palette.accent,
        borderColor: palette.accent,
    },
    footer: {
        padding: 20,
        backgroundColor: palette.card,
        borderTopWidth: 1,
        borderTopColor: palette.border,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: palette.accent,
        borderRadius: 16,
        paddingVertical: 16,
        shadowColor: palette.accent,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    continueButtonDisabled: {
        backgroundColor: palette.border,
        shadowOpacity: 0,
        elevation: 0,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default SelectMembersScreen;

