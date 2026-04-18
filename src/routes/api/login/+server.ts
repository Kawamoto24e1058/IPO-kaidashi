import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createHash } from 'crypto';
import type { RequestEvent } from './$types';

function getSessionToken(): string {
	const secret = env.SESSION_SECRET || 'ipo-kaidashi-secret';
	return createHash('sha256').update(env.STAFF_PASSWORD + secret).digest('hex');
}

export async function POST({ request, cookies }: RequestEvent) {
	const { password } = await request.json();

	if (!env.STAFF_PASSWORD) {
		return json({ error: '環境変数 STAFF_PASSWORD が設定されていません' }, { status: 500 });
	}

	if (password === env.STAFF_PASSWORD) {
		cookies.set('staff_auth', getSessionToken(), {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 30 // 30日
		});
		return json({ success: true });
	}

	return json({ error: 'パスワードが違います' }, { status: 401 });
}
