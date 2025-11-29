import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/colors.js';
import { API_BASE_URL } from '../api.js';

const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

export const JoinRoomModal = ({ visible, onClose, onSuccess }) => {
    const [roomCode, setRoomCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRoomCodeChange = (text) => {
        const formattedCode = text.trim().toUpperCase();
        setRoomCode(formattedCode);
        setError('');
    };

    const validateRoomCode = () => {
        if (!roomCode || roomCode.trim().length === 0) {
            setError('Room code is required');
            return false;
        }
        if (roomCode.length < 3) {
            setError('Room code must be at least 3 characters');
            return false;
        }
        return true;
    };

    const handleJoinRoom = async () => {
        if (!validateRoomCode()) {
            return;
        }

        try {
            setIsLoading(true);
            setError('');

            const response = await api.post('/api/v1/room/join', {
                roomCode: roomCode.trim().toUpperCase(),
            });

            if (response.data?.success) {
                const { room, message, requiresApproval } = response.data;

                if (requiresApproval) {
                    Alert.alert(
                        'Join Request Sent',
                        message || 'Your request has been sent to the room admin for approval.',
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    setRoomCode('');
                                    onClose();
                                },
                            },
                        ],
                    );
                } else {
                    Alert.alert(
                        'Success',
                        message || 'You have successfully joined the room!',
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    setRoomCode('');
                                    onClose();
                                    if (onSuccess) {
                                        onSuccess(room);
                                    }
                                },
                            },
                        ],
                    );
                }
            } else {
                throw new Error(response.data?.message || 'Failed to join room');
            }
        } catch (error) {
            console.log('Join room error:', error?.response?.data || error?.message);

            let errorMessage = 'Failed to join room. Please try again.';

            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = 'Room not found. Please check the room code.';
                } else if (error.response.status === 403) {
                    errorMessage = 'You do not have permission to join this room.';
                } else if (error.response.status === 409) {
                    errorMessage = 'You are already a member of this room.';
                } else if (error.response.data?.message) {
                    errorMessage = error.response.data.message;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setRoomCode('');
        setError('');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Join Room</Text>
                            <TouchableOpacity
                                onPress={handleClose}
                                style={styles.closeButton}
                                disabled={isLoading}
                            >
                                <Feather name="x" size={24} color={palette.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalDescription}>
                                Enter the room code to join a match-ready group. If you're not a member yet, the admin will receive a join request.
                            </Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Room Code</Text>
                                <View style={styles.inputContainer}>
                                    <Feather
                                        name="hash"
                                        size={20}
                                        color={palette.accent}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter room code (e.g., PMX-204)"
                                        placeholderTextColor="#9ca3af"
                                        value={roomCode}
                                        onChangeText={handleRoomCodeChange}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        editable={!isLoading}
                                        maxLength={20}
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
                                style={[
                                    styles.joinButton,
                                    (isLoading || !roomCode.trim()) && styles.joinButtonDisabled,
                                ]}
                                onPress={handleJoinRoom}
                                disabled={isLoading || !roomCode.trim()}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={
                                        isLoading || !roomCode.trim()
                                            ? ['#9ca3af', '#6b7280']
                                            : ['#8b5cf6', '#7c3aed']
                                    }
                                    style={styles.joinButtonGradient}
                                >
                                    {isLoading ? (
                                        <View style={styles.buttonContent}>
                                            <ActivityIndicator size="small" color="#ffffff" />
                                            <Text style={styles.joinButtonText}>Joining...</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.joinButtonText}>Join Room</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
    },
    modalContent: {
        backgroundColor: palette.card,
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        gap: 20,
    },
    modalDescription: {
        fontSize: 14,
        color: palette.textSecondary,
        lineHeight: 20,
    },
    inputGroup: {
        marginTop: 4,
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
    joinButton: {
        borderRadius: 16,
        marginTop: 8,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    joinButtonGradient: {
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    joinButtonDisabled: {
        shadowOpacity: 0.1,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    joinButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default JoinRoomModal;

