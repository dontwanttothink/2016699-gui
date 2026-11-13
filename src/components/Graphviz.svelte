<script lang="ts">
import { graphviz } from "d3-graphviz";
import { transition } from "d3-transition";
import { onMount } from "svelte";
import { MediaQuery } from "svelte/reactivity";

let {
	body,
	error = $bindable(""),
}: {
	/** Nodos y aristas en DOT, sin el `digraph { }` que los envuelve */
	body: string;
	error?: string;
} = $props();

const RENDER_DEBOUNCE_MS = 250;
const FONT = "Figtree Variable";

const darkScheme = new MediaQuery("prefers-color-scheme: dark");
const foreground = $derived(darkScheme.current ? "#ffffff" : "#0f0f0f");
const style = $derived(
	`color="${foreground}", fontcolor="${foreground}", fontname="${FONT}"`,
);
const dot = $derived(
	`digraph { bgcolor=transparent; graph [${style}]; node [${style}]; edge [${style}]; ${body}\n}`,
);

let el: HTMLElement;
let graph: ReturnType<typeof graphviz> | undefined = $state.raw();
let instant = false;
let ready = false;

onMount(() => {
	graph = graphviz(el, { fit: true, zoom: true, useWorker: false })
		.transition(() => {
			const duration = instant ? 0 : 500;
			instant = false;
			return transition("graph").duration(duration);
		})
		.onerror((message: unknown) => {
			error = String(message);
		});

	const observer = new ResizeObserver(() => {
		instant = true;
		ready = true;
		render(dot);
	});
	observer.observe(el);

	return () => {
		observer.disconnect();
		graph?.destroy();
	};
});

$effect(() => {
	error = "";
	const source = dot;
	if (!ready) return;
	const timer = setTimeout(() => render(source), RENDER_DEBOUNCE_MS);
	return () => clearTimeout(timer);
});

function render(src: string) {
	graph?.width(el.clientWidth).height(el.clientHeight).renderDot(src);
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
