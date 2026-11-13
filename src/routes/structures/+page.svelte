<script lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/svelte";
import { onMount } from "svelte";
import Graphviz from "#components/Graphviz.svelte";
import { avlToDot, heapToDot, listToDot } from "#lib/structureDot.ts";
import { onSnapshotsChange, readSnapshots } from "#lib/structuresWindow.ts";
import { structuresAt } from "#lib/verbose.ts";

const STEP_ANIMATION_MS = 120;

let snapshots = $state(readSnapshots());
let step = $state(0);

onMount(() =>
	onSnapshotsChange(() => {
		snapshots = readSnapshots();
		step = 0;
	}),
);

const panels = $derived.by(() => {
	const { list, heap, avl } = structuresAt(snapshots, step);
	return [
		...(list ? [{ title: "Plan (lista)", body: listToDot(list) }] : []),
		...(heap ? [{ title: "Heap", body: heapToDot(heap) }] : []),
		...(avl ? [{ title: "AVL de posiciones", body: avlToDot(avl) }] : []),
	];
});

function go(delta: number) {
	step = Math.min(snapshots.length - 1, Math.max(0, step + delta));
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === "ArrowLeft") go(-1);
	else if (event.key === "ArrowRight") go(1);
}
</script>

<svelte:window onkeydown={onKeydown} />

<main class="structures">
	{#if snapshots.length === 0}
		<p class="empty">No hay estructuras para mostrar.</p>
	{:else}
		<div class="panels">
			{#each panels as panel (panel.title)}
				<section class="panel">
					<h2>{panel.title}</h2>
					<div class="canvas">
						{#if panel.body === ""}
							<p class="empty">(Vacío)</p>
						{:else}
							<Graphviz body={panel.body} duration={STEP_ANIMATION_MS} />
						{/if}
					</div>
				</section>
			{/each}
		</div>
		<nav class="controls">
			<button
				type="button"
				aria-label="Paso anterior"
				disabled={step === 0}
				onclick={() => go(-1)}
			>
				<ChevronLeft size={16} aria-hidden="true" />
			</button>
			<span>Paso {step + 1} de {snapshots.length}</span>
			<button
				type="button"
				aria-label="Paso siguiente"
				disabled={step === snapshots.length - 1}
				onclick={() => go(1)}
			>
				<ChevronRight size={16} aria-hidden="true" />
			</button>
		</nav>
	{/if}
</main>

<style>
.structures {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	height: 100vh;
	box-sizing: border-box;
	padding: 1.5rem;
}

.panels {
	flex: 1;
	min-height: 0;
	display: flex;
	gap: 1rem;
}

.panel {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.panel h2 {
	margin: 0;
	font-size: var(--font-size-lg);
	text-align: center;
}

.canvas {
	flex: 1;
	min-height: 0;
	border: 1px solid var(--border);
	border-radius: 1rem;
	background-color: var(--surface);
	overflow: hidden;
}

.empty {
	margin: 0;
	padding: 1rem;
	text-align: center;
	color: var(--subtle);
}

.controls {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 1rem;
}

.controls button:disabled {
	opacity: 0.4;
	cursor: default;
}
</style>
