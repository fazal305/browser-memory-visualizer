let eventLoopTrace = [];
let eventLoopStep = 0;
let eventLoopTimer = null;
let selectedSnippetId = "classic";
let eventLoopChart = null;
let instrumentContext = null;

const eventLoopSnippets = [
    {
        id: "sync",
        title: "Sync only",
        code: `log("sync A");
log("sync B");
log("sync C");`
    },
    {
        id: "timer",
        title: "Sync + timeout",
        code: `log("sync start");
setTimeout(() => log("timeout 0"), 0);
log("sync end");`
    },
    {
        id: "classic",
        title: "Promise before timeout",
        code: `log("script start");
setTimeout(() => log("setTimeout callback"), 0);
Promise.resolve().then(() => log("Promise.then callback"));
log("script end");`
    },
    {
        id: "nested",
        title: "Nested tasks",
        code: `log("start");
setTimeout(() => {
  log("timeout outer");
  Promise.resolve().then(() => log("promise inside timeout"));
}, 0);
Promise.resolve().then(() => {
  log("promise outer");
  setTimeout(() => log("timeout inside promise"), 0);
});
log("end");`
    }
];

function pushLoopEvent(source, label, queuedAt, executedAt, phase) {
    eventLoopTrace.push({
        id: BMV.generateId("loop"),
        source,
        label,
        queuedAt,
        executedAt,
        phase,
        timestamp: performance.now()
    });
}

function instrumentTimersAndPromises() {
    const start = performance.now();

    function relativeNow() {
        return Math.round(performance.now() - start);
    }

    function log(label) {
        pushLoopEvent("call-stack", label, relativeNow(), relativeNow(), "execute");
    }

    function instrumentedSetTimeout(callback, delay) {
        const label = `setTimeout ${delay || 0}ms`;
        const queuedAt = relativeNow();

        pushLoopEvent("macrotask", label, queuedAt, null, "queue");

        return window.setTimeout(function runInstrumentedTimeout() {
            const executedAt = relativeNow();
            pushLoopEvent("macrotask", label, queuedAt, executedAt, "execute");
            callback();
        }, delay);
    }

    const instrumentedPromise = {
        resolve(value) {
            return {
                then(callback) {
                    const label = "Promise.then callback";
                    const queuedAt = relativeNow();

                    pushLoopEvent("microtask", label, queuedAt, null, "queue");

                    return Promise.resolve(value).then(function runInstrumentedThen(resolvedValue) {
                        const executedAt = relativeNow();
                        pushLoopEvent("microtask", label, queuedAt, executedAt, "execute");
                        return callback(resolvedValue);
                    });
                }
            };
        }
    };

    instrumentContext = {
        log,
        setTimeout: instrumentedSetTimeout,
        Promise: instrumentedPromise
    };

    return instrumentContext;
}

function getSnippet(snippetId) {
    return eventLoopSnippets.find((snippet) => snippet.id === snippetId) || eventLoopSnippets[0];
}

async function runSnippet(snippetId) {
    selectedSnippetId = snippetId || selectedSnippetId;
    pauseEventLoopSequence();
    eventLoopTrace = [];
    eventLoopStep = 0;

    const snippet = getSnippet(selectedSnippetId);
    const context = instrumentTimersAndPromises();

    try {
        const runner = new Function("log", "setTimeout", "Promise", snippet.code);
        runner(context.log, context.setTimeout, context.Promise);
    } catch (error) {
        BMV.showStatus(`Snippet failed: ${error.message}`, "danger");
        return;
    }

    await wait(90);

    const workspace = BMV.loadWorkspace();
    workspace.eventLoopLog = eventLoopTrace.map((entry) => ({
        id: entry.id,
        source: entry.source,
        label: entry.label,
        queuedAt: entry.queuedAt,
        executedAt: entry.executedAt,
        phase: entry.phase
    }));
    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Event Loop", "Ran snippet", `Captured ${eventLoopTrace.length} scheduling/execution event(s) for ${selectedSnippetId}.`);

    renderLanes(0);
    renderEventLoopLog();
    renderEventLoopChart();
    BMV.showStatus("Real event loop order captured. Replay the sequence to inspect it.", "success");
}

function renderLanes(step) {
    const visible = eventLoopTrace.slice(0, step);
    const lanes = {
        "call-stack": [],
        microtask: [],
        macrotask: []
    };

    visible.forEach((entry) => {
        if (entry.phase === "queue") {
            lanes[entry.source].push(entry);
        }

        if (entry.phase === "execute") {
            lanes[entry.source] = lanes[entry.source].filter((item) => item.label !== entry.label || item.queuedAt !== entry.queuedAt);
            lanes["call-stack"].push(entry);
        }
    });

    $("#laneCallStack").html(renderLaneTokens(lanes["call-stack"], "call-stack"));
    $("#laneMicrotask").html(renderLaneTokens(lanes.microtask, "microtask"));
    $("#laneMacrotask").html(renderLaneTokens(lanes.macrotask, "macrotask"));

    renderTimeline();
    renderObservedOrder();
    renderEventStats();
}

function renderLaneTokens(entries, lane) {
    if (!entries.length) {
        return `<span class="text-secondary mono">empty</span>`;
    }

    return entries.map((entry) => `
    <span class="loop-token ${lane}">
      ${BMV.escapeHtml(entry.label)}
    </span>
  `).join("");
}

function renderTimeline() {
    if (!eventLoopTrace.length) {
        $("#loopTimeline").html("");
        return;
    }

    $("#loopTimeline").html(eventLoopTrace.map((entry, index) => `
    <span class="timeline-chip ${index === eventLoopStep - 1 ? "active" : ""}">
      ${index + 1}. ${BMV.escapeHtml(entry.source)} ${BMV.escapeHtml(entry.phase)}
    </span>
  `).join(""));
}

function renderObservedOrder() {
    const executed = eventLoopTrace.filter((entry) => entry.phase === "execute");

    $("#observedOrder").html(executed.length ? executed.map((entry, index) => `
    <div class="order-item">
      ${index + 1}. ${BMV.escapeHtml(entry.label)}
      <span class="text-secondary">(${BMV.escapeHtml(entry.source)}, ${entry.executedAt}ms)</span>
    </div>
  `).join("") : BMV.renderEmptyState("Run a snippet to capture real execution order."));
}

function renderEventStats() {
    const queued = eventLoopTrace.filter((entry) => entry.phase === "queue").length;
    const executed = eventLoopTrace.filter((entry) => entry.phase === "execute").length;
    const microtasks = eventLoopTrace.filter((entry) => entry.source === "microtask").length;
    const macrotasks = eventLoopTrace.filter((entry) => entry.source === "macrotask").length;

    $("#eventStats").html(`
    <div class="stat-card">
      <p class="stat-label">Events</p>
      <p class="stat-value">${eventLoopTrace.length}</p>
      <p class="stat-hint">queued plus executed</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Queued</p>
      <p class="stat-value">${queued}</p>
      <p class="stat-hint">instrumented scheduling</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Executed</p>
      <p class="stat-value">${executed}</p>
      <p class="stat-hint">observed callbacks/logs</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Micro/Macro</p>
      <p class="stat-value">${microtasks}/${macrotasks}</p>
      <p class="stat-hint">Promise then / setTimeout</p>
    </div>
  `);
}

function playEventLoopSequence() {
    if (!eventLoopTrace.length) return;
    pauseEventLoopSequence();

    eventLoopTimer = window.setInterval(() => {
        if (eventLoopStep >= eventLoopTrace.length) {
            pauseEventLoopSequence();
            return;
        }

        eventLoopStep += 1;
        renderLanes(eventLoopStep);
    }, BMV.getAnimationDelayMs());
}

function pauseEventLoopSequence() {
    if (eventLoopTimer) {
        window.clearInterval(eventLoopTimer);
        eventLoopTimer = null;
    }
}

function stepEventLoopForward() {
    if (eventLoopStep >= eventLoopTrace.length) return;
    eventLoopStep += 1;
    renderLanes(eventLoopStep);
}

function stepEventLoopBack() {
    if (eventLoopStep <= 0) return;
    eventLoopStep -= 1;
    renderLanes(eventLoopStep);
}

function renderEventLoopLog() {
    const workspace = BMV.loadWorkspace();
    const logs = workspace.eventLoopLog.slice(0, 80);

    if (!logs.length) {
        $("#eventLoopLog").html(BMV.renderEmptyState("No event loop run has been captured yet."));
        return;
    }

    $("#eventLoopLog").html(logs.map((entry, index) => `
    <div class="log-line">
      <strong>${index + 1}. ${BMV.escapeHtml(entry.source)}</strong>
      <span> / ${BMV.escapeHtml(entry.phase || "event")}</span>
      <div>${BMV.escapeHtml(entry.label)}</div>
      <span class="badge-runtime mt-2">queued ${entry.queuedAt ?? "-"}ms</span>
      <span class="badge-runtime mt-2">executed ${entry.executedAt ?? "-"}ms</span>
    </div>
  `).join(""));
}

function renderEventLoopChart() {
    const canvas = document.getElementById("eventLoopChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (eventLoopChart) {
        eventLoopChart.destroy();
    }

    const executed = eventLoopTrace.filter((entry) => entry.phase === "execute");

    eventLoopChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: executed.map((entry, index) => `${index + 1}`),
            datasets: [
                {
                    label: "Execution time ms",
                    data: executed.map((entry) => entry.executedAt || 0),
                    backgroundColor: executed.map((entry) => {
                        if (entry.source === "microtask") return "rgba(168, 85, 247, 0.72)";
                        if (entry.source === "macrotask") return "rgba(250, 204, 21, 0.72)";
                        return "rgba(34, 211, 238, 0.72)";
                    }),
                    borderColor: "#22d3ee",
                    borderWidth: 1
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#9aabc7",
                        font: { family: "Cascadia Code, Fira Code, Consolas, monospace" }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#9aabc7" },
                    grid: { color: "rgba(154, 171, 199, 0.12)" }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#9aabc7" },
                    grid: { color: "rgba(154, 171, 199, 0.12)" }
                }
            }
        }
    });
}

function renderSnippets() {
    $("#snippetList").html(eventLoopSnippets.map((snippet) => `
    <div class="snippet-card ${snippet.id === selectedSnippetId ? "active" : ""}" data-snippet-id="${snippet.id}">
      <h3>${BMV.escapeHtml(snippet.title)}</h3>
      <pre>${BMV.escapeHtml(snippet.code)}</pre>
    </div>
  `).join(""));
}

function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

$(function initializeEventLoopPage() {
    BMV.bootPage("event-loop", `
    <header class="page-header">
      <div>
        <div class="page-kicker">Task scheduling trace</div>
        <h1 class="page-title">Event Loop</h1>
        <p class="page-description">
          Snippets use real <span class="mono">setTimeout</span> and real <span class="mono">Promise.then</span>.
          The visualizer records actual queueing and callback execution timing.
        </p>
      </div>
      <button class="btn btn-runtime" id="runSnippetBtn" type="button">Run Selected Snippet</button>
    </header>

    <section class="stat-grid mb-3" id="eventStats"></section>

    <section class="event-loop-layout">
      <aside class="card-runtime">
        <h2 class="section-title">Preset snippets</h2>
        <div class="snippet-list" id="snippetList"></div>
      </aside>

      <main class="card-runtime">
        <div class="event-controls">
          <button class="btn btn-ghost" id="eventBackBtn" type="button">Step Back</button>
          <button class="btn btn-ghost" id="eventForwardBtn" type="button">Step Forward</button>
          <button class="btn btn-runtime" id="playEventBtn" type="button">Play</button>
          <button class="btn btn-ghost" id="pauseEventBtn" type="button">Pause</button>
        </div>

        <div class="lane-shell">
          <section class="loop-lane">
            <div class="loop-lane-header"><span>Call Stack</span><span>sync execution + active callbacks</span></div>
            <div id="laneCallStack"></div>
          </section>
          <section class="loop-lane">
            <div class="loop-lane-header"><span>Microtask Queue</span><span>Promise.then</span></div>
            <div id="laneMicrotask"></div>
          </section>
          <section class="loop-lane">
            <div class="loop-lane-header"><span>Macrotask Queue</span><span>setTimeout</span></div>
            <div id="laneMacrotask"></div>
          </section>
        </div>

        <div class="loop-timeline" id="loopTimeline"></div>

        <section class="dashboard-grid">
          <div class="card-runtime mt-3">
            <h2 class="section-title">Observed execution order</h2>
            <div class="observed-order" id="observedOrder"></div>
          </div>
          <div class="card-runtime mt-3">
            <h2 class="section-title">Execution timing</h2>
            <div class="event-chart-wrap">
              <canvas id="eventLoopChart"></canvas>
            </div>
          </div>
        </section>

        <section class="card-runtime mt-3">
          <h2 class="section-title">Captured log</h2>
          <div class="log-panel" id="eventLoopLog"></div>
        </section>
      </main>
    </section>
  `);

    renderSnippets();
    renderLanes(0);
    renderEventLoopLog();
    renderEventStats();

    $(document).on("click", ".snippet-card", function () {
        selectedSnippetId = $(this).data("snippet-id");
        renderSnippets();
    });

    $("#runSnippetBtn").on("click", function () {
        runSnippet(selectedSnippetId);
    });

    $("#eventForwardBtn").on("click", stepEventLoopForward);
    $("#eventBackBtn").on("click", stepEventLoopBack);
    $("#playEventBtn").on("click", playEventLoopSequence);
    $("#pauseEventBtn").on("click", pauseEventLoopSequence);
});

window.instrumentTimersAndPromises = instrumentTimersAndPromises;
window.runSnippet = runSnippet;
window.renderLanes = renderLanes;
window.playEventLoopSequence = playEventLoopSequence;
window.pauseEventLoopSequence = pauseEventLoopSequence;
window.renderEventLoopLog = renderEventLoopLog;