/**
 * Add Players to Room Screen
 * Allows members to add new players to an existing room
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState, useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/colors.js';
import { API_BASE_URL } from '../api.js';
import { ContactPickerModal } from '../components/ContactPickerModal.js';
import { useAlert } from '../utils/alertUtils.js';

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

const AddPlayersToRoomScreen = ({ route, navigation }) => {
    const { roomId, roomName } = route.params || {};
    const { showAlert, AlertComponent } = useAlert();

    const [existingPlayers, setExistingPlayers] = useState([]);
    const [newPlayers, setNewPlayers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerMobile, setNewPlayerMobile] = useState('');
    const [showContactModal, setShowContactModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Load existing room players and friends
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const headers = await getAuthHeaders();

            // Load room data to get existing players
            const roomResponse = await axios.get(`${API_BASE_URL}/api/v1/room/${roomId}`, { headers });
            if (roomResponse?.data?.success && roomResponse.data.room) {
                setExistingPlayers(roomResponse.data.room.players || []);
            }

            // Load friends
            try {
                setIsLoadingFriends(true);
                const friendsResponse = await axios.get(`${API_BASE_URL}/api/v1/user/friends`, { headers });
                if (friendsResponse.data?.friends) {
                    setFriends(friendsResponse.data.friends);
                }
            } catch (error) {
                console.log('Error loading friends:', error?.message);
            } finally {
                setIsLoadingFriends(false);
            }
        } catch (error) {
            console.error('Error loading room data:', error);
            setErrorMessage('Failed to load room data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [roomId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData]),
    );

    const handlePhoneChange = (text) => {
        const digits = text.replace(/\D/g, '');
        const formattedPhone = digits.slice(0, 10);
        setNewPlayerMobile(formattedPhone);
    };

    const handleSelectContact = (contact) => {
        const isAlreadyAdded = newPlayers.some((p) => p.mobile === contact.phoneNumber) ||
            existingPlayers.some((p) => normalizeMobile(p.mobile) === normalizeMobile(contact.phoneNumber));

        if (isAlreadyAdded) {
            showAlert({
                title: 'Already Added',
                message: 'This player is already in the room',
                type: 'warning',
                buttons: [{ text: 'OK' }],
            });
            return;
        }

        setNewPlayers([
            ...newPlayers,
            {
                id: `contact-${contact.id}-${Date.now()}`,
                name: contact.name,
                mobile: contact.phoneNumber,
                isFriend: false,
            },
        ]);
    };

    const handleAddMultipleContacts = (contacts) => {
        const filteredContacts = contacts.filter(
            (contact) =>
                !newPlayers.some((p) => p.mobile === contact.phoneNumber) &&
                !existingPlayers.some((p) => normalizeMobile(p.mobile) === normalizeMobile(contact.phoneNumber))
        );

        const mappedContacts = filteredContacts.map((contact) => ({
            id: `contact-${contact.id}-${Date.now()}`,
            name: contact.name,
            mobile: contact.phoneNumber,
            isFriend: false,
        }));

        setNewPlayers([...newPlayers, ...mappedContacts]);
        setShowContactModal(false);
    };

    const normalizeMobile = (mobile) => {
        if (!mobile) return '';
        const cleanMobile = mobile.replace(/[\s\-+()]/g, '');
        const normalizedMobile = cleanMobile.replace(/^91/, '');
        return normalizedMobile.slice(-10);
    };

    const validateNewPlayer = () => {
        if (!newPlayerName.trim()) {
            showAlert({
                title: 'Validation Error',
                message: 'Player name is required',
                type: 'warning',
                buttons: [{ text: 'OK' }],
            });
            return false;
        }
        if (newPlayerMobile.length !== 10) {
            showAlert({
                title: 'Validation Error',
                message: 'Please enter a valid 10-digit mobile number',
                type: 'warning',
                buttons: [{ text: 'OK' }],
            });
            return false;
        }

        const normalizedMobile = normalizeMobile(newPlayerMobile);
        const isDuplicate = newPlayers.some((p) => normalizeMobile(p.mobile) === normalizedMobile) ||
            existingPlayers.some((p) => normalizeMobile(p.mobile) === normalizedMobile);

        if (isDuplicate) {
            showAlert({
                title: 'Already Added',
                message: 'This mobile number is already in the room',
                type: 'warning',
                buttons: [{ text: 'OK' }],
            });
            return false;
        }

        return true;
    };

    const handleAddNewPlayer = () => {
        if (!validateNewPlayer()) {
            return;
        }

        setNewPlayers([
            ...newPlayers,
            {
                id: `new-${Date.now()}`,
                name: newPlayerName.trim(),
                mobile: newPlayerMobile,
                isFriend: false,
            },
        ]);

        setNewPlayerName('');
        setNewPlayerMobile('');
        setShowAddPlayerForm(false);
    };

    const handleAddFriend = (friend) => {
        const normalizedMobile = normalizeMobile(friend.mobile);
        const isAlreadyAdded = newPlayers.some((p) => normalizeMobile(p.mobile) === normalizedMobile) ||
            existingPlayers.some((p) => normalizeMobile(p.mobile) === normalizedMobile);

        if (isAlreadyAdded) {
            showAlert({
                title: 'Already Added',
                message: 'This player is already in the room',
                type: 'warning',
                buttons: [{ text: 'OK' }],
            });
            return;
        }

        setNewPlayers([
            ...newPlayers,
            {
                ...friend,
                isFriend: true,
            },
        ]);
    };

    const handleRemoveNewPlayer = (playerId) => {
        setNewPlayers(newPlayers.filter((p) => p.id !== playerId));
    };

    const handleSave = async () => {
        if (newPlayers.length === 0) {
            showAlert({
                title: 'No Players Added',
                message: 'Please add at least one player to continue',
                type: 'warning',
                buttons: [{ text: 'OK' }],
            });
            return;
        }

        try {
            setIsSaving(true);
            const headers = await getAuthHeaders();

            // Combine existing players with new players
            const allPlayers = [
                ...existingPlayers.map((p) => ({
                    id: p.userId || null,
                    name: p.name || '',
                    mobile: p.mobile || '',
                })),
                ...newPlayers.map((p) => ({
                    id: p.id && !p.id.toString().startsWith('new-') && !p.id.toString().startsWith('contact-') ? p.id : undefined,
                    name: p.name || '',
                    mobile: p.mobile || '',
                })),
            ];

            // Update room with all players
            const response = await axios.put(
                `${API_BASE_URL}/api/v1/room/${roomId}`,
                {
                    players: allPlayers,
                },
                { headers }
            );

            if (response.data?.success) {
                showAlert({
                    title: 'Success',
                    message: `${newPlayers.length} player(s) added successfully!`,
                    type: 'success',
                    buttons: [
                        {
                            text: 'OK',
                            onPress: () => {
                                // Refresh room data and go back
                                navigation.goBack();
                            },
                        },
                    ],
                });
            } else {
                throw new Error(response.data?.message || 'Failed to add players');
            }
        } catch (error) {
            console.error('Error adding players:', error?.response?.data || error?.message);
            showAlert({
                title: 'Error',
                message: error?.response?.data?.message || 'Failed to add players. Please try again.',
                type: 'error',
                buttons: [{ text: 'OK' }],
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={palette.accent} />
                    <Text style={styles.loadingText}>Loading...</Text>
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
                    <Text style={styles.headerTitle}>Add Players</Text>
                    <Text style={styles.headerSubtitle}>{roomName}</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardContainer}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Error Message */}
                    {errorMessage ? (
                        <View style={styles.errorCard}>
                            <Feather name="alert-circle" size={20} color={palette.warning} />
                            <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                    ) : null}

                    {/* Existing Players Info */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Feather name="info" size={16} color={palette.accent} />
                            <Text style={styles.infoText}>
                                {existingPlayers.length} player(s) already in room. Add more below.
                            </Text>
                        </View>
                    </View>

                    {/* New Players List */}
                    {newPlayers.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                New Players ({newPlayers.length})
                            </Text>
                            <View style={styles.playersList}>
                                {newPlayers.map((player) => (
                                    <View key={player.id} style={styles.playerCard}>
                                        <View style={styles.playerInfo}>
                                            <Text style={styles.playerName}>{player.name}</Text>
                                            <Text style={styles.playerMobile}>{player.mobile}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveNewPlayer(player.id)}
                                            style={styles.removeButton}
                                        >
                                            <Feather name="x-circle" size={20} color={palette.warning} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Add Player Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Add Players</Text>
                            <Text style={styles.sectionSubtitle}>
                                {newPlayers.length} {newPlayers.length === 1 ? 'player' : 'players'} added
                            </Text>
                        </View>

                        {!showAddPlayerForm ? (
                            <View style={styles.addButtonsContainer}>
                                {friends.length > 0 && (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => setShowAddPlayerForm('friends')}
                                        disabled={isLoadingFriends}
                                    >
                                        <Feather name="user-plus" size={18} color={palette.accent} />
                                        <Text style={styles.addButtonText}>Add from Friends</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={() => setShowAddPlayerForm('new')}
                                >
                                    <Feather name="plus-circle" size={18} color={palette.accent} />
                                    <Text style={styles.addButtonText}>Add New Player</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.addPlayerForm}>
                                {showAddPlayerForm === 'friends' ? (
                                    <>
                                        <View style={styles.formHeader}>
                                            <Text style={styles.formTitle}>Select Friends</Text>
                                            <TouchableOpacity
                                                onPress={() => setShowAddPlayerForm(false)}
                                            >
                                                <Feather name="x" size={20} color={palette.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                        {isLoadingFriends ? (
                                            <ActivityIndicator size="small" color={palette.accent} />
                                        ) : friends.length > 0 ? (
                                            <FlatList
                                                data={friends}
                                                numColumns={2}
                                                keyExtractor={(item) => item._id || item.id}
                                                renderItem={({ item: friend }) => {
                                                    const normalizedMobile = normalizeMobile(friend.mobile);
                                                    const isAlreadyAdded = newPlayers.some((p) => normalizeMobile(p.mobile) === normalizedMobile) ||
                                                        existingPlayers.some((p) => normalizeMobile(p.mobile) === normalizedMobile);
                                                    return (
                                                        <TouchableOpacity
                                                            style={[
                                                                styles.friendCard,
                                                                isAlreadyAdded && styles.friendCardDisabled,
                                                            ]}
                                                            onPress={() => handleAddFriend(friend)}
                                                            disabled={isAlreadyAdded}
                                                            activeOpacity={0.7}
                                                        >
                                                            <View style={styles.friendInfo}>
                                                                <Text
                                                                    style={[
                                                                        styles.friendName,
                                                                        isAlreadyAdded && styles.friendNameDisabled,
                                                                    ]}
                                                                    numberOfLines={1}
                                                                >
                                                                    {friend.displayName || friend.name}
                                                                </Text>
                                                                <Text
                                                                    style={[
                                                                        styles.friendMobile,
                                                                        isAlreadyAdded && styles.friendMobileDisabled,
                                                                    ]}
                                                                    numberOfLines={1}
                                                                >
                                                                    {friend.mobile}
                                                                </Text>
                                                            </View>
                                                            {isAlreadyAdded && (
                                                                <Feather name="check-circle" size={20} color={palette.success} />
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                }}
                                                contentContainerStyle={styles.friendsList}
                                                columnWrapperStyle={styles.friendRow}
                                                scrollEnabled={false}
                                            />
                                        ) : (
                                            <Text style={styles.emptyText}>No friends available</Text>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <View style={styles.formHeader}>
                                            <Text style={styles.formTitle}>New Player</Text>
                                            <TouchableOpacity onPress={() => setShowAddPlayerForm(false)}>
                                                <Feather name="x" size={20} color={palette.textSecondary} />
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.importContactButton}
                                            onPress={() => setShowContactModal(true)}
                                        >
                                            <Feather name="user" size={18} color={palette.accent} />
                                            <Text style={styles.importContactButtonText}>
                                                Import from Contacts
                                            </Text>
                                        </TouchableOpacity>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Player Name"
                                            placeholderTextColor="#9ca3af"
                                            value={newPlayerName}
                                            onChangeText={setNewPlayerName}
                                            autoCapitalize="words"
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Mobile Number (10 digits)"
                                            placeholderTextColor="#9ca3af"
                                            value={newPlayerMobile}
                                            onChangeText={handlePhoneChange}
                                            keyboardType="phone-pad"
                                            maxLength={10}
                                        />
                                        <TouchableOpacity
                                            style={[
                                                styles.addPlayerButton,
                                                (!newPlayerName.trim() || newPlayerMobile.length !== 10) &&
                                                styles.addPlayerButtonDisabled,
                                            ]}
                                            onPress={handleAddNewPlayer}
                                            disabled={!newPlayerName.trim() || newPlayerMobile.length !== 10}
                                        >
                                            <Text
                                                style={[
                                                    styles.addPlayerButtonText,
                                                    (!newPlayerName.trim() || newPlayerMobile.length !== 10) &&
                                                    styles.addPlayerButtonTextDisabled,
                                                ]}
                                            >
                                                Add Player
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Save Button */}
                    {newPlayers.length > 0 && (
                        <TouchableOpacity
                            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={isSaving}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={
                                    isSaving
                                        ? ['#9ca3af', '#6b7280']
                                        : ['#8b5cf6', '#7c3aed']
                                }
                                style={styles.saveButtonGradient}
                            >
                                {isSaving ? (
                                    <View style={styles.buttonContent}>
                                        <ActivityIndicator size="small" color="#ffffff" />
                                        <Text style={styles.saveButtonText}>Adding Players...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.saveButtonText}>
                                            Add {newPlayers.length} Player{newPlayers.length > 1 ? 's' : ''}
                                        </Text>
                                        <Feather name="check" size={20} color="#fff" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <ContactPickerModal
                visible={showContactModal}
                onClose={() => setShowContactModal(false)}
                onSelectContact={handleSelectContact}
                onSelectContacts={handleAddMultipleContacts}
                existingPlayers={[...existingPlayers, ...newPlayers]}
            />

            <AlertComponent />
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
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    headerSubtitle: {
        fontSize: 12,
        color: palette.textSecondary,
        marginTop: 2,
    },
    headerSpacer: {
        width: 32,
    },
    keyboardContainer: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
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
    infoCard: {
        backgroundColor: palette.accentLight,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: palette.accent,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: palette.textPrimary,
        fontWeight: '500',
    },
    section: {
        gap: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: palette.textSecondary,
    },
    playersList: {
        gap: 12,
    },
    playerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: palette.border,
    },
    playerInfo: {
        flex: 1,
    },
    playerName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    playerMobile: {
        fontSize: 14,
        color: palette.textSecondary,
        marginTop: 4,
    },
    removeButton: {
        padding: 4,
    },
    addButtonsContainer: {
        gap: 12,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: palette.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: palette.border,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.accent,
    },
    addPlayerForm: {
        gap: 12,
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    importContactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: palette.accentLight,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.accent,
        marginBottom: 8,
    },
    importContactButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.accent,
    },
    input: {
        backgroundColor: palette.card,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: palette.textPrimary,
        borderWidth: 1,
        borderColor: palette.border,
    },
    addPlayerButton: {
        backgroundColor: palette.accent,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    addPlayerButtonDisabled: {
        backgroundColor: '#e5e7eb',
    },
    addPlayerButtonText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    addPlayerButtonTextDisabled: {
        color: '#9ca3af',
    },
    friendsList: {
        gap: 12,
    },
    friendRow: {
        justifyContent: 'space-between',
        gap: 12,
    },
    friendCard: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
        minHeight: 70,
        borderWidth: 1,
        borderColor: palette.border,
    },
    friendCardDisabled: {
        backgroundColor: '#f3f4f6',
        opacity: 0.7,
    },
    friendInfo: {
        flex: 1,
        marginRight: 8,
    },
    friendName: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.textPrimary,
    },
    friendNameDisabled: {
        color: palette.textSecondary,
    },
    friendMobile: {
        fontSize: 12,
        color: palette.textSecondary,
        marginTop: 4,
    },
    friendMobileDisabled: {
        color: '#d1d5db',
    },
    emptyText: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        padding: 20,
    },
    saveButton: {
        marginTop: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#8b5cf6',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
        marginBottom: 16,
    },
    errorText: {
        flex: 1,
        color: palette.warning,
        fontSize: 14,
    },
});

export default AddPlayersToRoomScreen;

