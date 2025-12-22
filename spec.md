# budget-flow-map – Specification

## 1. Overview

**budget-flow-map** is a web-based visualization tool that presents Japanese government budget
and spending flows as an interactive, map-like structure.

Instead of relying on drill-down interactions or Top-N filtering,
the system emphasizes **holistic structural understanding**
through zooming, panning, and spatial exploration.

---

## 2. Background & Motivation

### 2.1 Problem Statement

Existing approaches to visualizing government budgets suffer from:

- Excessive fragmentation due to drill-down UX
- Loss of global context when filtering by Top-N
- Visual overload and unreadability in large Sankey diagrams
- Strong coupling between interaction steps and comprehension

### 2.2 Prior Work

- Previous repository:
  https://github.com/igomuni/marumie-rssystem
  - Used Nivo Sankey
  - Relied on Top-N + drill-down approach
  - Confirmed scalability and UX limitations

### 2.3 Design Inspiration

- U.S. Department of Energy (DOE) official website
  http://www.departmentof.energy/

Key inspirations:
- Calm, authoritative information hierarchy
- Generous whitespace
- Progressive disclosure without explicit drill-down

---

## 3. Core Design Principles

1. **No Mandatory Drill-Down**
   - All entities exist in a single continuous space

2. **Map-like Interaction**
   - Zoom in/out to change semantic resolution
   - Pan to explore neighboring structures
   - Focus without context loss

3. **Structural First, Detail Second**
   - Shape, density, and flow direction matter more than labels
   - Textual detail appears only when relevant

4. **Scalability by Design**
   - Thousands of nodes/edges should be a normal case

5. **No Aggregation or Clustering**
   - All nodes are rendered individually
   - TopN filtering is strictly prohibited

---

## 4. Data Model

### 4.1 Input

- Source: RS system CSV data (FY2024)
- Core entities:
  - Budget categories
  - Projects / programs
  - Spending destinations
  - Monetary amounts
  - Fiscal year

### 4.2 Graph Structure (5-Layer Sankey DAG)

```
[Ministry] → [Bureau] → [Division] → [Project] → [Recipient]
    ↓           ↓           ↓            ↓
  Layer0     Layer1      Layer2       Layer3       Layer4
```

- All 5 layers are rendered as independent nodes
- Edges connect only adjacent layers (Ministry→Bureau, Bureau→Division, etc.)
- Recipients are expressed as edge endpoints from Projects

### 4.3 Internal Representation

- Directed weighted graph (DAG-like)
- Nodes:
  - `id`
  - `type` (ministry / bureau / division / project / recipient)
  - `amount`
  - `layer` (0-4)
- Edges:
  - `source`
  - `target`
  - `value`

Pre-aggregation and clustering are NOT allowed.
All underlying entities must be individually preserved and rendered.

---

## 5. Visualization Architecture

### 5.1 Rendering Strategy

| Layer | Technology | Purpose |
|-----|-----------|---------|
| Base graph | WebGL / Canvas | Large-scale node & edge rendering |
| Interaction | Overlay (SVG / HTML) | Hover, focus, labels |
| UI shell | React | State & layout |

### 5.2 Layout Strategy

- **Build-time pre-calculation**: Layout positions are computed during build and stored as JSON
- Client-side is responsible for rendering only
- Sankey-like left-to-right flow-aware spatial layout
- Emphasis on:
  - Flow continuity
  - Layer-based horizontal positioning
  - Visual density as information

Layout must be **stable across interactions** to preserve mental maps.

### 5.3 Scale Requirements

- **Node count**: 10,000 - 30,000
- **Edge count**: Tens of thousands
- **Target frame rate**: 60fps during zoom/pan operations

---

## 6. Visual Language

### 6.1 Node Design

**Color (Hybrid approach)**:
- Base hue: Determined by ministry category (e.g., MHLW=blue, MLIT=green)
- Saturation: Varies by node type (Ministry=high, Division=medium, Project=low)
- Lightness: Varies by amount scale (Large=bright, Small=dark)

**Size**:
- Proportional to budget/spending amount (linear scale)
- Minimum size threshold to ensure visibility

### 6.2 Edge Design

- **Width**: Linear proportion to amount
- **Color**: Inherits upstream node (ministry) color
- **Shape**: Sankey-style Bezier curves (emphasizing horizontal flow)
- **Opacity**:
  - Normal: 30%
  - Hover-related: 100%
  - Non-related: 10%

### 6.3 Label Display (Zoom-Linked)

| Zoom Level | Visible Content | Labels |
|------------|-----------------|--------|
| Overview (1x) | Overall structure, ministry nodes prominent | Ministry names only |
| Medium (2-4x) | Bureau/Division levels become identifiable | Bureau names shown |
| Detail (5x+) | Project level individually identifiable | Project names shown |

- Zoom is continuous (not discrete steps)
- Labels appear progressively based on zoom level

---

## 7. Interaction Design

### 7.1 Required

**Hover**:
- Highlight directly connected edges only
- Display node details in tooltip

**Click (Google Maps style)**:
- Display detailed information in left-side panel
- Tab switching: Basic Info / Related Recipients / Flow Context
- Viewport does NOT change (no drill-down)

**Zoom/Pan**:
- Mouse wheel for zoom
- Drag to pan
- Double-click to zoom in (optional)

### 7.2 Optional

- Search & locate
- Temporal switching (future: multiple years)

### 7.3 Explicitly Excluded

- Step-based drill-down
- Modal-heavy navigation
- Pagination-based exploration
- TopN filtering
- Visual aggregation/clustering

---

## 8. Technology Stack

### 8.1 Frontend

- React
- TypeScript
- Zustand (lightweight state management)

### 8.2 Visualization (Candidates)

- **Primary**: deck.gl (ScatterplotLayer + PathLayer) or PixiJS
- **Layout calculation**: d3-sankey or dagre (build-time only)
- **Overlay**: DOM/SVG for labels and tooltips

Nivo is explicitly excluded.

### 8.3 Build Pipeline

- Vite
- ESLint / Prettier
- Build-time layout computation (Node.js script)
- CSV parsing with streaming support

---

## 9. Non-Goals

- Accounting-level precision UI
- Mobile-first optimization (tablet support is sufficient)
- Explanatory storytelling mode (this is an exploration tool)
- Multiple fiscal year support (FY2024 only for initial release)

---

## 10. Deferred Decisions

The following will be determined iteratively after initial implementation:

| Item | Priority | Reason |
|------|----------|--------|
| Search functionality details | Medium | Can be added after core features |
| Zero-amount item handling | Medium | Requires real data testing |
| Initial viewport design | Medium | Requires prototype validation |
| Accessibility requirements | Low | Can be addressed progressively |
| Print/static export | Low | Out of scope |
| Multi-year support | Low | Future extension |

---

## 11. Philosophy

This project treats public finance not as a table to be read,
but as a **structure to be navigated**.

Understanding emerges from spatial familiarity,
not from clicking deeper.

The goal is to enable users to **"get familiar by gazing"**
rather than **"understand by operating"**.

---

## 12. Architectural Constraints

1. **No TopN** - All nodes must be individually rendered
2. **No Drill-down** - Clicks show info panels, never change the view
3. **Performance First** - 60fps is the minimum acceptable frame rate
4. **Traditional Sankey Flow** - Left-to-right directionality is maintained
5. **Build-time Layout** - Client only renders pre-computed positions
