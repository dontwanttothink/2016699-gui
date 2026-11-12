<script lang="ts">
import type { Snippet } from "svelte";
import { onMount } from "svelte";

const MIN_LEFT_WIDTH = 160;
const MIN_RIGHT_WIDTH = 280;
const KEY_STEP = 16;

const {
	left,
	right,
	initialWidth = 60,
}: {
	left: Snippet;
	right: Snippet;
	/** Ancho inicial del panel izquierdo, como porcentaje del contenedor */
	initialWidth?: number;
} = $props();

const uid = $props.id();
const paneId = `split-pane-${uid}`;

let container: HTMLElement;
let divider: HTMLElement;
let containerWidth = $state(0);
let dividerWidth = $state(0);
let leftWidth = $state(0);
let dragging = $state(false);

const leftMax = $derived(
	Math.max(MIN_LEFT_WIDTH, containerWidth - dividerWidth - MIN_RIGHT_WIDTH),
);

function clamp(value: number) {
	return Math.min(leftMax, Math.max(MIN_LEFT_WIDTH, value));
}

function measure() {
	containerWidth = container.getBoundingClientRect().width;
	dividerWidth = divider.getBoundingClientRect().width;
}

onMount(() => {
	measure();
	leftWidth = clamp((containerWidth * initialWidth) / 100);

	const observer = new ResizeObserver(() => {
		measure();
		leftWidth = clamp(leftWidth);
	});
	observer.observe(container);
	return () => observer.disconnect();
});

function startDrag(event: PointerEvent) {
	dragging = true;
	event.preventDefault();
	(event.target as HTMLElement).setPointerCapture(event.pointerId);
}

function drag(event: PointerEvent) {
	if (!dragging) return;
	leftWidth = clamp(event.clientX - container.getBoundingClientRect().left);
}

function stopDrag() {
	dragging = false;
}

function onKeyDown(event: KeyboardEvent) {
	switch (event.key) {
		case "ArrowLeft":
			leftWidth = clamp(leftWidth - KEY_STEP);
			break;
		case "ArrowRight":
			leftWidth = clamp(leftWidth + KEY_STEP);
			break;
		case "Home":
			leftWidth = MIN_LEFT_WIDTH;
			break;
		case "End":
			leftWidth = leftMax;
			break;
		default:
			return;
	}
	event.preventDefault();
}
</script>

<main
	class="split"
	bind:this={container}
	style="--min-left: {MIN_LEFT_WIDTH}px; --min-right: {MIN_RIGHT_WIDTH}px"
>
	<div id={paneId} class="pane left" style="width: {leftWidth}px">
		{@render left()}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<!-- biome-ignore lint/a11y/useSemanticElements: there doesn't seem to actually be a more appropriate element unfortunately -->
	<div
		bind:this={divider}
		class="divider"
		class:active={dragging}
		role="separator"
		tabindex="0"
		aria-label="Resize panels"
		aria-orientation="vertical"
		aria-controls={paneId}
		aria-valuenow={Math.round(leftWidth)}
		aria-valuemin={MIN_LEFT_WIDTH}
		aria-valuemax={leftMax}
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
}

.pane.left {
	min-width: var(--min-left);
}

.pane.right {
	flex: 1;
	display: flex;
	flex-direction: column;
	padding: 0px;
	box-sizing: border-box;
	min-width: var(--min-right);
}

.divider {
	flex: 0 0 3px;
	height: calc(100% - 2.3em);
	align-self: center;
	background-color: var(--border);
	border-radius: 3px;
	cursor: col-resize;
	touch-action: none;
	transition: background-color 100ms ease;
}
</style>
