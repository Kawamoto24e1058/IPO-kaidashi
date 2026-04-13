import { json } from '@sveltejs/kit';
import { Client } from '@notionhq/client';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from './$types';
export async function POST({ request }: RequestEvent) {
	try {
		const notion = new Client({ auth: env.NOTION_API_KEY });
		const { updates } = await request.json();

		if (!Array.isArray(updates) || updates.length === 0) {
			return json({ success: false, error: 'No updates provided' }, { status: 400 });
		}

		// 全ての更新処理を並列実行
		await Promise.all(
			updates.map(async (update) => {
				await notion.pages.update({
					page_id: update.id,
					properties: {
						在庫数: {
							number: update.newStock
						}
					}
				});
			})
		);

		return json({ success: true });
	} catch (error: any) {
		console.error('Failed to update Notion inventory:', error);
		if (error?.code === 'validation_error') {
			return json({ success: false, error: 'Notionプロパティ名の設定を確認してください（validation_error）' }, { status: 400 });
		}
		return json({ success: false, error: 'Failed to update' }, { status: 500 });
	}
}
