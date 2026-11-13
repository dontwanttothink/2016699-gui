import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { toCourseDrafts } from "#lib/courseDraft.ts";
import { ParseError, parseCourses } from "#lib/curriculum.ts";
import { editor } from "#lib/editor.svelte.ts";
import { goto } from "$app/navigation";

async function showError(text: string) {
	await message(text, { title: "No se pudo cargar el archivo", kind: "error" });
}

export async function loadCoursesFile() {
	let text: string | null;
	try {
		text = await invoke<string | null>("pick_courses_file");
	} catch (error) {
		await showError(String(error));
		return;
	}
	if (text === null) return;

	const courses = parseCourses(text);
	if (courses instanceof ParseError) {
		await showError(courses.message);
		return;
	}

	editor.courses.splice(0, editor.courses.length, ...toCourseDrafts(courses));
	await goto("/");
}
