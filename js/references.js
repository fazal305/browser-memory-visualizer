let graphScale = 1;
let selectedGraphNodeId = null;

function computeReachability() {
    return BMV.getReachableObjectIds(BMV.loadWorkspace());
}

function buildReferenceGraph() {
    const workspace = BMV.loadWorkspace();
    const reachable = computeReachability();
    const nodes = [];
    const edges = [];

    workspace.roots.forEach((root, index) => {
        nodes.push({
            id: root.id,
            kind: "root",
            label: root.name,
            targetObjectId: root.targetObjectId,
            x: 110 + index * 180,
            y: 80,
            reachable: true
        });

        if (BMV.getObjectById(workspace, root.targetObjectId)) {
            edges.push({
                from: root.id,
                to: root.targetObjectId,
                label: "root",
                kind: "root"
            });
        }
    });

    workspace.heap.forEach((obj, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);

        nodes.push({
            id: obj.id,
            kind: "object",
            label: obj.label,
            type: obj.type,
            x: 120 + col * 210,
            y: 230 + row * 170,
            reachable: reachable.has(obj.id)
        });

        BMV.getOutgoingReferences(obj).forEach((ref) => {
            if (BMV.getObjectById(workspace, ref.targetObjectId)) {
                edges.push({
                    from: obj.id,
                    to: ref.targetObjectId,
                    label: ref.propertyName,
                    kind: reachable.has(obj.id) ? "object" : "orphan"
                });
            }
        });
    });

    return { workspace, reachable, nodes, edges };
}

function getGraphNodeById(graph, id) {
    return graph.nodes.find((node) => node.id === id) || null;
}

function renderReferenceGraph() {
    const graph = buildReferenceGraph();
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
    const width = Math.max(920, 260 + Math.min(graph.nodes.length, 4) * 210);
    const objectRows = Math.ceil(graph.workspace.heap.length / 4);
    const height = Math.max(560, 300 + objectRows * 170);

    const marker = `
    <defs>
      <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="rgba(154, 171, 199, 0.78)"></path>
      </marker>
    </defs>
  `;

    const edges = graph.edges.map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return "";

        const x1 = from.x;
        const y1 = from.y + (from.kind === "root" ? 32 : 46);
        const x2 = to.x;
        const y2 = to.y - 38;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const edgeClass = edge.kind === "root" ? "root-edge" : edge.kind === "orphan" ? "orphan-edge" : "";

        return `
      <path class="graph-edge ${edgeClass}" d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" marker-end="url(#arrowHead)"></path>
      <text class="graph-edge-label" x="${midX}" y="${midY - 8}" text-anchor="middle" font-size="11">${BMV.escapeHtml(edge.label)}</text>
    `;
    }).join("");

    const nodes = graph.nodes.map((node) => {
        if (node.kind === "root") {
            return `
        <g class="graph-node root" data-node-id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <circle r="34"></circle>
          <text class="graph-label" y="5" text-anchor="middle" font-size="12">${BMV.escapeHtml(node.label)}</text>
          <text class="graph-label" y="53" text-anchor="middle" font-size="10">root</text>
        </g>
      `;
        }

        return `
      <g class="graph-node ${node.reachable ? "reachable" : "unreachable"}" data-node-id="${node.id}" transform="translate(${node.x - 76}, ${node.y - 42})">
        <rect width="152" height="84" rx="14"></rect>
        <text class="graph-label" x="76" y="30" text-anchor="middle" font-size="13">${BMV.escapeHtml(node.label)}</text>
        <text class="graph-label" x="76" y="52" text-anchor="middle" font-size="10">${BMV.escapeHtml(node.type)} / ${node.reachable ? "reachable" : "orphan"}</text>
      </g>
    `;
    }).join("");

    $("#referenceGraph").html(`
    <svg class="reference-graph" viewBox="0 0 ${width} ${height}" style="transform: scale(${graphScale}); transform-origin: top left;">
      ${marker}
      ${edges}
      ${nodes}
    </svg>
  `);

    renderGraphStats(graph);
}

function getIncomingReferences(workspace, objectId) {
    const incoming = [];

    workspace.roots.forEach((root) => {
        if (root.targetObjectId === objectId) {
            incoming.push({ from: root.name, property: "root", kind: "root" });
        }
    });

    workspace.heap.forEach((obj) => {
        BMV.getOutgoingReferences(obj).forEach((ref) => {
            if (ref.targetObjectId === objectId) {
                incoming.push({ from: obj.label, property: ref.propertyName, kind: "object" });
            }
        });
    });

    return incoming;
}

function selectGraphNode(id) {
    selectedGraphNodeId = id;
    const graph = buildReferenceGraph();
    const workspace = graph.workspace;
    const node = getGraphNodeById(graph, id);

    if (!node) {
        $("#nodeDetails").html(BMV.renderEmptyState("Select a node in the graph to inspect references."));
        return;
    }

    if (node.kind === "root") {
        const root = workspace.roots.find((item) => item.id === id);
        const target = BMV.getObjectById(workspace, root.targetObjectId);

        $("#nodeDetails").html(`
      <div class="detail-block">
        <h4>Root variable</h4>
        <div class="detail-row"><span>Name</span><span>${BMV.escapeHtml(root.name)}</span></div>
        <div class="detail-row"><span>Target</span><span>${target ? BMV.escapeHtml(target.label) : "missing"} / ${BMV.escapeHtml(root.targetObjectId)}</span></div>
        <div class="detail-row"><span>Created</span><span>${BMV.formatTimestamp(root.createdAt)}</span></div>
      </div>
      <button class="btn btn-danger-soft w-100" type="button" data-remove-root-graph="${root.id}">Remove Root</button>
    `);
        return;
    }

    const obj = BMV.getObjectById(workspace, id);
    const incoming = getIncomingReferences(workspace, id);
    const outgoing = BMV.getOutgoingReferences(obj);

    $("#nodeDetails").html(`
    <div class="detail-block">
      <h4>Object details</h4>
      <div class="detail-row"><span>ID</span><span>${BMV.escapeHtml(obj.id)}</span></div>
      <div class="detail-row"><span>Type</span><span>${BMV.escapeHtml(obj.type)}</span></div>
      <div class="detail-row"><span>Label</span><span>${BMV.escapeHtml(obj.label)}</span></div>
      <div class="detail-row"><span>Size</span><span>${BMV.formatBytes(obj.sizeBytes)}</span></div>
      <div class="detail-row"><span>Status</span><span>${graph.reachable.has(obj.id) ? "reachable" : "unreachable"}</span></div>
    </div>

    <div class="detail-block">
      <h4>Incoming references</h4>
      <div class="reference-mini-list">
        ${incoming.length ? incoming.map((ref) => `
          <div class="reference-mini-item">${BMV.escapeHtml(ref.from)} → ${BMV.escapeHtml(ref.property)}</div>
        `).join("") : `<div class="reference-mini-item">No incoming references</div>`}
      </div>
    </div>

    <div class="detail-block">
      <h4>Outgoing references</h4>
      <div class="reference-mini-list">
        ${outgoing.length ? outgoing.map((ref) => `
          <div class="reference-mini-item">${BMV.escapeHtml(ref.propertyName)} → ${BMV.escapeHtml(ref.targetObjectId)}</div>
        `).join("") : `<div class="reference-mini-item">No outgoing references</div>`}
      </div>
    </div>

    <div class="detail-block">
      <h4>Add root here</h4>
      <input class="form-control mb-2" id="graphRootName" placeholder="rootName">
      <button class="btn btn-runtime w-100" type="button" data-add-root-graph="${obj.id}">Add Root Reference</button>
    </div>
  `);
}

function renderGraphStats(graph) {
    $("#graphStats").html(`
    <div class="stat-card">
      <p class="stat-label">Graph Nodes</p>
      <p class="stat-value">${graph.nodes.length}</p>
      <p class="stat-hint">Roots plus heap objects</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Reference Edges</p>
      <p class="stat-value">${graph.edges.length}</p>
      <p class="stat-hint">Root and property links</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Reachable</p>
      <p class="stat-value">${graph.reachable.size}</p>
      <p class="stat-hint">Traceable from roots</p>
    </div>
    <div class="stat-card">
      <p class="stat-label">Unreachable</p>
      <p class="stat-value">${Math.max(graph.workspace.heap.length - graph.reachable.size, 0)}</p>
      <p class="stat-hint">Eligible for GC sweep</p>
    </div>
  `);
}

function addRootFromGraph(name, objectId) {
    const workspace = BMV.loadWorkspace();
    const cleanName = String(name || "").trim();
    const target = BMV.getObjectById(workspace, objectId);

    if (!cleanName || !target) {
        BMV.showStatus("Enter a root name and select a valid object.", "warning");
        return;
    }

    const existing = workspace.roots.find((root) => root.name === cleanName);
    if (existing) {
        existing.targetObjectId = objectId;
    } else {
        workspace.roots.push({
            id: BMV.generateId("root"),
            name: cleanName,
            targetObjectId: objectId,
            createdAt: new Date().toISOString()
        });
    }

    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("References", "Added root", `Added root '${cleanName}' from reference graph.`);
    BMV.showStatus("Root reference added.", "success");
    renderReferenceGraph();
    selectGraphNode(objectId);
}

function removeRootFromGraph(rootId) {
    const workspace = BMV.loadWorkspace();
    const root = workspace.roots.find((item) => item.id === rootId);
    workspace.roots = workspace.roots.filter((item) => item.id !== rootId);

    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("References", "Removed root", `Removed root '${root ? root.name : rootId}'.`);
    BMV.showStatus("Root removed.", "warning");
    renderReferenceGraph();
    selectGraphNode(null);
}

function relayoutGraph() {
    renderReferenceGraph();
    if (selectedGraphNodeId) selectGraphNode(selectedGraphNodeId);
}

$(function initializeReferencesPage() {
    BMV.bootPage("references", `
    <header class="page-header">
      <div>
        <div class="page-kicker">Reachability graph</div>
        <h1 class="page-title">References</h1>
        <p class="page-description">
          This graph is built from the real shared heap and root set in localStorage.
          Roots sit at the top; object properties draw arrows to the objects they reference.
        </p>
      </div>
      <a class="btn btn-ghost" href="garbage-collection.html">Run Garbage Collection</a>
    </header>

    <section class="stat-grid mb-3" id="graphStats"></section>

    <section class="references-layout">
      <main class="card-runtime">
        <div class="graph-controls">
          <button class="btn btn-ghost btn-sm" id="zoomOutBtn" type="button">Zoom Out</button>
          <button class="btn btn-ghost btn-sm" id="zoomInBtn" type="button">Zoom In</button>
          <button class="btn btn-ghost btn-sm" id="relayoutBtn" type="button">Re-layout</button>
          <span class="badge-runtime badge-green">green = reachable</span>
          <span class="badge-runtime badge-red">red/dim = unreachable</span>
        </div>
        <div class="graph-shell" id="referenceGraph"></div>
      </main>

      <aside class="card-runtime">
        <h2 class="section-title">Node inspector</h2>
        <div class="node-details" id="nodeDetails">
          ${BMV.renderEmptyState("Select a node in the graph to inspect references.")}
        </div>
      </aside>
    </section>
  `);

    renderReferenceGraph();

    $("#zoomInBtn").on("click", function () {
        graphScale = Math.min(graphScale + 0.12, 1.6);
        renderReferenceGraph();
    });

    $("#zoomOutBtn").on("click", function () {
        graphScale = Math.max(graphScale - 0.12, 0.65);
        renderReferenceGraph();
    });

    $("#relayoutBtn").on("click", relayoutGraph);

    $(document).on("click", ".graph-node", function () {
        selectGraphNode($(this).data("node-id"));
    });

    $(document).on("click", "[data-add-root-graph]", function () {
        addRootFromGraph($("#graphRootName").val(), $(this).data("add-root-graph"));
    });

    $(document).on("click", "[data-remove-root-graph]", function () {
        removeRootFromGraph($(this).data("remove-root-graph"));
    });
});

window.buildReferenceGraph = buildReferenceGraph;
window.renderReferenceGraph = renderReferenceGraph;
window.computeReachability = computeReachability;
window.selectGraphNode = selectGraphNode;
window.addRootFromGraph = addRootFromGraph;
window.removeRootFromGraph = removeRootFromGraph;