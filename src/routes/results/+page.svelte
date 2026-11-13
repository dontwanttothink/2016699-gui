<script lang="ts">
import { getPlanResult } from "#lib/planResult.svelte.ts";
import { goto } from "$app/navigation";

const result = $derived(getPlanResult());

$effect(() => {
	if (result === null) goto("/", { replaceState: true });
});
</script>

{#if result}
	<main class="results">
		<p class="json">{JSON.stringify(result.semesters, null, 2)}</p>
		<button type="button" onclick={() => goto("/")}>Volver</button>
	</main>
{/if}

<style>
.results {
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1.25rem;
}

.json {
	white-space: pre-wrap;
	font-family: ui-monospace, monospace;
	font-size: var(--font-size-sm);
}
</style>
