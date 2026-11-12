<script lang="ts">
import { MediaQuery } from "svelte/reactivity";
// import { invoke } from "@tauri-apps/api/core";
import Graphviz from "#components/Graphviz.svelte";
import SplitPane from "#components/SplitPane.svelte";

const darkScheme = new MediaQuery("prefers-color-scheme: dark");
const foreground = $derived(darkScheme.current ? "#ffffff" : "#0f0f0f");
const font = "Figtree Variable";

let body = $state("a -> b; b -> c");
const dot = $derived(
	`digraph { bgcolor=transparent; graph [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; node [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; edge [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; ${body}\n}`,
);
let errorMsg = $state("");
</script>

<SplitPane>
	{#snippet left()}
		<Graphviz {dot} bind:error={errorMsg} />
	{/snippet}

	{#snippet right()}
		<div style:padding="1em">
			<h1>hello</h1>
		</div>
	{/snippet}
</SplitPane>

<style>
</style>
