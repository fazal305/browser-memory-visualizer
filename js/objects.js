let heapFilterQuery = "";
let heapTypeFilter = "all";

function getTypeClass(type) {
    return `type-${String(type || "object").toLowerCase()}`;
}

function renderRootOptions(selectedId) {
    const workspace = BMV.loadWorkspace();
    return workspace.heap.map((obj) => `
    <option value="${obj.id}" ${obj.id === selectedId ? "selected" : ""}>
      ${BMV.escapeHtml(obj.label)} (${BMV.escapeHtml(obj.id)})
    </option>
  `).join("");
}

function renderReferenceOptions(selectedId) {
    const workspace = BMV.loadWorkspace();
    return `
    <option value="">Choose object reference</option>
    ${workspace.heap.map((obj) => `
      <option value="${obj.id}" ${obj.id === selectedId ? "selected" : ""}>
        ${BMV.escapeHtml(obj.label)} (${BMV.escapeHtml(obj.type)})
      </option>
    `).join("")}
  `;
}

function getFilteredHeap(workspace) {
    const query = heapFilterQuery.trim().toLowerCase();

    return workspace.heap.filter((obj) => {
        const matchesQuery = !query
            || obj.label.toLowerCase().includes(query)
            || obj.type.toLowerCase().includes(query)
            || obj.id.toLowerCase().includes(query);

        const matchesType = heapTypeFilter === "all" || obj.type === heapTypeFilter;

        return matchesQuery && matchesType;
    });
}

function renderProperties(obj) {
    if (!obj.properties.length) {
        return `<div class="empty-state py-3">No properties yet.</div>`;
    }

    return `
    <div class="property-list">
      ${obj.properties.map((prop) => `
        <div class="property-row">
          <span class="property-name">${BMV.escapeHtml(prop.name)}</span>
          <span class="property-value">
            ${prop.valueType === "reference"
            ? `→ ${BMV.escapeHtml(prop.value)}`
            : BMV.escapeHtml(prop.value)}
          </span>
          <button class="btn btn-sm btn-danger-soft" type="button" data-remove-property="${obj.id}" data-property-name="${BMV.escapeHtml(prop.name)}">Remove</button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderHeap() {
    const workspace = BMV.loadWorkspace();
    const reachable = BMV.getReachableObjectIds(workspace);
    const filteredHeap = getFilteredHeap(workspace);

    $("#heapCount").text(`${filteredHeap.length} visible / ${workspace.heap.length} total`);

    if (!filteredHeap.length) {
        $("#heapGrid").html(BMV.renderEmptyState("No heap objects match the current filter."));
        return;
    }

    $("#heapGrid").html(filteredHeap.map((obj) => {
        const reachableClass = reachable.has(obj.id) ? "" : "unreachable";
        return `
      <article class="object-card ${getTypeClass(obj.type)} ${reachableClass}">
        <div class="object-card-header">
          <div>
            <h3 class="object-card-title">${BMV.escapeHtml(obj.label)}</h3>
            <div class="object-id">${BMV.escapeHtml(obj.id)}</div>
          </div>
          <span class="badge-runtime">${BMV.escapeHtml(obj.type)}</span>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-2">
          <span class="badge-runtime badge-green">${BMV.formatBytes(obj.sizeBytes)}</span>
          <span class="badge-runtime ${reachable.has(obj.id) ? "badge-green" : "badge-red"}">
            ${reachable.has(obj.id) ? "reachable" : "unreachable"}
          </span>
        </div>

        ${renderProperties(obj)}

        <div class="toolbar-runtime mt-3 mb-0">
          <button class="btn btn-sm btn-ghost" type="button" data-edit-object="${obj.id}">Edit</button>
          <button class="btn btn-sm btn-ghost" type="button" data-add-property="${obj.id}">Add property</button>
          <button class="btn btn-sm btn-danger-soft" type="button" data-delete-object="${obj.id}">Delete</button>
        </div>
      </article>
    `;
    }).join(""));
}

function renderRoots() {
    const workspace = BMV.loadWorkspace();

    if (!workspace.roots.length) {
        $("#rootList").html(BMV.renderEmptyState("No root variables yet. Assign one to keep an object reachable."));
        return;
    }

    $("#rootList").html(workspace.roots.map((root) => {
        const target = BMV.getObjectById(workspace, root.targetObjectId);
        return `
      <div class="root-item">
        <div>
          <p class="root-name">${BMV.escapeHtml(root.name)}</p>
          <p class="root-target">→ ${target ? BMV.escapeHtml(target.label) : "missing object"} / ${BMV.escapeHtml(root.targetObjectId)}</p>
        </div>
        <button class="btn btn-sm btn-danger-soft" type="button" data-clear-root="${root.id}">Clear</button>
      </div>
    `;
    }).join(""));
}

function renderObjectSelects() {
    $("#rootTarget").html(renderRootOptions());
}

function createObject() {
    const workspace = BMV.loadWorkspace();
    const type = $("#objectType").val();
    const label = $("#objectLabel").val().trim() || `${type}-${workspace.heap.length + 1}`;

    const obj = {
        id: BMV.generateId("obj"),
        type,
        label,
        properties: [],
        sizeBytes: 0,
        marked: false,
        createdAt: new Date().toISOString()
    };

    obj.sizeBytes = BMV.estimateObjectSize(obj);
    workspace.heap.push(obj);
    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Objects", "Created object", `Created ${type} ${obj.id} labeled '${label}'.`);

    $("#objectLabel").val("");
    BMV.showStatus("Object created on the heap.", "success");
    refreshObjectsPage();
}

function editObject(id) {
    const workspace = BMV.loadWorkspace();
    const obj = BMV.getObjectById(workspace, id);
    if (!obj) return;

    const newLabel = window.prompt("Edit object label", obj.label);
    if (newLabel === null) return;

    obj.label = newLabel.trim() || obj.label;
    obj.sizeBytes = BMV.estimateObjectSize(obj);
    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Objects", "Edited object", `Renamed ${id} to '${obj.label}'.`);
    BMV.showStatus("Object label updated.", "success");
    refreshObjectsPage();
}

function deleteObject(id) {
    const workspace = BMV.loadWorkspace();
    const obj = BMV.getObjectById(workspace, id);
    if (!obj) return;

    const confirmed = window.confirm(`Delete ${obj.label} directly from the heap? References to it will be cleared.`);
    if (!confirmed) return;

    workspace.heap = workspace.heap.filter((item) => item.id !== id);
    workspace.roots = workspace.roots.filter((root) => root.targetObjectId !== id);

    workspace.heap.forEach((item) => {
        item.properties = item.properties.filter((prop) => !(prop.valueType === "reference" && prop.value === id));
        item.sizeBytes = BMV.estimateObjectSize(item);
    });

    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Objects", "Deleted object", `Deleted ${obj.type} ${id} from the heap.`);
    BMV.showStatus("Object deleted from heap.", "warning");
    refreshObjectsPage();
}

function addProperty(objectId) {
    const workspace = BMV.loadWorkspace();
    const obj = BMV.getObjectById(workspace, objectId);
    if (!obj) return;

    $("#propertyObjectId").val(objectId);
    $("#propertyObjectLabel").text(`${obj.label} (${obj.id})`);
    $("#propertyName").val("");
    $("#propertyType").val("primitive");
    $("#propertyPrimitiveValue").val("");
    $("#propertyReferenceValue").html(renderReferenceOptions()).val("");
    $("#primitiveValueGroup").show();
    $("#referenceValueGroup").hide();

    bootstrap.Modal.getOrCreateInstance(document.getElementById("propertyModal")).show();
}

function savePropertyFromModal() {
    const workspace = BMV.loadWorkspace();
    const objectId = $("#propertyObjectId").val();
    const obj = BMV.getObjectById(workspace, objectId);
    if (!obj) return;

    const name = $("#propertyName").val().trim();
    const valueType = $("#propertyType").val();
    const value = valueType === "reference"
        ? $("#propertyReferenceValue").val()
        : $("#propertyPrimitiveValue").val().trim();

    if (!name || !value) {
        BMV.showStatus("Property name and value are required.", "warning");
        return;
    }

    const existing = obj.properties.find((prop) => prop.name === name);
    if (existing) {
        existing.valueType = valueType;
        existing.value = value;
    } else {
        obj.properties.push({ name, valueType, value });
    }

    obj.sizeBytes = BMV.estimateObjectSize(obj);
    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Objects", "Added property", `Set ${obj.label}.${name} to ${valueType} value '${value}'.`);

    bootstrap.Modal.getOrCreateInstance(document.getElementById("propertyModal")).hide();
    BMV.showStatus("Property saved.", "success");
    refreshObjectsPage();
}

function removeProperty(objectId, propertyName) {
    const workspace = BMV.loadWorkspace();
    const obj = BMV.getObjectById(workspace, objectId);
    if (!obj) return;

    obj.properties = obj.properties.filter((prop) => prop.name !== propertyName);
    obj.sizeBytes = BMV.estimateObjectSize(obj);

    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Objects", "Removed property", `Removed ${obj.label}.${propertyName}.`);
    BMV.showStatus("Property removed.", "warning");
    refreshObjectsPage();
}

function filterHeap(query) {
    heapFilterQuery = query || "";
    renderHeap();
}

function assignRoot(name, objectId) {
    const workspace = BMV.loadWorkspace();
    const cleanName = String(name || "").trim();
    const target = BMV.getObjectById(workspace, objectId);

    if (!cleanName || !target) {
        BMV.showStatus("Choose a root name and target object.", "warning");
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
    BMV.addActivityLog("Objects", "Assigned root", `Assigned root '${cleanName}' to ${target.id}.`);
    BMV.showStatus("Root reference assigned.", "success");
    $("#rootName").val("");
    refreshObjectsPage();
}

function clearRoot(rootId) {
    const workspace = BMV.loadWorkspace();
    const root = workspace.roots.find((item) => item.id === rootId);
    workspace.roots = workspace.roots.filter((item) => item.id !== rootId);

    BMV.saveWorkspace(workspace);
    BMV.addActivityLog("Objects", "Cleared root", `Cleared root '${root ? root.name : rootId}'.`);
    BMV.showStatus("Root reference cleared.", "warning");
    refreshObjectsPage();
}

function refreshObjectsPage() {
    renderObjectSelects();
    renderRoots();
    renderHeap();
}

$(function initializeObjectsPage() {
    BMV.bootPage("objects", `
    <header class="page-header">
      <div>
        <div class="page-kicker">Heap laboratory</div>
        <h1 class="page-title">Objects</h1>
        <p class="page-description">
          Create heap entries, attach primitive values or object references, and simulate root variables
          like <span class="mono">let currentUser = userObject</span>.
        </p>
      </div>
      <a class="btn btn-ghost" href="references.html">View Reference Graph</a>
    </header>

    <section class="objects-layout">
      <aside class="card-runtime">
        <h2 class="section-title">Create heap object</h2>
        <div class="object-form-stack">
          <div>
            <label class="form-label" for="objectType">Type</label>
            <select class="form-select" id="objectType">
              <option>Object</option>
              <option>Array</option>
              <option>Function</option>
            </select>
          </div>
          <div>
            <label class="form-label" for="objectLabel">Label</label>
            <input class="form-control" id="objectLabel" placeholder="user1">
          </div>
          <button class="btn btn-runtime" id="createObjectBtn" type="button">Create Object</button>
        </div>

        <hr class="border-secondary my-4">

        <h2 class="section-title">Root references</h2>
        <div class="object-form-stack mb-3">
          <div>
            <label class="form-label" for="rootName">Root variable name</label>
            <input class="form-control" id="rootName" placeholder="currentUser">
          </div>
          <div>
            <label class="form-label" for="rootTarget">Target object</label>
            <select class="form-select" id="rootTarget"></select>
          </div>
          <button class="btn btn-ghost" id="assignRootBtn" type="button">Assign Root</button>
        </div>
        <div class="root-list" id="rootList"></div>
      </aside>

      <main class="card-runtime">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <h2 class="section-title mb-0">Heap grid</h2>
          <span class="badge-runtime" id="heapCount">0 visible</span>
        </div>

        <div class="heap-toolbar">
          <input class="form-control" id="heapSearch" placeholder="Search by label, id, or type">
          <select class="form-select" id="heapTypeFilter">
            <option value="all">All types</option>
            <option value="Object">Object</option>
            <option value="Array">Array</option>
            <option value="Function">Function</option>
          </select>
        </div>

        <div class="heap-grid" id="heapGrid"></div>
      </main>
    </section>

    <div class="modal fade" id="propertyModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <h2 class="modal-title fs-5">Add or update property</h2>
              <p class="mb-0 text-secondary mono" id="propertyObjectLabel"></p>
            </div>
            <button class="btn-close btn-close-white" type="button" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="propertyObjectId">
            <div class="mb-3">
              <label class="form-label" for="propertyName">Property name</label>
              <input class="form-control" id="propertyName" placeholder="friend">
            </div>
            <div class="mb-3">
              <label class="form-label" for="propertyType">Value type</label>
              <select class="form-select" id="propertyType">
                <option value="primitive">Primitive</option>
                <option value="reference">Reference</option>
              </select>
            </div>
            <div class="mb-3" id="primitiveValueGroup">
              <label class="form-label" for="propertyPrimitiveValue">Primitive value</label>
              <input class="form-control" id="propertyPrimitiveValue" placeholder="Ali">
            </div>
            <div class="mb-3" id="referenceValueGroup">
              <label class="form-label" for="propertyReferenceValue">Referenced object</label>
              <select class="form-select" id="propertyReferenceValue"></select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" type="button" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-runtime" id="savePropertyBtn" type="button">Save Property</button>
          </div>
        </div>
      </div>
    </div>
  `);

    refreshObjectsPage();

    $("#createObjectBtn").on("click", createObject);
    $("#assignRootBtn").on("click", function () {
        assignRoot($("#rootName").val(), $("#rootTarget").val());
    });

    $("#heapSearch").on("input", function () {
        filterHeap($(this).val());
    });

    $("#heapTypeFilter").on("change", function () {
        heapTypeFilter = $(this).val();
        renderHeap();
    });

    $("#propertyType").on("change", function () {
        const isReference = $(this).val() === "reference";
        $("#primitiveValueGroup").toggle(!isReference);
        $("#referenceValueGroup").toggle(isReference);
    });

    $("#savePropertyBtn").on("click", savePropertyFromModal);

    $(document).on("click", "[data-edit-object]", function () {
        editObject($(this).data("edit-object"));
    });

    $(document).on("click", "[data-delete-object]", function () {
        deleteObject($(this).data("delete-object"));
    });

    $(document).on("click", "[data-add-property]", function () {
        addProperty($(this).data("add-property"));
    });

    $(document).on("click", "[data-remove-property]", function () {
        removeProperty($(this).data("remove-property"), $(this).data("property-name"));
    });

    $(document).on("click", "[data-clear-root]", function () {
        clearRoot($(this).data("clear-root"));
    });
});

window.renderHeap = renderHeap;
window.createObject = createObject;
window.editObject = editObject;
window.deleteObject = deleteObject;
window.addProperty = addProperty;
window.removeProperty = removeProperty;
window.filterHeap = filterHeap;
window.assignRoot = assignRoot;
window.clearRoot = clearRoot;