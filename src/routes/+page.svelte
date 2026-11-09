<script lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { graphviz } from "d3-graphviz";
import { onMount } from "svelte";

let container: HTMLElement;
let treeEl: HTMLElement;
let graph: ReturnType<typeof graphviz> | undefined;
let errorMsg = $state("");
let leftWidth = $state(70);
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

const MIN_WIDTH = 10;
const MAX_WIDTH = 80;
const KEY_STEP = 5;

function clampWidth(value: number) {
	return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

let dragging = $state(false);
function startDrag(event: PointerEvent) {
	dragging = true;
	(event.target as HTMLElement).setPointerCapture(event.pointerId);
}

function drag(event: PointerEvent) {
	if (!dragging) return;
	const rect = container.getBoundingClientRect();
	leftWidth = clampWidth(((event.clientX - rect.left) / rect.width) * 100);
}

function stopDrag() {
	dragging = false;
}

function onKeyDown(event: KeyboardEvent) {
	switch (event.key) {
		case "ArrowLeft":
			leftWidth = clampWidth(leftWidth - KEY_STEP);
			break;
		case "ArrowRight":
			leftWidth = clampWidth(leftWidth + KEY_STEP);
			break;
		case "Home":
			leftWidth = MIN_WIDTH;
			break;
		case "End":
			leftWidth = MAX_WIDTH;
			break;
		default:
			return;
	}
	event.preventDefault();
}
</script>

<main class="split" bind:this={container}>
	<div id="tree-pane" class="pane left" style="width: {leftWidth}%">
		<div class="tree" bind:this={treeEl}></div>
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<!-- biome-ignore lint/a11y/useSemanticElements: there doesn't seem to actually be a more appropriate element unfortunately -->
	<div
		class="divider"
		class:active={dragging}
		role="separator"
		tabindex="0"
		aria-label="Resize panels"
		aria-orientation="vertical"
		aria-controls="tree-pane"
		aria-valuenow={Math.round(leftWidth)}
		aria-valuemin={MIN_WIDTH}
		aria-valuemax={MAX_WIDTH}
		onkeydown={onKeyDown}
		onpointerdown={startDrag}
		onpointermove={drag}
		onpointerup={stopDrag}
		onpointercancel={stopDrag}
	></div>

	<div class="pane right">
		<h1>hello</h1>
	</div>
</main>

<style>
.split {
	display: flex;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

.pane {
	overflow: auto;
	min-width: 0;
}

.pane.right {
	flex: 1;
	display: flex;
	flex-direction: column;
	padding: 0px;
	box-sizing: border-box;
}

.divider {
	flex: 0 0 6px;
	background-color: #cccccc;
	cursor: col-resize;
	touch-action: none;
}

.divider:hover,
.divider:focus-visible,
.divider.active {
	background-color: #396cd8;
}

.divider:focus-visible {
	outline: 2px solid #396cd8;
	outline-offset: 2px;
}

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
