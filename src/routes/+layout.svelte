<script lang="ts">
import "../app.css";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onMount } from "svelte";
import { loadCoursesFile } from "#lib/loadCourses.ts";

const { children } = $props();

onMount(() => {
	getCurrentWindow().show().catch(console.error);
	const unlisten = listen("load-courses", loadCoursesFile);
	return () => {
		unlisten.then((stop) => stop());
	};
});
</script>

{@render children()}
