<script lang="ts">
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';

	let password = $state('');
	let isLoggingIn = $state(false);
	let errorMsg = $state('');

	async function handleLogin() {
		if (!password) return;
		isLoggingIn = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});

			if (res.ok) {
				goto('/');
			} else {
				const data = await res.json();
				errorMsg = data.error || 'パスワードが違います';
				password = '';
			}
		} catch {
			errorMsg = 'エラーが発生しました。もう一度お試しください。';
		} finally {
			isLoggingIn = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleLogin();
	}
</script>

<svelte:head>
	<title>ログイン | IPO-kaidashi</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F7] p-6 text-[#1D1D1F]">
	<div
		in:fly={{ y: 20, duration: 800 }}
		class="w-full max-w-sm text-center"
	>
		<div class="mb-8 flex justify-center">
			<div class="flex h-20 w-20 items-center justify-center rounded-[22%] bg-white shadow-xl">
				<span class="text-4xl">🛒</span>
			</div>
		</div>

		<h1 class="mb-2 text-3xl font-bold tracking-tight">IPO-kaidashi</h1>
		<p class="mb-10 text-[#86868B]">スタッフ用パスワードを入力してください</p>

		<div class="space-y-3">
			<input
				type="password"
				bind:value={password}
				onkeydown={handleKeydown}
				placeholder="パスワード"
				autocomplete="current-password"
				class="w-full rounded-2xl bg-white px-5 py-4 text-center text-lg font-medium shadow-md outline-none ring-0 transition-all placeholder:text-[#C7C7CC] focus:ring-2 focus:ring-[#0071E3]"
			/>

			{#if errorMsg}
				<p class="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMsg}</p>
			{/if}

			<button
				onclick={handleLogin}
				disabled={isLoggingIn || !password}
				class="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0071E3] py-4 text-[17px] font-semibold text-white shadow-[0_4px_14px_rgba(0,113,227,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
			>
				{#if isLoggingIn}
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
				{:else}
					ログイン
				{/if}
			</button>
		</div>

		<p class="mt-12 text-xs text-[#86868B]">
			Appleスタイルのミニマリスト在庫管理ツール
		</p>
	</div>
</div>

<style>
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		-webkit-font-smoothing: antialiased;
	}
</style>
