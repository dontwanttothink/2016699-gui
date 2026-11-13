<script lang="ts">
import { graphviz } from "d3-graphviz";
import { transition } from "d3-transition";
import { onMount } from "svelte";
import { MediaQuery } from "svelte/reactivity";

let {
	body,
	duration = 500,
	error = $bindable(""),
}: {
	/** Nodos y aristas en DOT, sin el `digraph { }` que los envuelve */
	body: string;
	/** Duración en milisegundos de la animación entre un grafo y el siguiente */
	duration?: number;
	error?: string;
} = $props();

const FONT = "Figtree Variable";

// Esto es necesario para impedir problemas con las animaciones.
const debounce = $derived(duration / 2);

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
			const length = instant ? 0 : duration;
			instant = false;
			return transition("graph").duration(length);
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
	const delay = debounce;
	if (!ready) return;
	const timer = setTimeout(() => render(source), delay);
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
