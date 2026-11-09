<script lang="ts">
// import { invoke } from "@tauri-apps/api/core";
import { graphviz } from "d3-graphviz";
import { onMount } from "svelte";
import SplitPane from "#components/SplitPane.svelte";

let treeEl: HTMLElement;
let graph: ReturnType<typeof graphviz> | undefined;
let errorMsg = $state("");
let dot = $state("digraph { a -> b }");

onMount(() => {
	graph = graphviz(treeEl, { fit: true, zoom: true }).onerror(
		(message: unknown) => {
			errorMsg = String(message);
		},
	);

	render(dot);

	const observer = new ResizeObserver(() => render(dot));
	observer.observe(treeEl);

	return () => observer.disconnect();
});

$effect(() => {
	const src = dot;
	errorMsg = "";
	render(src);
});

function render(src: string) {
	graph?.width(treeEl.clientWidth).height(treeEl.clientHeight).renderDot(src);
}
</script>

<SplitPane>
	{#snippet left()}
		<div class="tree" bind:this={treeEl}></div>
	{/snippet}

	{#snippet right()}
		<h1>hello</h1>
	{/snippet}
</SplitPane>

<style>
.tree {
	width: 100%;
	height: 100%;
}

.tree :global(svg) {
	display: block;
}

h1 {
	text-align: center;
}
</style>
