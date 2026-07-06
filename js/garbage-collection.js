let gcMarkedIds = new Set();
let gcLastBefore = null;
let gcLastAfter = null;
let gcRunning = false;

function addGcLog(phase, detail, objectsAffected) {
    const workspace = BMV.loadWorkspace();
    workspace.gcLog.unshift({
        id: BMV.generateId("gc"),
        phase,
        detail,
        objectsAffected,
        createdAt: new Date().toISOString()
    });
    workspace.gcLog = workspace.gcLog.slice(0, 80);
    BMV.saveWorkspace(workspace);
}

function renderGcObjects(activeId, collectingIds) {
    const workspace = BMV.loadWorkspace();

    if (!workspace.heap.length) {
        $("#gcObjectGrid").html(BMV.renderEmptyState("The heap is empty. Seed demo data from Settings to continue."));
        return;
    }

    $("#gcObjectGrid").html(workspace.heap.map((obj) => {
        const isMarked = gcMarkedIds.has(obj.id) || obj.marked;
        const isActive = activeId === obj.id;
        const isCollecting = collectingIds && collectingIds.has(obj.id);
        const stateClass = isCollecting ? "collecting" : isActive ? "marking" : isMarked ? "reachable" : "pending";
        const stateLabel = isCollecting ? "sweeping" : isActive ? "marking now" : isMarked ? "marked reachable" : "unmarked";

        return `
      <article class="object-card gc-object-card ${stateClass}">
        <div class="object-card-header">
          <div>
            <h3 class="object-card-title">${BMV.escapeHtml(obj.label)}</h3>
            <div class="object-id">${BMV.escapeHtml(obj.id)}</div>
          </div>
          <span class="badge-runtime">${BMV.escapeHtml(obj.type)}</span>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <span class="badge-runtime badge-green">${BMV.formatBytes(obj.sizeBytes)}</span>
          <span class="badge-runtime ${isMarked ? "badge-purple" : "badge-yellow"}">${stateLabel}</span>
        </div>
        <p class="gc-state mono text-secondary mb-0">
          refs: ${BMV.getOutgoingReferences(obj).map((ref) => ref.targetObjectId).join(", ") || "none"}
        </p>
      </article>
    `;
    }).join(""));
}

async function runMarkPhase() {
    if (gcRunning) return;
    gcRunning = true;
    gcMarkedIds = new Set();
    gcLastBefore = getHeapSnapshot();

    const workspace = BMV.loadWorkspace();
    workspace.heap.forEach((obj) => {
        obj.marked = false;
    });
    BMV.saveWorkspace(workspace);

    $("#gcPhaseBanner").text("Mark phase: starting at root variables and walking outgoing references.");
    renderGcObjects();

    const stack = workspace.roots.map((root) => root.targetObjectId).filter(Boolean);
    const delay = BMV.getAnimationDelayMs();

    while (stack.length) {
        const objectId = stack.pop();
        if (gcMarkedIds.has(objectId)) continue;

        const obj = BMV.getObjectById(workspace, objectId);
        if (!obj) continue;

        gcMarkedIds.add(objectId);
        obj.marked = true;

        BMV.saveWorkspace(workspace);
        $("#gcPhaseBanner").text(`Mark phase: marked ${obj.label} (${obj.id}).`);
        renderGcObjects(objectId);
        await wait(delay);

        BMV.getOutgoingReferences(obj).forEach((ref) => {
            if (!gcMarkedIds.has(ref.targetObjectId)) {
                stack.push(ref.targetObjectId);
            }
        });
    }

    BMV.saveWorkspace(workspace);
    addGcLog("mark", `Marked ${gcMarkedIds.size} reachable object(s) from ${workspace.roots.length} root(s).`, gcMarkedIds.size);
    BMV.addActivityLog("Garbage Collection", "Mark phase", `Marked ${gcMarkedIds.size} reachable object(s).`);
    $("#gcPhaseBanner").text(`Mark phase complete: ${gcMarkedIds.size} object(s) are reachable.`);
    gcRunning = false;
    renderGcObjects();
    renderGcLog();
    renderGcStats();
    renderHeapBeforeAfter();
}

async function runSweepPhase() {
    if (gcRunning) return;
    gcRunning = true;

    const workspace = BMV.loadWorkspace();
    if (!gcMarkedIds.size) {
        gcMarkedIds = new Set(workspace.heap.filter((obj) => obj.marked).map((obj) => obj.id));
    }

    gcLastBefore = gcLastBefore || getHeapSnapshot();

    const unreachable = workspace.heap.filter((obj) => !gcMarkedIds.has(obj.id));
    const collectingIds = new Set(unreachable.map((obj) => obj.id));
    const freedBytes = unreachable.reduce((total, obj) => total + Number(obj.sizeBytes || 0), 0);

    $("#gcPhaseBanner").text(`Sweep phase: collecting ${unreachable.length} unmarked object(s).`);
    renderGcObjects(null, collectingIds);
    await wait(BMV.getAnimationDelayMs());

    workspace.heap = workspace.heap.filter((obj) => gcMarkedIds.has(obj.id)).map((obj) => ({
        ...obj,
        marked: false
    }));

    workspace.roots = workspace.roots.filter((root) => BMV.getObjectById(workspace, root.targetObjectId));
    workspace.heap.forEach((obj) => {
        obj.properties = obj.properties.filter((prop) => {
            return prop.valueType !== "reference" || BMV.getObjectById(workspace, prop.value);
        });
        obj.sizeBytes = BMV.estimateObjectSize(obj);
    });

    BMV.saveWorkspace(workspace);
    gcLastAfter = getHeapSnapshot();

    addGcLog(
        "sweep",
        `Collected ${unreachable.length} unreachable object(s), freeing ${BMV.formatBytes(freedBytes)}.`,
        unreachable.length
    );
    BMV.addActivityLog("Garbage Collection", "Sweep phase", `Collected ${unreachable.length} unreachable object(s).`);

    gcMarkedIds = new Set();
    $("#gcPhaseBanner").text(`Sweep complete: ${unreachable.length} object(s) collected, ${BMV.formatBytes(freedBytes)} freed.`);
    gcRunning = false;
    renderGcObjects();
    renderGcLog();
    renderGcStats();
    renderHeapBeforeAfter();
}

async function runFullGC() {
    if (gcRunning) return;
    await runMarkPhase();
    await wait(BMV.getAnimationDelayMs());
    await runSweepPhase();
}

function getHeapSnapshot() {
    const workspace = BMV.loadWorkspace();
    return {
        objects: workspace.heap.length,
        bytes: workspace.heap.reduce((total, obj) => total + Number(obj.sizeBytes || 0), 0)
    };
}

function renderGcLog() {
    const workspace = BMV.loadWorkspace();
    const logs = workspace.gcLog.slice(0, 12);

    if (!logs.length) {
        $("#gcLog").html(BMV.renderEmptyState("No garbage-collection log entries yet."));
        return;
    }

    $("#gcLog").html(logs.map((entry) => `
    <div class="log-line">
      <strong>${BMV.escapeHtml(entry.phase.toUpperCase())}</strong>
      <span> / ${BMV.formatTimestamp(entry.createdAt)}</span>
      <div>${BMV.escapeHtml(entry.detail)}</div>
      <span class="badge-runtime mt-2">${Number(entry.objectsAffected || 0)} object(s)</span>
    </div>
  `).join(""));
}

function renderHeapBeforeAfter() {
    const current = getHeapSnapshot();
    const before = gcLastBefore || current;
    const after = gcLastAfter || current;

    $("#heapBeforeAfter").html(`
    <div class="compare-box">
      <p>Before</p>
      <strong>${before.objects}</strong>
      <span class="mono text-secondary">${BMV.formatBytes(before.bytes)}</span>
    </div>
    <div class="compare-box">
      <p>After</p>
      <strong>${after.objects}</strong>
      <span class="mono text-secondary">${BMV.formatBytes(after.bytes)}</span>
    </div>
  `);
}

function renderGcStats() {
    const workspace = BMV.loadWorkspace();
    const reachable = BMV.getReachableObjectIds(workspace);
    const unreachable = Math.max(workspace.heap.length - reachable.size, 0);
    const unreachableBytes = workspace.heap
        .filter((obj) => !reachable.has(obj.id))
        .reduce((total, obj) => total + Number(obj.sizeBytes || 0), 0);
    const lastSweep = workspace.gcLog.find((entry) => entry.phase === "sweep");

    $("#gcStats").html(`
    <div class="stat-card">
      <p class="stat-label">Heap Size</p>
      <p class="stat-value">${workspace.heap.length}</p>
      <p class="stat-hint">${BMV.formatBytes(workspace.heap.reduce((total, obj) => total + Number(obj.sizeBytes || 0), 0))}</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Reachable</p>
      <p class="stat-value">${reachable.size}</p>
      <p class="stat-hint">Marked during traversal</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Collectable</p>
      <p class="stat-value">${unreachable}</p>
      <p class="stat-hint">${BMV.formatBytes(unreachableBytes)} currently unreachable</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Last Sweep</p>
      <p class="stat-value">${lastSweep ? Number(lastSweep.objectsAffected || 0) : 0}</p>
      <p class="stat-hint">${lastSweep ? BMV.formatTimestamp(lastSweep.createdAt) : "not run yet"}</p>
    </div>
  `);
}

function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

$(function initializeGarbageCollectionPage() {
    BMV.bootPage("garbage-collection", `
    <header class="page-header">
      <div>
        <div class="page-kicker">Mark-and-sweep simulator</div>
        <h1 class="page-title">Garbage Collection</h1>
        <p class="page-description">
          This module runs a real mark-and-sweep pass over the shared heap and roots.
          Sweep removes only objects that are genuinely unreachable from roots.
        </p>
      </div>
      <a class="btn btn-ghost" href="references.html">Inspect Graph</a>
    </header>

    <section class="stat-grid mb-3" id="gcStats"></section>

    <section class="gc-layout">
      <main class="card-runtime">
        <div class="gc-controls">
          <button class="btn btn-ghost" id="markPhaseBtn" type="button">Step: Mark Phase</button>
          <button class="btn btn-ghost" id="sweepPhaseBtn" type="button">Step: Sweep Phase</button>
          <button class="btn btn-runtime" id="runFullGcBtn" type="button">Run Full GC</button>
        </div>

        <div class="gc-phase-banner" id="gcPhaseBanner">
          Ready. Mark phase starts from roots, then sweep removes unmarked objects.
        </div>

        <div class="gc-visual-grid" id="gcObjectGrid"></div>
      </main>

      <aside class="card-runtime">
        <h2 class="section-title">Before / after</h2>
        <div class="heap-compare mb-3" id="heapBeforeAfter"></div>

        <h2 class="section-title">GC action log</h2>
        <div class="log-panel" id="gcLog"></div>
      </aside>
    </section>
  `);

    renderGcObjects();
    renderGcLog();
    renderHeapBeforeAfter();
    renderGcStats();

    $("#markPhaseBtn").on("click", runMarkPhase);
    $("#sweepPhaseBtn").on("click", runSweepPhase);
    $("#runFullGcBtn").on("click", runFullGC);
});

window.runMarkPhase = runMarkPhase;
window.runSweepPhase = runSweepPhase;
window.runFullGC = runFullGC;
window.renderGcLog = renderGcLog;
window.renderHeapBeforeAfter = renderHeapBeforeAfter;
window.renderGcStats = renderGcStats;