<script lang="ts">
import { graphviz } from "d3-graphviz";
import { onMount } from "svelte";
import { MediaQuery } from "svelte/reactivity";

type Datum = {
	tag: string;
	attributes: Record<string, string>;
	parent?: { attributes: Record<string, string> };
};

let {
	dot,
	error = $bindable(""),
}: {
	dot: string;
	error?: string;
} = $props();

let el: HTMLElement;
let graph: ReturnType<typeof graphviz> | undefined = $state.raw();

const darkScheme = new MediaQuery("prefers-color-scheme: dark");
const foreground = $derived(darkScheme.current ? "#ffffff" : "#0f0f0f");

onMount(() => {
	graph = graphviz(el, { fit: true, zoom: true }).onerror(
		(message: unknown) => {
			error = String(message);
		},
	);

	const observer = new ResizeObserver(() => render(dot, foreground));
	observer.observe(el);

	return () => {
		observer.disconnect();
		graph?.destroy();
	};
});

$effect(() => {
	error = "";
	render(dot, foreground);
});

function render(src: string, fg: string) {
	graph
		?.width(el.clientWidth)
		.height(el.clientHeight)
		.attributer((d: Datum) => recolour(d, fg))
		.renderDot(src);
}

function recolour(d: Datum, fg: string) {
	if (d.tag === "polygon" && d.parent?.attributes.class === "graph") {
		d.attributes.fill = "transparent";
		d.attributes.stroke = "transparent";
		return;
	}

	if (d.attributes.stroke === "black") {
		d.attributes.stroke = fg;
	}

	if (
		(!d.attributes.fill || d.attributes.fill === "black") &&
		(d.tag === "text" || d.parent?.attributes.class === "edge")
	) {
		d.attributes.fill = fg;
	}
}
</script>

<div class="graph" bind:this={el}></div>

<style>
.graph {
	width: 100%;
	height: 100%;
}

.graph :global(svg) {
	display: block;
}
</style>
