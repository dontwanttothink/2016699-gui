<script lang="ts">
import { graphviz } from "d3-graphviz";
import { onMount } from "svelte";

let {
	dot,
	error = $bindable(""),
}: {
	dot: string;
	error?: string;
} = $props();

let el: HTMLElement;
let graph: ReturnType<typeof graphviz> | undefined = $state.raw();

onMount(() => {
	graph = graphviz(el, { fit: true, zoom: true }).onerror(
		(message: unknown) => {
			error = String(message);
		},
	);

	const observer = new ResizeObserver(() => render(dot));
	observer.observe(el);

	return () => {
		observer.disconnect();
		graph?.destroy();
	};
});

$effect(() => {
	error = "";
	render(dot);
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
