import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Card, Divider, TextInput, HelperText } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const emailValid = /.+@.+\..+/.test(email.trim());
  const passwordValid = password.length >= 6;
  const hasEmailError = email.length > 0 && !emailValid;
  const hasPasswordError = password.length > 0 && !passwordValid;
  const formValid = emailValid && passwordValid;
  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <MaterialIcons name="psychology" size={36} color="#fff" />
          <View style={{ height: 8 }} />
        </View>
        <Card style={styles.card}>
          <Card.Title
            title="Create your account"
            subtitle="Join to save your insights"
            titleStyle={styles.cardTitle}
            subtitleStyle={styles.cardSubtitle}
          />
          <Card.Content>
            <View style={styles.cardContentWrap}>
              <TextInput
                mode="flat"
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                error={hasEmailError}
                theme={{ colors: { onSurfaceVariant: '#fff' } }}
              />
              <HelperText type="error" visible={hasEmailError} style={styles.helper}>
                Enter a valid email address
              </HelperText>
              <TextInput
                mode="flat"
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                error={hasPasswordError}
                theme={{ colors: { onSurfaceVariant: '#fff' } }}
              />
              <HelperText type="error" visible={hasPasswordError} style={styles.helper}>
                Minimum 6 characters
              </HelperText>

              <Button
                mode="contained"
                style={[styles.primary, styles.pill]}
                contentStyle={styles.primaryContent}
                labelStyle={styles.primaryLabel}
                disabled={!formValid}
                onPress={() => Alert.alert('Not implemented', 'Email sign-up will be added later.')}
              >
                Sign up
              </Button>
              <Divider style={styles.divider} />
              <Button
                mode="contained"
                style={[styles.pill, styles.secondaryContained]}
                contentStyle={styles.primaryContent}
                labelStyle={styles.secondaryLabel}
                onPress={() => navigation.replace('Welcome')}
              >
                Continue without signing up
              </Button>
              <Divider style={styles.divider} />
              <Button
                mode="outlined"
                icon="google"
                style={[styles.outlined, styles.pill]}
                labelStyle={styles.outlinedLabel}
                onPress={() => {
                  /* TODO: implement Google sign-up */
                }}
              >
                Sign up with Google
              </Button>
              <Button
                mode="outlined"
                icon="apple"
                style={[styles.outlined, styles.apple, styles.pill]}
                labelStyle={styles.outlinedLabel}
                onPress={() => {
                  /* TODO: implement Apple sign-up */
                }}
              >
                Sign up with Apple
              </Button>
              <Divider style={styles.divider} />
              <Button onPress={() => navigation.navigate('Login')} labelStyle={styles.linkLabel}>
                Already have an account? Sign in
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroText: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
  },
  card: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderRadius: 16,
  },
  cardContentWrap: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  cardTitle: { color: '#fff' },
  cardSubtitle: { color: 'rgba(255,255,255,0.85)' },
  input: {
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  primary: {
    marginBottom: 8,
    backgroundColor: '#6C5CE7',
  },
  primaryContent: { height: 48 },
  primaryLabel: { color: '#fff', fontWeight: '600' },
  pill: {
    borderRadius: 28,
  },
  divider: {
    marginVertical: 12,
  },
  outlined: {
    borderColor: 'rgba(255,255,255,0.7)',
  },
  outlinedLabel: {
    color: '#fff',
  },
  apple: {
    marginTop: 8,
  },
  linkLabel: { color: '#fff' },
  helper: {
    color: '#ffb4b4',
    marginTop: -8,
    marginBottom: 8,
  },
  secondaryContained: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  secondaryLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
