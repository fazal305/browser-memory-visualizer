function renderSettingsForm() {
    const workspace = BMV.loadWorkspace();
    const settings = workspace.settings;

    $("#toolName").val(settings.toolName);
    $("#darkModeToggle").prop("checked", Boolean(settings.darkMode));
    $("#compactSidebarToggle").prop("checked", Boolean(settings.compactSidebar));

    $(".speed-options .btn").removeClass("active");
    $(`[data-speed="${settings.animationSpeed}"]`).addClass("active");

    renderWorkspacePreview();
    renderStorageStats();
}

function renderWorkspacePreview() {
    const workspace = BMV.loadWorkspace();
    $("#workspacePreview").text(JSON.stringify(workspace, null, 2));
}

function renderStorageStats() {
    const workspace = BMV.loadWorkspace();
    const bytes = new Blob([JSON.stringify(workspace)]).size;
    const logCount = workspace.gcLog.length + workspace.callStackLog.length + workspace.eventLoopLog.length + workspace.activityLog.length;

    $("#settingsStats").html(`
    <div class="stat-card">
      <p class="stat-label">Heap Objects</p>
      <p class="stat-value">${workspace.heap.length}</p>
      <p class="stat-hint">${BMV.formatBytes(workspace.heap.reduce((total, obj) => total + Number(obj.sizeBytes || 0), 0))}</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Roots</p>
      <p class="stat-value">${workspace.roots.length}</p>
      <p class="stat-hint">Current root references</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Logs</p>
      <p class="stat-value">${logCount}</p>
      <p class="stat-hint">GC, stack, event loop, activity</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Storage</p>
      <p class="stat-value">${BMV.formatBytes(bytes)}</p>
      <p class="stat-hint">Approx workspace JSON size</p>
    </div>
  `);
}

function saveSettings() {
    const workspace = BMV.loadWorkspace();

    workspace.settings.toolName = $("#toolName").val().trim() || BMV.defaultWorkspace.settings.toolName;
    workspace.settings.darkMode = $("#darkModeToggle").is(":checked");
    workspace.settings.compactSidebar = $("#compactSidebarToggle").is(":checked");

    BMV.saveWorkspace(workspace);
    BMV.applyThemeSettings();
    BMV.addActivityLog("Settings", "Saved settings", "Updated branding, theme, or layout preferences.");
    BMV.showStatus("Settings saved.", "success");
    renderSettingsForm();
}

function toggleDarkMode() {
    const workspace = BMV.loadWorkspace();
    workspace.settings.darkMode = $("#darkModeToggle").is(":checked");
    BMV.saveWorkspace(workspace);
    BMV.applyThemeSettings();
    BMV.addActivityLog("Settings", "Theme changed", `Dark mode ${workspace.settings.darkMode ? "enabled" : "disabled"}.`);
    renderWorkspacePreview();
}

function toggleCompactSidebar() {
    const workspace = BMV.loadWorkspace();
    workspace.settings.compactSidebar = $("#compactSidebarToggle").is(":checked");
    BMV.saveWorkspace(workspace);
    BMV.applyThemeSettings();
    BMV.addActivityLog("Settings", "Sidebar changed", `Compact sidebar ${workspace.settings.compactSidebar ? "enabled" : "disabled"}.`);
    renderWorkspacePreview();
}

function setAnimationSpeed(level) {
    const workspace = BMV.loadWorkspace();
    const allowed = ["slow", "normal", "fast"];

    workspace.settings.animationSpeed = allowed.includes(level) ? level : "normal";
    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Settings", "Animation speed", `Set animation speed to ${workspace.settings.animationSpeed}.`);
    BMV.showStatus(`Animation speed set to ${workspace.settings.animationSpeed}.`, "success");
    renderSettingsForm();
}

function exportWorkspace() {
    const workspace = BMV.loadWorkspace();
    const filename = `browser-memory-visualizer-${new Date().toISOString().slice(0, 10)}.json`;
    BMV.downloadJson(filename, workspace);
    BMV.addActivityLog("Settings", "Exported workspace", `Exported ${filename}.`);
    renderSettingsForm();
}

function importWorkspace(event) {
    const file = event.target.files && event.target.files[0];

    if (!file) {
        BMV.showStatus("Choose a JSON file first.", "warning");
        return;
    }

    const reader = new FileReader();

    reader.onload = function handleImport(loadEvent) {
        try {
            const imported = JSON.parse(loadEvent.target.result);
            const normalized = BMV.saveWorkspace(imported);
            BMV.addActivityLog("Settings", "Imported workspace", `Imported workspace with ${normalized.heap.length} heap object(s).`);
            BMV.showStatus("Workspace imported successfully.", "success");
            renderSettingsForm();
        } catch (error) {
            BMV.showStatus(`Import failed: ${error.message}`, "danger");
        } finally {
            $("#importWorkspaceFile").val("");
        }
    };

    reader.readAsText(file);
}

function resetDemoWorkspace() {
    const confirmed = window.confirm("Reset the workspace to the seeded demo data?");
    if (!confirmed) return;

    const workspace = BMV.seedDemoData();
    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Settings", "Reset demo data", "Restored the seeded Browser Memory Visualizer workspace.");
    BMV.showStatus("Demo workspace restored.", "success");
    renderSettingsForm();
}

function clearLogs() {
    const confirmed = window.confirm("Clear GC, call stack, event loop, and activity logs?");
    if (!confirmed) return;

    const workspace = BMV.loadWorkspace();
    workspace.gcLog = [];
    workspace.callStackLog = [];
    workspace.eventLoopLog = [];
    workspace.activityLog = [];

    BMV.saveWorkspace(workspace);
    BMV.showStatus("All logs cleared.", "warning");
    renderSettingsForm();
}

function clearWorkspace() {
    const confirmed = window.confirm("Clear localStorage entirely? The app will seed fresh demo data on the next load.");
    if (!confirmed) return;

    localStorage.removeItem(BMV.STORAGE_KEY);
    const workspace = BMV.loadWorkspace();
    BMV.saveWorkspace(workspace);
    BMV.showStatus("localStorage cleared and demo data re-seeded.", "warning");
    renderSettingsForm();
}

function copyWorkspaceJson() {
    BMV.copyText($("#workspacePreview").text(), "Workspace JSON copied.");
}

$(function initializeSettingsPage() {
    BMV.bootPage("settings", `
    <header class="page-header">
      <div>
        <div class="page-kicker">Workspace controls</div>
        <h1 class="page-title">Settings</h1>
        <p class="page-description">
          Configure the visualizer, export or import the persisted workspace, reset demo data,
          and manage logs stored in localStorage.
        </p>
      </div>
      <button class="btn btn-runtime" id="saveSettingsBtn" type="button">Save Settings</button>
    </header>

    <section class="stat-grid mb-3" id="settingsStats"></section>

    <section class="settings-layout">
      <main class="settings-grid">
        <section class="card-runtime">
          <h2 class="section-title">Branding and display</h2>

          <div class="mb-3">
            <label class="form-label" for="toolName">Tool name / branding label</label>
            <input class="form-control" id="toolName" placeholder="NightCity Memory Lab">
          </div>

          <div class="setting-row">
            <div>
              <h3>Dark mode</h3>
              <p>Use the dark developer-tool interface with neon accents.</p>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" id="darkModeToggle" type="checkbox" role="switch">
            </div>
          </div>

          <div class="setting-row mt-3">
            <div>
              <h3>Compact sidebar</h3>
              <p>Collapse sidebar labels for a denser workspace.</p>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" id="compactSidebarToggle" type="checkbox" role="switch">
            </div>
          </div>
        </section>

        <section class="card-runtime">
          <h2 class="section-title">Animation speed</h2>
          <p class="page-description mb-3">
            This affects step playback in Garbage Collection, Call Stack, and Event Loop modules.
          </p>
          <div class="speed-options">
            <button class="btn btn-ghost" type="button" data-speed="slow">Slow</button>
            <button class="btn btn-ghost" type="button" data-speed="normal">Normal</button>
            <button class="btn btn-ghost" type="button" data-speed="fast">Fast</button>
          </div>
        </section>

        <section class="card-runtime">
          <h2 class="section-title">Export and import</h2>

          <div class="toolbar-runtime">
            <button class="btn btn-runtime" id="exportWorkspaceBtn" type="button">Export Workspace JSON</button>
            <button class="btn btn-ghost" id="copyWorkspaceBtn" type="button">Copy JSON</button>
          </div>

          <div class="import-drop mt-3">
            <label class="form-label" for="importWorkspaceFile">Import workspace JSON</label>
            <input class="form-control" id="importWorkspaceFile" type="file" accept="application/json,.json">
          </div>
        </section>

        <section class="card-runtime danger-zone">
          <h2 class="section-title">Reset and clear</h2>
          <div class="toolbar-runtime mb-0">
            <button class="btn btn-ghost" id="resetDemoBtn" type="button">Reset Demo Data</button>
            <button class="btn btn-danger-soft" id="clearLogsBtn" type="button">Clear All Logs</button>
            <button class="btn btn-danger-soft" id="clearWorkspaceBtn" type="button">Clear localStorage</button>
          </div>
        </section>
      </main>

      <aside class="card-runtime">
        <h2 class="section-title">Workspace JSON preview</h2>
        <pre class="export-box" id="workspacePreview"></pre>
      </aside>
    </section>
  `);

    renderSettingsForm();

    $("#saveSettingsBtn").on("click", saveSettings);
    $("#darkModeToggle").on("change", toggleDarkMode);
    $("#compactSidebarToggle").on("change", toggleCompactSidebar);
    $("[data-speed]").on("click", function () {
        setAnimationSpeed($(this).data("speed"));
    });

    $("#exportWorkspaceBtn").on("click", exportWorkspace);
    $("#copyWorkspaceBtn").on("click", copyWorkspaceJson);
    $("#importWorkspaceFile").on("change", importWorkspace);
    $("#resetDemoBtn").on("click", resetDemoWorkspace);
    $("#clearLogsBtn").on("click", clearLogs);
    $("#clearWorkspaceBtn").on("click", clearWorkspace);
});

window.renderSettingsForm = renderSettingsForm;
window.saveSettings = saveSettings;
window.toggleDarkMode = toggleDarkMode;
window.toggleCompactSidebar = toggleCompactSidebar;
window.setAnimationSpeed = setAnimationSpeed;
window.exportWorkspace = exportWorkspace;
window.importWorkspace = importWorkspace;
window.resetDemoWorkspace = resetDemoWorkspace;
window.clearLogs = clearLogs;
window.clearWorkspace = clearWorkspace;