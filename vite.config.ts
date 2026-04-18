import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			// SvelteKit の静的ファイルをService Workerでキャッシュ
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
				// ログインリダイレクトがあるため、ナビゲーションはネットワーク優先
				navigateFallback: null
			},
			includeAssets: [
				'favicon.svg',
				'apple-touch-icon.png',
				'icon-192x192.png',
				'icon-512x512.png'
			],
			manifest: {
				name: 'IPO在庫管理',
				short_name: 'IPO在庫',
				description: 'IPOコワーキングカフェ 在庫管理',
				start_url: '/',
				scope: '/',
				theme_color: '#F5F5F7',
				background_color: '#F5F5F7',
				display: 'standalone',
				orientation: 'portrait',
				lang: 'ja',
				icons: [
					{
						src: 'icon-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'icon-192x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{
						src: 'icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: 'icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			}
		})
	]
});
