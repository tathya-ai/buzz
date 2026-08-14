import { Bot, Circle } from "lucide-react";

import { useRelayAgentsQuery } from "@/features/agents/hooks";
import { Badge } from "@/shared/ui/badge";

const statusClass = {
  online: "fill-green-500 text-green-500",
  away: "fill-amber-500 text-amber-500",
  offline: "fill-muted-foreground text-muted-foreground",
} as const;

export function AgentTeamPanel() {
  const agentsQuery = useRelayAgentsQuery();
  const agents = agentsQuery.data ?? [];

  return (
    <section data-testid="dashboard-agent-team">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold">Agent team</h3>
        {agents.length > 0 ? (
          <Badge variant="secondary">{agents.length}</Badge>
        ) : null}
      </div>
      {agentsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading agents…</div>
      ) : agentsQuery.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Agent presence could not be loaded from this community.
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
          No relay agent profiles have been published yet. Agents appear here
          after they publish their signed Buzz profile.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <article
              className="rounded-lg border border-border/70 bg-card p-4 shadow-sm"
              key={agent.pubkey}
            >
              <div className="flex items-center gap-2">
                <Circle
                  className={`h-2.5 w-2.5 ${statusClass[agent.status]}`}
                />
                <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {agent.name}
                </div>
                <Badge variant="secondary">{agent.agentType}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {agent.capabilities.length > 0 ? (
                  agent.capabilities.map((capability) => (
                    <Badge key={capability} variant="outline">
                      {capability}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No capabilities published
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {agent.channels.length} channel
                {agent.channels.length === 1 ? "" : "s"} · {agent.status}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
