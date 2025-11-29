import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext.js';
import { palette } from '../theme/colors.js';
import { LoginScreen } from './LoginScreen.js';
import { RegisterScreen } from './RegisterScreen.js';

const submitDelay = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

export const AuthScreen = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [submitting, setSubmitting] = useState(false);

  const handleAuth = async (_payload) => {
    setSubmitting(true);
    try {
      // Placeholder for future backend call
      await submitDelay();
      login();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.badge}>PickleMatch</Text>
          <Text style={styles.title}>Your pickleball co-pilot</Text>
          <Text style={styles.subtitle}>
            Coordinate rooms, shuffle fair teams, and track your leaderboard climb.
          </Text>
        </View>

        {mode === 'login' ? (
          <LoginScreen
            onSubmit={handleAuth}
            onSwitch={() => setMode('register')}
            loading={submitting}
          />
        ) : (
          <RegisterScreen
            onSubmit={handleAuth}
            onSwitch={() => setMode('login')}
            loading={submitting}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 24,
    gap: 24,
  },
  hero: {
    gap: 12,
    alignItems: 'flex-start',
  },
  badge: {
    backgroundColor: palette.accentLight,
    color: palette.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: palette.textSecondary,
  },
});

