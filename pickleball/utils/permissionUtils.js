import { Alert } from 'react-native';

// Import packages with fallback handling
let Contacts, Notifications;

try {
    Contacts = require('expo-contacts');
} catch (e) {
    console.log('expo-contacts not available');
}

try {
    Notifications = require('expo-notifications');
} catch (e) {
    console.log('expo-notifications not available');
}

// Function to request all essential permissions when app opens
export const requestAllPermissionsOnAppStart = async () => {
    const permissionResults = {
        contacts: 'unknown',
        notifications: 'unknown'
    };

    try {
        console.log('Requesting all permissions on app start...');

        // Request contacts permission
        if (Contacts && Contacts.requestPermissionsAsync) {
            try {
                const contactsResult = await Contacts.requestPermissionsAsync();
                permissionResults.contacts = contactsResult.status;
                console.log('Contacts permission:', contactsResult.status);
            } catch (error) {
                console.log('Error requesting contacts permission:', error);
                permissionResults.contacts = 'denied';
            }
        }


        // Request notification permission
        if (Notifications && Notifications.requestPermissionsAsync) {
            try {
                const notificationResult = await Notifications.requestPermissionsAsync();
                permissionResults.notifications = notificationResult.status;
                console.log('Notification permission:', notificationResult.status);
            } catch (error) {
                console.log('Error requesting notification permission:', error);
                permissionResults.notifications = 'denied';
            }
        }

        console.log('All permissions requested:', permissionResults);
        return permissionResults;

    } catch (error) {
        console.error('Error requesting permissions on app start:', error);
        return permissionResults;
    }
};

// Function to check current permission status
export const checkAllPermissions = async () => {
    const permissionStatus = {
        contacts: 'unknown',
        notifications: 'unknown'
    };

    try {
        // Check contacts permission
        if (Contacts && Contacts.getPermissionsAsync) {
            try {
                const contactsStatus = await Contacts.getPermissionsAsync();
                permissionStatus.contacts = contactsStatus.status;
            } catch (error) {
                permissionStatus.contacts = 'denied';
            }
        } else {
            permissionStatus.contacts = 'not_available';
        }


        // Check notification permission
        if (Notifications && Notifications.getPermissionsAsync) {
            try {
                const notificationStatus = await Notifications.getPermissionsAsync();
                permissionStatus.notifications = notificationStatus.status;
            } catch (error) {
                permissionStatus.notifications = 'denied';
            }
        } else {
            permissionStatus.notifications = 'not_available';
        }

        return permissionStatus;

    } catch (error) {
        console.error('Error checking permissions:', error);
        return permissionStatus;
    }
};

// Function to show permission explanation modal
export const showPermissionExplanation = () => {
    Alert.alert(
        'App Permissions',
        'FinanceFlow needs certain permissions to work properly:\n\n' +
        '• Contacts: To easily split bills with friends\n' +
        '• Notifications: To remind you about bill payments\n\n' +
        'You can change these permissions anytime in your device settings.',
        [
            {
                text: 'Later',
                style: 'cancel'
            },
            {
                text: 'Grant Permissions',
                onPress: () => requestAllPermissionsOnAppStart()
            }
        ]
    );
};
