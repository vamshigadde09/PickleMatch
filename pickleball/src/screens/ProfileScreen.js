import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, CommonActions } from '@react-navigation/native';
import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/colors.js';
import { API_BASE_URL } from '../api.js';
import { AlertModal } from '../components/AlertModal.js';
import { useAlert } from '../utils/alertUtils.js';
import { clearAuthCache } from '../context/ProtectedRoute.js';

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Helper to get user initials for avatar
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert, AlertComponent } = useAlert();

  const [userData, setUserData] = useState(null);
  const [friends, setFriends] = useState([]);
  const [partnerStats, setPartnerStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [addFriendMethod, setAddFriendMethod] = useState('mobile'); // 'mobile' or 'username'
  const [friendSearch, setFriendSearch] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  // Fetch user profile data
  const fetchProfileData = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const headers = await getAuthHeaders();

        // Fetch current user data
        const userResponse = await axios.get(`${API_BASE_URL}/api/v1/user/currentuser`, { headers });
        if (userResponse?.data?.success) {
          setUserData(userResponse.data.user);
        }

        // Fetch friends list
        const friendsResponse = await axios.get(`${API_BASE_URL}/api/v1/user/friends`, { headers });
        if (friendsResponse?.data?.success) {
          setFriends(friendsResponse.data.friends || []);
        }

        // Fetch partner stats
        try {
          const partnerStatsResponse = await axios.get(`${API_BASE_URL}/api/v1/user/partner-stats`, { headers });
          if (partnerStatsResponse?.data?.success) {
            setPartnerStats(partnerStatsResponse.data);
          }
        } catch (partnerError) {
          console.error('Partner stats fetch error:', partnerError);
          // Don't fail the whole profile load if partner stats fail
        }
      } catch (error) {
        console.error('Profile fetch error:', error?.response?.data || error?.message);
        if (error.response?.status === 401) {
          showAlert({
            title: 'Session Expired',
            message: 'Please log in again.',
            type: 'error',
            buttons: [{ text: 'OK', onPress: () => navigation.navigate('Auth') }],
          });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    // We intentionally do NOT include showAlert here to avoid infinite re-renders.
    // navigation is stable from React Navigation.
    [navigation],
  );

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchProfileData(true);
    }, [fetchProfileData]),
  );

  // Refresh handler
  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchProfileData(false);
  }, [fetchProfileData]);

  // Calculate win percentage
  const winPercentage = userData?.stats?.totalGames
    ? ((userData.stats.totalWins || 0) / userData.stats.totalGames * 100).toFixed(1)
    : '0.0';

  // Toggle mobile visibility
  const handleToggleMobileVisibility = async () => {
    try {
      setIsUpdating(true);
      const headers = await getAuthHeaders();
      const response = await axios.put(
        `${API_BASE_URL}/api/v1/user/updateuser`,
        { showMobile: !userData.showMobile },
        { headers }
      );

      if (response.data.success) {
        setUserData(prev => ({ ...prev, showMobile: !prev.showMobile }));
        showAlert({
          title: 'Success',
          message: `Mobile number is now ${!userData.showMobile ? 'visible' : 'hidden'}`,
          type: 'success',
          buttons: [{ text: 'OK' }],
        });
      }
    } catch (error) {
      console.error('Toggle mobile visibility error:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to update mobile visibility. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Edit profile field
  const handleEditField = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
    setShowEditModal(true);
  };

  // Save edited field
  const handleSaveEdit = async () => {
    if (!editingField || !editValue.trim()) {
      return;
    }

    try {
      setIsUpdating(true);
      const headers = await getAuthHeaders();
      const updateData = { [editingField]: editValue.trim() };

      const response = await axios.put(
        `${API_BASE_URL}/api/v1/user/updateuser`,
        updateData,
        { headers }
      );

      if (response.data.success) {
        setUserData(prev => ({ ...prev, ...updateData }));
        setShowEditModal(false);
        setEditingField(null);
        setEditValue('');
        showAlert({
          title: 'Success',
          message: 'Profile updated successfully!',
          type: 'success',
          buttons: [{ text: 'OK' }],
        });
      }
    } catch (error) {
      console.error('Update profile error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update profile. Please try again.';
      showAlert({
        title: 'Error',
        message: errorMessage,
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Add friend
  const handleAddFriend = async () => {
    if (!friendSearch.trim()) {
      showAlert({
        title: 'Required',
        message: `Please enter a ${addFriendMethod === 'mobile' ? 'mobile number' : 'username'}`,
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    try {
      setIsAddingFriend(true);
      const headers = await getAuthHeaders();
      const requestData = addFriendMethod === 'mobile'
        ? { mobile: friendSearch.trim() }
        : { username: friendSearch.trim() };

      const response = await axios.post(
        `${API_BASE_URL}/api/v1/user/friends/add`,
        requestData,
        { headers }
      );

      if (response.data.success) {
        setFriends(prev => [...prev, response.data.friend]);
        setFriendSearch('');
        setShowAddFriendModal(false);
        showAlert({
          title: 'Success',
          message: 'Friend added successfully!',
          type: 'success',
          buttons: [{ text: 'OK' }],
        });
      }
    } catch (error) {
      console.error('Add friend error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to add friend. Please try again.';
      showAlert({
        title: 'Error',
        message: errorMessage,
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setIsAddingFriend(false);
    }
  };

  // Remove friend
  const handleRemoveFriend = (friendId, friendName) => {
    showAlert({
      title: 'Remove Friend',
      message: `Are you sure you want to remove ${friendName} from your friends list?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const response = await axios.delete(
                `${API_BASE_URL}/api/v1/user/friends/${friendId}`,
                { headers }
              );

              if (response.data.success) {
                setFriends(prev => prev.filter(f => f._id !== friendId));
                showAlert({
                  title: 'Success',
                  message: 'Friend removed successfully',
                  type: 'success',
                  buttons: [{ text: 'OK' }],
                });
              }
            } catch (error) {
              console.error('Remove friend error:', error);
              showAlert({
                title: 'Error',
                message: 'Failed to remove friend. Please try again.',
                type: 'error',
                buttons: [{ text: 'OK' }],
              });
            }
          },
        },
      ],
    });
  };

  // Logout handler
  const handleLogout = () => {
    showAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear AsyncStorage
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('userData');

              // Clear auth cache
              clearAuthCache();

              // Navigate to Login screen
              // ProfileScreen is nested: Stack > HomePage (MainTabs) > Profile
              // We need to reset the root Stack navigator
              // Get the root navigator by finding the topmost parent
              let rootNav = navigation;
              while (rootNav.getParent()) {
                rootNav = rootNav.getParent();
              }

              // Reset the root navigator to Login screen
              rootNav.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                })
              );
            } catch (error) {
              console.error('Logout error:', error);
              showAlert({
                title: 'Error',
                message: 'Failed to logout. Please try again.',
                type: 'error',
                buttons: [{ text: 'OK' }],
              });
            }
          },
        },
      ],
    });
  };

  // Format currency (INR)
  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || 0}`;
  };

  if (isLoading && !userData) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.profileContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <LinearGradient
            colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {userData?.avatarUrl ? (
                <Image
                  source={{ uri: userData.avatarUrl }}
                  style={styles.avatar}
                />
              ) : (
                <LinearGradient
                  colors={['#c4b5fd', '#a78bfa']}
                  style={styles.avatarPlaceholder}
                >
                  <Text style={styles.avatarText}>
                    {getInitials(userData?.displayName || userData?.username || 'U')}
                  </Text>
                </LinearGradient>
              )}
              <TouchableOpacity
                style={styles.editAvatarButton}
                onPress={() => handleEditField('avatarUrl', userData?.avatarUrl)}
              >
                <Feather name="camera" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* User Info */}
            <Text style={styles.displayName}>{userData?.displayName || 'User'}</Text>
            <Text style={styles.username}>@{userData?.username || 'username'}</Text>

            {/* Mobile Number (if visible) */}
            {userData?.showMobile && userData?.mobile && (
              <View style={styles.mobileContainer}>
                <Feather name="phone" size={14} color="#ede9fe" />
                <Text style={styles.mobileText}>{userData.mobile}</Text>
              </View>
            )}

            {/* Points Summary */}
            <View style={styles.pointsSummary}>
              <View style={styles.pointItem}>
                <Text style={styles.pointLabel}>Individual</Text>
                <Text style={styles.pointValue}>{userData?.individualPoints || 0}</Text>
              </View>
              <View style={styles.pointDivider} />
              <View style={styles.pointItem}>
                <Text style={styles.pointLabel}>Team</Text>
                <Text style={styles.pointValue}>{userData?.teamPoints || 0}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Statistics</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#ede9fe', '#f3e8ff']}
                style={styles.statCardGradient}
              >
                <Feather name="activity" size={24} color={palette.accent} />
                <Text style={styles.statValue}>{userData?.stats?.totalGames || 0}</Text>
                <Text style={styles.statLabel}>Games Played</Text>
              </LinearGradient>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#d1fae5', '#ecfdf5']}
                style={styles.statCardGradient}
              >
                <Feather name="award" size={24} color={palette.success} />
                <Text style={styles.statValue}>{userData?.stats?.totalWins || 0}</Text>
                <Text style={styles.statLabel}>Wins</Text>
              </LinearGradient>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#fef3c7', '#fffbeb']}
                style={styles.statCardGradient}
              >
                <Feather name="trending-up" size={24} color={palette.warning} />
                <Text style={styles.statValue}>{winPercentage}%</Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </LinearGradient>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#fee2e2', '#fef2f2']}
                style={styles.statCardGradient}
              >
                <Feather name="zap" size={24} color="#ef4444" />
                <Text style={styles.statValue}>{userData?.stats?.streak || 0}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Partner Stats Section */}
        {(partnerStats?.bestPartner || partnerStats?.mostFrequentTeammate) && (
          <View style={styles.partnerStatsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Partners</Text>
            </View>
            <View style={styles.partnerStatsGrid}>
              {partnerStats?.bestPartner && (
                <View style={styles.partnerCard}>
                  <LinearGradient
                    colors={['#fef3c7', '#fffbeb']}
                    style={styles.partnerCardGradient}
                  >
                    <View style={styles.partnerHeader}>
                      <Feather name="heart" size={20} color={palette.warning} />
                      <Text style={styles.partnerLabel}>Best Partner</Text>
                    </View>
                    <Text style={styles.partnerName}>{partnerStats.bestPartner.name}</Text>
                    <View style={styles.partnerStatsRow}>
                      <View style={styles.partnerStatItem}>
                        <Text style={styles.partnerStatValue}>{partnerStats.bestPartner.winRate}%</Text>
                        <Text style={styles.partnerStatLabel}>Win Rate</Text>
                      </View>
                      <View style={styles.partnerStatDivider} />
                      <View style={styles.partnerStatItem}>
                        <Text style={styles.partnerStatValue}>{partnerStats.bestPartner.games}</Text>
                        <Text style={styles.partnerStatLabel}>Games</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              )}
              {partnerStats?.mostFrequentTeammate && (
                <View style={styles.partnerCard}>
                  <LinearGradient
                    colors={['#ede9fe', '#f3e8ff']}
                    style={styles.partnerCardGradient}
                  >
                    <View style={styles.partnerHeader}>
                      <Feather name="users" size={20} color={palette.accent} />
                      <Text style={styles.partnerLabel}>Most Frequent</Text>
                    </View>
                    <Text style={styles.partnerName}>{partnerStats.mostFrequentTeammate.name}</Text>
                    <View style={styles.partnerStatsRow}>
                      <View style={styles.partnerStatItem}>
                        <Text style={styles.partnerStatValue}>{partnerStats.mostFrequentTeammate.games}</Text>
                        <Text style={styles.partnerStatLabel}>Games Together</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Settings</Text>
          </View>
          <View style={styles.settingsCard}>
            {/* Edit Profile Fields */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => handleEditField('displayName', userData?.displayName)}
            >
              <View style={styles.settingLeft}>
                <Feather name="user" size={20} color={palette.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Display Name</Text>
                  <Text style={styles.settingValue}>{userData?.displayName || 'Not set'}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={palette.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => handleEditField('username', userData?.username)}
            >
              <View style={styles.settingLeft}>
                <Feather name="at-sign" size={20} color={palette.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Username</Text>
                  <Text style={styles.settingValue}>@{userData?.username || 'username'}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={palette.textSecondary} />
            </TouchableOpacity>

            {/* Mobile Visibility Toggle */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Feather name="phone" size={20} color={palette.accent} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Mobile Number</Text>
                  <Text style={styles.settingValue}>
                    {userData?.showMobile ? 'Visible to others' : 'Hidden'}
                  </Text>
                </View>
              </View>
              {isUpdating ? (
                <ActivityIndicator size="small" color={palette.accent} />
              ) : (
                <Switch
                  value={userData?.showMobile || false}
                  onValueChange={handleToggleMobileVisibility}
                  trackColor={{ false: palette.border, true: palette.accentLight }}
                  thumbColor={userData?.showMobile ? palette.accent : '#f4f3f4'}
                />
              )}
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              style={styles.logoutButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Feather name="log-out" size={20} color="#fff" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Friends Section */}
        <View style={styles.friendsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
            <TouchableOpacity onPress={() => setShowAddFriendModal(true)}>
              <Text style={styles.sectionAction}>Add</Text>
            </TouchableOpacity>
          </View>

          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={palette.border} />
              <Text style={styles.emptyStateText}>No friends yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add friends by mobile number or username
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => setShowAddFriendModal(true)}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed']}
                  style={styles.emptyStateButtonGradient}
                >
                  <Feather name="user-plus" size={16} color="#fff" />
                  <Text style={styles.emptyStateButtonText}>Add Friend</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.friendsList}>
              {friends.map((friend) => (
                <View key={friend._id || friend.id} style={styles.friendCard}>
                  <View style={styles.friendLeft}>
                    {friend.avatarUrl ? (
                      <Image
                        source={{ uri: friend.avatarUrl }}
                        style={styles.friendAvatar}
                      />
                    ) : (
                      <View style={styles.friendAvatarPlaceholder}>
                        <Text style={styles.friendAvatarText}>
                          {getInitials(friend.displayName || friend.name || friend.username)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>
                        {friend.displayName || friend.name || friend.username}
                      </Text>
                      <Text style={styles.friendUsername}>@{friend.username}</Text>
                      <View style={styles.friendPoints}>
                        <Feather name="award" size={12} color={palette.accent} />
                        <Text style={styles.friendPointsText}>
                          {friend.individualPoints || 0} pts
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeFriendButton}
                    onPress={() => handleRemoveFriend(friend._id || friend.id, friend.displayName || friend.name)}
                  >
                    <Feather name="x" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {editingField === 'displayName' ? 'Display Name' : editingField === 'username' ? 'Username' : 'Avatar URL'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingField(null);
                  setEditValue('');
                }}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                placeholder={`Enter ${editingField === 'displayName' ? 'display name' : editingField === 'username' ? 'username' : 'avatar URL'}`}
                placeholderTextColor="#9ca3af"
                value={editValue}
                onChangeText={setEditValue}
                autoCapitalize={editingField === 'username' ? 'none' : 'words'}
                editable={!isUpdating}
              />
              <TouchableOpacity
                style={[styles.modalButton, isUpdating && styles.modalButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={isUpdating || !editValue.trim()}
              >
                <LinearGradient
                  colors={isUpdating || !editValue.trim() ? ['#9ca3af', '#6b7280'] : ['#8b5cf6', '#7c3aed']}
                  style={styles.modalButtonGradient}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Save</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Friend Modal */}
      <Modal
        visible={showAddFriendModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddFriendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddFriendModal(false);
                  setFriendSearch('');
                }}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {/* Method Selector */}
              <View style={styles.methodSelector}>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    addFriendMethod === 'mobile' && styles.methodButtonActive,
                  ]}
                  onPress={() => setAddFriendMethod('mobile')}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      addFriendMethod === 'mobile' && styles.methodButtonTextActive,
                    ]}
                  >
                    Mobile
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    addFriendMethod === 'username' && styles.methodButtonActive,
                  ]}
                  onPress={() => setAddFriendMethod('username')}
                >
                  <Text
                    style={[
                      styles.methodButtonText,
                      addFriendMethod === 'username' && styles.methodButtonTextActive,
                    ]}
                  >
                    Username
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder={addFriendMethod === 'mobile' ? 'Enter mobile number' : 'Enter username'}
                placeholderTextColor="#9ca3af"
                value={friendSearch}
                onChangeText={setFriendSearch}
                keyboardType={addFriendMethod === 'mobile' ? 'phone-pad' : 'default'}
                autoCapitalize="none"
                editable={!isAddingFriend}
              />
              <TouchableOpacity
                style={[styles.modalButton, (isAddingFriend || !friendSearch.trim()) && styles.modalButtonDisabled]}
                onPress={handleAddFriend}
                disabled={isAddingFriend || !friendSearch.trim()}
              >
                <LinearGradient
                  colors={(isAddingFriend || !friendSearch.trim()) ? ['#9ca3af', '#6b7280'] : ['#8b5cf6', '#7c3aed']}
                  style={styles.modalButtonGradient}
                >
                  {isAddingFriend ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Add Friend</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertComponent />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: palette.textSecondary,
  },
  profileContent: {
    paddingBottom: 30,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerGradient: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  displayName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#ede9fe',
    marginBottom: 12,
  },
  mobileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  mobileText: {
    fontSize: 14,
    color: '#ede9fe',
    fontWeight: '600',
  },
  pointsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 24,
  },
  pointItem: {
    alignItems: 'center',
  },
  pointLabel: {
    fontSize: 12,
    color: '#c4b5fd',
    fontWeight: '600',
    marginBottom: 4,
  },
  pointValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  pointDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.textPrimary,
    letterSpacing: -0.8,
  },
  sectionAction: {
    color: palette.accent,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexBasis: '47%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statCardGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  settingsCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1.5,
    borderColor: palette.border,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  friendsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  emptyState: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyStateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  friendsList: {
    gap: 12,
  },
  friendCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1.5,
    borderColor: palette.border,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  friendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: palette.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.accent,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 4,
  },
  friendPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  friendPointsText: {
    fontSize: 12,
    color: palette.accent,
    fontWeight: '600',
  },
  removeFriendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    backgroundColor: palette.card,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: palette.accentLight,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.accent,
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  modalInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: palette.textPrimary,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  modalButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  partnerStatsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  partnerStatsGrid: {
    gap: 12,
  },
  partnerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  partnerCardGradient: {
    padding: 20,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  partnerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  partnerName: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: 16,
  },
  partnerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  partnerStatItem: {
    alignItems: 'center',
  },
  partnerStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  partnerStatLabel: {
    fontSize: 12,
    color: palette.textSecondary,
    fontWeight: '600',
  },
  partnerStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: palette.border,
  },
  logoutButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoutButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfileScreen;
