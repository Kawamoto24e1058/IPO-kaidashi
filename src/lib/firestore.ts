/**
 * Firestore ヘルパー
 *
 * 用途:
 *   1. Notion在庫データのバックアップ（inventory_backup/latest）
 *   2. メニュー等のマスターデータ管理（menus, suppliers など）
 */

import {
	doc,
	getDoc,
	setDoc,
	collection,
	getDocs,
	addDoc,
	updateDoc,
	deleteDoc,
	serverTimestamp,
	query,
	orderBy
} from 'firebase/firestore';
import { db } from './firebase';

// Firebase 設定が揃っているか確認（未設定時はFirestore操作をスキップ）
function isConfigured(): boolean {
	return !!(
		import.meta.env.VITE_FIREBASE_PROJECT_ID &&
		import.meta.env.VITE_FIREBASE_API_KEY
	);
}

// Firestoreの操作にタイムアウトを付ける（デフォルト4秒）
function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`Firestore timeout after ${ms}ms`)), ms)
		)
	]);
}

// ─── 型 ──────────────────────────────────────────────

export type InventoryItem = {
	id: string;
	name: string;
	stock: number;
	unit: string;
	targetStock: number;
	barcode: string;
	capacity: number;
	isNeeded: boolean;
};

export type MasterItem = {
	id: string;
	name: string;
	category: string;
	price: number;
	notes: string;
	createdAt?: unknown;
	updatedAt?: unknown;
};

// ─── 在庫バックアップ ─────────────────────────────────

/**
 * Notionから取得した在庫データをFirestoreに保存する。
 * 失敗しても例外を上に伝播させず、ログのみ出す。
 */
export async function backupInventory(items: InventoryItem[]): Promise<void> {
	if (!isConfigured()) return;
	try {
		await withTimeout(
			setDoc(doc(db, 'inventory_backup', 'latest'), {
				items,
				updatedAt: serverTimestamp(),
				source: 'notion'
			})
		);
	} catch (e) {
		console.warn('[Firestore] inventory backup failed:', e);
	}
}

/**
 * Firestoreから最新の在庫バックアップを取得する。
 * データがなければ null を返す。
 */
export async function getInventoryBackup(): Promise<{
	items: InventoryItem[];
	updatedAt: Date | null;
} | null> {
	if (!isConfigured()) return null;
	try {
		const snap = await withTimeout(getDoc(doc(db, 'inventory_backup', 'latest')));
		if (!snap.exists()) return null;
		const data = snap.data();
		return {
			items: data.items as InventoryItem[],
			updatedAt: data.updatedAt?.toDate?.() ?? null
		};
	} catch (e) {
		console.warn('[Firestore] inventory backup read failed:', e);
		return null;
	}
}

// ─── マスターデータ（汎用） ───────────────────────────

/**
 * 指定コレクションのマスターアイテムを全件取得する。
 */
export async function getMasterItems(collectionName: string): Promise<MasterItem[]> {
	if (!isConfigured()) return [];
	try {
		const q = query(collection(db, collectionName), orderBy('createdAt', 'asc'));
		const snap = await withTimeout(getDocs(q));
		return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MasterItem));
	} catch (e) {
		// orderBy が使えない（インデックスなし）場合はフォールバック
		try {
			const snap = await withTimeout(getDocs(collection(db, collectionName)));
			return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MasterItem));
		} catch {
			console.warn(`[Firestore] getMasterItems(${collectionName}) failed:`, e);
			return [];
		}
	}
}

/**
 * マスターアイテムを追加して、追加されたIDを返す。
 */
export async function addMasterItem(
	collectionName: string,
	data: Omit<MasterItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
	const ref = await addDoc(collection(db, collectionName), {
		...data,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp()
	});
	return ref.id;
}

/**
 * マスターアイテムを更新する。
 */
export async function updateMasterItem(
	collectionName: string,
	id: string,
	data: Partial<Omit<MasterItem, 'id' | 'createdAt'>>
): Promise<void> {
	await updateDoc(doc(db, collectionName, id), {
		...data,
		updatedAt: serverTimestamp()
	});
}

/**
 * マスターアイテムを削除する。
 */
export async function deleteMasterItem(collectionName: string, id: string): Promise<void> {
	await deleteDoc(doc(db, collectionName, id));
}
