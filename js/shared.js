const STORAGE_KEY = "browserMemoryVisualizerWorkspace";

const defaultWorkspace = {
    settings: {
        toolName: "NightCity Memory Lab",
        darkMode: true,
        compactSidebar: false,
        animationSpeed: "normal"
    },
    heap: [],
    roots: [],
    gcLog: [],
    callStackLog: [],
    eventLoopLog: [],
    activityLog: []
};

function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function generateId(prefix) {
    const stamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${stamp}-${random}`;
}

function formatTimestamp(dateString) {
    if (!dateString) return "never";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "invalid date";
    return date.toLocaleString([], {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function cloneWorkspace(workspace) {
    return JSON.parse(JSON.stringify(workspace));
}

function normalizeWorkspace(workspace) {
    const merged = {
        ...cloneWorkspace(defaultWorkspace),
        ...(workspace || {})
    };

    merged.settings = {
        ...defaultWorkspace.settings,
        ...(workspace && workspace.settings ? workspace.settings : {})
    };

    merged.heap = Array.isArray(merged.heap) ? merged.heap : [];
    merged.roots = Array.isArray(merged.roots) ? merged.roots : [];
    merged.gcLog = Array.isArray(merged.gcLog) ? merged.gcLog : [];
    merged.callStackLog = Array.isArray(merged.callStackLog) ? merged.callStackLog : [];
    merged.eventLoopLog = Array.isArray(merged.eventLoopLog) ? merged.eventLoopLog : [];
    merged.activityLog = Array.isArray(merged.activityLog) ? merged.activityLog : [];

    merged.heap = merged.heap.map((obj) => ({
        id: obj.id || generateId("obj"),
        type: obj.type || "Object",
        label: obj.label || "unnamed",
        properties: Array.isArray(obj.properties) ? obj.properties : [],
        sizeBytes: Number(obj.sizeBytes) || estimateObjectSize(obj),
        marked: Boolean(obj.marked),
        createdAt: obj.createdAt || new Date().toISOString()
    }));

    return merged;
}

function loadWorkspace() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
        const seeded = seedDemoData();
        saveWorkspace(seeded);
        return seeded;
    }

    try {
        const workspace = normalizeWorkspace(JSON.parse(raw));
        saveWorkspace(workspace);
        return workspace;
    } catch (error) {
        console.warn("Workspace was invalid and has been reset.", error);
        const seeded = seedDemoData();
        saveWorkspace(seeded);
        return seeded;
    }
}

function saveWorkspace(workspace) {
    const normalized = normalizeWorkspace(workspace);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}

function resetWorkspace() {
    const workspace = cloneWorkspace(defaultWorkspace);
    saveWorkspace(workspace);
    return workspace;
}

function seedDemoData() {
    const now = new Date().toISOString();

    const heap = [
        {
            id: "obj-user-1",
            type: "Object",
            label: "currentUser",
            properties: [
                { name: "name", valueType: "primitive", value: "Ali" },
                { name: "role", valueType: "primitive", value: "admin" },
                { name: "profile", valueType: "reference", value: "obj-profile-1" },
                { name: "cart", valueType: "reference", value: "obj-cart-1" }
            ],
            sizeBytes: 176,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-profile-1",
            type: "Object",
            label: "userProfile",
            properties: [
                { name: "city", valueType: "primitive", value: "Karachi" },
                { name: "settings", valueType: "reference", value: "obj-settings-1" }
            ],
            sizeBytes: 128,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-settings-1",
            type: "Object",
            label: "profileSettings",
            properties: [
                { name: "theme", valueType: "primitive", value: "dark" },
                { name: "notifications", valueType: "primitive", value: "enabled" }
            ],
            sizeBytes: 104,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-cart-1",
            type: "Array",
            label: "cartItems",
            properties: [
                { name: "0", valueType: "reference", value: "obj-product-1" },
                { name: "1", valueType: "reference", value: "obj-product-2" },
                { name: "length", valueType: "primitive", value: "2" }
            ],
            sizeBytes: 152,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-product-1",
            type: "Object",
            label: "keyboard",
            properties: [
                { name: "sku", valueType: "primitive", value: "KB-NEON-01" },
                { name: "price", valueType: "primitive", value: "89" }
            ],
            sizeBytes: 112,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-product-2",
            type: "Object",
            label: "monitor",
            properties: [
                { name: "sku", valueType: "primitive", value: "MN-CYBER-27" },
                { name: "price", valueType: "primitive", value: "299" }
            ],
            sizeBytes: 112,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-formatter-1",
            type: "Function",
            label: "formatCurrency",
            properties: [
                { name: "name", valueType: "primitive", value: "formatCurrency" },
                { name: "cache", valueType: "reference", value: "obj-cache-1" }
            ],
            sizeBytes: 144,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-cache-1",
            type: "Object",
            label: "formatterCache",
            properties: [
                { name: "USD", valueType: "primitive", value: "$" },
                { name: "PKR", valueType: "primitive", value: "Rs" }
            ],
            sizeBytes: 104,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-orphan-1",
            type: "Object",
            label: "detachedModalState",
            properties: [
                { name: "visible", valueType: "primitive", value: "false" },
                { name: "listener", valueType: "reference", value: "obj-orphan-2" }
            ],
            sizeBytes: 120,
            marked: false,
            createdAt: now
        },
        {
            id: "obj-orphan-2",
            type: "Function",
            label: "staleClickHandler",
            properties: [
                { name: "name", valueType: "primitive", value: "onStaleClick" }
            ],
            sizeBytes: 88,
            marked: false,
            createdAt: now
        }
    ];

    return {
        settings: { ...defaultWorkspace.settings },
        heap,
        roots: [
            { id: "root-current-user", name: "currentUser", targetObjectId: "obj-user-1", createdAt: now },
            { id: "root-format-money", name: "formatMoney", targetObjectId: "obj-formatter-1", createdAt: now },
            { id: "root-cart", name: "activeCart", targetObjectId: "obj-cart-1", createdAt: now }
        ],
        gcLog: [
            {
                id: "gc-demo-mark",
                phase: "mark",
                detail: "Marked reachable objects from currentUser, formatMoney, and activeCart roots.",
                objectsAffected: 8,
                createdAt: now
            },
            {
                id: "gc-demo-sweep",
                phase: "sweep",
                detail: "Previous sweep identified detachedModalState as unreachable but left it for demonstration.",
                objectsAffected: 1,
                createdAt: now
            }
        ],
        callStackLog: [],
        eventLoopLog: [],
        activityLog: [
            {
                id: "log-demo-1",
                module: "Objects",
                action: "Seeded heap",
                detail: "Created demo heap with reachable and unreachable objects.",
                createdAt: now
            },
            {
                id: "log-demo-2",
                module: "References",
                action: "Computed reachability",
                detail: "Demo roots make 8 objects reachable and 2 objects unreachable.",
                createdAt: now
            },
            {
                id: "log-demo-3",
                module: "Garbage Collection",
                action: "Prepared demo",
                detail: "Detached modal objects are intentionally unreachable for mark-and-sweep.",
                createdAt: now
            }
        ]
    };
}

function addActivityLog(module, action, detail) {
    const workspace = loadWorkspace();
    workspace.activityLog.unshift({
        id: generateId("log"),
        module,
        action,
        detail,
        createdAt: new Date().toISOString()
    });
    workspace.activityLog = workspace.activityLog.slice(0, 80);
    saveWorkspace(workspace);
}

function getObjectById(workspace, id) {
    return (workspace.heap || []).find((obj) => obj.id === id) || null;
}

function getOutgoingReferences(obj) {
    if (!obj || !Array.isArray(obj.properties)) return [];
    return obj.properties
        .filter((prop) => prop.valueType === "reference" && prop.value)
        .map((prop) => ({
            propertyName: prop.name,
            targetObjectId: prop.value
        }));
}

function getReachableObjectIds(workspace) {
    const reachable = new Set();
    const stack = (workspace.roots || [])
        .map((root) => root.targetObjectId)
        .filter(Boolean);

    while (stack.length) {
        const objectId = stack.pop();
        if (reachable.has(objectId)) continue;

        const obj = getObjectById(workspace, objectId);
        if (!obj) continue;

        reachable.add(objectId);
        getOutgoingReferences(obj).forEach((ref) => {
            if (!reachable.has(ref.targetObjectId)) {
                stack.push(ref.targetObjectId);
            }
        });
    }

    return reachable;
}

function estimateObjectSize(obj) {
    const baseSize = obj && obj.type === "Function" ? 96 : obj && obj.type === "Array" ? 72 : 64;
    const properties = Array.isArray(obj && obj.properties) ? obj.properties : [];
    const propertySize = properties.reduce((total, prop) => {
        const nameSize = String(prop.name || "").length * 2;
        const valueSize = String(prop.value || "").length * 2;
        const referenceCost = prop.valueType === "reference" ? 16 : 0;
        return total + 24 + nameSize + valueSize + referenceCost;
    }, 0);

    return baseSize + propertySize;
}

function renderSidebar(activePage) {
    const workspace = loadWorkspace();
    const navItems = [
        { page: "dashboard", href: "index.html", icon: "DB", label: "Dashboard" },
        { page: "objects", href: "objects.html", icon: "OB", label: "Objects" },
        { page: "references", href: "references.html", icon: "RF", label: "References" },
        { page: "garbage-collection", href: "garbage-collection.html", icon: "GC", label: "Garbage Collection" },
        { page: "call-stack", href: "call-stack.html", icon: "CS", label: "Call Stack" },
        { page: "event-loop", href: "event-loop.html", icon: "EL", label: "Event Loop" },
        { page: "settings", href: "settings.html", icon: "ST", label: "Settings" }
    ];

    const navHtml = navItems.map((item) => `
    <a class="nav-link-runtime ${item.page === activePage ? "active" : ""}" href="${item.href}" data-page="${item.page}">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </a>
  `).join("");

    return `
    <aside class="sidebar" id="appSidebar">
      <div class="brand-lockup">
        <div class="brand-mark">BM</div>
        <div>
          <p class="brand-title">${escapeHtml(workspace.settings.toolName)}</p>
          <p class="brand-subtitle">Runtime visualizer</p>
        </div>
      </div>
      <nav class="sidebar-nav" aria-label="Primary navigation">
        ${navHtml}
      </nav>
    </aside>
  `;
}

function setActiveNav() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    $(".nav-link-runtime").removeClass("active");
    $(`.nav-link-runtime[href="${path}"]`).addClass("active");
}

function showStatus(message, type) {
    $(".status-toast").remove();

    const toast = $(`
    <div class="status-toast ${escapeHtml(type || "success")}" role="status">
      ${escapeHtml(message)}
    </div>
  `);

    $("body").append(toast);

    window.setTimeout(() => {
        toast.fadeOut(180, function removeToast() {
            $(this).remove();
        });
    }, 2600);
}

function renderEmptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

function copyText(text, message) {
    if (!navigator.clipboard) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        showStatus(message || "Copied to clipboard.", "success");
        return;
    }

    navigator.clipboard
        .writeText(text)
        .then(() => showStatus(message || "Copied to clipboard.", "success"))
        .catch(() => showStatus("Clipboard permission was blocked.", "warning"));
}

function applyThemeSettings() {
    const workspace = loadWorkspace();
    $("body").toggleClass("light-mode", !workspace.settings.darkMode);
    $("body").toggleClass("sidebar-compact", Boolean(workspace.settings.compactSidebar));

    const toolName = workspace.settings.toolName || defaultWorkspace.settings.toolName;
    document.title = document.title.includes("Browser Memory Visualizer")
        ? document.title
        : `${document.title} | Browser Memory Visualizer`;

    $(".brand-title").text(toolName);
}

function getAnimationDelayMs() {
    const workspace = loadWorkspace();
    const speed = workspace.settings.animationSpeed;

    if (speed === "slow") return 900;
    if (speed === "fast") return 220;
    return 520;
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "item";
}

function buildTopbar() {
    return `
    <div class="topbar">
      <button class="btn btn-ghost btn-sm" id="mobileNavToggle" type="button">Menu</button>
      <span class="mono">Browser Memory Visualizer</span>
    </div>
  `;
}

function bootPage(activePage, mainHtml) {
    document.body.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(activePage)}
      <main class="main-content">
        ${buildTopbar()}
        ${mainHtml}
      </main>
    </div>
  `;

    applyThemeSettings();
    setActiveNav();

    $("#mobileNavToggle").on("click", function () {
        $("#appSidebar").toggleClass("mobile-open");
    });
}

window.BMV = {
    STORAGE_KEY,
    defaultWorkspace,
    escapeHtml,
    generateId,
    formatTimestamp,
    loadWorkspace,
    saveWorkspace,
    resetWorkspace,
    seedDemoData,
    addActivityLog,
    getObjectById,
    getOutgoingReferences,
    getReachableObjectIds,
    estimateObjectSize,
    renderSidebar,
    setActiveNav,
    showStatus,
    renderEmptyState,
    downloadJson,
    copyText,
    applyThemeSettings,
    getAnimationDelayMs,
    formatBytes,
    slugify,
    bootPage
};

$(function initializeSharedRuntime() {
    loadWorkspace();
    applyThemeSettings();

    $(window).on("storage", function () {
        applyThemeSettings();
    });
});