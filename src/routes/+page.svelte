<script lang="ts">
import { CircleAlert, GraduationCap, Plus } from "@lucide/svelte";
import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { tick } from "svelte";
import { MediaQuery } from "svelte/reactivity";
import EditableCourse from "#components/EditableCourse.svelte";
import Graphviz from "#components/Graphviz.svelte";
import SplitPane from "#components/SplitPane.svelte";
import {
	checkCourses,
	createCourseDraft,
	creditsMessage,
	creditsProblem,
	idCounts,
	MAX_CREDITS,
	semesterLimit,
	toDotBody,
	toPlannerInput,
} from "#lib/courseDraft.ts";
import { editor } from "#lib/editor.svelte.ts";
import { setPlanResult } from "#lib/planResult.svelte.ts";
import { parseVerbose } from "#lib/verbose.ts";
import { goto } from "$app/navigation";

type PlannerError = { kind: "impossible" | "failed"; message: string };

const darkScheme = new MediaQuery("prefers-color-scheme: dark");
const foreground = $derived(darkScheme.current ? "#ffffff" : "#0f0f0f");
const font = "Figtree Variable";

const courses = editor.courses;
const body = $derived(toDotBody(courses));
const dot = $derived(
	`digraph { bgcolor=transparent; graph [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; node [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; edge [color="${foreground}", fontcolor="${foreground}", fontname="${font}"]; ${body}\n}`,
);
let errorMsg = $state("");

let newestUid = $state<string | null>(null);
let editorEl: HTMLDivElement;
let addButton: HTMLButtonElement;

const counts = $derived(idCounts(courses));
const limit = $derived(semesterLimit(editor.maxCredits));

let maxCreditsTouched = $state(false);
const maxCreditsError = $derived.by(() => {
	if (!maxCreditsTouched) return null;
	const problem = creditsProblem(editor.maxCredits, MAX_CREDITS);
	return problem === null ? null : creditsMessage(problem, MAX_CREDITS);
});

function addCourse() {
	const course = createCourseDraft();
	courses.push(course);
	newestUid = course.uid;
}

async function plan() {
	const problems: string[] = [];
	if (courses.length === 0) {
		problems.push("Agregue al menos una materia.");
	} else {
		const { missing, issues } = checkCourses(courses, limit);
		if (missing === 1) {
			problems.push("Una materia no tiene nombre, ID o créditos.");
		} else if (missing > 1) {
			problems.push(`${missing} materias no tienen nombre, ID o créditos.`);
		}
		if (issues === 1) {
			problems.push(
				"Una materia tiene problemas en su ID, créditos o prerrequisitos.",
			);
		} else if (issues > 1) {
			problems.push(
				`${issues} materias tienen problemas en su ID, créditos o prerrequisitos.`,
			);
		}
	}
	const maxProblem = creditsProblem(editor.maxCredits, MAX_CREDITS);
	if (maxProblem !== null) {
		problems.push(
			`Máximo de créditos por semestre: ${creditsMessage(maxProblem, MAX_CREDITS)}`,
		);
	}
	if (problems.length > 0) {
		await message(`${problems.join("\n")}`, {
			title: "Revise las materias",
			kind: "warning",
		});
		return;
	}

	let output: string;
	try {
		output = await invoke<string>("run_planner", {
			input: toPlannerInput(courses),
			algorithm: editor.algorithm,
			maxCredits: Number(editor.maxCredits),
			verbose: true,
		});
	} catch (error) {
		const { kind, message: text } = error as PlannerError;
		await message(text || "Revise las materias.", {
			title:
				kind === "impossible" ? "No es posible planear" : "Error al planear",
			kind: "error",
		});
		return;
	}

	setPlanResult(parseVerbose(output));
	await goto("/results");
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
					bind:credits={course.credits}
					bind:prerequisites={course.prerequisites}
					{counts}
					semesterLimit={limit}
					focusOnMount={course.uid === newestUid}
					onremove={() => removeCourse(index)}
				/>
			{/each}
			<button type="button" bind:this={addButton} onclick={addCourse}>
				<Plus size={16} aria-hidden="true" />
				Agregar curso
			</button>
			<div class="settings">
				<label class="setting">
					<span>Máximo de créditos por semestre</span>
					<input
						class:invalid={maxCreditsError !== null}
						type="text"
						inputmode="numeric"
						bind:value={editor.maxCredits}
						aria-invalid={maxCreditsError !== null ? "true" : undefined}
						aria-describedby={maxCreditsError !== null
							? "max-credits-message"
							: undefined}
						onblur={() => (maxCreditsTouched = true)}
					>
				</label>
				{#if maxCreditsError}
					<p class="feedback message" id="max-credits-message">
						<CircleAlert aria-hidden="true" />
						{maxCreditsError}
					</p>
				{/if}
				<label class="setting">
					<span>Algoritmo</span>
					<select bind:value={editor.algorithm}>
						<option value="list">Lista</option>
						<option value="heap">Montículo</option>
					</select>
				</label>
			</div>
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

.settings {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	width: 100%;
	max-width: 24rem;
	padding-top: 1.25rem;
	border-top: 1px solid var(--border);
	font-size: var(--font-size-sm);
}

.setting {
	display: flex;
	align-items: last baseline;
	justify-content: space-between;
	gap: 0.5rem;
}

.setting span {
	color: var(--muted);
}

.setting input {
	flex: none;
	width: 3.5em;
	text-align: right;
}

.setting select {
	font: inherit;
	color: inherit;
	background-color: var(--surface);
	border: 1px solid var(--border);
	border-radius: 0.5em;
	padding: 0.2em 0.4em;
}

.message {
	color: var(--muted);
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
