<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';
	import { scale, fade } from 'svelte/transition';
	import { backOut } from 'svelte/easing';




	let { data }: { data: PageData } = $props();
	let shoppingList = $derived((data.allItems || []).filter(i => i.isNeeded));

	// 入力された「今回買った量」をIDをキーにして保持
	let buyAmounts: Record<string, number> = $state({});
	let isUpdating = $state(false);

	// スキャナー関連の状態
	let isScanning = $state(false);
	let scanMode = $state<'search' | 'register'>('search');
	let html5QrCode: Html5Qrcode | null = null;
	let scannedMatchedItem = $state<any>(null);
	let isScannerUpdating = $state(false);
	
	let popupFeedback = $state<{ type: 'success' | 'error' | 'warning' | null; text?: string }>({ type: null });
	let popupTimeout: ReturnType<typeof setTimeout>;

	let unregisteredBarcode = $state('');
	let isRegisteringModalOpen = $state(false);
	let selectedItemIdForBinding = $state('');
	let isRegistering = $state(false);

	function showPopup(type: 'success' | 'error' | 'warning', text?: string) {
		if (popupFeedback.type) return;
		clearTimeout(popupTimeout);
		popupFeedback = { type, text };
		popupTimeout = setTimeout(() => {
			popupFeedback = { type: null };
		}, 1200); // メッセージを読む時間を確保
	}

	// 今回買った分を追加
	function handleManualAdd(item: any) {
		const currentAmount = buyAmounts[item.id] || 0;
		const capacity = item.capacity || 1;
		buyAmounts[item.id] = currentAmount + capacity;

		if (navigator.vibrate) navigator.vibrate(50);
	}

	// 間違えた時用の取り消し
	function handleManualUndo(id: string, capacity: number) {
		const currentAmount = buyAmounts[id] || 0;
		buyAmounts[id] = Math.max(0, currentAmount - (capacity || 1));
	}

	// 最新の購入量から更新すべきデータを計算しAPIへ投げる
	async function handleUpdate() {
		const updates = Object.entries(buyAmounts)
			.filter(([_, amount]) => amount && amount > 0)
			.map(([id, amount]) => {
				const item = data.allItems.find((i: any) => i.id === id);
				return {
					id,
					newStock: (item?.stock || 0) + amount
				};
			});

		if (updates.length === 0) return;

		isUpdating = true;

		try {
			const res = await fetch('/api/update-inventory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ updates })
			});

			if (res.ok) {
				// 状態リセット＆データ再取得
				buyAmounts = {};
				await invalidateAll();
			} else {
				const errData = await res.json().catch(() => ({}));
				alert(errData?.error || '更新に失敗しました。APIの設定等を確認してください。');
			}
		} catch (error) {
			console.error(error);
			alert('エラーが発生しました');
		} finally {
			isUpdating = false;
		}
	}

	// スキャナーのトグル
	async function toggleScanner() {
		if (isScanning) {
			await stopScanner();
		} else {
			await startScanner();
		}
	}

	async function startScanner() {
		isScanning = true;
		
		// DOMマウントを待つ
		setTimeout(() => {
			html5QrCode = new Html5Qrcode('qr-reader');
			const config = {
				fps: 20,
				qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
					// 画面の幅に合わせてスキャンボックスを動的に設定
					const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
					const qrboxSize = Math.floor(minEdgeSize * 0.7);
					return {
						width: Math.min(400, Math.floor(viewfinderWidth * 0.8)),
						height: Math.min(250, Math.floor(qrboxSize * 0.6)) // 一般的なバーコード向けに横長に
					};
				},
				videoConstraints: {
					facingMode: 'environment',
					width: { min: 640, ideal: 1280, max: 1920 },
					height: { min: 480, ideal: 720, max: 1080 },
					focusMode: 'continuous'
				}
			};

			html5QrCode.start(
				config.videoConstraints,
				config,
				onScanSuccess,
				(err) => {
					// 継続的なスキャンエラーは無視
				}
			).catch(err => {
				console.error(err);
				alert('カメラへのアクセスに失敗しました。');
				isScanning = false;
			});
		}, 100);
	}

	async function stopScanner() {
		if (html5QrCode && html5QrCode.isScanning) {
			try {
				await html5QrCode.stop();
				html5QrCode.clear();
			} catch (err) {
				console.error(err);
			}
		}
		isScanning = false;
	}

	function onScanSuccess(decodedText: string) {
		if (popupFeedback.type || isRegisteringModalOpen || scannedMatchedItem) return; // アニメーション中やモーダル表示中は無視

		if (scanMode === 'search') {
			// 【検索モード】買い出しリスト内を照合
			const matchedItem = shoppingList.find((i: any) => i.barcode === decodedText);
			if (matchedItem) {
				if (navigator.vibrate) navigator.vibrate(50);
				if (html5QrCode) html5QrCode.pause(true);
				scannedMatchedItem = matchedItem;
			} else {
				if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
				showPopup('error', 'リストにありません');
			}
		} else {
			// 【登録モード】全商品を照合
			const matchedItem = data.allItems.find((i: any) => i.barcode === decodedText);
			if (matchedItem) {
				if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
				showPopup('warning', `登録済みです\n${matchedItem.name}`);
			} else {
				if (navigator.vibrate) navigator.vibrate(50);
				if (html5QrCode) html5QrCode.pause(true);
				unregisteredBarcode = decodedText;
				selectedItemIdForBinding = '';
				isRegisteringModalOpen = true;
			}
		}
	}

	function cancelRegistration() {
		isRegisteringModalOpen = false;
		unregisteredBarcode = '';
		if (html5QrCode) html5QrCode.resume();
	}

	function cancelScannerMatch() {
		scannedMatchedItem = null;
		if (html5QrCode) html5QrCode.resume();
	}

	async function handleScannerAdd() {
		if (!scannedMatchedItem || isScannerUpdating) return;
		isScannerUpdating = true;

		const capacity = scannedMatchedItem.capacity || 1;
		const updates = [{
			id: scannedMatchedItem.id,
			newStock: (scannedMatchedItem.stock || 0) + capacity
		}];

		try {
			const res = await fetch('/api/update-inventory', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ updates })
			});

			if (res.ok) {
				await invalidateAll();
				if (navigator.vibrate) navigator.vibrate(50);
				scannedMatchedItem = null;
				showPopup('success', '追加完了');
				if (html5QrCode) html5QrCode.resume();
			} else {
				const errData = await res.json().catch(() => ({}));
				alert(errData?.error || '更新に失敗しました。APIの設定等を確認してください。');
			}
		} catch (error) {
			console.error(error);
			alert('エラーが発生しました');
		} finally {
			isScannerUpdating = false;
		}
	}

	async function handleRegisterBarcode() {
		if (!selectedItemIdForBinding || isRegistering) return;

		isRegistering = true;
		try {
			const res = await fetch('/api/update-barcode', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: selectedItemIdForBinding, barcode: unregisteredBarcode })
			});

			if (res.ok) {
				const itemIndex = data.allItems.findIndex((i: any) => i.id === selectedItemIdForBinding);
				if (itemIndex !== -1) {
					data.allItems[itemIndex].barcode = unregisteredBarcode;
				}

				isRegisteringModalOpen = false;
				unregisteredBarcode = '';
				
				if (navigator.vibrate) navigator.vibrate(50);
				showPopup('success', '登録完了');
				
				if (html5QrCode) html5QrCode.resume();
			} else {
				alert('登録に失敗しました。');
			}
		} catch (error) {
			console.error(error);
			alert('エラーが発生しました');
		} finally {
			isRegistering = false;
		}
	}

	onDestroy(() => {
		stopScanner();
	});
</script>

<svelte:head>
	<title>買い出しリスト</title>
</svelte:head>

<div class="min-h-screen bg-[#F5F5F7] pb-32 font-sans tracking-tight text-[#1D1D1F]">
	<div class="mx-auto max-w-md space-y-6 p-6">
		<h1 class="mb-8 mt-4 pl-1 text-3xl font-semibold">買い出しリスト</h1>

		<div class="space-y-4">
			{#if !data.allItems || data.allItems.length === 0}
				<div class="mt-10 text-center text-[#86868B]">
					データが読み込めませんでした。<br />環境変数の設定を確認してください。
				</div>
			{:else if shoppingList.length === 0}
				<div class="mt-10 text-center text-[#86868B]">
					現在、買い出しが必要な商品はありません。<br />
					<span class="text-xs">※ 在庫が十分な商品もスキャンしてバーコード登録が可能です。</span>
					<div class="mt-4 rounded-lg bg-red-50 p-2 text-xs text-red-500 font-mono">
						デバッグ: 全取得データ数 = {data.allItems?.length || 0}
					</div>
				</div>
			{/if}

			{#each shoppingList as item (item.id)}
				{@const currentAdded = buyAmounts[item.id] || 0}
				{@const displayStock = item.stock + currentAdded}
				{@const shortage = Math.max(0, item.targetStock - displayStock)}
				<div
					class="flex items-center justify-between rounded-2xl bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
				>
					<div class="flex-1 pr-2">
						<h2 class="text-lg font-medium leading-tight">{item.name}</h2>
						{#if item.barcode}
							<p class="text-xs text-[#86868B] mt-0.5 font-mono">
								JAN: {item.barcode.slice(0, -4)}<span class="font-bold text-[#1D1D1F]">{item.barcode.slice(-4)}</span>
							</p>
						{/if}
						<div class="mt-2 space-y-0.5 text-sm">
							<p class="text-[#86868B]">
								現在庫: <span class="font-medium text-[#1D1D1F]">{displayStock}</span> {item.unit}
								{#if currentAdded > 0}
									<span class="ml-1 font-bold text-[#0071E3]">(+{currentAdded})</span>
								{/if}
							</p>
							<p class="text-[#86868B]">
								不足分: 
								{#if shortage <= 0}
									<span class="font-medium text-emerald-500">充足</span>
								{:else}
									<span class="font-medium text-rose-500">{shortage}</span> {item.unit}
								{/if}
							</p>
						</div>
					</div>

					<div class="flex shrink-0 items-center gap-2">
						{#if currentAdded > 0}
							<!-- マイナス（取り消し）ボタン -->
							<button
								onclick={() => handleManualUndo(item.id, item.capacity)}
								class="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F5F7] text-2xl font-medium text-[#86868B] transition-all active:scale-95 active:bg-[#E5E5E7] select-none"
							>
								−
							</button>
						{/if}
						<!-- メインの追加ボタン -->
						<button
							onclick={() => handleManualAdd(item)}
							class="flex h-12 min-w-[100px] items-center justify-center gap-1 rounded-xl bg-[#0071E3] px-5 text-[17px] font-semibold text-white transition-all active:scale-95 active:bg-[#005BB5] shadow-[0_4px_10px_rgba(0,113,227,0.2)] select-none"
						>
							<span class="text-xl leading-none">＋</span>
							<span>{item.capacity || 1} {item.unit}</span>
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Sticky Action Area -->
	<div class="fixed bottom-0 left-0 right-0 z-10 pointer-events-none">
		<div class="bg-linear-to-t from-[#F5F5F7] via-[#F5F5F7]/90 to-transparent p-6 pb-8 pointer-events-auto">
			<div class="mx-auto flex max-w-md items-center gap-4">
				<button
					onclick={handleUpdate}
					disabled={isUpdating}
					class="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0071E3] py-4 text-lg font-medium text-white shadow-[0_4px_14px_rgba(0,113,227,0.3)] transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
				>
					{#if isUpdating}
						<svg class="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"></path>
						</svg>
						更新中...
					{:else}
						在庫を更新
					{/if}
				</button>

				<!-- 📷 スキャンボタン -->
				<button
					onclick={toggleScanner}
					class="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition-all active:scale-90"
					aria-label="スキャン"
				>
					📷
				</button>
			</div>
		</div>
	</div>

	<!-- スキャナーオーバーレイ -->
	{#if isScanning}
		<div class="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
			<div class="flex items-center justify-between p-6 pb-2">
				<h2 class="text-xl font-medium text-white">バーコードスキャン</h2>
				<button
					onclick={stopScanner}
					class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-all active:scale-90"
				>
					✕
				</button>
			</div>

			<!-- モード切り替えトグル -->
			<div class="px-6 pb-4">
				<div class="flex rounded-xl bg-white/10 p-1 backdrop-blur-md">
					<button
						onclick={() => scanMode = 'search'}
						class="flex-1 rounded-lg py-3 text-sm font-bold transition-all {scanMode === 'search' ? 'bg-[#0071E3] text-white shadow-md' : 'text-white/60 hover:text-white'}"
					>
						検索モード（照合）
					</button>
					<button
						onclick={() => scanMode = 'register'}
						class="flex-1 rounded-lg py-3 text-sm font-bold transition-all {scanMode === 'register' ? 'bg-[#0071E3] text-white shadow-md' : 'text-white/60 hover:text-white'}"
					>
						登録モード
					</button>
				</div>
			</div>
			
			<div class="relative flex-1 px-4 pb-10 flex flex-col justify-center">
				<div class="overflow-hidden rounded-2xl bg-black">
					<div id="qr-reader" class="w-full"></div>
				</div>

				<!-- スキャン成功時（商品追加アクション） -->
				{#if scannedMatchedItem}
					<div
						transition:fade={{ duration: 150 }}
						class="absolute inset-0 z-60 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
					>
						<div class="w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
							<div class="flex items-center gap-2 mb-4 justify-center">
								<span class="text-3xl leading-none">⭕️</span>
								<h3 class="text-2xl font-bold text-[#1D1D1F]">確認しました</h3>
							</div>
							
							<div class="rounded-xl bg-[#F5F5F7] p-4 text-center">
								<h4 class="text-xl font-bold text-[#1D1D1F]">{scannedMatchedItem.name}</h4>
								<p class="mt-2 text-[#86868B] text-sm">
									現在庫: <span class="font-medium text-[#1D1D1F]">{scannedMatchedItem.stock}</span> {scannedMatchedItem.unit}
								</p>
								<p class="mt-0.5 text-[#86868B] text-sm">
									買い出し点: {scannedMatchedItem.targetStock} {scannedMatchedItem.unit}
								</p>
							</div>

							<div class="mt-6 flex flex-col gap-3">
								<button
									onclick={handleScannerAdd}
									disabled={isScannerUpdating}
									class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0071E3] py-4 text-[17px] font-semibold text-white shadow-[0_4px_10px_rgba(0,113,227,0.2)] transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
								>
									{#if isScannerUpdating}
										<svg class="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"></path>
										</svg>
										追加中...
									{:else}
										<span class="text-xl leading-none">＋</span>
										<span>{scannedMatchedItem.capacity || 1} {scannedMatchedItem.unit} 追加</span>
									{/if}
								</button>
								<button
									onclick={cancelScannerMatch}
									disabled={isScannerUpdating}
									class="w-full rounded-xl bg-[#F5F5F7] py-3 text-[15px] font-medium text-[#1D1D1F] transition-all active:scale-95 disabled:opacity-50"
								>
									キャンセル
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- スキャン用巨大ポップアップ -->
				{#if popupFeedback.type}
					<div
						transition:fade={{ duration: 150 }}
						class="absolute inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
					>
						<div
							in:scale={{ duration: 400, easing: backOut, start: 0.3 }}
							out:scale={{ duration: 200, start: 0.8 }}
							class="flex flex-col items-center justify-center drop-shadow-2xl text-center px-4"
						>
							<span class="text-[140px] leading-none">
								{#if popupFeedback.type === 'success'}⭕️
								{:else if popupFeedback.type === 'warning'}⚠️
								{:else}❌{/if}
							</span>
							{#if popupFeedback.text}
								<span class="mt-6 text-3xl font-bold tracking-wider text-white whitespace-pre-wrap">
									{popupFeedback.text}
								</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- 登録モーダル -->
				{#if isRegisteringModalOpen}
					<div
						transition:fade={{ duration: 150 }}
						class="absolute inset-0 z-60 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
					>
						<div class="w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl">
							<h3 class="text-xl font-bold text-[#1D1D1F]">バーコードの登録</h3>
							<p class="mt-2 text-sm text-[#86868B]">
								未登録のコード: <span class="font-mono text-black">{unregisteredBarcode}</span>
							</p>
							
							<div class="mt-6">
								<label for="item-select" class="mb-2 block text-sm font-medium text-[#1D1D1F]">紐付ける商品</label>
								<div class="relative">
									<select
										id="item-select"
										bind:value={selectedItemIdForBinding}
										class="w-full appearance-none rounded-xl bg-[#F5F5F7] px-4 py-3 pr-10 text-[15px] font-medium outline-none focus:ring-2 focus:ring-[#0071E3]/50"
									>
										<option value="" disabled selected>選択してください</option>
										{#each data.allItems as item (item.id)}
											<option value={item.id}>{item.name}</option>
										{/each}
									</select>
									<span class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500">
										▼
									</span>
								</div>
							</div>

							<div class="mt-8 flex gap-3">
								<button
									onclick={cancelRegistration}
									disabled={isRegistering}
									class="flex-1 rounded-xl bg-[#F5F5F7] py-3 text-[15px] font-medium text-[#1D1D1F] transition-all active:scale-95 disabled:opacity-50"
								>
									キャンセル
								</button>
								<button
									onclick={handleRegisterBarcode}
									disabled={!selectedItemIdForBinding || isRegistering}
									class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0071E3] py-3 text-[15px] font-medium text-white transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
								>
									{#if isRegistering}
										<svg class="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"></path>
										</svg>
									{/if}
									登録する
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
