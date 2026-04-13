import { Client, isFullDatabase } from '@notionhq/client';
import { env } from '$env/dynamic/private';

export async function load() {
	// Notionクライアントの初期化
	const notion = new Client({ auth: env.NOTION_API_KEY });

	try {
		// 1. データベース情報を取得してデータソースIDを特定する
		const db = await notion.databases.retrieve({ database_id: env.NOTION_DATABASE_ID as string });
		
		if (!isFullDatabase(db)) {
			throw new Error('データベース情報の詳細を取得できませんでした。権限を確認してください。');
		}

		const dataSourceId = db.data_sources?.[0]?.id;
		if (!dataSourceId) {
			throw new Error('データベース内に有効なデータソースが見つかりませんでした。');
		}

		// 2. 特定したデータソースに対してクエリを実行（全件取得）
		const response = await notion.dataSources.query({
			data_source_id: dataSourceId
		});

		if (response.results.length > 0) {
			console.log('Available properties:', Object.keys((response.results[0] as any).properties));
		}

		const getProp = (page: any, keyword: string) => {
			const key = Object.keys(page.properties).find((k) => k.includes(keyword));
			return key ? page.properties[key] : undefined;
		};

		// 取得したデータをアプリ用に整形
		const items = response.results.map((page: any) => {
			const stock = getProp(page, '現在庫')?.number ?? 0;
			const targetStock = getProp(page, 'スーパー買い物点')?.number ?? 0;
			const name = getProp(page, '原材料名')?.title?.[0]?.plain_text ?? '名前なし';
			const unit = getProp(page, '単位')?.select?.name ?? '';
			const barcode = getProp(page, 'バーコード')?.rich_text?.[0]?.plain_text ?? '';
			const capacity = getProp(page, '内容量')?.number ?? 1;

			// デバッグ用ログ（取得できた数値を確認）
			console.log(`[Item] ${name} | 在庫: ${stock} / 目標: ${targetStock}`);

			const isNeeded = stock < targetStock;

			return {
				id: page.id,
				name,
				stock,
				unit,
				targetStock,
				barcode,
				capacity,
				isNeeded
			};
		});

		return {
			allItems: items
		};
	} catch (error) {
		console.error('Notion API Error:', error);
		// エラー内容を画面に返す
		return {
			allItems: [],
			error: 'データの取得に失敗しました。サーバーのログを確認してください。'
		};
	}
}