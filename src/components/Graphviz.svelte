<script lang="ts">
import { graphviz } from "d3-graphviz";
import { onMount } from "svelte";

type Renderer = ReturnType<typeof graphviz>;
type Datum = {
	tag: string;
	attributes?: Record<string, string>;
	parent?: { attributes?: Record<string, string> };
};

let {
	dot,
	error = $bindable(""),
	onselect,
}: { dot: string; error?: string; onselect: (id: number) => void } = $props();

let el: HTMLDivElement;
let graph = $state.raw<Renderer>();
let frame = 0;
let lastRender = "";
let rendering = false;
let mounted = false;

onMount(() => {
	mounted = true;
	graph = graphviz(el, { fit: true, zoom: true, useWorker: false }).onerror(
		(message: unknown) => {
			if (!mounted) return;
			rendering = false;
			error = String(message);
		},
	);
	const observer = new ResizeObserver(scheduleRender);
	observer.observe(el);
	el.addEventListener("click", selectNode);

	return () => {
		mounted = false;
		observer.disconnect();
		el.removeEventListener("click", selectNode);
		cancelAnimationFrame(frame);
		graph?.destroy();
	};
});

$effect(() => {
	if (dot && graph) scheduleRender();
});

function scheduleRender() {
	cancelAnimationFrame(frame);
	frame = requestAnimationFrame(render);
}

function render() {
	if (!mounted || !graph || rendering || !el.clientWidth || !el.clientHeight)
		return;
	const key = `${el.clientWidth}:${el.clientHeight}:${dot}`;
	if (key === lastRender) return;
	lastRender = key;
	rendering = true;
	error = "";
	graph
		.width(el.clientWidth)
		.height(el.clientHeight)
		.attributer(recolour)
		.renderDot(dot, () => {
			if (!mounted) return;
			rendering = false;
			scheduleRender();
		});
}

function recolour(datum: Datum) {
	const attrs = datum.attributes;
	if (
		!attrs ||
		datum.tag !== "polygon" ||
		datum.parent?.attributes?.class !== "graph"
	)
		return;
	attrs.fill = "transparent";
	attrs.stroke = "transparent";
}

function selectNode(event: MouseEvent) {
	if (!(event.target instanceof Element)) return;
	const node = event.target.closest("g.node[id^='course-']");
	if (node) onselect(Number(node.id.slice("course-".length)));
}

export function scale(factor: number) {
	const zoom = graph?.zoomBehavior();
	const selection = graph?.zoomSelection();
	// The installed d3-graphviz returns a D3 selection. Its declaration describes a DOM element.
	if (zoom && selection)
		zoom.scaleBy(
			selection as unknown as Parameters<typeof zoom.scaleBy>[0],
			factor,
		);
}

export function reset() {
	if (graph?.zoomBehavior()) graph.resetZoom();
}
</script>

<div class="graph" bind:this={el}></div>

<style>
.graph {
	position: absolute;
	inset: 0;
}
.graph :global(svg) {
	display: block;
}
.graph :global(g.node) {
	cursor: pointer;
}
.graph :global(g.node:hover path),
.graph :global(g.node:hover polygon) {
	stroke: #2365b8;
	stroke-width: 2;
}
</style>
