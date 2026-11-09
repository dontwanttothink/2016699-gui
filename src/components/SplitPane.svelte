<script lang="ts">
import type { Snippet } from "svelte";

const MIN_WIDTH = 10;
const MAX_WIDTH = 80;
const KEY_STEP = 5;

const {
	left,
	right,
	initialWidth = 70,
}: {
	left: Snippet;
	right: Snippet;
	initialWidth?: number;
} = $props();

const uid = $props.id();
const paneId = `split-pane-${uid}`;

let container: HTMLElement;
// svelte-ignore state_referenced_locally: we can't be reactive to that
let leftWidth = $state(clampWidth(initialWidth));
let dragging = $state(false);

function clampWidth(value: number) {
	return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

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
	<div id={paneId} class="pane left" style="width: {leftWidth}%">
		{@render left()}
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
		aria-controls={paneId}
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
		{@render right()}
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
</style>
