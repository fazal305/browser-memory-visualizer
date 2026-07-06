# Browser Memory Visualizer

An interactive, browser-based educational tool that visualizes core
JavaScript runtime concepts: objects and the heap, references and
reachability, garbage collection, the call stack, and the event loop.

## Live Links

- GitHub Repository: [fazal305/browser-memory-visualizer](https://github.com/fazal305/browser-memory-visualizer)
- Live Demo: [https://fazal305.github.io/browser-memory-visualizer/](https://fazal305.github.io/browser-memory-visualizer/)

## Overview

Browser Memory Visualizer makes invisible JavaScript runtime behavior easier to understand by turning heap objects, references, garbage collection, function calls, and task scheduling into interactive diagrams. It uses real shared workspace data in localStorage, a real mark-and-sweep traversal, wrapped function calls for stack traces, and instrumented `setTimeout` / `Promise.then` runs for event loop ordering.

The project is designed as a professional multi-page frontend portfolio application with consistent navigation, polished dark-mode styling, and educational workflows for learners and instructors.

## Pages

- Dashboard: overview, live workspace stats, heap trend chart, recent activity, and quick module links.
- Objects: create, edit, delete, search, and connect heap objects; assign or clear root references.
- References: render the current heap and roots as a node-link graph with reachability status.
- Garbage Collection: step through mark phase, sweep unreachable objects, and inspect GC logs.
- Call Stack: run instrumented sample functions and replay real call/return stack events.
- Event Loop: run real timer and promise snippets and replay observed scheduling order.
- Settings: configure branding, theme, sidebar mode, animation speed, import/export, and reset data.

## Features

- Multi-page browser application with normal HTML navigation.
- Shared heap and root-reference state persisted through localStorage.
- Seeded demo workspace with reachable and deliberately unreachable objects.
- Heap object cards with Object, Array, and Function types.
- Primitive and reference-type object properties.
- Search and type filtering for heap objects.
- SVG reference graph derived from real heap/root state.
- Reachability detection from roots using graph traversal.
- Real mark-and-sweep garbage collection implementation.
- GC animation, before/after heap comparison, and action logs.
- Real function-call instrumentation with call and return playback.
- Safe bounded stack overflow demonstration.
- Real `setTimeout` and `Promise.then` instrumentation for event loop ordering.
- Event loop lanes for call stack, microtasks, and macrotasks.
- Chart.js dashboard and event-loop charts.
- Workspace JSON export/import.
- Dark mode, compact sidebar, and animation-speed settings.

## Technologies Used

- HTML5
- CSS3
- Bootstrap 5
- jQuery
- Vanilla JavaScript
- Chart.js
- SVG / Canvas graph rendering
- LocalStorage
- Blob API
- Clipboard API

## Learning Outcomes

- Understand how JavaScript objects can be represented on a heap.
- Learn how references connect objects and how root variables keep objects alive.
- Trace reachability from roots through object properties.
- Understand the mark-and-sweep garbage collection algorithm.
- See how nested and recursive function calls push and pop stack frames.
- Learn why unbounded recursion can overflow the call stack.
- Observe why microtasks such as `Promise.then` run before macrotasks such as `setTimeout`.
- Practice reasoning about persistent frontend state across multiple pages.

## Architecture Notes

- Multi-page frontend architecture: each major module has its own HTML file, CSS file, and JavaScript file. Pages are connected through normal anchor links and can run locally by opening `index.html`.
- Shared heap/root state model across Objects, References, and Garbage Collection modules: all three modules read from and write to the same localStorage workspace, so changes on one page are reflected across the others.
- Shared JavaScript utilities: `js/shared.js` owns workspace loading/saving, demo seeding, ID generation, reachability traversal, size estimation, sidebar rendering, status messages, JSON download, clipboard helpers, theme application, animation speed, formatting, and slug creation.
- Shared CSS plus page-specific CSS: `styles.css` contains product-wide layout, design tokens, cards, navigation, controls, graph shells, stack frames, lane styling, and responsive rules. Each file in `css/` adds module-specific layout and visual behavior.
- localStorage workspace model: localStorage is the source of truth for settings, heap, roots, GC log, call stack log, event loop log, and recent activity.
- Real mark-and-sweep garbage collection implementation: the GC page traverses outgoing object references from root variables, marks reachable objects, and sweeps only unmarked objects from the actual heap.
- Real function-call instrumentation for the Call Stack module: sample functions are wrapped so every actual call and return records function name, arguments, depth, event type, and timestamp.
- Real setTimeout/Promise instrumentation for the Event Loop module: snippets receive instrumented versions of `setTimeout` and `Promise.resolve().then(...)` while still using the browser's real scheduling APIs.
- No-build browser architecture: there are no bundlers, package managers, transpilers, or frameworks. Bootstrap, jQuery, and Chart.js are loaded from CDNs.

## Folder Structure

```text
browser-memory-visualizer/
  index.html
  objects.html
  references.html
  garbage-collection.html
  call-stack.html
  event-loop.html
  settings.html

  styles.css

  css/
    dashboard.css
    objects.css
    references.css
    garbage-collection.css
    call-stack.css
    event-loop.css
    settings.css

  js/
    shared.js
    dashboard.js
    objects.js
    references.js
    garbage-collection.js
    call-stack.js
    event-loop.js
    settings.js

  README.md
  LICENSE
  .gitignore
```

How To Run Locally
git clone https://github.com/fazal305/browser-memory-visualizer.git
cd browser-memory-visualizer
open index.html
On Windows, you can also double-click index.html or run:
Start-Process .\index.html
How To Use
Open index.html in a browser.
Review the dashboard stats and quick action cards.
Go to Objects and create or edit heap objects.
Add primitive properties or reference properties between objects.
Assign root references to simulate variables keeping objects alive.
Open References to inspect the live reference graph.
Open Garbage Collection and run mark phase, sweep phase, or full GC.
Open Call Stack, run a sample, and step through real call/return frames.
Open Event Loop, run a snippet, and replay the real observed execution order.
Open Settings to export/import the workspace, tune animation speed, or reset demo data.
Sample Workflow
Create a few objects with references between them:
On Objects, create user, profile, and cart.
Add a reference property from user.profile to profile.
Add a reference property from user.cart to cart.
Assign a root named currentUser to user.

View the reference graph and identify unreachable objects:
Open References.
Confirm currentUser appears as a root node.
Follow arrows from user to profile and cart.
Look for dim red objects with no path from any root.

Run mark-and-sweep garbage collection:
Open Garbage Collection.
Click Step: Mark Phase to mark reachable objects.
Click Step: Sweep Phase to remove unreachable objects.
Check before/after counts and the GC action log.

Run a call stack sample and step through the recorded frames:
Open Call Stack.
Select Recursive factorial.
Click Run Selected Sample.
Use step controls to watch calls push frames and returns pop frames.

Run an event loop snippet and observe real execution order:
Open Event Loop.
Select Promise before timeout.
Click Run Selected Snippet.
Replay the sequence and observe that the promise microtask executes before the timeout macrotask.

Export the workspace:
Open Settings.
Click Export Workspace JSON.
Save the generated JSON file for sharing, backup, or later import.
