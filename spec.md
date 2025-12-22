# budget-flow-map – Specification

## 1. Overview

**budget-flow-map** is a web-based visualization tool that presents government budget
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

---

## 4. Data Model

### 4.1 Input

- Source: RS system CSV data
- Core entities:
  - Budget categories
  - Projects / programs
  - Spending destinations
  - Monetary amounts
  - Fiscal year

### 4.2 Internal Representation

- Directed weighted graph (DAG-like)
- Nodes:
  - `id`
  - `type` (budget / project / destination)
  - `amount`
- Edges:
  - `source`
  - `target`
  - `value`

Pre-aggregation and clustering are allowed,
but must not erase the existence of underlying entities.

---

## 5. Visualization Architecture

### 5.1 Rendering Strategy

| Layer | Technology | Purpose |
|-----|-----------|---------|
| Base graph | WebGL / Canvas | Large-scale node & edge rendering |
| Interaction | Overlay (SVG / HTML) | Hover, focus, labels |
| UI shell | React | State & layout |

### 5.2 Layout Strategy

- Force-directed or flow-aware spatial layout
- Emphasis on:
  - Flow continuity
  - Cluster proximity
  - Visual density as information

Layout must be **stable across interactions** to preserve mental maps.

---

## 6. Interaction Design

### Required
- Zoom (semantic + geometric)
- Pan
- Hover focus
- Highlight flow paths

### Optional
- Search & locate
- Temporal switching (year)

### Explicitly Excluded
- Step-based drill-down
- Modal-heavy navigation
- Pagination-based exploration

---

## 7. Technology Stack (Proposed)

### Frontend
- React
- TypeScript
- Zustand or equivalent lightweight state management

### Visualization Candidates
- D3 (low-level, custom rendering)
- deck.gl
- PixiJS
- regl-based custom WebGL

Nivo is explicitly excluded.

### Tooling
- Vite
- ESLint / Prettier
- CSV parsing with streaming support

---

## 8. Non-Goals

- Accounting-level precision UI
- Mobile-first optimization (tablet support is sufficient)
- Explanatory storytelling mode (this is an exploration tool)

---

## 9. Future Extensions

- Multi-country comparison
- Narrative overlays
- AI-assisted pattern detection
- Exportable static views for reports

---

## 10. Philosophy

This project treats public finance not as a table to be read,
but as a structure to be navigated.

Understanding emerges from spatial familiarity,
not from clicking deeper.
