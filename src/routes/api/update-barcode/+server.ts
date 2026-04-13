import { json } from '@sveltejs/kit';
import { Client } from '@notionhq/client';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from './$types';
export async function POST({ request }: RequestEvent) {
	try {
		const notion = new Client({ auth: env.NOTION_API_KEY });
		const { id, barcode } = await request.json();

		if (!id || !barcode) {
			return json({ success: false, error: 'Missing required parameters' }, { status: 400 });
		}

		await notion.pages.update({
			page_id: id,
			properties: {
				バーコード: {
					rich_text: [
						{
							text: {
								content: barcode
							}
						}
					]
				}
			}
		});

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update Notion barcode:', error);
		return json({ success: false, error: 'Failed to update' }, { status: 500 });
	}
}
