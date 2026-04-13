import { json } from '@sveltejs/kit';
import { Client } from '@notionhq/client';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from './$types';

export async function POST({ request }: RequestEvent) {
	try {
		const notion = new Client({ auth: env.NOTION_API_KEY });
		const databaseId = env.NOTION_DATABASE_ID;

		if (!databaseId) {
			return json({ success: false, error: 'Database ID is missing in environment variables' }, { status: 500 });
		}

		const data = await request.json();
		const { name, stock, targetStock, unit, capacity, barcode } = data;

		// バリデーション
		if (!name || !unit) {
			return json(
				{ success: false, error: '原材料名 (name) と 単位 (unit) は必須項目です' },
				{ status: 400 }
			);
		}

		const response = await notion.pages.create({
			parent: { database_id: databaseId },
			properties: {
				原材料名: {
					title: [
						{
							text: {
								content: name
							}
						}
					]
				},
				現在庫: {
					number: Number(stock) || 0
				},
				スーパー買い物点: {
					number: Number(targetStock) || 0
				},
				単位: {
					select: {
						name: unit
					}
				},
				内容量: {
					number: Number(capacity) || 1
				},
				バーコード: {
					rich_text: [
						{
							text: {
								content: barcode || ''
							}
						}
					]
				}
			}
		});

		return json({ success: true, id: response.id });
	} catch (error: any) {
		console.error('Failed to create Notion item:', error);
		if (error?.code === 'validation_error') {
			return json(
				{ success: false, error: 'Notionプロパティ名の設定を確認してください（validation_error）' },
				{ status: 400 }
			);
		}
		return json({ success: false, error: 'Failed to create item' }, { status: 500 });
	}
}
