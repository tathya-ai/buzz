import { Check, LoaderCircle, X } from "lucide-react";
import * as React from "react";

import { useApprovalMutation } from "@/features/workflows/hooks";
import type { WorkflowApproval } from "@/shared/api/types";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

type WorkflowApprovalCardProps = {
  approval: WorkflowApproval;
};

export function WorkflowApprovalCard({ approval }: WorkflowApprovalCardProps) {
  const isExpired = new Date(approval.expiresAt) < new Date();
  const [note, setNote] = React.useState("");
  const approvalMutation = useApprovalMutation();

  if (approval.status !== "pending" || isExpired) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
      data-testid="workflow-approval-card"
    >
      <p className="mb-2 text-sm font-medium">Approval Required</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Approver: {approval.approverSpec}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        Expires: {new Date(approval.expiresAt).toLocaleString()}
      </p>
      <Textarea
        aria-label="Decision note (optional)"
        className="mb-2 min-h-16 resize-y text-xs"
        disabled={approvalMutation.isPending}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Decision note (optional)"
        value={note}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={approvalMutation.isPending}
          onClick={() =>
            approvalMutation.mutate({
              token: approval.approvalRef,
              action: "grant",
              note: note.trim() || undefined,
            })
          }
          size="sm"
        >
          {approvalMutation.isPending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Approve
        </Button>
        <Button
          disabled={approvalMutation.isPending}
          onClick={() =>
            approvalMutation.mutate({
              token: approval.approvalRef,
              action: "deny",
              note: note.trim() || undefined,
            })
          }
          size="sm"
          variant="outline"
        >
          <X className="mr-2 h-4 w-4" />
          Deny
        </Button>
      </div>
      {approvalMutation.error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {approvalMutation.error instanceof Error
            ? approvalMutation.error.message
            : "The decision could not be recorded."}
        </p>
      ) : null}
    </div>
  );
}
