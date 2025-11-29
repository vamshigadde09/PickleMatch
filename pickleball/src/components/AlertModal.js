import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/colors.js';

/**
 * Custom Alert Modal Component
 * Replaces Alert.alert() with a styled modal that matches the app's design
 * 
 * Usage:
 * const [alert, setAlert] = useState({ visible: false });
 * 
 * setAlert({
 *   visible: true,
 *   title: 'Success',
 *   message: 'Operation completed successfully!',
 *   type: 'success', // 'success', 'error', 'warning', 'info'
 *   buttons: [
 *     { text: 'OK', onPress: () => setAlert({ visible: false }) }
 *   ]
 * });
 * 
 * <AlertModal {...alert} onClose={() => setAlert({ visible: false })} />
 */
export const AlertModal = ({
    visible = false,
    title,
    message,
    type = 'info', // 'success', 'error', 'warning', 'info'
    buttons = [{ text: 'OK' }],
    onClose,
}) => {
    const getTypeConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: 'check-circle',
                    iconColor: palette.success,
                    bgColor: '#d1fae5',
                    titleColor: palette.success,
                };
            case 'error':
                return {
                    icon: 'alert-circle',
                    iconColor: '#ef4444',
                    bgColor: '#fee2e2',
                    titleColor: '#ef4444',
                };
            case 'warning':
                return {
                    icon: 'alert-triangle',
                    iconColor: palette.warning,
                    bgColor: '#fff7ed',
                    titleColor: palette.warning,
                };
            case 'info':
            default:
                return {
                    icon: 'info',
                    iconColor: palette.accent,
                    bgColor: palette.accentLight,
                    titleColor: palette.accent,
                };
        }
    };

    const typeConfig = getTypeConfig();

    const handleButtonPress = (button) => {
        if (button.onPress) {
            button.onPress();
        }
        if (!button.keepOpen) {
            if (onClose) {
                onClose();
            }
        }
    };

    // Determine button layout
    const hasMultipleButtons = buttons && buttons.length > 1;
    const primaryButton = buttons && buttons.length > 0 ? buttons[0] : null;
    const secondaryButton = buttons && buttons.length > 1 ? buttons[1] : null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        {/* Icon */}
                        <View style={[styles.iconContainer, { backgroundColor: typeConfig.bgColor }]}>
                            <Feather
                                name={typeConfig.icon}
                                size={48}
                                color={typeConfig.iconColor}
                            />
                        </View>

                        {/* Title */}
                        {title && (
                            <Text style={[styles.modalTitle, { color: typeConfig.titleColor }]}>
                                {title}
                            </Text>
                        )}

                        {/* Message */}
                        {message && (
                            <Text style={styles.modalMessage}>
                                {message}
                            </Text>
                        )}

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            {hasMultipleButtons ? (
                                <>
                                    {/* Secondary Button (Cancel/No) */}
                                    {secondaryButton && (
                                        <TouchableOpacity
                                            style={styles.secondaryButton}
                                            onPress={() => handleButtonPress(secondaryButton)}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.secondaryButtonText,
                                                    secondaryButton.style === 'destructive' && styles.destructiveButtonText,
                                                ]}
                                            >
                                                {secondaryButton.text}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Primary Button (OK/Yes) */}
                                    {primaryButton && (
                                        <TouchableOpacity
                                            style={styles.primaryButtonWrapper}
                                            onPress={() => handleButtonPress(primaryButton)}
                                            activeOpacity={0.8}
                                        >
                                            <LinearGradient
                                                colors={['#8b5cf6', '#7c3aed']}
                                                style={styles.primaryButtonGradient}
                                            >
                                                <Text style={styles.primaryButtonText}>
                                                    {primaryButton.text}
                                                </Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}
                                </>
                            ) : (
                                /* Single Button */
                                primaryButton && (
                                    <TouchableOpacity
                                        style={styles.primaryButtonWrapperFull}
                                        onPress={() => handleButtonPress(primaryButton)}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={['#8b5cf6', '#7c3aed']}
                                            style={styles.primaryButtonGradient}
                                        >
                                            <Text style={styles.primaryButtonText}>
                                                {primaryButton.text}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </View>
                </View>
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
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 12,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: palette.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
    },
    modalMessage: {
        fontSize: 16,
        color: palette.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    buttonContainer: {
        width: '100%',
        flexDirection: 'row',
        gap: 12,
    },
    primaryButtonWrapper: {
        flex: 1,
        borderRadius: 16,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonWrapperFull: {
        width: '100%',
        borderRadius: 16,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonGradient: {
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: palette.border,
    },
    secondaryButtonText: {
        color: palette.textPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    destructiveButtonText: {
        color: '#ef4444',
    },
});

export default AlertModal;

