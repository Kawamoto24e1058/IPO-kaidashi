import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { goto } from '$app/navigation';

class AuthState {
	#user = $state<User | null>(null);
	#loading = $state(true);

	constructor() {
		if (typeof window !== 'undefined') {
			auth.onAuthStateChanged((u) => {
				this.#user = u;
				this.#loading = false;
			});
		}
	}

	get user() { return this.#user; }
	get loading() { return this.#loading; }
	get isAuthenticated() { return !!this.#user; }

	async login() {
		try {
			await signInWithPopup(auth, googleProvider);
		} catch (error) {
			console.error('Login failed:', error);
			throw error;
		}
	}

	async logout() {
		try {
			await signOut(auth);
			goto('/login');
		} catch (error) {
			console.error('Logout failed:', error);
		}
	}
}

export const authState = new AuthState();
