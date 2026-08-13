import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { usePreviewFeatureWarning } from "@/shared/features";
import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const DashboardsScreen = React.lazy(async () => {
  const module = await import("@/features/dashboards/ui/DashboardsScreen");
  return { default: module.DashboardsScreen };
});

export const Route = createFileRoute("/dashboards")({
  component: DashboardsRouteComponent,
});

function DashboardsRouteComponent() {
  usePreviewFeatureWarning("dashboards");
  return (
    <React.Suspense
      fallback={<ViewLoadingFallback includeHeader kind="dashboards" />}
    >
      <DashboardsScreen />
    </React.Suspense>
  );
}
