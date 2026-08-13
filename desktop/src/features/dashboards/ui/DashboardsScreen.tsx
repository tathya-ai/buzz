import { AlertCircle, Gauge, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  displayDashboardValue,
  parseRecordContent,
  readDashboardPath,
  type DashboardPanel,
} from "../model";
import { useDashboards } from "../hooks";

function MetricPanel({
  panel,
  data,
}: {
  panel: DashboardPanel;
  data: unknown;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {panel.metrics?.map((metric) => (
        <div
          className="rounded-lg border border-border/70 bg-card p-4 shadow-sm"
          key={`${panel.id}-${metric.path}`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {metric.label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {displayDashboardValue(readDashboardPath(data, metric.path))}
            {metric.suffix ?? ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function TextPanel({ panel, data }: { panel: DashboardPanel; data: unknown }) {
  const value = readDashboardPath(data, panel.path);
  return (
    <div className="whitespace-pre-wrap rounded-lg border border-border/70 bg-card p-4 text-sm leading-6 text-foreground shadow-sm">
      {value === undefined
        ? (panel.emptyText ?? "No data yet.")
        : displayDashboardValue(value)}
    </div>
  );
}

function ListPanel({ panel, data }: { panel: DashboardPanel; data: unknown }) {
  const value = readDashboardPath(data, panel.path);
  const items = Array.isArray(value) ? value.slice(0, panel.limit ?? 10) : [];
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
        {panel.emptyText ?? "No items yet."}
      </div>
    );
  }
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
      {items.map((item) => (
        <div className="p-4" key={`${panel.id}-${JSON.stringify(item)}`}>
          <div className="text-sm font-medium text-foreground">
            {displayDashboardValue(
              readDashboardPath(item, panel.itemTitlePath),
            )}
          </div>
          {panel.itemBodyPath ? (
            <div className="mt-1 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
              {displayDashboardValue(
                readDashboardPath(item, panel.itemBodyPath),
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function JsonPanel({ panel, data }: { panel: DashboardPanel; data: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg border border-border/70 bg-muted/30 p-4 text-xs text-foreground">
      {displayDashboardValue(readDashboardPath(data, panel.path))}
    </pre>
  );
}

export function DashboardsScreen() {
  const {
    definitions,
    definitionsQuery,
    membersQuery,
    records,
    recordsQuery,
    selected,
    setSelectedSlug,
  } = useDashboards();
  const loading = membersQuery.isLoading || definitionsQuery.isLoading;
  const error =
    membersQuery.error ?? definitionsQuery.error ?? recordsQuery.error;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <h1 className="truncate text-lg font-semibold">Dashboards</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner-published operating views over signed community records.
          </p>
        </div>
        <Button
          disabled={definitionsQuery.isFetching || recordsQuery.isFetching}
          onClick={() => {
            void definitionsQuery.refetch();
            void recordsQuery.refetch();
          }}
          size="sm"
          variant="outline"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">
            Loading dashboards…
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Dashboard records could not be loaded from this community.
            </div>
          </div>
        ) : !selected ? (
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border p-8 text-center">
            <Gauge className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-base font-semibold">
              No dashboard published
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A community owner can publish a kind 30078 dashboard manifest
              tagged
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5">
                buzz-dashboard
              </code>
              to make a signed operating view appear here.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {selected.manifest.title}
                </h2>
                {selected.manifest.description ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {selected.manifest.description}
                  </p>
                ) : null}
              </div>
              {definitions.length > 1 ? (
                <label className="text-xs font-medium text-muted-foreground">
                  View
                  <select
                    className="ml-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    onChange={(event) => setSelectedSlug(event.target.value)}
                    value={selected.manifest.slug}
                  >
                    {definitions.map((definition) => (
                      <option
                        key={definition.manifest.slug}
                        value={definition.manifest.slug}
                      >
                        {definition.manifest.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="space-y-7">
              {selected.manifest.panels.map((panel) => {
                const data = parseRecordContent(records.get(panel.source.dTag));
                return (
                  <section key={panel.id}>
                    <h3 className="mb-3 text-base font-semibold">
                      {panel.title}
                    </h3>
                    {panel.type === "metrics" ? (
                      <MetricPanel data={data} panel={panel} />
                    ) : panel.type === "text" ? (
                      <TextPanel data={data} panel={panel} />
                    ) : panel.type === "list" ? (
                      <ListPanel data={data} panel={panel} />
                    ) : (
                      <JsonPanel data={data} panel={panel} />
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
