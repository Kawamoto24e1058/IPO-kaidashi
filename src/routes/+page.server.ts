import { Client, isFullDatabase } from '@notionhq/client';
import { NOTION_API_KEY, NOTION_DATABASE_ID } from '$env/static/private';

// Notionクライアントの初期化
const notion = new Client({ auth: NOTION_API_KEY });

export async function load() {
	try {
		// 1. データベース情報を取得してデータソースIDを特定する
		const db = await notion.databases.retrieve({ database_id: NOTION_DATABASE_ID });
		
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

		// 取得したデータをアプリ用に整形
		const items = response.results.map((page: any) => {
			return {
				id: page.id,
				// Notionの実際のプロパティ名に合わせる
				name: page.properties['商品名']?.title[0]?.plain_text || '名前なし',
				stock: page.properties['在庫数']?.number || 0,
				unit: page.properties['単位']?.select?.name || '',
				targetStock: page.properties['買い出し点']?.number || 0,
				barcode: page.properties['バーコード']?.rich_text?.[0]?.plain_text || '',
				capacity: page.properties['内容量']?.number || 1,
				needsShopping: page.properties['買い出し必要']?.formula?.checkbox || false
			};
		});

		return {
			items
		};
	} catch (error) {
		console.error('Notion API Error:', error);
		// エラー内容を画面に返す
		return {
			items: [],
			error: 'データの取得に失敗しました。サーバーのログを確認してください。'
		};
	}
}