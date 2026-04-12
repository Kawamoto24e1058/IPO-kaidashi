import { json } from '@sveltejs/kit';
import { Client } from '@notionhq/client';
import { NOTION_API_KEY } from '$env/static/private';
import type { RequestEvent } from './$types';

const notion = new Client({ auth: NOTION_API_KEY });

export async function POST({ request }: RequestEvent) {
	try {
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
	} catch (error) {
		console.error('Failed to update Notion inventory:', error);
		return json({ success: false, error: 'Failed to update' }, { status: 500 });
	}
}
