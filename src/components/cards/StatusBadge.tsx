import type { ItemStatus } from "@/types/domain";
import { Badge } from "@chakra-ui/react";

const statusConfig: Record<
  ItemStatus,
  { label: string; colorPalette: string }
> = {
  planned: { label: "Planned", colorPalette: "gray" },
  available: { label: "Available", colorPalette: "blue" },
  in_progress: { label: "In Progress", colorPalette: "orange" },
  completed: { label: "Completed", colorPalette: "green" },
  deferred: { label: "Deferred", colorPalette: "purple" },
  cancelled: { label: "Cancelled", colorPalette: "red" },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const config = statusConfig[status] ?? {
    label: status,
    colorPalette: "gray",
  };
  return (
    <Badge colorPalette={config.colorPalette} variant="subtle">
      {config.label}
    </Badge>
  );
}
