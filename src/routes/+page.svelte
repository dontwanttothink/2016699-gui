<script lang="ts">
import { Plus } from "@lucide/svelte";
import { tick } from "svelte";
import { MediaQuery } from "svelte/reactivity";
// import { invoke } from "@tauri-apps/api/core";
import EditableCourse from "#components/EditableCourse.svelte";
import Graphviz from "#components/Graphviz.svelte";
import SplitPane from "#components/SplitPane.svelte";
import {
	type CourseDraft,
	createCourseDraft,
	parseId,
} from "#lib/courseDraft.ts";

const darkScheme = new MediaQuery("prefers-color-scheme: dark");
const foreground = $derived(darkScheme.current ? "#ffffff" : "#0f0f0f");
const font = "Figtree Variable";

let body = $state("a -> b; b -> c");
const dot = $derived(
	`digraph { bgcolor=transparent; graph [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; node [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; edge [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; ${body}\n}`,
);
let errorMsg = $state("");

let courses = $state<CourseDraft[]>([]);
let newestUid = $state<string | null>(null);
let editorEl: HTMLDivElement;
let addButton: HTMLButtonElement;

const knownIds = $derived(
	new Set(
		courses
			.map((course) => parseId(course.id))
			.filter((n): n is number => n !== null),
	),
);

const idCounts = $derived.by(() => {
	const counts = new Map<number, number>();
	for (const course of courses) {
		const n = parseId(course.id);
		if (n !== null) counts.set(n, (counts.get(n) ?? 0) + 1);
	}
	return counts;
});

function isIdTaken(course: CourseDraft) {
	const n = parseId(course.id);
	return n !== null && (idCounts.get(n) ?? 0) > 1;
}

function addCourse() {
	const course = createCourseDraft();
	courses.push(course);
	newestUid = course.uid;
}

function removeCourse(index: number) {
	courses.splice(index, 1);
	tick().then(() => {
		const names = editorEl.querySelectorAll<HTMLTextAreaElement>(".name");
		(names[index] ?? names[index - 1] ?? addButton).focus();
	});
}
</script>

<SplitPane>
	{#snippet left()}
		<Graphviz {dot} bind:error={errorMsg} />
	{/snippet}

	{#snippet right()}
		<div class="course-editor-container" bind:this={editorEl}>
			{#each courses as course, index (course.uid)}
				<EditableCourse
					bind:name={course.name}
					bind:id={course.id}
					bind:prerequisites={course.prerequisites}
					{knownIds}
					idTaken={isIdTaken(course)}
					focusOnMount={course.uid === newestUid}
					onremove={() => removeCourse(index)}
				/>
			{/each}
			<button type="button" bind:this={addButton} onclick={addCourse}>
				<Plus size={16} aria-hidden="true" />
				Agregar curso
			</button>
		</div>
	{/snippet}
</SplitPane>

<style>
.course-editor-container {
	padding: 1.5rem;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1.25rem;
}
</style>
