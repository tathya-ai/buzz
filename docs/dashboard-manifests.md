# Dashboard manifests

Buzz dashboards are owner-published operating views over signed relay records.
They provide a native desktop surface for metrics, status text, lists, and raw
JSON without giving dashboard definitions permission to execute code or render
HTML.

Dashboards are a desktop preview feature. Enable **Dashboards** in Settings →
Experiments, then open **Dashboards** in the sidebar.

## Manifest event

A dashboard manifest is a kind `30078` event with:

- a `d` tag beginning with `buzz-dashboard:`
- a `t` tag equal to `buzz-dashboard`
- JSON content matching version 1 of the schema below
- the community owner's signature

The client ignores dashboard manifests published by other members. If multiple
owner events describe the same `slug`, the latest event wins with event id as
the deterministic same-second tie-break.

```json
{
  "version": 1,
  "slug": "operations",
  "title": "Operations",
  "description": "Current operating signals.",
  "panels": [
    {
      "id": "summary",
      "title": "Summary",
      "type": "metrics",
      "source": { "dTag": "company.operations.summary", "author": "owner" },
      "metrics": [
        { "label": "Qualified", "path": "qualified" },
        { "label": "Target", "path": "target", "suffix": "/week" }
      ]
    },
    {
      "id": "direction",
      "title": "Direction",
      "type": "text",
      "source": { "dTag": "company.operations.direction" },
      "path": "statement",
      "emptyText": "No direction has been published."
    },
    {
      "id": "priorities",
      "title": "Priorities",
      "type": "list",
      "source": { "dTag": "company.operations.priorities", "author": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
      "path": "items",
      "itemTitlePath": "title",
      "itemBodyPath": "context",
      "limit": 10
    }
  ]
}
```

## Data records

Each panel points to a `d` tag on another kind `30078` event. Its optional
`source.author` is either `owner` or the exact lowercase hex pubkey of the
member or agent allowed to supply that record. Omitting it defaults to the
owner. The client ignores same-tag records from every other author, even when
they are newer. The manifest controls presentation only. Record content remains
signed JSON on the relay and is never evaluated as code.

Supported panel types:

- `metrics`: labeled values read from paths in one JSON record
- `text`: one string, number, or boolean read from a JSON path
- `list`: a bounded array with title and optional body paths per item
- `json`: an escaped diagnostic view of a record or nested path

Paths use dot-separated object keys and numeric array indexes. HTML, scripts,
templates, expressions, and remote component URLs are unsupported by design.

## Upstream boundary

This feature contains only the generic manifest contract, relay reads, and
native presentation components. Organization-specific record names, scoring,
qualification rules, agent instructions, and private data belong on the closed
relay or in downstream private repositories.
