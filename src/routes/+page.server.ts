import { Client, isFullDatabase } from '@notionhq/client';
import { env } from '$env/dynamic/private';
import { backupInventory, getInventoryBackup, getMasterItems } from '$lib/firestore';

export async function load() {
	const notion = new Client({ auth: env.NOTION_API_KEY });

	// マスターデータはNotionとは独立してFirestoreから常に取得
	const masterItemsPromise = getMasterItems('menus').catch(() => []);

	try {
		const db = await notion.databases.retrieve({ database_id: env.NOTION_DATABASE_ID as string });

		if (!isFullDatabase(db)) {
			throw new Error('データベース情報の詳細を取得できませんでした。権限を確認してください。');
		}

		const dataSourceId = db.data_sources?.[0]?.id;
		if (!dataSourceId) {
			throw new Error('データベース内に有効なデータソースが見つかりませんでした。');
		}

		const response = await notion.dataSources.query({
			data_source_id: dataSourceId
		});

		if (response.results.length > 0) {
			console.log('Available properties:', Object.keys((response.results[0] as any).properties));
		}

		const getProp = (page: any, keyword: string) => {
			const key = Object.keys(page.properties).find((k) => k === keyword || k.includes(keyword));
			return key ? page.properties[key] : undefined;
		};

		const items = response.results.map((page: any) => {
			const stockProp = getProp(page, '現在庫');
			const targetProp = getProp(page, 'スーパー買い物点');

			const stock = Number(stockProp?.number || 0);
			const targetStock = Number(targetProp?.number || 0);
			const name = getProp(page, '原材料名')?.title?.[0]?.plain_text ?? '名前なし';
			const unit = getProp(page, '単位')?.select?.name ?? '';
			const barcode = getProp(page, 'バーコード')?.rich_text?.[0]?.plain_text ?? '';
			const capacity = Number(getProp(page, '内容量')?.number || 1);

			console.log(`[Item Debug] ${name}: 現在庫(raw)=${stockProp?.number}, 買い物点(raw)=${targetProp?.number} -> stock=${stock}, target=${targetStock}`);

			return {
				id: page.id,
				name,
				stock,
				unit,
				targetStock,
				barcode,
				capacity,
				isNeeded: stock < targetStock
			};
		});

		// Notion取得成功 → バックグラウンドでFirestoreにバックアップ（awaithしない）
		backupInventory(items);

		const [masterItems] = await Promise.all([masterItemsPromise]);

		return {
			allItems: items,
			masterItems,
			dataSource: 'notion' as const
		};
	} catch (error) {
		console.error('Notion API Error:', error);

		// Notion失敗 → Firestoreのバックアップから自動フォールバック
		const [backup, masterItems] = await Promise.all([
			getInventoryBackup(),
			masterItemsPromise
		]);

		if (backup) {
			console.log(`[Firestore] フォールバック成功: ${backup.updatedAt?.toISOString() ?? '不明'} 時点のバックアップを使用`);
			return {
				allItems: backup.items,
				masterItems,
				dataSource: 'firestore' as const,
				backupDate: backup.updatedAt?.toISOString() ?? null
			};
		}

		return {
			allItems: [],
			masterItems,
			dataSource: 'error' as const,
			error: 'データの取得に失敗しました。サーバーのログを確認してください。'
		};
	}
}
