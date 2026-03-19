import React, { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	Modal,
	Platform,
	KeyboardAvoidingView,
	ScrollView,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

type Mode = 'initial' | 'signin' | 'signup';

export default function AuthScreen() {
	const router = useRouter();
	const {
		signInWithEmail,
		signUpWithEmail,
		signInWithGoogle,
		signInWithApple,
		signInWithGitHub,
		signInAsGuest,
		loading: authLoading,
	} = useAuth();

	const [mode, setMode] = useState<Mode>('initial');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [loading, setLoading] = useState(false);
	const [errorModal, setErrorModal] = useState<{
		visible: boolean;
		title: string;
		message: string;
	}>({
		visible: false,
		title: '',
		message: '',
	});
	const [successModal, setSuccessModal] = useState<{
		visible: boolean;
		message: string;
	}>({
		visible: false,
		message: '',
	});

	const showError = (title: string, message: string) => {
		setErrorModal({ visible: true, title, message });
	};

	if (authLoading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size='large' color='#007AFF' />
			</View>
		);
	}

	const handleEmailAuth = async () => {
		if (!email || !password) {
			showError(
				'Validation Error',
				'Please enter both an email address and a password.',
			);
			return;
		}

		if (mode === 'signup' && password.length < 8) {
			showError(
				'Password Too Short',
				'Your password must be at least 8 characters long to keep your account secure.',
			);
			return;
		}

		setLoading(true);
		try {
			if (mode === 'signin') {
				await signInWithEmail(email, password);
				router.replace('/');
			} else {
				await signUpWithEmail(email, password, name);
				setSuccessModal({
					visible: true,
					message: 'Account created! You are now signed in.',
				});
				router.replace('/');
			}
		} catch (error: any) {
			showError('Error', error.message || 'Authentication failed');
		} finally {
			setLoading(false);
		}
	};

	const handleSocialAuth = async (
		provider: 'google' | 'apple' | 'github',
	) => {
		setLoading(true);
		try {
			if (provider === 'google') {
				await signInWithGoogle();
			} else if (provider === 'apple') {
				await signInWithApple();
			} else if (provider === 'github') {
				await signInWithGitHub();
			}
			router.replace('/');
		} catch (error: any) {
			showError('Error', error.message || 'Authentication failed');
		} finally {
			setLoading(false);
		}
	};

	const handleGuestSignIn = async () => {
		setLoading(true);
		try {
			await signInAsGuest();
			router.replace('/');
		} catch (error: any) {
			showError('Error', error.message || 'Failed to join as guest');
		} finally {
			setLoading(false);
		}
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.content}>
					{mode === 'initial' ? (
						<>
							<Text style={styles.title}>Welcome</Text>
							<TouchableOpacity
								style={styles.primaryButton}
								onPress={() => setMode('signin')}
							>
								<Text style={styles.primaryButtonText}>Log in</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.primaryButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#007AFF', marginTop: 16 }]}
								onPress={() => setMode('signup')}
							>
								<Text style={[styles.primaryButtonText, { color: '#007AFF' }]}>Sign up</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.guestButton, { marginTop: 16 }]}
								onPress={handleGuestSignIn}
								disabled={loading}
							>
								<Text style={styles.guestButtonText}>Continue as guest</Text>
							</TouchableOpacity>
						</>
					) : (
						<>
							<TouchableOpacity 
								style={{ marginBottom: 20 }}
								onPress={() => setMode('initial')}
							>
								<Text style={{ color: '#007AFF', fontSize: 16 }}>← Back</Text>
							</TouchableOpacity>

							<Text style={styles.title}>
								{mode === 'signin' ? 'Log In' : 'Sign Up'}
							</Text>

							{mode === 'signup' && (
								<TextInput
									style={styles.input}
									placeholder='Name (optional)'
									value={name}
									onChangeText={setName}
									autoCapitalize='words'
								/>
							)}

							<TextInput
								style={styles.input}
								placeholder='Email'
								value={email}
								onChangeText={setEmail}
								keyboardType='email-address'
								autoCapitalize='none'
								autoCorrect={false}
							/>

							<TextInput
								style={styles.input}
								placeholder='Password'
								value={password}
								onChangeText={setPassword}
								secureTextEntry
								autoCapitalize='none'
							/>

							<TouchableOpacity
								style={[
									styles.primaryButton,
									loading && styles.buttonDisabled,
								]}
								onPress={handleEmailAuth}
								disabled={loading}
							>
								{loading ? (
									<ActivityIndicator color='#fff' />
								) : (
									<Text style={styles.primaryButtonText}>
										{mode === 'signin' ? 'Log In' : 'Sign Up'}
									</Text>
								)}
							</TouchableOpacity>

							<Text style={{ textAlign: 'center', marginTop: 16, color: '#666' }}>
								{mode === 'signin'
									? "Don't have an account? "
									: 'Already have an account? '}
								<Text 
									style={{ color: '#007AFF' }}
									onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
								>
									{mode === 'signin' ? 'Sign Up' : 'Log In'}
								</Text>
							</Text>

							<View style={styles.divider}>
								<View style={styles.dividerLine} />
								<Text style={styles.dividerText}>or continue with</Text>
								<View style={styles.dividerLine} />
							</View>

							<TouchableOpacity
								style={styles.socialButton}
								onPress={() => handleSocialAuth('google')}
								disabled={loading}
							>
								<Text style={styles.socialButtonText}>
									Continue with Google
								</Text>
							</TouchableOpacity>

							{Platform.OS === 'ios' && (
								<TouchableOpacity
									style={[styles.socialButton, styles.appleButton]}
									onPress={() => handleSocialAuth('apple')}
									disabled={loading}
								>
									<Text
										style={[
											styles.socialButtonText,
											styles.appleButtonText,
										]}
									>
										Continue with Apple
									</Text>
								</TouchableOpacity>
							)}
						</>
					)}
				</View>
			</ScrollView>

			{/* Error Modal */}
			<Modal
				visible={errorModal.visible}
				animationType='fade'
				transparent={true}
				onRequestClose={() =>
					setErrorModal({ ...errorModal, visible: false })
				}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.alertModal}>
						<Text style={styles.alertTitle}>
							{errorModal.title}
						</Text>
						<Text style={styles.alertMessage}>
							{errorModal.message}
						</Text>
						<TouchableOpacity
							style={styles.alertButton}
							onPress={() =>
								setErrorModal({ ...errorModal, visible: false })
							}
						>
							<Text style={styles.alertButtonText}>OK</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{/* Success Modal */}
			<Modal
				visible={successModal.visible}
				animationType='fade'
				transparent={true}
				onRequestClose={() =>
					setSuccessModal({ ...successModal, visible: false })
				}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.alertModal}>
						<Text style={styles.alertTitle}>Success</Text>
						<Text style={styles.alertMessage}>
							{successModal.message}
						</Text>
						<TouchableOpacity
							style={styles.alertButton}
							onPress={() =>
								setSuccessModal({
									...successModal,
									visible: false,
								})
							}
						>
							<Text style={styles.alertButtonText}>OK</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#fff',
	},
	scrollContent: {
		flexGrow: 1,
	},
	content: {
		flex: 1,
		padding: 24,
		justifyContent: 'center',
	},
	title: {
		fontSize: 32,
		fontWeight: 'bold',
		marginBottom: 32,
		textAlign: 'center',
		color: '#000',
	},
	input: {
		height: 50,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		paddingHorizontal: 16,
		marginBottom: 16,
		fontSize: 16,
		backgroundColor: '#fff',
	},
	primaryButton: {
		height: 50,
		backgroundColor: '#007AFF',
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: 8,
	},
	primaryButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	switchModeButton: {
		marginTop: 16,
		alignItems: 'center',
	},
	switchModeText: {
		color: '#007AFF',
		fontSize: 14,
	},
	divider: {
		flexDirection: 'row',
		alignItems: 'center',
		marginVertical: 24,
	},
	dividerLine: {
		flex: 1,
		height: 1,
		backgroundColor: '#ddd',
	},
	dividerText: {
		marginHorizontal: 12,
		color: '#666',
		fontSize: 14,
	},
	socialButton: {
		height: 50,
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 12,
		backgroundColor: '#fff',
	},
	socialButtonText: {
		fontSize: 16,
		color: '#000',
		fontWeight: '500',
	},
	appleButton: {
		backgroundColor: '#000',
		borderColor: '#000',
	},
	appleButtonText: {
		color: '#fff',
	},
	guestDivider: {
		flexDirection: 'row',
		alignItems: 'center',
		marginVertical: 16,
	},
	guestButton: {
		height: 50,
		borderWidth: 2,
		borderColor: '#007AFF',
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#fff',
	},
	guestButtonText: {
		fontSize: 16,
		color: '#007AFF',
		fontWeight: '600',
	},
	guestNote: {
		marginTop: 12,
		textAlign: 'center',
		fontSize: 12,
		color: '#999',
		paddingHorizontal: 20,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	alertModal: {
		backgroundColor: '#fff',
		borderRadius: 16,
		padding: 24,
		marginHorizontal: 20,
		width: '85%',
	},
	alertTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#000',
		marginBottom: 12,
	},
	alertMessage: {
		fontSize: 15,
		color: '#666',
		marginBottom: 24,
		lineHeight: 22,
	},
	alertButton: {
		backgroundColor: '#007AFF',
		borderRadius: 8,
		padding: 14,
		alignItems: 'center',
	},
	alertButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
});
