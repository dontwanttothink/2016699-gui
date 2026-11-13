<script lang="ts">
import { GraduationCap, Plus } from "@lucide/svelte";
import { message } from "@tauri-apps/plugin-dialog";
import { tick } from "svelte";
import { MediaQuery } from "svelte/reactivity";
// import { invoke } from "@tauri-apps/api/core";
import EditableCourse from "#components/EditableCourse.svelte";
import Graphviz from "#components/Graphviz.svelte";
import SplitPane from "#components/SplitPane.svelte";
import {
	type CourseDraft,
	checkCourses,
	createCourseDraft,
	idCounts,
	toDotBody,
} from "#lib/courseDraft.ts";

const darkScheme = new MediaQuery("prefers-color-scheme: dark");
const foreground = $derived(darkScheme.current ? "#ffffff" : "#0f0f0f");
const font = "Figtree Variable";

let courses = $state<CourseDraft[]>([]);
const body = $derived(toDotBody(courses));
const dot = $derived(
	`digraph { bgcolor=transparent; graph [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; node [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; edge [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; ${body}\n}`,
);
let errorMsg = $state("");

let newestUid = $state<string | null>(null);
let editorEl: HTMLDivElement;
let addButton: HTMLButtonElement;

const counts = $derived(idCounts(courses));

function addCourse() {
	const course = createCourseDraft();
	courses.push(course);
	newestUid = course.uid;
}

async function plan() {
	if (courses.length === 0) {
		await message("Agregue al menos una materia.", {
			title: "Revise las materias",
			kind: "warning",
		});
		return;
	}

	const { missing, issues } = checkCourses(courses);
	const problems: string[] = [];
	if (missing === 1) {
		problems.push("Una materia no tiene nombre o ID.");
	} else if (missing > 1) {
		problems.push(`${missing} materias no tienen nombre o ID.`);
	}
	if (issues === 1) {
		problems.push("Una materia tiene problemas en su ID o prerrequisitos.");
	} else if (issues > 1) {
		problems.push(
			`${issues} materias tienen problemas en su ID o prerrequisitos.`,
		);
	}
	if (problems.length === 0) return;

	await message(`${problems.join("\n")}`, {
		title: "Revise las materias",
		kind: "warning",
	});
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
		{#if body === ""}
			<div class="empty">
				<GraduationCap size={96} strokeWidth={1.25} aria-hidden="true" />
			</div>
		{:else}
			<Graphviz {dot} bind:error={errorMsg} />
		{/if}
	{/snippet}

	{#snippet right()}
		<div class="course-editor-container" bind:this={editorEl}>
			{#each courses as course, index (course.uid)}
				<EditableCourse
					bind:name={course.name}
					bind:id={course.id}
					bind:prerequisites={course.prerequisites}
					{counts}
					focusOnMount={course.uid === newestUid}
					onremove={() => removeCourse(index)}
				/>
			{/each}
			<button type="button" bind:this={addButton} onclick={addCourse}>
				<Plus size={16} aria-hidden="true" />
				Agregar curso
			</button>
			<button type="button" class="plan" onclick={plan}>Planear</button>
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

.empty {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--subtle);
}

.plan {
	width: 100%;
	max-width: 24rem;
	justify-content: center;
	margin-top: auto;
	padding: 0.8em 1.5em;
	font-size: var(--font-size-lg);
	font-weight: 600;
	color: #ffffff;
	background-color: var(--accent);
	border-color: var(--accent);
}

.plan:active {
	background-color: var(--accent);
	filter: brightness(0.9);
}
</style>
