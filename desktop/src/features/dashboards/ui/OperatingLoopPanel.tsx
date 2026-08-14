import { Play, Route } from "lucide-react";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { useChannelsQuery } from "@/features/channels/hooks";
import {
  useRunApprovalsQuery,
  useTriggerWorkflowMutation,
  useWorkflowRunsQuery,
} from "@/features/workflows/hooks";
import { WorkflowRunTrace } from "@/features/workflows/ui/WorkflowRunTrace";
import type { Workflow } from "@/shared/api/types";
import { getChannelsWorkflows } from "@/shared/api/tauriWorkflows";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

function WorkflowLoopCard({ workflow }: { workflow: Workflow }) {
  const runsQuery = useWorkflowRunsQuery(workflow.id);
  const triggerMutation = useTriggerWorkflowMutation(workflow.id);
  const latestRun = runsQuery.data?.[0] ?? null;
  const approvalsQuery = useRunApprovalsQuery(
    workflow.id,
    latestRun?.id ?? null,
  );

  return (
    <article
      className="rounded-lg border border-border/70 bg-card p-4 shadow-sm"
      data-testid={`dashboard-workflow-${workflow.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{workflow.name}</h4>
            <Badge
              variant={
                latestRun?.status === "completed" ? "success" : "secondary"
              }
            >
              {latestRun?.status?.replace(/_/g, " ") ?? "ready"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Signed trigger → approval → execution → evidence
          </p>
        </div>
        <Button
          disabled={triggerMutation.isPending || workflow.status !== "active"}
          onClick={() => triggerMutation.mutate()}
          size="sm"
          variant="outline"
        >
          <Play className="mr-2 h-4 w-4" />
          {triggerMutation.isPending ? "Starting…" : "Start run"}
        </Button>
      </div>
      {triggerMutation.error ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {triggerMutation.error instanceof Error
            ? triggerMutation.error.message
            : "The workflow could not be started."}
        </p>
      ) : null}
      {latestRun ? (
        <div className="mt-4">
          <WorkflowRunTrace
            approvals={approvalsQuery.data ?? []}
            run={latestRun}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No run has started yet.
        </div>
      )}
    </article>
  );
}

export function OperatingLoopPanel() {
  const channelsQuery = useChannelsQuery();
  const channelIds = React.useMemo(
    () =>
      (channelsQuery.data ?? [])
        .filter((channel) => channel.isMember)
        .map((channel) => channel.id)
        .sort(),
    [channelsQuery.data],
  );
  const channelKey = channelIds.join(",");
  const workflowsQuery = useQuery({
    queryKey: ["dashboard", "operating-loop", channelKey],
    queryFn: () => getChannelsWorkflows(channelIds),
    enabled: channelIds.length > 0,
    staleTime: 30_000,
  });
  const workflows = workflowsQuery.data ?? [];

  return (
    <section data-testid="dashboard-operating-loop">
      <div className="mb-3 flex items-center gap-2">
        <Route className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold">Operating loop</h3>
        {workflows.length > 0 ? (
          <Badge variant="secondary">{workflows.length}</Badge>
        ) : null}
      </div>
      {channelsQuery.isLoading || workflowsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading workflows…</div>
      ) : channelsQuery.error || workflowsQuery.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Community workflows could not be loaded.
        </div>
      ) : workflows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
          No operating workflow has been published yet. Create a workflow with
          an approval gate to turn this dashboard into an action surface.
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <WorkflowLoopCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </section>
  );
}
