// @ts-expect-error Node types are not installed in the frontend project.
import { execFile } from "node:child_process";
// @ts-expect-error Node types are not installed in the frontend project.
import { resolve } from "node:path";
// @ts-expect-error Node types are not installed in the frontend project.
import process from "node:process";
import { exportJava, parsePlan } from "../src/lib/curriculum.ts";

/**
 * @typedef {AsyncIterable<string> & {
 *   headers: Record<string, string | undefined>,
 *   method?: string,
 *   setEncoding: (encoding: string) => void
 * }} RequestStream
 */

/** @returns {import("vite").Plugin} */
export function javaPlanner() {
	const configured = process.env.GRADUACION_JAVA_JAR;
	const jar = configured ? resolve(configured) : null;
	let running = false;
	return {
		name: "graduacion-java",
		configureServer(server) {
			server.middlewares.use(
				"/_graduacion/java",
				async (incoming, response) => {
					const request = /** @type {RequestStream} */ (
						/** @type {unknown} */ (incoming)
					);
					const send = (
						/** @type {number} */ status,
						/** @type {object} */ data,
					) => {
						response.statusCode = status;
						response.setHeader(
							"Content-Type",
							"application/json; charset=utf-8",
						);
						response.setHeader("Cache-Control", "no-store");
						response.end(JSON.stringify(data));
					};
					const host = request.headers.host ?? "";
					const loopback = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(
						host,
					);
					if (
						!loopback ||
						request.method !== "POST" ||
						request.headers.origin !== `http://${host}` ||
						request.headers["content-type"] !== "application/json"
					)
						return send(403, {
							error:
								"La conexión Java requiere la GUI abierta desde localhost.",
						});
					if (!jar)
						return send(503, {
							error:
								"Configura GRADUACION_JAVA_JAR antes de iniciar Vite para usar el núcleo Java.",
						});
					if (running)
						return send(429, {
							error: "Java está procesando otro cálculo. Intenta de nuevo.",
						});

					running = true;
					try {
						let body = "";
						request.setEncoding("utf8");
						for await (const chunk of request) {
							body += chunk;
							if (body.length > 250_000) {
								send(413, {
									error: "El plan supera el tamaño admitido por Java.",
								});
								return;
							}
						}
						const data = JSON.parse(body);
						const algorithm = data.algorithm;
						if (algorithm !== "0" && algorithm !== "1")
							return send(400, { error: "Algoritmo desconocido." });
						const { courses } = parsePlan(
							JSON.stringify({
								version: 1,
								courses: data.courses,
								limits: { courses: 120, credits: 20 },
							}),
						);
						if (
							!courses.length ||
							courses.some((course) => course.credits > 20)
						) {
							return send(400, {
								error:
									"Java requiere un plan con asignaturas de hasta 20 créditos.",
							});
						}
						const input = exportJava(courses);
						const stdout = await new Promise((done, fail) => {
							const child = execFile(
								"java",
								[
									"-Dfile.encoding=UTF-8",
									"-jar",
									jar,
									"--algorithm",
									algorithm,
									"--verbose",
									"-",
								],
								{
									timeout: 12_000,
									maxBuffer: 2_000_000,
									encoding: "utf8",
									windowsHide: true,
								},
								(
									/** @type {Error | null} */ error,
									/** @type {string} */ output,
								) => (error ? fail(error) : done(output)),
							);
							child.stdin?.on("error", () => {});
							child.stdin?.end(input, "utf8");
						});
						send(200, { stdout });
					} catch (error) {
						server.config.logger.warn(
							`Java planner: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
						);
						send(422, {
							error:
								"Java no completó la ejecución. Comprueba el JAR y la versión del JDK en la terminal de Vite.",
						});
					} finally {
						running = false;
					}
				},
			);
		},
	};
}
