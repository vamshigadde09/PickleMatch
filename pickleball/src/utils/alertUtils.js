/**
 * Alert Utility Functions
 * Provides easy-to-use functions that match Alert.alert() API but use custom AlertModal
 */

import React from 'react';
import { AlertModal } from '../components/AlertModal.js';

/**
 * Alert Hook - Use in components
 * 
 * Usage:
 * const { showAlert, AlertComponent } = useAlert();
 * 
 * showAlert({
 *   title: 'Success',
 *   message: 'Operation completed!',
 *   type: 'success',
 *   buttons: [{ text: 'OK' }]
 * });
 * 
 * return (
 *   <>
 *     <YourComponent />
 *     <AlertComponent />
 *   </>
 * );
 */
export const useAlert = () => {
    const [alertState, setAlertState] = React.useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttons: [{ text: 'OK' }],
    });

    const showAlert = (config) => {
        setAlertState({
            visible: true,
            title: config.title || '',
            message: config.message || '',
            type: config.type || 'info',
            buttons: config.buttons || [{ text: 'OK' }],
        });
    };

    const hideAlert = () => {
        setAlertState({
            ...alertState,
            visible: false,
        });
    };

    const AlertComponent = () => (
        <AlertModal
            visible={alertState.visible}
            title={alertState.title}
            message={alertState.message}
            type={alertState.type}
            buttons={alertState.buttons.map(button => ({
                ...button,
                onPress: () => {
                    if (button.onPress) {
                        button.onPress();
                    }
                    hideAlert();
                },
            }))}
            onClose={hideAlert}
        />
    );

    return {
        showAlert,
        hideAlert,
        AlertComponent,
    };
};

/**
 * Quick Alert Helpers
 * These return the config object that can be passed to showAlert()
 */
export const AlertHelpers = {
    success: (title, message, onPress) => ({
        title: title || 'Success',
        message: message || 'Operation completed successfully!',
        type: 'success',
        buttons: [{ text: 'OK', onPress }],
    }),

    error: (title, message, onPress) => ({
        title: title || 'Error',
        message: message || 'An error occurred. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', onPress }],
    }),

    warning: (title, message, onPress) => ({
        title: title || 'Warning',
        message: message || 'Please review this action.',
        type: 'warning',
        buttons: [{ text: 'OK', onPress }],
    }),

    info: (title, message, onPress) => ({
        title: title || 'Information',
        message: message || '',
        type: 'info',
        buttons: [{ text: 'OK', onPress }],
    }),

    confirm: (title, message, onConfirm, onCancel) => ({
        title: title || 'Confirm',
        message: message || 'Are you sure you want to continue?',
        type: 'warning',
        buttons: [
            {
                text: 'Cancel',
                onPress: onCancel,
            },
            {
                text: 'Confirm',
                onPress: onConfirm,
            },
        ],
    }),

    confirmDestructive: (title, message, onConfirm, onCancel) => ({
        title: title || 'Confirm',
        message: message || 'This action cannot be undone. Are you sure?',
        type: 'error',
        buttons: [
            {
                text: 'Cancel',
                onPress: onCancel,
            },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: onConfirm,
            },
        ],
    }),
};

export default {
    useAlert,
    AlertHelpers,
};

