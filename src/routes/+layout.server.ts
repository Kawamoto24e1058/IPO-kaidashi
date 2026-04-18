import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createHash } from 'crypto';
import type { LayoutServerLoad } from './$types';

function getSessionToken(): string {
	const secret = env.SESSION_SECRET || 'ipo-kaidashi-secret';
	return createHash('sha256').update(env.STAFF_PASSWORD + secret).digest('hex');
}

export const load: LayoutServerLoad = ({ cookies, url }) => {
	const token = cookies.get('staff_auth');
	const isAuthenticated = !!env.STAFF_PASSWORD && token === getSessionToken();
	const isLoginPage = url.pathname === '/login';

	if (!isAuthenticated && !isLoginPage) {
		redirect(302, '/login');
	}

	if (isAuthenticated && isLoginPage) {
		redirect(302, '/');
	}

	return { isAuthenticated };
};
