import { updateCourseSession } from "@/lib/services/courseSessionService";
import type { CourseSession, CourseSessionStatus } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  HStack,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useState } from "react";

const STATUS_COLOR: Record<CourseSessionStatus, string> = {
  scheduled: "gray",
  completed: "green",
  missed: "red",
  made_up: "blue",
};

export function CourseSessionCard({
  session,
  onUpdated,
  courseName,
  areaColor,
}: {
  session: CourseSession;
  onUpdated: () => void;
  courseName?: string;
  areaColor?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(session.notes ?? "");
  const [status, setStatus] = useState<CourseSessionStatus>(session.status);
  const [saving, setSaving] = useState(false);

  const dateLabel = new Date(session.date).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCourseSession(session.id, { notes, status });
      onUpdated();
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      borderWidth={1}
      borderRadius="md"
      p={3}
      bg="bg.subtle"
      borderLeftWidth={areaColor ? 4 : 1}
      style={areaColor ? { borderLeftColor: areaColor } : undefined}
    >
      <HStack justify="space-between" flexWrap="wrap" gap={2}>
        <HStack align="flex-start" gap={3}>
          <Stack gap={0}>
            {courseName && (
              <Text alignSelf="flex-start" fontWeight="semibold" fontSize="sm">
                {courseName}
              </Text>
            )}
            <Text
              fontWeight="medium"
              fontSize="sm"
              color={courseName ? "fg.muted" : undefined}
            >
              {dateLabel}
            </Text>
          </Stack>
          <Badge
            colorPalette={STATUS_COLOR[session.status]}
            variant="subtle"
            size="sm"
          >
            {session.status.replace("_", " ")}
          </Badge>
        </HStack>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            setNotes(session.notes ?? "");
            setStatus(session.status);
            setExpanded((v) => !v);
          }}
        >
          {expanded ? "Close" : "Edit"}
        </Button>
      </HStack>

      {!expanded && session.notes && (
        <Text fontSize="sm" color="fg.muted" mt={2} whiteSpace="pre-wrap">
          {session.notes}
        </Text>
      )}

      {expanded && (
        <Stack gap={3} mt={3}>
          <NativeSelect.Root size="sm">
            <NativeSelect.Field
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseSessionStatus)}
            >
              {(["scheduled", "completed", "missed", "made_up"] as const).map(
                (s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ),
              )}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes / agenda for this session…"
            rows={3}
            size="sm"
          />
          <HStack>
            <Button size="xs" loading={saving} onClick={handleSave}>
              Save
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </Button>
          </HStack>
        </Stack>
      )}
    </Box>
  );
}
