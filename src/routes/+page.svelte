<script lang="ts">
// import { invoke } from "@tauri-apps/api/core";
import Graphviz from "#components/Graphviz.svelte";
import SplitPane from "#components/SplitPane.svelte";

let dot = $state("digraph { a -> b }");
let errorMsg = $state("");
</script>

<SplitPane>
	{#snippet left()}
		<Graphviz {dot} bind:error={errorMsg} />
	{/snippet}

	{#snippet right()}
		<h1>hello</h1>
	{/snippet}
</SplitPane>

<style>
h1 {
	text-align: center;
}
</style>
