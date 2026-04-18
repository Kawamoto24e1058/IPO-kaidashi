import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function POST({ cookies }: RequestEvent) {
	cookies.delete('staff_auth', { path: '/' });
	return json({ success: true });
}
