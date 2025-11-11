## 🧩 Rule: Component Documentation in `widgets/<name>/README.md`

For each new UI component (widget), the agent **must** create or update a file  
`widgets/<widget-name>/README.md` describing the component in a **complete, reproducible** form.  
The README must contain enough structured information for another agent to recreate or refactor the component from scratch **without external context**.

### Required structure of the README

#### 1. Name
Short, unique component name.  
**Example:** `UserPanel`, `DataListView`

#### 2. Purpose
One paragraph describing what the component does and in what context it is used.

#### 3. Visual Overview
- ASCII mockup or link to an image.
- Colors, spacing, proportions, transparency.
- State variants (default, hover, active, disabled, loading, empty).

#### 4. Behavior
Describe how the component reacts to user input, system events, and data updates.  
Use clear, declarative sentences such as:
- “On click, triggers `onSelect` callback.”
- “If content exceeds container width, show horizontal scroll buttons.”
- “Hover adds subtle shadow.”
- “Drag moves the element within its parent area.”

#### 5. API (Props / Inputs / Outputs)
Use a table format:

| Name          | Type                          | Default      | Description                         |
|---------------|-------------------------------|--------------|-------------------------------------|
| `items`       | `List<Item>`                  | `[]`         | Data elements to render             |
| `onSelect`    | `(Item) -> Unit`              | —            | Triggered when user selects an item |
| `orientation` | `enum {horizontal, vertical}` | `horizontal` | Display direction                   |

#### 6. States and Examples
Describe how the component behaves under different conditions:
- Empty state
- Normal state with content
- Overflow or pagination
- Error / loading

#### 7. Lifecycle
- When to initialize, update, and destroy the component.
- Which listeners or observers need cleanup.
- Dependencies (CSS files, assets, external libraries).

#### 8. Integration Example
Provide a minimal code snippet showing how the component is used in context:

```html
<DataListView
    items={items}
    orientation="horizontal"
    onSelect={handleSelect}
/>
```
---

### Formatting Rules
- Use Markdown headings (`##`, `###`) for section titles.
- The README must be **machine-readable**, **self-contained**, and sufficient for regeneration by another agent.
