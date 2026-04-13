import { Badge } from "@chakra-ui/react";

const statusConfig: Record<string, { label: string; colorPalette: string }> = {
  not_started: { label: "Not Started", colorPalette: "gray" },
  active: { label: "Active", colorPalette: "orange" },
  submitted: { label: "Submitted", colorPalette: "blue" },
  completed: { label: "Completed", colorPalette: "green" },
  archived: { label: "Archived", colorPalette: "gray" },
  in_progress: { label: "In Progress", colorPalette: "orange" },
  graded: { label: "Graded", colorPalette: "purple" },
  suspended: { label: "Suspended", colorPalette: "yellow" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    label: status.replace(/_/g, " "),
    colorPalette: "gray",
  };
  return (
    <Badge colorPalette={config.colorPalette} variant="subtle">
      {config.label}
    </Badge>
  );
}
