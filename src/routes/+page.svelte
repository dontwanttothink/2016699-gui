<script lang="ts">
import { invoke } from "@tauri-apps/api/core";
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

:root {
	font-family: Inter, Avenir, system-ui, Helvetica, Arial, sans-serif;
	font-size: 16px;
	line-height: 24px;
	font-weight: 400;

	color: #0f0f0f;
	background-color: #f6f6f6;

	font-synthesis: none;
	text-rendering: optimizeLegibility;
}

.row {
	display: flex;
	justify-content: center;
}

a {
	font-weight: 500;
	color: #646cff;
	text-decoration: inherit;
}

a:hover {
	color: #535bf2;
}

h1 {
	text-align: center;
}

input,
button {
	border-radius: 8px;
	border: 1px solid transparent;
	padding: 0.6em 1.2em;
	font-size: 1em;
	font-weight: 500;
	font-family: inherit;
	color: #0f0f0f;
	background-color: #ffffff;
	transition: border-color 0.25s;
	box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
}

button {
	cursor: pointer;
}

button:hover {
	border-color: #396cd8;
}
button:active {
	border-color: #396cd8;
	background-color: #e8e8e8;
}

input,
button {
	outline: none;
}

#greet-input {
	margin-right: 5px;
}

@media (prefers-color-scheme: dark) {
	:root {
		color: #f6f6f6;
		background-color: #2f2f2f;
	}

	a:hover {
		color: #24c8db;
	}

	input,
	button {
		color: #ffffff;
		background-color: #0f0f0f98;
	}
	button:active {
		background-color: #0f0f0f69;
	}
}
</style>
