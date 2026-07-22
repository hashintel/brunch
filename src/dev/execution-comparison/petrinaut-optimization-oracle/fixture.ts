import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PACKAGE_SCRIPTS = [
  ['packages/ds-components', '@hashintel/ds-components', ['codegen', 'build']],
  ['packages/petrinaut-core', '@hashintel/petrinaut-core', ['build']],
  ['packages/optimizer-client', '@local/petrinaut-optimizer-client', ['build']],
  ['packages/petrinaut', '@hashintel/petrinaut', ['build']],
] as const;

export async function createKnownGoodPetrinautCandidate(root: string): Promise<void> {
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(root, 'scripts', 'mark.mjs'), preparationMarkerSource());
  await writeFile(join(root, 'scripts', 'server.mjs'), candidateServerSource());
  for (const [path, name, scripts] of PACKAGE_SCRIPTS) {
    await mkdir(join(root, path), { recursive: true });
    await writeFile(
      join(root, path, 'package.json'),
      `${JSON.stringify({
        name,
        version: '0.0.0',
        private: true,
        scripts: Object.fromEntries(
          scripts.map((script) => [script, `node ../../scripts/mark.mjs ${name}:${script}`]),
        ),
      })}\n`,
    );
  }
  await mkdir(join(root, 'apps', 'petrinaut-website'), { recursive: true });
  await writeFile(
    join(root, 'apps', 'petrinaut-website', 'package.json'),
    `${JSON.stringify({
      name: '@apps/petrinaut-website',
      version: '0.0.0',
      private: true,
      scripts: { dev: 'node ../../scripts/server.mjs' },
    })}\n`,
  );
}

function preparationMarkerSource(): string {
  return String.raw`
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, ".focused-preparation.json");
const expected = [
  "@hashintel/ds-components:codegen",
  "@hashintel/ds-components:build",
  "@hashintel/petrinaut-core:build",
  "@local/petrinaut-optimizer-client:build",
  "@hashintel/petrinaut:build",
];
let completed = [];
try {
  completed = JSON.parse(await readFile(path, "utf8"));
} catch {}
const next = process.argv[2];
if (next !== expected[completed.length]) {
  throw new Error("focused preparation ran out of order: " + next);
}
completed.push(next);
await writeFile(path, JSON.stringify(completed));
`;
}

function candidateServerSource(): string {
  return String.raw`
import { createServer, request as httpRequest } from "node:http";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const host = args.get("--host") ?? "127.0.0.1";
const port = Number(args.get("--port"));
const optimizerOrigin = new URL(process.env.PETRINAUT_OPT_ORIGIN);
const optimizerProvider = process.env.VITE_PETRINAUT_OPT_PROVIDER;
const requiredPreparation = 5;

const html = String.raw${'`'}<!doctype html>
<html><body>
  <main>
    <div role="tablist"><button role="tab" aria-selected="true">Optimizations</button></div>
    <h1>Optimizations</h1>
    <button id="create">Create optimization</button>
    <section id="form" hidden aria-label="Optimization configuration">
      <label>Optimization name <input id="name" value="Optimization proof"></label>
      <label>Scenario
        <select id="scenario"><option value="">Select scenario</option><option value="baseline">Baseline</option><option value="surge">Surge</option></select>
      </label>
      <div id="configuration" hidden>
        <label>rate fixed value <input id="rate-fixed" type="number" value="5"></label>
        <label><input id="rate-optimize" type="checkbox"> Optimize rate</label>
        <label>rate minimum <input id="rate-minimum" type="number" value="1"></label>
        <label>rate maximum <input id="rate-maximum" type="number" value="10"></label>
        <label>demand fixed value <input id="demand-fixed" type="number" value="3"></label>
        <label>Objective metric
          <select id="metric"><option value="saved-profit">Saved profit</option><option value="custom">Custom metric</option></select>
        </label>
        <label id="custom-wrap" hidden>Custom metric code <textarea id="custom-code">return state.profit;</textarea></label>
        <label>Objective direction
          <select id="direction"><option value="maximize">Maximize</option><option value="minimize">Minimize</option></select>
        </label>
        <label>Optimization steps <input id="steps" type="number" value="2"></label>
        <button id="run">Run optimization</button>
      </div>
    </section>
    <div id="status" role="status" aria-label="Optimization status">Idle</div>
    <section id="results" role="region" aria-label="Optimization results"></section>
  </main>
  <script type="module">
    const byId = (id) => document.getElementById(id);
    let controller;
    byId("create").addEventListener("click", () => { byId("form").hidden = false; byId("scenario").focus(); });
    byId("metric").addEventListener("change", () => { byId("custom-wrap").hidden = byId("metric").value !== "custom"; });
    byId("scenario").addEventListener("change", () => {
      byId("configuration").hidden = !byId("scenario").value;
      byId("rate-optimize").checked = false;
      byId("rate-fixed").value = byId("scenario").value === "surge" ? "8" : "5";
      byId("rate-minimum").value = "1";
      byId("rate-maximum").value = "10";
      byId("demand-fixed").value = byId("scenario").value === "surge" ? "6" : "3";
      byId("metric").value = "saved-profit";
      byId("direction").value = "maximize";
      byId("custom-wrap").hidden = true;
    });
    const renderEvent = (event) => {
      if (event.type === "started") {
        byId("status").textContent = "Running";
        const cancel = document.createElement("button");
        cancel.id = "cancel";
        cancel.textContent = "Cancel optimization";
        cancel.addEventListener("click", () => {
          controller.abort();
          byId("status").textContent = "Cancelled";
          cancel.remove();
        });
        byId("results").append(cancel);
      } else if (event.type === "trial") {
        const trial = document.createElement("p");
        trial.textContent = "Trial " + (event.trial + 1) + ": " + event.objective;
        byId("results").append(trial);
        if (event.best) {
          const best = document.createElement("p");
          best.textContent = "Best so far: " + event.best.objective;
          byId("results").append(best);
        }
      } else if (event.type === "complete") {
        byId("status").textContent = "Complete";
        byId("cancel")?.remove();
      } else if (event.type === "error") {
        byId("status").textContent = "Error: " + event.message;
        byId("cancel")?.remove();
      }
    };
    byId("run").addEventListener("click", async () => {
      controller = new AbortController();
      byId("results").replaceChildren();
      byId("status").textContent = "Starting";
      const metric = byId("metric").value === "custom"
        ? { id: "custom-objective", source: "custom", code: byId("custom-code").value }
        : { id: "profit", source: "saved" };
      const body = {
        kind: "petrinaut-optimization",
        version: 1,
        name: byId("name").value,
        scenario: {
          id: byId("scenario").value,
          parameterBindings: {
            rate: byId("rate-optimize").checked
              ? { kind: "optimize", domain: { kind: "continuous", minimum: Number(byId("rate-minimum").value), maximum: Number(byId("rate-maximum").value), scale: "linear" } }
              : { kind: "fixed", value: Number(byId("rate-fixed").value) },
            demand: { kind: "fixed", value: Number(byId("demand-fixed").value) },
          },
        },
        objective: { metric, direction: byId("direction").value },
        execution: { seed: 1234, dt: 0.1, maxTime: 10 },
        study: { trials: Number(byId("steps").value), sampler: "tpe" },
      };
      try {
        const response = await fetch("/api/petrinaut-opt/optimize/all", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          buffer += decoder.decode(result.value, { stream: true });
          let newline;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) renderEvent(JSON.parse(line));
          }
        }
      } catch (error) {
        if (error.name !== "AbortError") byId("status").textContent = "Error: " + error.message;
      }
    });
  </script>
</body></html>${'`'};

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/favicon.ico") {
    response.writeHead(204).end();
    return;
  }
  if (request.method === "GET" && request.url === "/optimization") {
    if (optimizerProvider !== "service") {
      response.writeHead(404).end("Optimization provider disabled");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    return;
  }
  if (request.method === "POST" && request.url === "/api/petrinaut-opt/optimize/all") {
    const upstream = httpRequest(new URL("/optimize/all", optimizerOrigin), {
      method: "POST",
      headers: { "content-type": "application/json" },
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 500, { "content-type": "application/x-ndjson" });
      upstreamResponse.pipe(response);
    });
    request.pipe(upstream);
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableEnded) upstream.destroy();
    });
    return;
  }
  response.writeHead(404).end("Not found");
});

server.listen(port, host, async () => {
  const { readFile } = await import("node:fs/promises");
  let prepared = [];
  try { prepared = JSON.parse(await readFile(new URL("../.focused-preparation.json", import.meta.url), "utf8")); } catch {}
  if (prepared.length !== requiredPreparation) {
    console.error("focused preparation incomplete");
    process.exit(1);
  }
  console.log("PETRINAUT_READY");
});
`;
}
