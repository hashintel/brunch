import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PACKAGE_SCRIPTS = [
  ['packages/ds-components', '@hashintel/ds-components', ['codegen', 'build']],
  ['packages/petrinaut-core', '@hashintel/petrinaut-core', ['build']],
  ['packages/optimizer-client', '@local/petrinaut-optimizer-client', ['build']],
  ['packages/refractive', '@hashintel/refractive', ['build']],
  ['packages/petrinaut', '@hashintel/petrinaut', ['build']],
] as const;

export async function createKnownGoodPetrinautCandidate(
  root: string,
  options: {
    readonly backgroundRequestDurationMs?: number;
    readonly inventedLabelsRival?: boolean;
  } = {},
): Promise<void> {
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
  await writeFile(
    join(root, 'scripts', 'server.mjs'),
    candidateServerSource({
      backgroundRequestDurationMs: options.backgroundRequestDurationMs ?? 0,
      inventedLabelsRival: options.inventedLabelsRival ?? false,
    }),
  );
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

/** Rival that retains the pre-D138 invented accessibility labels. */
export async function createInventedLabelsPetrinautCandidate(root: string): Promise<void> {
  await createKnownGoodPetrinautCandidate(root, { inventedLabelsRival: true });
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
  "@hashintel/refractive:build",
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

function candidateServerSource(options: {
  readonly backgroundRequestDurationMs: number;
  readonly inventedLabelsRival: boolean;
}): string {
  const invented = options.inventedLabelsRival;
  const viewTitle = invented ? '<h1>Optimizations</h1>' : '<span>Optimizations</span>';
  const nav = invented
    ? '<div role="tablist"><button role="tab" aria-selected="true">Optimizations</button></div>'
    : `<div role="radiogroup" aria-label="Mode">
        <label><input type="radio" name="mode" value="edit">Edit</label>
        <label><input type="radio" name="mode" value="simulate">Simulate</label>
      </div>
      <div role="radiogroup" aria-label="Simulate view">
        <input type="radio" name="sim" value="experiments" checked>
        <input type="radio" name="sim" value="scenarios">
        <input type="radio" name="sim" value="optimizations">
      </div>`;
  const createLabel = invented ? 'Create optimization' : 'Create';
  const runLabel = invented ? 'Run optimization' : 'Run';
  const cancelLabel = invented ? 'Cancel optimization' : 'Cancel';
  const scenarioLabel = invented ? 'Scenario' : '';
  const scenarioPlaceholder = invented ? 'Select scenario' : 'Select a scenario';
  const metricLabel = invented ? 'Objective metric' : '';
  const metricPlaceholder = invented ? '' : 'Select a metric';
  const directionBlock = invented
    ? `<label>Objective direction
        <select id="direction"><option value="maximize">Maximize</option><option value="minimize">Minimize</option></select>
      </label>`
    : `<div role="radiogroup" aria-label="Direction">
        <label><input type="radio" name="direction" value="maximize" id="direction-max">Maximize</label>
        <label><input type="radio" name="direction" value="minimize" id="direction-min">Minimize</label>
      </div>`;
  const statusBlock = invented
    ? '<div id="status" role="status" aria-label="Optimization status">Idle</div><section id="results" role="region" aria-label="Optimization results"></section>'
    : '<div id="status">Idle</div><div id="results"></div><div>Best</div>';

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
const requiredPreparation = 6;
const backgroundRequestDurationMs = ${options.backgroundRequestDurationMs};

const html = String.raw${'`'}<!doctype html>
<html><body>
  <main>
    ${nav}
    <div id="view" hidden>
      ${viewTitle}
      <button id="create">${createLabel}</button>
      <table id="table"><thead><tr><th>Name</th><th>Best</th><th>Status</th></tr></thead><tbody></tbody></table>
    </div>
    <dialog id="drawer" aria-label="Create an optimization">
      <h2>Create an optimization</h2>
      <label>${scenarioLabel}
        <select id="scenario" role="combobox">
          <option value="">${scenarioPlaceholder}</option>
          <option value="scenario__seasonal_flu">Seasonal Flu</option>
          <option value="scenario__high_virulence">High Virulence Outbreak</option>
        </select>
      </label>
      <div id="configuration" hidden>
        <label>Name <input id="name" value="Optimization"></label>
        <label><input id="rate-optimize" type="checkbox"> Optimize infected_ratio</label>
        <label>infected_ratio fixed value <input id="rate-fixed" type="number" value="0.01"></label>
        <label>infected_ratio minimum <input id="rate-minimum" type="number" value="0.001"></label>
        <label>infected_ratio maximum <input id="rate-maximum" type="number" value="0.1"></label>
        <label>population fixed value <input id="demand-fixed" type="number" value="1000"></label>
        <label>${metricLabel}
          <select id="metric" role="combobox">
            <option value="">${metricPlaceholder}</option>
            <option value="metric__infected_fraction">Infected Fraction</option>
            <option value="custom">Custom code</option>
          </select>
        </label>
        <label id="custom-wrap" hidden>Metric code <textarea id="custom-code" aria-label="Editor content">return 42;</textarea></label>
        ${directionBlock}
      </div>
      <button id="run">${runLabel}</button>
      <button id="drawer-cancel">Cancel</button>
    </dialog>
    ${statusBlock}
  </main>
  <script type="module">
    const inventedLabelsRival = ${invented ? 'true' : 'false'};
    if (${options.backgroundRequestDurationMs} > 0) {
      void fetch("/background-readiness-rival");
    }
    const byId = (id) => document.getElementById(id);
    let controller;
    const showView = () => { byId("view").hidden = false; };
    for (const input of document.querySelectorAll('input[name="mode"]')) {
      input.addEventListener("change", () => {
        if (input.value === "simulate" && input.checked) showView();
      });
    }
    for (const input of document.querySelectorAll('input[name="sim"]')) {
      input.addEventListener("change", () => {
        if (input.value === "optimizations" && input.checked) showView();
      });
    }
    if (inventedLabelsRival) showView();
    byId("create").addEventListener("click", () => {
      byId("scenario").value = "";
      byId("configuration").hidden = true;
      byId("rate-optimize").checked = false;
      byId("metric").value = "";
      byId("custom-wrap").hidden = true;
      byId("name").value = "Optimization";
      if (!inventedLabelsRival) {
        byId("direction-max").checked = false;
        byId("direction-min").checked = false;
      }
      byId("drawer").setAttribute("open", "");
      byId("scenario").focus();
    });
    byId("metric").addEventListener("change", () => {
      byId("custom-wrap").hidden = byId("metric").value !== "custom";
    });
    byId("scenario").addEventListener("change", () => {
      byId("configuration").hidden = !byId("scenario").value;
      byId("rate-optimize").checked = false;
      byId("rate-fixed").value = byId("scenario").value.includes("high") ? "0.0001" : "0.01";
      byId("demand-fixed").value = byId("scenario").value.includes("high") ? "10000" : "1000";
      byId("metric").value = "";
      if (!inventedLabelsRival) {
        byId("direction-max").checked = false;
        byId("direction-min").checked = false;
      } else {
        byId("direction").value = "maximize";
      }
      byId("custom-wrap").hidden = true;
    });
    const directionValue = () => inventedLabelsRival
      ? byId("direction").value
      : (document.querySelector('input[name="direction"]:checked')?.value ?? "maximize");
    const ensureCancel = () => {
      if (byId("cancel")) return;
      const cancel = document.createElement("button");
      cancel.id = "cancel";
      cancel.textContent = "${cancelLabel}";
      cancel.addEventListener("click", () => {
        controller.abort();
        byId("status").textContent = "Cancelled";
        cancel.remove();
      });
      byId("results").append(cancel);
    };
    const renderUpstream = (sseEvent, data) => {
      if (sseEvent === "error" || (data && data.state === "ERROR")) {
        byId("status").textContent = "Error";
        byId("cancel")?.remove();
        return;
      }
      if (sseEvent === "done") {
        byId("status").textContent = "Complete";
        byId("cancel")?.remove();
        const row = document.createElement("tr");
        row.innerHTML = "<td>" + byId("name").value + "</td><td>" + (data?.metric ?? "") + "</td><td>Complete</td>";
        byId("table").querySelector("tbody").append(row);
        return;
      }
      if (data && typeof data.step === "number") {
        byId("status").textContent = "Running";
        ensureCancel();
        const trial = document.createElement("p");
        trial.textContent = String(data.step + 1);
        byId("results").append(trial);
        if (typeof data.metric === "number") {
          const best = document.createElement("p");
          best.textContent = String(data.metric);
          byId("results").append(best);
        }
      }
    };
    byId("run").addEventListener("click", async () => {
      byId("drawer").removeAttribute("open");
      controller = new AbortController();
      byId("results").replaceChildren();
      byId("status").textContent = "Initializing";
      ensureCancel();
      const metricId = byId("metric").value === "custom" ? "custom-objective" : byId("metric").value;
      const metrics = byId("metric").value === "custom"
        ? [{ id: metricId, name: "Custom objective", code: byId("custom-code").value }]
        : [{ id: metricId, name: "Infected Fraction", code: "return 1;" }];
      const body = {
        kind: "petrinaut-optimization",
        version: 1,
        name: byId("name").value,
        model: { title: "Calibration", definition: { metrics, scenarios: [{ id: byId("scenario").value }] } },
        scenario: {
          id: byId("scenario").value,
          parameterBindings: {
            infected_ratio: byId("rate-optimize").checked
              ? { kind: "optimize", domain: { kind: "continuous", minimum: Number(byId("rate-minimum").value), maximum: Number(byId("rate-maximum").value), scale: "linear" } }
              : { kind: "fixed", value: Number(byId("rate-fixed").value) },
            population: { kind: "fixed", value: Number(byId("demand-fixed").value) },
          },
        },
        objective: { metricId, direction: directionValue() },
        execution: { seed: 1234, dt: 0.1, maxTime: 10 },
        study: { trials: 2, sampler: "tpe" },
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
        let sseEvent = "";
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          buffer += decoder.decode(result.value, { stream: true });
          let separator;
          while ((separator = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            sseEvent = "";
            let dataLine = "";
            for (const line of raw.split("\n")) {
              if (line.startsWith("event:")) sseEvent = line.slice(6).trim();
              if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            }
            let data = null;
            if (dataLine) data = JSON.parse(dataLine);
            renderUpstream(sseEvent, data);
          }
        }
      } catch (error) {
        if (error.name !== "AbortError") byId("status").textContent = "Error";
      }
    });
  </script>
</body></html>${'`'};

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/background-readiness-rival") {
    setTimeout(() => {
      response.writeHead(204).end();
    }, backgroundRequestDurationMs);
    return;
  }
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
      headers: { "content-type": "application/json", accept: "text/event-stream" },
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 500, {
        "content-type": upstreamResponse.headers["content-type"] ?? "text/event-stream",
      });
      upstreamResponse.on("error", () => {
        if (!response.writableEnded) response.end();
      });
      upstreamResponse.pipe(response);
    });
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      if (!response.writableEnded) response.end();
    });
    request.on("error", () => upstream.destroy());
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
