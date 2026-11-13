<script lang="ts">
import { CircleAlert, Plus, Trash2, X } from "@lucide/svelte";
import { onMount, tick } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import {
	createPrerequisiteRow,
	creditsMessage,
	creditsProblem,
	idProblem,
	type PrerequisiteProblem,
	type PrerequisiteRow,
	prerequisiteProblems,
	stripUnsafeName,
} from "#lib/courseDraft.ts";

const PRIORITY: PrerequisiteProblem[] = [
	"notInteger",
	"self",
	"repeated",
	"unknown",
];

const MESSAGES: Record<PrerequisiteProblem, (unknownCount: number) => string> =
	{
		notInteger: () => "Un prerrequisito no es un ID válido.",
		self: () => "Una materia no puede ser prerrequisito de sí misma.",
		repeated: () => "Un prerrequisito aparece repetido.",
		unknown: (count) =>
			count === 1
				? "Un prerrequisito no corresponde a ninguna materia."
				: `${count} prerrequisitos no corresponden a ninguna materia.`,
	};

let {
	name = $bindable(""),
	id = $bindable(""),
	credits = $bindable(""),
	prerequisites = $bindable([]),
	counts,
	semesterLimit,
	focusOnMount = false,
	onremove,
}: {
	name?: string;
	id?: string;
	credits?: string;
	prerequisites?: PrerequisiteRow[];
	counts: ReadonlyMap<number, number>;
	semesterLimit: number;
	focusOnMount?: boolean;
	onremove: () => void;
} = $props();

const uid = $props.id();
const idMessageId = `${uid}-id-message`;
const creditsMessageId = `${uid}-credits-message`;
const summaryId = `${uid}-summary`;

const touched = new SvelteSet<string>();
let nameInput: HTMLTextAreaElement;
let addButton: HTMLButtonElement;
const rowInputs: Record<string, HTMLInputElement | undefined> = {};

onMount(() => {
	if (focusOnMount) nameInput.focus();
});

function addRow() {
	const row = createPrerequisiteRow();
	prerequisites.push(row);
	tick().then(() => rowInputs[row.uid]?.focus());
}

function removeRow(index: number) {
	const next = prerequisites[index + 1] ?? prerequisites[index - 1];
	prerequisites.splice(index, 1);
	tick().then(() => (next ? rowInputs[next.uid] : addButton)?.focus());
}

function keepSingleLine(event: KeyboardEvent) {
	if (event.key === "Enter") event.preventDefault();
}

function cleanName(event: Event) {
	const field = event.currentTarget as HTMLTextAreaElement;
	name = stripUnsafeName(field.value);
	field.value = name;
}

const idMessage = $derived.by(() => {
	if (!touched.has("id")) return null;
	const problem = idProblem(id, counts);
	if (problem === "notInteger") return "El ID debe ser un número entero.";
	if (problem === "taken") return "Esta ID ya la usa otra materia.";
	return null;
});

const creditsError = $derived.by(() => {
	if (!touched.has("credits")) return null;
	const problem = creditsProblem(credits, semesterLimit);
	return problem === null || problem === "empty"
		? null
		: creditsMessage(problem, semesterLimit);
});

const problems = $derived(prerequisiteProblems(id, prerequisites, counts));

function shownProblem(index: number): PrerequisiteProblem | null {
	return touched.has(prerequisites[index].uid) ? problems[index] : null;
}

const summary = $derived.by(() => {
	const shown = prerequisites.flatMap((row, index) => {
		const problem = shownProblem(index);
		return problem ? [problem] : [];
	});
	const worst = PRIORITY.find((problem) => shown.includes(problem));
	if (worst === undefined) return null;
	const unknownCount = shown.filter((problem) => problem === "unknown").length;
	return `${MESSAGES[worst](unknownCount)} Revise los IDs tachados.`;
});
</script>

<article class="course">
	<button
		type="button"
		class="delete"
		aria-label="Eliminar materia"
		onclick={onremove}
	>
		<Trash2 size={16} aria-hidden="true" />
	</button>

	<div class="name-field" data-value={name}>
		<textarea
			bind:this={nameInput}
			class="name"
			rows="1"
			placeholder="Nombre"
			aria-label="Nombre de la materia"
			value={name}
			oninput={cleanName}
			onkeydown={keepSingleLine}
		></textarea>
	</div>

	<div class="fields">
		<label class="field id-field">
			<span>ID</span>
			<input
				class:invalid={idMessage !== null}
				type="text"
				inputmode="numeric"
				bind:value={id}
				aria-invalid={idMessage !== null ? "true" : undefined}
				aria-describedby={idMessage !== null ? idMessageId : undefined}
				onblur={() => touched.add("id")}
			>
		</label>
		<label class="field credits-field">
			<span>Créditos</span>
			<input
				class:invalid={creditsError !== null}
				type="text"
				inputmode="numeric"
				bind:value={credits}
				aria-invalid={creditsError !== null ? "true" : undefined}
				aria-describedby={creditsError !== null ? creditsMessageId : undefined}
				onblur={() => touched.add("credits")}
			>
		</label>
	</div>
	{#if idMessage}
		<p class="feedback message" id={idMessageId}>
			<CircleAlert aria-hidden="true" />
			{idMessage}
		</p>
	{/if}
	{#if creditsError}
		<p class="feedback message" id={creditsMessageId}>
			<CircleAlert aria-hidden="true" />
			{creditsError}
		</p>
	{/if}

	<fieldset class="prerequisites">
		<legend>Prerrequisitos</legend>
		{#if prerequisites.length === 0}
			<p class="empty">(Ninguno)</p>
		{:else}
			<ul>
				{#each prerequisites as row, index (row.uid)}
					{@const problem = shownProblem(index)}
					<li class="prerequisite">
						<input
							bind:this={rowInputs[row.uid]}
							class:invalid={problem !== null}
							type="text"
							inputmode="numeric"
							aria-label="Prerrequisito {index + 1}"
							aria-invalid={problem !== null ? "true" : undefined}
							aria-describedby={problem !== null ? summaryId : undefined}
							bind:value={row.value}
							onblur={() => touched.add(row.uid)}
						>
						<button
							type="button"
							class="remove"
							aria-label="Quitar prerrequisito {index + 1}"
							onclick={() => removeRow(index)}
						>
							<X size={16} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<button
			bind:this={addButton}
			type="button"
			class="add-prerequisite"
			onclick={addRow}
		>
			<Plus size={16} aria-hidden="true" />
			Agregar prerrequisito
		</button>
	</fieldset>

	{#if summary}
		<p class="feedback summary" id={summaryId} role="alert">
			<CircleAlert aria-hidden="true" />
			{summary}
		</p>
	{/if}
</article>

<style>
.course {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	width: 100%;
	max-width: 24rem;
	box-sizing: border-box;
	padding: 0.75rem 1.25rem;
	border-radius: 1rem;
	border: 1px solid var(--border);
	background-color: var(--surface);
	box-shadow: var(--shadow);
}

.delete {
	position: absolute;
	top: 0.5rem;
	right: 0.5rem;
	padding: 0.25em;
	background: none;
	box-shadow: none;
	border: none;
	color: var(--muted);
}

.name-field {
	display: grid;
	padding-inline: 1.5em;
	font-size: var(--font-size-lg);
	font-weight: 600;
}

.name-field::after {
	content: attr(data-value) " ";
	grid-area: 1 / 1;
	padding: 0.1em 0;
	border-bottom: 1px solid transparent;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	visibility: hidden;
}

.name {
	grid-area: 1 / 1;
	resize: none;
	overflow: hidden;
	overflow-wrap: anywhere;
	color: inherit;
	font: inherit;
	text-align: center;
}

.name::placeholder {
	color: var(--subtle);
	font-weight: 400;
}

.fields {
	display: flex;
	gap: 1rem;
}

.field {
	display: flex;
	align-items: baseline;
	gap: 0.5rem;
	font-size: var(--font-size-sm);
}

.field span {
	color: var(--muted);
}

.field input {
	flex: 1;
	width: 0;
}

.id-field {
	flex: 1;
	min-width: 0;
}

.credits-field {
	flex: none;
}

.credits-field input {
	flex: none;
	width: 2em;
	text-align: right;
}

.message {
	color: var(--muted);
}

.prerequisites {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	margin: 0;
	padding: 0;
	border: none;
	font-size: var(--font-size-sm);
}

.prerequisites legend {
	padding: 0;
	color: var(--muted);
}

.empty {
	margin: 0.5em;
	text-align: center;
	color: var(--subtle);
}

.prerequisites ul {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.prerequisite {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.prerequisite input {
	flex: 1;
	width: 0;
}

.remove {
	padding: 0.25em;
	background: none;
	box-shadow: none;
	border: none;
	color: var(--muted);
}

.add-prerequisite {
	align-self: center;
	margin-top: 0.5rem;
	font-size: var(--font-size-sm);
}
</style>
