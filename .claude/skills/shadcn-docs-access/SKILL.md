---
name: shadcn-docs-access
description: Use when needing to look up shadcn component information, browse available components, get installation instructions, or understand component APIs. Provides efficient access to shadcn/ui documentation via MCP tools (always available) and llms.txt fallback. Triggers on shadcn/ui component questions, component lookup requests, or when building UIs with shadcn. (project)
---

# Accessing shadcn/ui Documentation

Access shadcn/ui component library documentation via the `shadcn` MCP server configured in `.mcp.json`.

## MCP Tools (Recommended)

The `shadcn` MCP server provides direct registry access. **Always use MCP tools first.**

### Available Tools

| Tool                                             | Purpose                                            |
| ------------------------------------------------ | -------------------------------------------------- |
| `mcp__shadcn__get_project_registries`            | List configured registries (check components.json) |
| `mcp__shadcn__search_items_in_registries`        | Fuzzy search for components by name/description    |
| `mcp__shadcn__list_items_in_registries`          | Browse all items in registries (paginated)         |
| `mcp__shadcn__view_items_in_registries`          | Get detailed info: type, files, dependencies       |
| `mcp__shadcn__get_item_examples_from_registries` | Find usage examples and demo code                  |
| `mcp__shadcn__get_add_command_for_items`         | Get CLI install command for items                  |
| `mcp__shadcn__get_audit_checklist`               | Post-creation verification checklist               |

### Usage Patterns

**Check available registries:**

```
mcp__shadcn__get_project_registries()
```

**Search for components:**

```
mcp__shadcn__search_items_in_registries({ registries: ["@shadcn"], query: "button" })
mcp__shadcn__search_items_in_registries({ registries: ["@shadcn"], query: "form", limit: 5 })
```

**Get component details:**

```
mcp__shadcn__view_items_in_registries({ items: ["@shadcn/button"] })
mcp__shadcn__view_items_in_registries({ items: ["@shadcn/dialog", "@shadcn/card"] })
```

**Find usage examples:**

```
mcp__shadcn__get_item_examples_from_registries({ registries: ["@shadcn"], query: "button-demo" })
mcp__shadcn__get_item_examples_from_registries({ registries: ["@shadcn"], query: "form example" })
```

**Get install command:**

```
mcp__shadcn__get_add_command_for_items({ items: ["@shadcn/button", "@shadcn/card"] })
# Returns: pnpm dlx shadcn@latest add @shadcn/button @shadcn/card
```

**Post-creation audit:**

```
mcp__shadcn__get_audit_checklist()
```

## Decision Tree

```
Need shadcn component info?
├─ "What components exist?" → search_items_in_registries or list_items_in_registries
├─ "How do I use X?" → get_item_examples_from_registries (query: "X-demo")
├─ "What are X's dependencies?" → view_items_in_registries
├─ "Install X" → get_add_command_for_items, then run the command
├─ "Verify my component works" → get_audit_checklist
└─ MCP unavailable → WebFetch llms.txt fallback (see below)
```

## WebFetch Fallback

Use **only if MCP tools are unavailable**.

### llms.txt

```
https://ui.shadcn.com/llms.txt
```

Structured index of all documentation sections, component categories, and framework guides.

### Direct URL Patterns

| Content Type   | URL Pattern                                           |
| -------------- | ----------------------------------------------------- |
| Component docs | `https://ui.shadcn.com/docs/components/{name}`        |
| Installation   | `https://ui.shadcn.com/docs/installation/{framework}` |
| Themes         | `https://ui.shadcn.com/docs/theming`                  |
| CLI reference  | `https://ui.shadcn.com/docs/cli`                      |
| MCP docs       | `https://ui.shadcn.com/docs/mcp`                      |
| Dark mode      | `https://ui.shadcn.com/docs/dark-mode/{framework}`    |

**Frameworks**: `next`, `vite`, `remix`, `astro`, `laravel`, `gatsby`, `manual`

## Common Mistakes

| Mistake                                 | Fix                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Using wrong tool names (`getComponent`) | Use actual names: `search_items_in_registries`, `view_items_in_registries` |
| Forgetting registry prefix              | Items need `@shadcn/` prefix: `["@shadcn/button"]` not `["button"]`        |
| Not checking registries first           | Run `get_project_registries` to see what's configured                      |
| Skipping examples                       | Use `get_item_examples_from_registries` for real usage patterns            |
