<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/firebase';
	import { getRedirectResult } from 'firebase/auth';
	import { authState } from '$lib/auth.svelte';
	import { fade, fly } from 'svelte/transition';

	let isLoggingIn = $state(false);

	onMount(async () => {
		try {
			const result = await getRedirectResult(auth);
			if (result?.user) {
				goto('/');
			}
		} catch (error) {
			console.error('Redirect result error:', error);
		}
	});

	async function handleLogin() {
		isLoggingIn = true;
		try {
			await authState.login();
		} catch (error) {
			console.error(error);
			alert('ログインに失敗しました。');
		} finally {
			isLoggingIn = false;
		}
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
		<p class="mb-12 text-[#86868B]">サインインして在庫管理を始めましょう</p>

		<button
			onclick={handleLogin}
			disabled={isLoggingIn}
			class="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50 hover:shadow-lg"
		>
			{#if isLoggingIn}
				<div class="h-5 w-5 animate-spin rounded-full border-2 border-[#0071E3] border-t-transparent"></div>
			{:else}
				<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="h-5 w-5" />
			{/if}
			Googleでサインイン
		</button>

		<p class="mt-12 text-xs text-[#86868B]">
			Appleスタイルのミニマリスト在庫管理ツール
		</p>
	</div>
</div>

<style>
	/* Apple-like smooth fonts */
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		-webkit-font-smoothing: antialiased;
	}
</style>
