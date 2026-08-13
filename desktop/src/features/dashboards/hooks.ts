import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useRelayMembersQuery } from "@/features/community-members/hooks";
import { relayClient } from "@/shared/api/relayClient";
import type { RelayEvent } from "@/shared/api/types";
import {
  DASHBOARD_KIND,
  DASHBOARD_TAG,
  latestRecordsByDTag,
  selectDashboardDefinitions,
  type DashboardDefinition,
} from "./model";

const dashboardDefinitionsQueryKey = (ownerPubkey: string | null) =>
  ["dashboards", "definitions", ownerPubkey] as const;
const dashboardRecordsQueryKey = (sourceKey: string) =>
  ["dashboards", "records", sourceKey] as const;

function useLiveDashboardInvalidation(
  ownerPubkey: string | null,
  dTags: string[],
  authors: string[],
  sourceKey: string,
) {
  const queryClient = useQueryClient();
  const dTagKey = dTags.join("\u0000");

  React.useEffect(() => {
    if (!ownerPubkey) return;
    const subscribedDTags = dTagKey ? dTagKey.split("\u0000") : [];
    let cancelled = false;
    const unsubs: Array<() => Promise<void>> = [];

    const attach = async (
      filter: Parameters<typeof relayClient.subscribeLive>[0],
      queryKey: readonly unknown[],
    ) => {
      try {
        const unsub = await relayClient.subscribeLive(filter, () => {
          void queryClient.invalidateQueries({ queryKey });
        });
        if (cancelled) {
          void unsub();
        } else {
          unsubs.push(unsub);
        }
      } catch {
        // Focused polling remains the freshness backstop when live setup fails.
      }
    };

    void attach(
      {
        kinds: [DASHBOARD_KIND],
        authors: [ownerPubkey],
        "#t": [DASHBOARD_TAG],
        limit: 0,
      },
      dashboardDefinitionsQueryKey(ownerPubkey),
    );
    if (subscribedDTags.length > 0) {
      void attach(
        {
          kinds: [DASHBOARD_KIND],
          "#d": subscribedDTags,
          authors,
          limit: 0,
        },
        dashboardRecordsQueryKey(sourceKey),
      );
    }

    const unsubscribeReconnect = relayClient.subscribeToReconnects(() => {
      void queryClient.invalidateQueries({
        queryKey: dashboardDefinitionsQueryKey(ownerPubkey),
      });
      if (subscribedDTags.length > 0) {
        void queryClient.invalidateQueries({
          queryKey: dashboardRecordsQueryKey(sourceKey),
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribeReconnect();
      for (const unsubscribe of unsubs) void unsubscribe();
    };
  }, [authors, dTagKey, ownerPubkey, queryClient, sourceKey]);
}

export function useDashboards() {
  const membersQuery = useRelayMembersQuery();
  const ownerPubkey =
    membersQuery.data?.find((member) => member.role === "owner")?.pubkey ??
    null;

  const definitionsQuery = useQuery<DashboardDefinition[]>({
    enabled: ownerPubkey !== null,
    queryKey: dashboardDefinitionsQueryKey(ownerPubkey),
    queryFn: async () => {
      if (!ownerPubkey) return [];
      const events = await relayClient.fetchEvents({
        kinds: [DASHBOARD_KIND],
        authors: [ownerPubkey],
        "#t": [DASHBOARD_TAG],
        limit: 50,
      });
      return selectDashboardDefinitions(events, ownerPubkey);
    },
    refetchInterval: 60_000,
  });

  const definitions = definitionsQuery.data ?? [];
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
  const selected =
    definitions.find(
      (definition) => definition.manifest.slug === selectedSlug,
    ) ??
    definitions[0] ??
    null;
  const recordSources = React.useMemo(() => {
    const allowedAuthorsByDTag = new Map<string, Set<string>>();
    if (!selected || !ownerPubkey) return allowedAuthorsByDTag;
    for (const panel of selected.manifest.panels) {
      const author =
        !panel.source.author || panel.source.author === "owner"
          ? ownerPubkey
          : panel.source.author;
      const authors = allowedAuthorsByDTag.get(panel.source.dTag) ?? new Set();
      authors.add(author.toLowerCase());
      allowedAuthorsByDTag.set(panel.source.dTag, authors);
    }
    return allowedAuthorsByDTag;
  }, [ownerPubkey, selected]);
  const dTags = React.useMemo(
    () => [...recordSources.keys()].sort(),
    [recordSources],
  );
  const authors = React.useMemo(
    () =>
      [
        ...new Set([...recordSources.values()].flatMap((set) => [...set])),
      ].sort(),
    [recordSources],
  );
  const sourceKey = React.useMemo(
    () =>
      dTags
        .map(
          (dTag) =>
            `${dTag}:${[...(recordSources.get(dTag) ?? [])].sort().join(",")}`,
        )
        .join("|"),
    [dTags, recordSources],
  );

  const recordsQuery = useQuery<Map<string, RelayEvent>>({
    enabled: dTags.length > 0,
    queryKey: dashboardRecordsQueryKey(sourceKey),
    queryFn: async () => {
      const events = await relayClient.fetchEvents({
        kinds: [DASHBOARD_KIND],
        "#d": dTags,
        authors,
        limit: Math.max(100, dTags.length * 10),
      });
      return latestRecordsByDTag(events, recordSources);
    },
    refetchInterval: 60_000,
  });

  useLiveDashboardInvalidation(ownerPubkey, dTags, authors, sourceKey);

  return {
    definitions,
    definitionsQuery,
    membersQuery,
    ownerPubkey,
    records: recordsQuery.data ?? new Map<string, RelayEvent>(),
    recordsQuery,
    selected,
    setSelectedSlug,
  };
}
