import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  displayDashboardValue,
  latestRecordsByDTag,
  parseDashboardManifest,
  readDashboardPath,
  selectDashboardDefinitions,
} from "./model.ts";

function event(overrides = {}) {
  return {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    created_at: 100,
    kind: 30078,
    tags: [
      ["d", "buzz-dashboard:operations"],
      ["t", "buzz-dashboard"],
    ],
    content: JSON.stringify({
      version: 1,
      slug: "operations",
      title: "Operations",
      panels: [
        {
          id: "summary",
          title: "Summary",
          type: "metrics",
          source: { dTag: "company.summary" },
          metrics: [{ label: "Qualified", path: "qualified" }],
        },
      ],
    }),
    sig: "c".repeat(128),
    ...overrides,
  };
}

describe("dashboard manifest", () => {
  it("parses a bounded owner-authored dashboard definition", () => {
    assert.equal(parseDashboardManifest(event())?.title, "Operations");
  });

  it("rejects HTML-like data paths and the wrong event namespace", () => {
    const invalid = event({
      content: JSON.stringify({
        version: 1,
        slug: "operations",
        title: "Operations",
        panels: [
          {
            id: "x",
            title: "X",
            type: "text",
            source: { dTag: "company.summary" },
            path: "<script>",
          },
        ],
      }),
    });
    assert.equal(parseDashboardManifest(invalid), null);
    assert.equal(
      parseDashboardManifest(
        event({ tags: [["d", "company-dashboard:operations"]] }),
      ),
      null,
    );
  });

  it("accepts only owner events and keeps the latest version per slug", () => {
    const older = event({ id: "1".repeat(64), created_at: 100 });
    const newer = event({ id: "2".repeat(64), created_at: 101 });
    const other = event({ pubkey: "d".repeat(64), created_at: 102 });
    const definitions = selectDashboardDefinitions(
      [older, newer, other],
      "b".repeat(64),
    );
    assert.equal(definitions.length, 1);
    assert.equal(definitions[0].event.id, newer.id);
  });
});

describe("dashboard record helpers", () => {
  it("resolves nested paths and display values without evaluating content", () => {
    assert.equal(readDashboardPath({ a: { b: 3 } }, "a.b"), 3);
    assert.equal(readDashboardPath({ a: [] }, "a.0"), undefined);
    assert.equal(displayDashboardValue(false), "false");
    assert.equal(displayDashboardValue(undefined), "—");
  });

  it("uses deterministic latest-event selection", () => {
    const first = event({
      id: "1".repeat(64),
      tags: [["d", "company.summary"]],
    });
    const second = event({
      id: "2".repeat(64),
      tags: [["d", "company.summary"]],
    });
    assert.equal(
      latestRecordsByDTag([first, second]).get("company.summary")?.id,
      second.id,
    );
  });

  it("rejects records from authors the manifest did not authorize", () => {
    const owner = "b".repeat(64);
    const attacker = event({
      id: "9".repeat(64),
      pubkey: "d".repeat(64),
      created_at: 999,
      tags: [["d", "company.summary"]],
    });
    const trusted = event({
      id: "1".repeat(64),
      pubkey: owner,
      tags: [["d", "company.summary"]],
    });
    const allowed = new Map([["company.summary", new Set([owner])]]);
    assert.equal(
      latestRecordsByDTag([trusted, attacker], allowed).get("company.summary")
        ?.id,
      trusted.id,
    );
  });
});
