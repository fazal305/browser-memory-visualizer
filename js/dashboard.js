let heapChart = null;

function getWorkspaceStats() {
    const workspace = BMV.loadWorkspace();
    const reachableIds = BMV.getReachableObjectIds(workspace);
    const heapBytes = workspace.heap.reduce((total, obj) => total + Number(obj.sizeBytes || 0), 0);
    const lastCallStackDepth = workspace.callStackLog.reduce((max, entry) => {
        return Math.max(max, Number(entry.depth || 0));
    }, 0);
    const pendingQueuedTasks = workspace.eventLoopLog.filter((entry) => {
        return entry.queuedAt !== undefined && (entry.executedAt === undefined || entry.executedAt === null);
    }).length;

    return {
        workspace,
        totalObjects: workspace.heap.length,
        totalRoots: workspace.roots.length,
        reachable: reachableIds.size,
        unreachable: Math.max(workspace.heap.length - reachableIds.size, 0),
        heapBytes,
        lastCallStackDepth,
        pendingQueuedTasks
    };
}

function renderDashboardStats() {
    const stats = getWorkspaceStats();

    $("#dashboardStats").html(`
    <div class="stat-card">
      <p class="stat-label">Heap Objects</p>
      <p class="stat-value">${stats.totalObjects}</p>
      <p class="stat-hint">${BMV.formatBytes(stats.heapBytes)} estimated memory</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Root References</p>
      <p class="stat-value">${stats.totalRoots}</p>
      <p class="stat-hint">Variables keeping objects alive</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Reachability</p>
      <p class="stat-value">${stats.reachable}/${stats.unreachable}</p>
      <p class="stat-hint">Reachable / unreachable objects</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Runtime Signals</p>
      <p class="stat-value">${stats.lastCallStackDepth}/${stats.pendingQueuedTasks}</p>
      <p class="stat-hint">Max stack depth / pending tasks</p>
    </div>
  `);
}

function getHeapHistoryPoints(workspace) {
    const logs = [...workspace.activityLog].reverse().slice(-12);
    const base = Math.max(workspace.heap.length - logs.length, 0);
    const points = logs.map((entry, index) => {
        let adjustment = 0;

        if (/created/i.test(entry.action)) adjustment = 1;
        if (/deleted|collected|sweep/i.test(entry.action)) adjustment = -1;

        return {
            label: `${index + 1}`,
            value: Math.max(base + index + adjustment, 0)
        };
    });

    points.push({
        label: "Now",
        value: workspace.heap.length
    });

    return points.length > 1 ? points : [
        { label: "Seed", value: workspace.heap.length },
        { label: "Now", value: workspace.heap.length }
    ];
}

function renderHeapSizeChart() {
    const workspace = BMV.loadWorkspace();
    const points = getHeapHistoryPoints(workspace);
    const canvas = document.getElementById("heapSizeChart");

    if (!canvas || typeof Chart === "undefined") return;

    if (heapChart) {
        heapChart.destroy();
    }

    heapChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: points.map((point) => point.label),
            datasets: [
                {
                    label: "Heap objects",
                    data: points.map((point) => point.value),
                    borderColor: "#22d3ee",
                    backgroundColor: "rgba(34, 211, 238, 0.16)",
                    fill: true,
                    tension: 0.36,
                    pointRadius: 4,
                    pointBackgroundColor: "#a855f7"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 420
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#9aabc7",
                        font: {
                            family: "Cascadia Code, Fira Code, Consolas, monospace"
                        }
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
                    ticks: {
                        color: "#9aabc7",
                        precision: 0
                    },
                    grid: { color: "rgba(154, 171, 199, 0.12)" }
                }
            }
        }
    });
}

function renderRecentActivityLog() {
    const workspace = BMV.loadWorkspace();
    const logs = workspace.activityLog.slice(0, 8);

    if (!logs.length) {
        $("#recentActivity").html(BMV.renderEmptyState("No activity has been recorded yet."));
        return;
    }

    $("#recentActivity").html(logs.map((entry) => `
    <div class="activity-item">
      <div class="activity-meta">
        <span>${BMV.escapeHtml(entry.module)} / ${BMV.escapeHtml(entry.action)}</span>
        <span>${BMV.formatTimestamp(entry.createdAt)}</span>
      </div>
      <p class="activity-detail">${BMV.escapeHtml(entry.detail)}</p>
    </div>
  `).join(""));
}

function renderQuickActions() {
    const actions = [
        {
            code: "HEAP",
            title: "Create Objects",
            detail: "Add heap objects, attach primitive properties, connect references, and assign roots.",
            href: "objects.html"
        },
        {
            code: "GRAPH",
            title: "Inspect References",
            detail: "See root variables and object-to-object pointers rendered as a live reference graph.",
            href: "references.html"
        },
        {
            code: "GC",
            title: "Run Mark-and-Sweep",
            detail: "Trace reachable objects from roots, then collect genuinely unreachable heap entries.",
            href: "garbage-collection.html"
        },
        {
            code: "STACK",
            title: "Replay Calls",
            detail: "Run instrumented functions and step through real recorded call and return events.",
            href: "call-stack.html"
        },
        {
            code: "LOOP",
            title: "Observe Event Loop",
            detail: "Schedule real promises and timers, then replay the observed execution order.",
            href: "event-loop.html"
        },
        {
            code: "JSON",
            title: "Export Workspace",
            detail: "Tune the tool, export or import workspace JSON, and reset the demo environment.",
            href: "settings.html"
        }
    ];

    $("#quickActions").html(actions.map((action) => `
    <a class="action-card" href="${action.href}">
      <span class="action-code">${action.code}</span>
      <h3>${BMV.escapeHtml(action.title)}</h3>
      <p>${BMV.escapeHtml(action.detail)}</p>
    </a>
  `).join(""));
}

function renderModuleOverview() {
    $("#moduleOverview").html(`
    <div class="module-pill-row">
      <span class="badge-runtime">Objects: heap records</span>
      <span class="badge-runtime badge-green">References: graph reachability</span>
      <span class="badge-runtime badge-purple">GC: mark and sweep</span>
      <span class="badge-runtime badge-yellow">Call Stack: real traces</span>
      <span class="badge-runtime">Event Loop: real scheduling</span>
    </div>
  `);
}

function renderDashboard() {
    renderDashboardStats();
    renderHeapSizeChart();
    renderRecentActivityLog();
    renderQuickActions();
    renderModuleOverview();
}

$(function initializeDashboard() {
    BMV.bootPage("dashboard", `
    <header class="page-header">
      <div>
        <div class="page-kicker">Runtime education lab</div>
        <h1 class="page-title">Browser Memory Visualizer</h1>
        <p class="page-description">
          A multi-page JavaScript runtime visualizer for exploring heap objects, references,
          garbage collection, function calls, and the event loop using shared persisted workspace data.
        </p>
      </div>
      <a class="btn btn-runtime" href="objects.html">Start with Objects</a>
    </header>

    <section class="dashboard-hero">
      <div class="card-runtime hero-panel">
        <h2 class="section-title">What this teaches</h2>
        <p class="page-description">
          JavaScript keeps objects alive when they are reachable from roots. This tool makes that model visible:
          build real heap records, connect references, compute reachability, collect unreachable objects,
          and replay actual recorded call stack and event loop behavior.
        </p>
        <div id="moduleOverview"></div>
      </div>

      <div class="card-runtime chart-card">
        <h2 class="section-title">Heap size trend</h2>
        <div class="chart-wrap">
          <canvas id="heapSizeChart" aria-label="Heap size over recent actions"></canvas>
        </div>
      </div>
    </section>

    <section class="stat-grid" id="dashboardStats" aria-live="polite"></section>

    <section class="dashboard-grid">
      <div class="card-runtime">
        <h2 class="section-title">Quick actions</h2>
        <div class="quick-action-grid" id="quickActions"></div>
      </div>

      <aside class="card-runtime">
        <h2 class="section-title">Recent activity</h2>
        <div class="activity-list" id="recentActivity"></div>
      </aside>
    </section>
  `);

    renderDashboard();
});

window.renderDashboardStats = renderDashboardStats;
window.renderHeapSizeChart = renderHeapSizeChart;
window.renderRecentActivityLog = renderRecentActivityLog;
window.renderQuickActions = renderQuickActions;