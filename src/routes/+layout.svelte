<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { authState } from '$lib/auth.svelte';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';

	let { children } = $props();

	// Auth Guard logic
	$effect(() => {
		const isLoginPage = String(page.url.pathname) === '/login';
		const loading = authState.loading;
		const authenticated = authState.isAuthenticated;

		untrack(() => {
			if (!loading) {
				if (!authenticated && !isLoginPage) {
					goto('/login');
				} else if (authenticated && isLoginPage) {
					goto('/');
				}
			}
		});
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if authState.loading}
	<div class="flex h-screen items-center justify-center bg-[#F5F5F7]">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-[#0071E3] border-t-transparent"></div>
	</div>
{:else}
	{@render children()}
{/if}
