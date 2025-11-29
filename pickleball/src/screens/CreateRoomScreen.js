import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/colors.js';
import { API_BASE_URL } from '../api.js';
import { StatusBar } from 'expo-status-bar';
import { ContactPickerModal } from '../components/ContactPickerModal.js';

// Helper function to get auth headers
const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
    };
};

export const CreateRoomScreen = ({ navigation }) => {
    const [roomName, setRoomName] = useState('');
    const [players, setPlayers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerMobile, setNewPlayerMobile] = useState('');
    const [showMobileToggle, setShowMobileToggle] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        try {
            setIsLoadingFriends(true);
            const headers = await getAuthHeaders();
            const response = await axios.get(`${API_BASE_URL}/api/v1/user/friends`, { headers });
            if (response.data?.friends) {
                setFriends(response.data.friends);
            }
        } catch (error) {
            console.log('Error loading friends:', error?.message);
        } finally {
            setIsLoadingFriends(false);
        }
    };

    const handleRoomNameChange = (text) => {
        setRoomName(text);
        setError('');
    };

    const handlePhoneChange = (text) => {
        const digits = text.replace(/\D/g, '');
        const formattedPhone = digits.slice(0, 10);
        setNewPlayerMobile(formattedPhone);
    };

    const handleSelectContact = (contact) => {
        setPlayers((currentPlayers) => {
            const isAlreadyAdded = currentPlayers.some((p) => p.mobile === contact.phoneNumber);
            if (isAlreadyAdded) {
                return currentPlayers;
            }

            return [
                ...currentPlayers,
                {
                    id: `contact-${contact.id}-${Date.now()}`,
                    name: contact.name,
                    mobile: contact.phoneNumber,
                    isFriend: false,
                },
            ];
        });

        setError('');
    };

    const handleAddMultipleContacts = (contacts) => {
        setPlayers((currentPlayers) => {
            const newPlayers = contacts
                .filter((contact) => !currentPlayers.some((p) => p.mobile === contact.phoneNumber))
                .map((contact) => ({
                    id: `contact-${contact.id}-${Date.now()}`,
                    name: contact.name,
                    mobile: contact.phoneNumber,
                    isFriend: false,
                }));

            return [...currentPlayers, ...newPlayers];
        });

        setShowContactModal(false);
        setError('');
    };

    const handleOpenContactModal = () => {
        setShowContactModal(true);
    };

    const validateForm = () => {
        if (!roomName || roomName.trim().length === 0) {
            setError('Room name is required');
            return false;
        }
        if (roomName.trim().length < 3) {
            setError('Room name must be at least 3 characters');
            return false;
        }
        return true;
    };

    const validateNewPlayer = () => {
        if (!newPlayerName || newPlayerName.trim().length === 0) {
            Alert.alert('Error', 'Player name is required');
            return false;
        }
        if (!newPlayerMobile || newPlayerMobile.length !== 10) {
            Alert.alert('Error', 'Valid 10-digit mobile number is required');
            return false;
        }
        if (!/^[6-9]/.test(newPlayerMobile)) {
            Alert.alert('Error', 'Mobile number must start with 6, 7, 8, or 9');
            return false;
        }
        return true;
    };

    const handleAddFriend = (friend) => {
        const isAlreadyAdded = players.some((p) => p.id === friend.id || p.mobile === friend.mobile);
        if (isAlreadyAdded) {
            Alert.alert('Already Added', 'This player is already in the room');
            return;
        }
        setPlayers([...players, { ...friend, isFriend: true }]);
        setError('');
    };

    const handleAddNewPlayer = () => {
        if (!validateNewPlayer()) {
            return;
        }

        const isAlreadyAdded = players.some((p) => p.mobile === newPlayerMobile);
        if (isAlreadyAdded) {
            Alert.alert('Already Added', 'This mobile number is already in the room');
            return;
        }

        setPlayers([
            ...players,
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
        setError('');
    };

    const handleRemovePlayer = (playerId) => {
        setPlayers(players.filter((p) => p.id !== playerId));
    };

    const handleCreateRoom = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            // Prepare players data for backend
            const playersData = players.map((p) => {
                // Handle both 'id' and '_id' fields (MongoDB uses _id)
                const playerId = p.id || p._id;

                // If player ID starts with 'new-' or 'contact-', it's a new player (no userId)
                // Otherwise, it's an existing user's ID (MongoDB ObjectId)
                const isNewPlayer = !playerId ||
                    playerId.toString().startsWith('new-') ||
                    playerId.toString().startsWith('contact-');

                return {
                    id: isNewPlayer ? undefined : playerId,
                    name: (p.name || '').trim(),
                    mobile: p.mobile || '',
                };
            });

            const headers = await getAuthHeaders();
            const response = await axios.post(`${API_BASE_URL}/api/v1/room/create`, {
                name: roomName.trim(),
                players: playersData,
                showMobileNumber: showMobileToggle,
            }, { headers });

            if (response.data?.success) {
                const { room } = response.data;

                // Clear form after successful creation
                setRoomName('');
                setPlayers([]);
                setShowMobileToggle(false);
                setShowAddPlayerForm(false);
                setNewPlayerName('');
                setNewPlayerMobile('');

                Alert.alert(
                    'Room Created!',
                    `Room "${room.name}" has been created successfully!\n\n✅ You are automatically added as a player.\n\n📋 Room Code: ${room.code}\n\nShare this code with others to join the room.`,
                    [
                        {
                            text: 'Choose Game Format',
                            onPress: () => {
                                if (navigation?.navigate) {
                                    navigation.navigate('ChooseGameFormat', {
                                        roomId: room._id || room.id,
                                        roomName: room.name,
                                    });
                                }
                            },
                        },
                        {
                            text: 'Go to Home',
                            style: 'cancel',
                            onPress: () => {
                                if (navigation?.goBack) {
                                    navigation.goBack();
                                } else if (navigation?.navigate) {
                                    navigation.navigate('Home');
                                }
                            },
                        },
                    ],
                );
            } else {
                throw new Error(response.data?.message || 'Failed to create room');
            }
        } catch (error) {
            console.log('Create room error:', error?.response?.data || error?.message);

            let errorMessage = 'Failed to create room. Please try again.';

            if (error.response) {
                // Handle different error status codes
                if (error.response.status === 400) {
                    // Validation errors
                    if (error.response.data?.errors && Array.isArray(error.response.data.errors)) {
                        errorMessage = error.response.data.errors.join(', ');
                    } else if (error.response.data?.message) {
                        errorMessage = error.response.data.message;
                    }
                } else if (error.response.status === 401) {
                    errorMessage = 'Authentication failed. Please login again.';
                    // Optionally redirect to login
                } else if (error.response.status === 409) {
                    errorMessage = error.response.data?.message || 'A room with this name already exists.';
                } else if (error.response.status === 500) {
                    errorMessage = 'Server error. Please try again later.';
                } else if (error.response.data?.message) {
                    errorMessage = error.response.data.message;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            setError(errorMessage);

            // Show alert for critical errors
            if (error.response?.status === 401) {
                Alert.alert('Authentication Error', errorMessage, [
                    {
                        text: 'OK',
                        onPress: () => {
                            // Optionally navigate to login screen
                            if (navigation?.navigate) {
                                navigation.navigate('Login');
                            }
                        },
                    },
                ]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation?.goBack()}
                        style={styles.backButton}
                        disabled={isLoading}
                    >
                        <Feather name="arrow-left" size={24} color={palette.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Create Room</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.content}>
                        <Text style={styles.description}>
                            Create a new room, add players, and start organizing matches. You'll be the admin of this room.
                        </Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Room Name</Text>
                            <View style={styles.inputContainer}>
                                <MaterialIcons
                                    name="meeting-room"
                                    size={20}
                                    color={palette.accent}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter room name"
                                    placeholderTextColor="#9ca3af"
                                    value={roomName}
                                    onChangeText={handleRoomNameChange}
                                    autoCapitalize="words"
                                    editable={!isLoading}
                                    maxLength={50}
                                />
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Add Players (Optional)</Text>
                                <Text style={styles.sectionSubtitle}>
                                    {players.length === 0 ? 'You can add players now or let others join via room code later' : `${players.length} ${players.length === 1 ? 'player' : 'players'} added`}
                                </Text>
                            </View>

                            {players.length > 0 && (
                                <View style={styles.playersList}>
                                    {players.map((player) => (
                                        <View key={player.id} style={styles.playerCard}>
                                            <View style={styles.playerInfo}>
                                                <Text style={styles.playerName}>{player.name}</Text>
                                                <Text style={styles.playerMobile}>{player.mobile}</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleRemovePlayer(player.id)}
                                                style={styles.removeButton}
                                                disabled={isLoading}
                                            >
                                                <Feather name="x-circle" size={20} color={palette.warning} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {!showAddPlayerForm ? (
                                <View style={styles.addButtonsContainer}>
                                    {friends.length > 0 && (
                                        <TouchableOpacity
                                            style={styles.addButton}
                                            onPress={() => setShowAddPlayerForm('friends')}
                                            disabled={isLoading}
                                        >
                                            <Feather name="user-plus" size={18} color={palette.accent} />
                                            <Text style={styles.addButtonText}>Add from Friends</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => setShowAddPlayerForm('new')}
                                        disabled={isLoading}
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
                                                    keyExtractor={(item) => item.id}
                                                    renderItem={({ item: friend }) => {
                                                        const isAlreadyAdded = players.some(
                                                            (p) => p.id === friend.id || p.mobile === friend.mobile
                                                        );
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
                                                                        {friend.name}
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
                                                onPress={handleOpenContactModal}
                                                disabled={isLoading}
                                            >
                                                <Feather name="user" size={18} color={palette.accent} />
                                                <Text style={styles.importContactButtonText}>
                                                    Import from Contacts
                                                </Text>
                                            </TouchableOpacity>
                                            <View style={styles.inputGroup}>
                                                <Text style={styles.inputLabel}>Name</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="Enter player name"
                                                    placeholderTextColor="#9ca3af"
                                                    value={newPlayerName}
                                                    onChangeText={setNewPlayerName}
                                                    autoCapitalize="words"
                                                    maxLength={50}
                                                />
                                            </View>
                                            <View style={styles.inputGroup}>
                                                <Text style={styles.inputLabel}>Mobile Number</Text>
                                                <View style={styles.inputContainer}>
                                                    <MaterialIcons
                                                        name="phone"
                                                        size={20}
                                                        color={palette.accent}
                                                        style={styles.inputIcon}
                                                    />
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="Enter 10-digit mobile number"
                                                        placeholderTextColor="#9ca3af"
                                                        value={newPlayerMobile}
                                                        onChangeText={handlePhoneChange}
                                                        keyboardType="phone-pad"
                                                        maxLength={10}
                                                    />
                                                </View>
                                            </View>
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

                        <View style={styles.toggleSection}>
                            <View style={styles.toggleContainer}>
                                <View style={styles.toggleInfo}>
                                    <Text style={styles.toggleLabel}>Show Mobile Number</Text>
                                    <Text style={styles.toggleDescription}>
                                        Display mobile numbers publicly on profiles
                                    </Text>
                                </View>
                                <Switch
                                    value={showMobileToggle}
                                    onValueChange={setShowMobileToggle}
                                    trackColor={{ false: '#e5e7eb', true: palette.accentLight }}
                                    thumbColor={showMobileToggle ? palette.accent : '#f3f4f6'}
                                />
                            </View>
                        </View>

                        {error ? (
                            <View style={styles.errorContainer}>
                                <Feather name="alert-circle" size={16} color={palette.warning} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.createButton, (isLoading || !roomName.trim()) && styles.createButtonDisabled]}
                            onPress={handleCreateRoom}
                            disabled={isLoading || !roomName.trim()}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={
                                    isLoading || !roomName.trim()
                                        ? ['#9ca3af', '#6b7280']
                                        : ['#8b5cf6', '#7c3aed']
                                }
                                style={styles.createButtonGradient}
                            >
                                {isLoading ? (
                                    <View style={styles.buttonContent}>
                                        <ActivityIndicator size="small" color="#ffffff" />
                                        <Text style={styles.createButtonText}>Creating...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.createButtonText}>Create Room</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <ContactPickerModal
                visible={showContactModal}
                onClose={() => setShowContactModal(false)}
                onSelectContact={handleSelectContact}
                onSelectContacts={handleAddMultipleContacts}
                existingPlayers={players}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: palette.background,
    },
    keyboardContainer: {
        flex: 1,
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
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    headerSpacer: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    content: {
        padding: 24,
        gap: 24,
    },
    description: {
        fontSize: 14,
        color: palette.textSecondary,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 4,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.textPrimary,
        marginBottom: 8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: palette.textPrimary,
        backgroundColor: 'transparent',
    },
    section: {
        gap: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
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
        marginTop: 2,
    },
    removeButton: {
        padding: 4,
    },
    addButtonsContainer: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: palette.accentLight,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.accent,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: palette.accent,
    },
    addPlayerForm: {
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 16,
        gap: 16,
        borderWidth: 1,
        borderColor: palette.border,
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '600',
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
    friendsList: {
        gap: 12,
        paddingBottom: 4,
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
    toggleSection: {
        marginTop: 8,
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: palette.border,
    },
    toggleInfo: {
        flex: 1,
        marginRight: 16,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
        marginBottom: 4,
    },
    toggleDescription: {
        fontSize: 13,
        color: palette.textSecondary,
    },
    errorContainer: {
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
        flex: 1,
        color: palette.warning,
        fontSize: 13,
    },
    createButton: {
        borderRadius: 16,
        marginTop: 8,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    createButtonGradient: {
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createButtonDisabled: {
        shadowOpacity: 0.1,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    createButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
});

export default CreateRoomScreen;

