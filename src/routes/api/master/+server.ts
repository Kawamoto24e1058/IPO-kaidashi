import { json } from '@sveltejs/kit';
import { addMasterItem, updateMasterItem, deleteMasterItem } from '$lib/firestore';
import type { RequestEvent } from './$types';

// マスターアイテム追加
export async function POST({ request }: RequestEvent) {
	try {
		const { collection, data } = await request.json();
		if (!collection || !data?.name) {
			return json({ error: 'コレクション名とアイテム名は必須です' }, { status: 400 });
		}
		const id = await addMasterItem(collection, data);
		return json({ success: true, id });
	} catch (e) {
		console.error(e);
		return json({ error: '追加に失敗しました' }, { status: 500 });
	}
}

// マスターアイテム更新
export async function PUT({ request }: RequestEvent) {
	try {
		const { collection, id, data } = await request.json();
		if (!collection || !id) {
			return json({ error: 'コレクション名とIDは必須です' }, { status: 400 });
		}
		await updateMasterItem(collection, id, data);
		return json({ success: true });
	} catch (e) {
		console.error(e);
		return json({ error: '更新に失敗しました' }, { status: 500 });
	}
}

// マスターアイテム削除
export async function DELETE({ request }: RequestEvent) {
	try {
		const { collection, id } = await request.json();
		if (!collection || !id) {
			return json({ error: 'コレクション名とIDは必須です' }, { status: 400 });
		}
		await deleteMasterItem(collection, id);
		return json({ success: true });
	} catch (e) {
		console.error(e);
		return json({ error: '削除に失敗しました' }, { status: 500 });
	}
}
