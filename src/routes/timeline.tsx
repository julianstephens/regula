import { AppLink } from "@/components/ui/app-link";
import { DEFAULT_BLOCK_WEEKS, getRestWeek } from "@/lib/blocks";
import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import pb from "@/lib/pocketbase";
import { listPrograms } from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import { listTimeline } from "@/lib/services/timelineService";
import type { ItemEvent, Program, StudySession } from "@/types/domain";
import { Badge, Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const eventColors: Record<string, string> = {
  created: "gray",
  scheduled: "blue",
  started: "orange",
  completed: "green",
  deferred: "purple",
  reopened: "cyan",
  cancelled: "red",
  edited: "gray",
};

type RestWeekEntry = {
  kind: "rest_week";
  timestamp: string;
  program: Program;
  restStart: Date;
  restEnd: Date;
};

type MixedEntry =
  | {
    kind: "event" | "session";
    timestamp: string;
    data: ItemEvent | StudySession;
  }
  | RestWeekEntry;

export default function Timeline() {
  const qc = useQueryClient();

  const { data: rawEntries = [], isLoading } = useQuery({
    queryKey: ["timeline"],
    queryFn: () => listTimeline(80),
  });

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const { data: allPrograms = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const globalDefault = settings?.block_weeks ?? DEFAULT_BLOCK_WEEKS;

  // Compute rest-week synthetic entries from block programs
  const blockPrograms = allPrograms.filter(
    (p) => p.type === "block" && p.end_date,
  );
  const restWeekEntries: RestWeekEntry[] = blockPrograms.flatMap((p) => {
    const rw = getRestWeek(p, globalDefault);
    if (!rw) return [];
    return [
      {
        kind: "rest_week" as const,
        timestamp: rw.end.toISOString(),
        program: p,
        restStart: rw.start,
        restEnd: rw.end,
      },
    ];
  });

  // Merge and sort descending
  const entries: MixedEntry[] = [
    ...(rawEntries as {
      kind: "event" | "session";
      timestamp: string;
      data: ItemEvent | StudySession;
    }[]),
    ...restWeekEntries,
  ].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Realtime refresh
  useEffect(() => {
    void pb.collection("regula_item_events").subscribe("*", () => {
      void qc.invalidateQueries({ queryKey: ["timeline"] });
    });
    void pb.collection("regula_study_sessions").subscribe("*", () => {
      void qc.invalidateQueries({ queryKey: ["timeline"] });
    });
    return () => {
      void pb.collection("regula_item_events").unsubscribe("*");
      void pb.collection("regula_study_sessions").unsubscribe("*");
    };
  }, [qc]);

  return (
    <Stack gap={6}>
      <Heading size="lg">Timeline</Heading>

      {isLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : entries.length === 0 ? (
        <Box py={12} textAlign="center" color="fg.muted">
          <Text>No activity yet.</Text>
        </Box>
      ) : (
        <Stack
          gap={0}
          borderLeft="2px solid"
          borderColor="border.subtle"
          ml={2}
        >
          {entries.map((entry, i) => {
            if (entry.kind === "rest_week") {
              const rw = entry as RestWeekEntry;
              return (
                <HStack
                  key={`rw-${rw.program.id}-${i}`}
                  align="flex-start"
                  gap={4}
                  pl={4}
                  pb={4}
                  position="relative"
                >
                  <Box
                    position="absolute"
                    left="-5px"
                    top="6px"
                    w={2}
                    h={2}
                    borderRadius="full"
                    bg="orange.solid"
                  />
                  <Box
                    flex={1}
                    p={3}
                    borderWidth={2}
                    borderRadius="md"
                    bg="orange.subtle"
                    borderColor="orange.emphasized"
                  >
                    <HStack justify="space-between">
                      <HStack>
                        <Badge colorPalette="orange" variant="subtle">
                          rest week
                        </Badge>
                        <Text fontWeight="medium" fontSize="sm">
                          {rw.program.name}
                        </Text>
                      </HStack>
                      <Text fontSize="xs" color="fg.subtle">
                        {rw.restStart.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                        {" – "}
                        {rw.restEnd.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    </HStack>
                  </Box>
                </HStack>
              );
            }

            if (entry.kind === "event") {
              const ev = entry.data as ItemEvent;
              return (
                <HStack
                  key={`e-${ev.id}-${i}`}
                  align="flex-start"
                  gap={4}
                  pl={4}
                  pb={4}
                  position="relative"
                >
                  <Box
                    position="absolute"
                    left="-5px"
                    top="6px"
                    w={2}
                    h={2}
                    borderRadius="full"
                    bg={`${eventColors[ev.event_type] ?? "gray"}.solid`}
                  />
                  <Box
                    flex={1}
                    p={3}
                    borderWidth={1}
                    borderRadius="md"
                    bg="bg.subtle"
                  >
                    <HStack justify="space-between" mb={1}>
                      <HStack>
                        <Badge
                          colorPalette={eventColors[ev.event_type] ?? "gray"}
                          variant="subtle"
                        >
                          {ev.event_type}
                        </Badge>
                        {ev.expand?.study_item && (
                          <AppLink
                            to={`/study-items/${ev.study_item}`}
                            fontWeight="medium"
                            fontSize="sm"
                            color="colorPalette.fg"
                          >
                            {ev.expand.study_item.title}
                          </AppLink>
                        )}
                      </HStack>
                      <Text fontSize="xs" color="fg.subtle">
                        {formatDate(entry.timestamp)}
                      </Text>
                    </HStack>
                    {ev.notes && (
                      <Text fontSize="sm" color="fg.muted">
                        {ev.notes}
                      </Text>
                    )}
                  </Box>
                </HStack>
              );
            }

            const sess = entry.data as StudySession;
            return (
              <HStack
                key={`s-${sess.id}-${i}`}
                align="flex-start"
                gap={4}
                pl={4}
                pb={4}
                position="relative"
              >
                <Box
                  position="absolute"
                  left="-5px"
                  top="6px"
                  w={2}
                  h={2}
                  borderRadius="full"
                  bg="blue.solid"
                />
                <Box
                  flex={1}
                  p={3}
                  borderWidth={1}
                  borderRadius="md"
                  bg="bg.subtle"
                >
                  <HStack justify="space-between" mb={1}>
                    <HStack>
                      <Badge colorPalette="blue" variant="subtle">
                        session
                      </Badge>
                      {sess.expand?.study_items?.length
                        ? sess.expand.study_items.map((it) => (
                          <AppLink
                            key={it.id}
                            to={`/study-items/${it.id}`}
                            fontWeight="medium"
                            fontSize="sm"
                            color="colorPalette.fg"
                          >
                            {it.title}
                          </AppLink>
                        ))
                        : null}
                      {sess.outcome && (
                        <Badge variant="outline" fontSize="xs">
                          {sess.outcome}
                        </Badge>
                      )}
                    </HStack>
                    <Text fontSize="xs" color="fg.subtle">
                      {formatDate(sess.started_at)}
                    </Text>
                  </HStack>
                  <HStack gap={3} fontSize="sm" color="fg.muted">
                    {sess.session_type && (
                      <Text>{sess.session_type.replace(/_/g, " ")}</Text>
                    )}
                    {sess.duration_minutes != null &&
                      sess.duration_minutes > 0 && (
                        <Text>{formatMinutes(sess.duration_minutes)}</Text>
                      )}
                    {sess.notes && <Text>{sess.notes}</Text>}
                  </HStack>
                </Box>
              </HStack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
