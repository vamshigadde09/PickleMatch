import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { palette } from '../theme/colors.js';

const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length > 10) {
        return digits.slice(-10);
    }
    return digits;
};

export const ContactPickerModal = ({ visible, onClose, onSelectContact, onSelectContacts, existingPlayers = [] }) => {
    const [contacts, setContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        if (visible) {
            loadContacts();
        } else {
            setSearchQuery('');
            setContacts([]);
            setFilteredContacts([]);
            setSelectedContacts([]);
        }
    }, [visible]);

    useEffect(() => {
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const filtered = contacts.filter(
                (contact) =>
                    contact.name.toLowerCase().includes(query) ||
                    contact.phoneNumber.includes(query),
            );
            setFilteredContacts(filtered);
        } else {
            setFilteredContacts(contacts);
        }
    }, [searchQuery, contacts]);

    const loadContacts = async () => {
        try {
            setIsLoading(true);

            const { status } = await Contacts.requestPermissionsAsync();

            if (status !== 'granted') {
                setHasPermission(false);
                Alert.alert(
                    'Permission Denied',
                    'Please grant contacts permission to import contacts. You can enable it in your device settings.',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: onClose },
                        {
                            text: 'Open Settings',
                            onPress: () => {
                                Linking.openSettings();
                                onClose();
                            },
                        },
                    ],
                );
                return;
            }

            setHasPermission(true);

            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
            });

            const validContacts = data
                .filter((contact) => {
                    const phone = contact.phoneNumbers?.[0]?.number;
                    if (!phone) return false;
                    const formatted = formatPhoneNumber(phone);
                    return formatted.length === 10 && /^[6-9]/.test(formatted);
                })
                .map((contact) => {
                    const phone = contact.phoneNumbers?.[0]?.number;
                    return {
                        id: contact.id,
                        name: contact.name || 'Unknown',
                        phoneNumber: formatPhoneNumber(phone),
                        imageUri: contact.imageUri || null,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            setContacts(validContacts);
            setFilteredContacts(validContacts);
        } catch (error) {
            console.log('Error loading contacts:', error);
            Alert.alert('Error', 'Failed to load contacts. Please try again.');
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const toggleContactSelection = (contact) => {
        const isSelected = selectedContacts.some((c) => c.id === contact.id);
        const isAlreadyAdded = existingPlayers.some((p) => p.mobile === contact.phoneNumber);

        if (isAlreadyAdded) {
            Alert.alert('Already Added', 'This contact is already in the room');
            return;
        }

        if (isSelected) {
            setSelectedContacts(selectedContacts.filter((c) => c.id !== contact.id));
        } else {
            setSelectedContacts([...selectedContacts, contact]);
        }
    };

    const handleAddSelectedContacts = () => {
        if (selectedContacts.length === 0) {
            Alert.alert('No Selection', 'Please select at least one contact');
            return;
        }

        // Filter out contacts that are already added
        const newContacts = selectedContacts.filter(
            (contact) => !existingPlayers.some((p) => p.mobile === contact.phoneNumber)
        );

        if (newContacts.length === 0) {
            Alert.alert('No New Contacts', 'All selected contacts are already in the room');
            setSelectedContacts([]);
            return;
        }

        // Prefer onSelectContacts for multiple contacts, fallback to onSelectContact
        if (onSelectContacts && newContacts.length > 1) {
            onSelectContacts(newContacts);
        } else if (onSelectContact) {
            // For single contact or when onSelectContacts is not provided
            newContacts.forEach((contact) => {
                onSelectContact(contact);
            });
        }

        setSelectedContacts([]);
        onClose();
    };

    const handleClose = () => {
        setSearchQuery('');
        onClose();
    };

    const renderContactItem = ({ item }) => {
        const isSelected = selectedContacts.some((c) => c.id === item.id);
        const isAlreadyAdded = existingPlayers.some((p) => p.mobile === item.phoneNumber);

        return (
            <TouchableOpacity
                style={[
                    styles.contactItem,
                    isSelected && styles.contactItemSelected,
                    isAlreadyAdded && styles.contactItemDisabled,
                ]}
                onPress={() => toggleContactSelection(item)}
                activeOpacity={0.7}
                disabled={isAlreadyAdded}
            >
                <View style={[
                    styles.contactAvatar,
                    isSelected && styles.contactAvatarSelected,
                ]}>
                    {item.imageUri ? (
                        <Image
                            source={{ uri: item.imageUri }}
                            style={styles.contactAvatarImage}
                        />
                    ) : (
                        <Text style={[
                            styles.contactAvatarText,
                            isSelected && styles.contactAvatarTextSelected,
                        ]}>
                            {item.name.charAt(0).toUpperCase()}
                        </Text>
                    )}
                </View>
                <View style={styles.contactInfo}>
                    <Text style={[
                        styles.contactName,
                        isAlreadyAdded && styles.contactNameDisabled,
                    ]}>
                        {item.name}
                    </Text>
                    <View style={styles.contactPhoneContainer}>
                        <MaterialIcons name="phone" size={14} color={palette.textSecondary} />
                        <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
                    </View>
                </View>
                {isSelected ? (
                    <View style={styles.checkboxSelected}>
                        <Feather name="check" size={20} color="#ffffff" />
                    </View>
                ) : (
                    <View style={styles.checkboxUnselected} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    enabled={true}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Select Contacts</Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleClose}
                                style={styles.closeButton}
                                disabled={isLoading}
                            >
                                <Feather name="x" size={24} color={palette.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={palette.accent} />
                                    <Text style={styles.loadingText}>Loading contacts...</Text>
                                </View>
                            ) : !hasPermission ? (
                                <View style={styles.emptyContainer}>
                                    <Feather name="alert-circle" size={48} color={palette.warning} />
                                    <Text style={styles.emptyText}>Permission Required</Text>
                                    <Text style={styles.emptySubtext}>
                                        Please grant contacts permission to view your contacts.
                                    </Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredContacts}
                                    renderItem={renderContactItem}
                                    keyExtractor={(item) => item.id}
                                    style={styles.contactsList}
                                    contentContainerStyle={styles.contactsListContent}
                                    showsVerticalScrollIndicator={true}
                                    keyboardShouldPersistTaps="handled"
                                    ListHeaderComponent={
                                        selectedContacts.length > 0 ? (
                                            <View style={styles.selectedSection}>
                                                <View style={styles.selectedContactsList}>
                                                    {selectedContacts.map((contact) => (
                                                        <View key={contact.id} style={styles.selectedContactChip}>
                                                            <View style={styles.chipAvatar}>
                                                                {contact.imageUri ? (
                                                                    <Image
                                                                        source={{ uri: contact.imageUri }}
                                                                        style={styles.chipAvatarImage}
                                                                    />
                                                                ) : (
                                                                    <Text style={styles.chipAvatarText}>
                                                                        {contact.name.charAt(0).toUpperCase()}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                            <Text style={styles.selectedContactName} numberOfLines={1}>
                                                                {contact.name}
                                                            </Text>
                                                            <TouchableOpacity
                                                                onPress={() => toggleContactSelection(contact)}
                                                                style={styles.removeChipButton}
                                                            >
                                                                <Feather name="x" size={14} color={palette.textPrimary} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null
                                    }
                                    ListEmptyComponent={
                                        <View style={styles.emptyContainer}>
                                            <Feather name="user-x" size={48} color={palette.textSecondary} />
                                            <Text style={styles.emptyText}>
                                                {searchQuery ? 'No contacts found' : 'No contacts available'}
                                            </Text>
                                            <Text style={styles.emptySubtext}>
                                                {searchQuery
                                                    ? 'Try a different search term'
                                                    : 'No contacts with valid 10-digit Indian mobile numbers'}
                                            </Text>
                                        </View>
                                    }
                                />
                            )}
                        </View>

                        {hasPermission && filteredContacts.length > 0 && (
                            <View style={styles.footer}>
                                <Text style={styles.footerText}>
                                    {filteredContacts.length} {filteredContacts.length === 1 ? 'contact' : 'contacts'} found
                                    {selectedContacts.length > 0 && (
                                        <Text style={styles.footerSelectedText}>
                                            {' • '}{selectedContacts.length} selected
                                        </Text>
                                    )}
                                </Text>
                            </View>
                        )}

                        {hasPermission && (
                            <>
                                <View style={styles.searchContainer}>
                                    <Feather
                                        name="search"
                                        size={20}
                                        color={palette.textSecondary}
                                        style={styles.searchIcon}
                                    />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search by name or phone..."
                                        placeholderTextColor="#9ca3af"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => setSearchQuery('')}
                                            style={styles.clearButton}
                                        >
                                            <Feather name="x" size={18} color={palette.textSecondary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {selectedContacts.length > 0 && (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={handleAddSelectedContacts}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.addButtonText}>
                                            Add {selectedContacts.length} {selectedContacts.length === 1 ? 'Contact' : 'Contacts'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
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
        justifyContent: 'flex-end',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: palette.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '90%',
        flexDirection: 'column',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        flexShrink: 0,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: palette.textPrimary,
    },
    modalSubtitle: {
        fontSize: 13,
        color: palette.accent,
        fontWeight: '600',
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        paddingTop: 16,
        paddingBottom: 16,
        height: 64,
        flexShrink: 0,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: palette.textPrimary,
    },
    clearButton: {
        padding: 4,
        marginLeft: 8,
    },
    modalBody: {
        flex: 1,
        minHeight: 200,
        flexGrow: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: palette.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
        gap: 12,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: palette.textPrimary,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: palette.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    contactsList: {
        flex: 1,
    },
    contactsListContent: {
        paddingVertical: 8,
    },
    selectedSection: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: palette.accent,
        backgroundColor: palette.accentLight,
    },
    selectedContactsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        maxHeight: 120,
    },
    selectedContactChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.card,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
        borderWidth: 1,
        borderColor: palette.accent,
        maxWidth: '100%',
        flexShrink: 1,
    },
    chipAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: palette.accent,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    chipAvatarImage: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    chipAvatarText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#ffffff',
    },
    selectedContactName: {
        fontSize: 13,
        fontWeight: '500',
        color: palette.textPrimary,
        flex: 1,
    },
    removeChipButton: {
        padding: 2,
        marginLeft: 2,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
    },
    contactItemSelected: {
        backgroundColor: palette.accentLight,
    },
    contactItemDisabled: {
        opacity: 0.5,
    },
    contactAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: palette.accentLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    contactAvatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    contactAvatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: palette.accent,
    },
    contactAvatarSelected: {
        backgroundColor: palette.accent,
    },
    contactAvatarTextSelected: {
        color: '#ffffff',
    },
    contactInfo: {
        flex: 1,
    },
    contactName: {
        fontSize: 16,
        fontWeight: '600',
        color: palette.textPrimary,
        marginBottom: 4,
    },
    contactPhoneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    contactPhone: {
        fontSize: 14,
        color: palette.textSecondary,
    },
    contactNameDisabled: {
        opacity: 0.5,
    },
    checkboxSelected: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: palette.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxUnselected: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: palette.border,
    },
    addButton: {
        backgroundColor: palette.accent,
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: palette.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    addButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        backgroundColor: '#f9fafb',
        flexShrink: 0,
    },
    footerText: {
        fontSize: 12,
        color: palette.textSecondary,
        textAlign: 'center',
    },
    footerSelectedText: {
        fontSize: 12,
        color: palette.accent,
        fontWeight: '600',
    },
});

export default ContactPickerModal;

