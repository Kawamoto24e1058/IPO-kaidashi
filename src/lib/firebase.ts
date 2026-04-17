import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Singleton pattern for Firebase initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// iOS PWA の Storage Partitioning 対策:
// sessionStorage は ITP により cross-context でアクセス不可のため
// browserLocalPersistence (localStorage) を明示的に指定する
// initializeAuth は1度しか呼べないため try/catch でガード
let auth;
try {
	auth = initializeAuth(app, {
		persistence: browserLocalPersistence
	});
} catch {
	// すでに初期化済みの場合は既存インスタンスを取得
	auth = getAuth(app);
}

const googleProvider = new GoogleAuthProvider();

export { app, auth, googleProvider };
