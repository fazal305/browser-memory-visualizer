let stackTrace = [];
let stackStep = 0;
let stackFrames = [];
let stackTimer = null;
let selectedSampleId = "checkout";
let activeDepth = 0;
const MAX_SAFE_DEPTH = 16;

const stackSamples = [
    {
        id: "checkout",
        title: "Checkout total",
        detail: "A realistic nested call sequence: controller, cart total, tax, discount, and formatting."
    },
    {
        id: "factorial",
        title: "Recursive factorial",
        detail: "A bounded recursive example that records each real nested call and return."
    },
    {
        id: "pipeline",
        title: "Data pipeline",
        detail: "A validation and transformation pipeline with branching helper calls."
    }
];

function recordStackEvent(event, functionName, args, depth, result) {
    stackTrace.push({
        id: BMV.generateId("frame"),
        functionName,
        args: Array.from(args || []),
        depth,
        event,
        result,
        timestamp: performance.now()
    });
}

function wrapFunction(functionName, fn) {
    return function wrappedFunction() {
        activeDepth += 1;
        const depth = activeDepth;
        recordStackEvent("call", functionName, arguments, depth);

        try {
            const result = fn.apply(null, arguments);
            recordStackEvent("return", functionName, [result], depth, result);
            return result;
        } finally {
            activeDepth -= 1;
        }
    };
}

function instrumentSampleFunctions() {
    const api = {};

    api.formatCurrency = wrapFunction("formatCurrency", function formatCurrency(amount) {
        return `$${amount.toFixed(2)}`;
    });

    api.applyDiscount = wrapFunction("applyDiscount", function applyDiscount(total, rate) {
        return total - total * rate;
    });

    api.calculateTax = wrapFunction("calculateTax", function calculateTax(total) {
        return total * 0.08;
    });

    api.calculateCartTotal = wrapFunction("calculateCartTotal", function calculateCartTotal(items) {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        const discounted = api.applyDiscount(subtotal, 0.1);
        return discounted + api.calculateTax(discounted);
    });

    api.checkoutController = wrapFunction("checkoutController", function checkoutController() {
        const total = api.calculateCartTotal([
            { price: 89, qty: 1 },
            { price: 29, qty: 2 },
            { price: 199, qty: 1 }
        ]);
        return api.formatCurrency(total);
    });

    api.factorial = wrapFunction("factorial", function factorial(n) {
        if (n <= 1) return 1;
        return n * api.factorial(n - 1);
    });

    api.normalizeUser = wrapFunction("normalizeUser", function normalizeUser(user) {
        return {
            name: String(user.name).trim(),
            role: String(user.role || "viewer").toLowerCase()
        };
    });

    api.validateUser = wrapFunction("validateUser", function validateUser(user) {
        return Boolean(user.name && user.role);
    });

    api.persistUser = wrapFunction("persistUser", function persistUser(user) {
        return `saved:${user.name}:${user.role}`;
    });

    api.userPipeline = wrapFunction("userPipeline", function userPipeline() {
        const normalized = api.normalizeUser({ name: " Ali ", role: "ADMIN" });
        if (!api.validateUser(normalized)) return "invalid";
        return api.persistUser(normalized);
    });

    return api;
}

function saveCallStackLog() {
    const workspace = BMV.loadWorkspace();
    workspace.callStackLog = stackTrace.map((entry) => ({
        id: entry.id,
        functionName: entry.functionName,
        args: entry.args,
        depth: entry.depth,
        event: entry.event,
        timestamp: Math.round(entry.timestamp)
    }));
    BMV.saveWorkspace(workspace);
}

function runSample(sampleId) {
    selectedSampleId = sampleId || selectedSampleId;
    stackTrace = [];
    stackStep = 0;
    stackFrames = [];
    activeDepth = 0;
    pauseSequence();

    const api = instrumentSampleFunctions();

    if (selectedSampleId === "factorial") {
        api.factorial(5);
    } else if (selectedSampleId === "pipeline") {
        api.userPipeline();
    } else {
        api.checkoutController();
    }

    saveCallStackLog();
    BMV.addActivityLog("Call Stack", "Ran sample", `Recorded ${stackTrace.length} call/return event(s) for ${selectedSampleId}.`);
    BMV.showStatus("Real call sequence recorded. Use playback controls to inspect it.", "success");

    stackStep = 0;
    renderStackFrames(stackStep);
    renderSequenceStrip();
    renderStackStats();
}

function renderStackFrames(step) {
    const visibleEvents = stackTrace.slice(0, step);
    const frames = [];

    visibleEvents.forEach((entry) => {
        if (entry.event === "call") {
            frames.unshift(entry);
        } else {
            const index = frames.findIndex((frame) => frame.functionName === entry.functionName && frame.depth === entry.depth);
            if (index >= 0) frames.splice(index, 1);
        }
    });

    stackFrames = frames;

    if (!stackTrace.length) {
        $("#stackFrames").html(BMV.renderEmptyState("Run a sample to record a real call/return sequence."));
        $("#frameDetails").html(BMV.renderEmptyState("No frame selected yet."));
        return;
    }

    if (!frames.length) {
        $("#stackFrames").html(BMV.renderEmptyState(step === 0 ? "Playback is at the beginning." : "The stack is empty after all returns."));
    } else {
        $("#stackFrames").html(frames.map((frame) => `
      <div class="stack-frame depth-${Math.min(frame.depth, 5)}">
        <strong>${BMV.escapeHtml(frame.functionName)}</strong>
        <div class="text-secondary">depth ${frame.depth}</div>
        <div>${BMV.escapeHtml(JSON.stringify(frame.args))}</div>
      </div>
    `).join(""));
    }

    const current = stackTrace[Math.max(0, step - 1)];
    renderFrameDetails(current);
    renderSequenceStrip();
    renderStackStats();
}

function renderFrameDetails(entry) {
    if (!entry) {
        $("#frameDetails").html(BMV.renderEmptyState("Step forward to inspect the current event."));
        return;
    }

    $("#frameDetails").html(`
    <div class="frame-detail-grid">
      <div class="frame-detail-row"><span>Event</span><span>${BMV.escapeHtml(entry.event)}</span></div>
      <div class="frame-detail-row"><span>Function</span><span>${BMV.escapeHtml(entry.functionName)}</span></div>
      <div class="frame-detail-row"><span>Depth</span><span>${entry.depth}</span></div>
      <div class="frame-detail-row"><span>Args</span><span>${BMV.escapeHtml(JSON.stringify(entry.args))}</span></div>
      <div class="frame-detail-row"><span>Time</span><span>${Math.round(entry.timestamp)} ms</span></div>
    </div>
  `);
}

function renderSequenceStrip() {
    if (!stackTrace.length) {
        $("#sequenceStrip").html("");
        return;
    }

    $("#sequenceStrip").html(stackTrace.map((entry, index) => `
    <span class="sequence-dot ${entry.event === "return" ? "return" : ""} ${index === stackStep - 1 ? "active" : ""}"
      title="${BMV.escapeHtml(entry.event)} ${BMV.escapeHtml(entry.functionName)}"></span>
  `).join(""));
}

function renderStackStats() {
    const maxDepth = stackTrace.reduce((max, entry) => Math.max(max, entry.depth), 0);

    $("#stackStats").html(`
    <div class="stat-card">
      <p class="stat-label">Recorded Events</p>
      <p class="stat-value">${stackTrace.length}</p>
      <p class="stat-hint">Calls plus returns</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Current Step</p>
      <p class="stat-value">${stackStep}</p>
      <p class="stat-hint">of ${stackTrace.length}</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Current Depth</p>
      <p class="stat-value">${stackFrames.length}</p>
      <p class="stat-hint">active stack frames</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Max Depth</p>
      <p class="stat-value">${maxDepth}</p>
      <p class="stat-hint">from last run</p>
    </div>
  `);
}

function stepForward() {
    if (stackStep >= stackTrace.length) {
        pauseSequence();
        return;
    }

    stackStep += 1;
    renderStackFrames(stackStep);
}

function stepBack() {
    if (stackStep <= 0) return;
    stackStep -= 1;
    renderStackFrames(stackStep);
}

function playSequence() {
    if (!stackTrace.length) return;
    pauseSequence();

    stackTimer = window.setInterval(() => {
        if (stackStep >= stackTrace.length) {
            pauseSequence();
            return;
        }

        stepForward();
    }, BMV.getAnimationDelayMs());
}

function pauseSequence() {
    if (stackTimer) {
        window.clearInterval(stackTimer);
        stackTimer = null;
    }
}

function runStackOverflowDemo() {
    stackTrace = [];
    stackStep = 0;
    stackFrames = [];
    activeDepth = 0;
    pauseSequence();

    let guardedRecursive;

    guardedRecursive = wrapFunction("unboundedRecursion", function unboundedRecursion(n) {
        if (n >= MAX_SAFE_DEPTH) {
            recordStackEvent("return", "guardStoppedRecursion", [`Stopped at safe demo depth ${MAX_SAFE_DEPTH}`], activeDepth + 1);
            return "guard stopped";
        }

        return guardedRecursive(n + 1);
    });

    guardedRecursive(1);
    saveCallStackLog();
    BMV.addActivityLog("Call Stack", "Stack overflow demo", `Stopped recursion safely at depth ${MAX_SAFE_DEPTH}.`);

    $("#overflowMessage").html(`
    <div class="overflow-warning">
      A real unbounded recursion would eventually throw <span class="mono">Maximum call stack size exceeded</span>.
      This demo uses a guard at depth ${MAX_SAFE_DEPTH} so the page stays responsive.
    </div>
  `);

    renderStackFrames(0);
    renderSequenceStrip();
    renderStackStats();
    BMV.showStatus("Safe stack overflow demonstration recorded.", "warning");
}

function renderSamples() {
    $("#sampleList").html(stackSamples.map((sample) => `
    <div class="sample-card ${sample.id === selectedSampleId ? "active" : ""}" data-sample-id="${sample.id}">
      <h3>${BMV.escapeHtml(sample.title)}</h3>
      <p>${BMV.escapeHtml(sample.detail)}</p>
    </div>
  `).join(""));
}

$(function initializeCallStackPage() {
    BMV.bootPage("call-stack", `
    <header class="page-header">
      <div>
        <div class="page-kicker">Function execution trace</div>
        <h1 class="page-title">Call Stack</h1>
        <p class="page-description">
          Samples are real JavaScript functions wrapped with instrumentation. Run one, then replay the actual
          call and return events as stack frames.
        </p>
      </div>
      <button class="btn btn-runtime" id="runSelectedSampleBtn" type="button">Run Selected Sample</button>
    </header>

    <section class="stat-grid mb-3" id="stackStats"></section>

    <section class="call-stack-layout">
      <aside class="card-runtime">
        <h2 class="section-title">Samples</h2>
        <div class="sample-list" id="sampleList"></div>
        <hr class="border-secondary my-4">
        <button class="btn btn-danger-soft w-100" id="overflowDemoBtn" type="button">Run Safe Overflow Demo</button>
        <div class="mt-3" id="overflowMessage"></div>
      </aside>

      <main class="card-runtime">
        <div class="stack-controls">
          <button class="btn btn-ghost" id="stepBackBtn" type="button">Step Back</button>
          <button class="btn btn-ghost" id="stepForwardBtn" type="button">Step Forward</button>
          <button class="btn btn-runtime" id="playStackBtn" type="button">Play</button>
          <button class="btn btn-ghost" id="pauseStackBtn" type="button">Pause</button>
        </div>
        <div class="stack-shell" id="stackFrames"></div>
        <div class="sequence-strip" id="sequenceStrip"></div>
      </main>

      <aside class="card-runtime frame-panel">
        <h2 class="section-title">Current event</h2>
        <div id="frameDetails"></div>
      </aside>
    </section>
  `);

    renderSamples();
    renderStackFrames(0);
    renderStackStats();

    $(document).on("click", ".sample-card", function () {
        selectedSampleId = $(this).data("sample-id");
        renderSamples();
    });

    $("#runSelectedSampleBtn").on("click", function () {
        runSample(selectedSampleId);
    });

    $("#stepForwardBtn").on("click", stepForward);
    $("#stepBackBtn").on("click", stepBack);
    $("#playStackBtn").on("click", playSequence);
    $("#pauseStackBtn").on("click", pauseSequence);
    $("#overflowDemoBtn").on("click", runStackOverflowDemo);
});

window.instrumentSampleFunctions = instrumentSampleFunctions;
window.runSample = runSample;
window.renderStackFrames = renderStackFrames;
window.stepForward = stepForward;
window.stepBack = stepBack;
window.playSequence = playSequence;
window.pauseSequence = pauseSequence;
window.runStackOverflowDemo = runStackOverflowDemo;