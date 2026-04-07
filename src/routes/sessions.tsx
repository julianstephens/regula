import { StatusBadge } from "@/components/cards/StatusBadge";
import { SessionTimer } from "@/components/feedback/SessionTimer";
import { SessionLogModal } from "@/components/forms/SessionLogModal";
import { StudyItemPicker } from "@/components/forms/StudyItemPicker";
import { endOfDay, formatDate, startOfDay, toPbDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import {
  DEFAULT_AHEAD_WEEKS,
  getSettings,
} from "@/lib/services/settingsService";
import { listStudyItems } from "@/lib/services/studyItemService";
import {
  endSession,
  getOpenSession,
  listSessions,
  logSession,
  startSession,
} from "@/lib/services/studySessionService";
import type { SessionOutcome, StudyItem } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type DateFilter = "today" | "week" | "all";

const outcomeColor: Record<SessionOutcome, string> = {
  completed: "green",
  partial: "yellow",
  blocked: "red",
  abandoned: "gray",
};

export default function Sessions() {
  const qc = useQueryClient();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<SessionOutcome>("completed");
  const [sessionType, setSessionType] =
    useState<import("@/types/domain").SessionType>("deep_work");
  const [sessionNotes, setSessionNotes] = useState("");
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const getFilters = () => {
    if (dateFilter === "today")
      return {
        dateFrom: toPbDate(startOfDay()),
        dateTo: toPbDate(endOfDay()),
      };
    if (dateFilter === "week") {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      return { dateFrom: toPbDate(weekStart) };
    }
    return {};
  };

  const { data: openSession } = useQuery({
    queryKey: ["open_session"],
    queryFn: getOpenSession,
    refetchOnWindowFocus: true,
  });
  const activeSessionId = openSession?.id ?? null;
  const activeStartedAt = openSession?.started_at
    ? new Date(openSession.started_at)
    : null;

  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions", dateFilter],
    queryFn: () => listSessions(getFilters()),
  });
  const { data: allItems = [] } = useQuery<StudyItem[]>({
    queryKey: ["study_items", "all"],
    queryFn: () => listStudyItems(),
  });
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const startMut = useMutation({
    mutationFn: startSession,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["open_session"] });
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setSelectedItemIds([]);
    },
  });
  const endMut = useMutation({
    mutationFn: ({
      sessionId,
      outcome,
      notes,
      type,
    }: {
      sessionId: string;
      outcome: SessionOutcome;
      notes: string;
      type: import("@/types/domain").SessionType;
    }) => endSession(sessionId, outcome, notes, type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["open_session"] });
      void qc.invalidateQueries({ queryKey: ["study_sessions"] });
      void qc.invalidateQueries({ queryKey: ["study_items"] });
    },
  });
  const logMut = useMutation({
    mutationFn: logSession,
    onSuccess: () => {
      setLogModalOpen(false);
      void qc.invalidateQueries({ queryKey: ["study_sessions"] });
      void qc.invalidateQueries({ queryKey: ["study_items"] });
    },
  });

  const aheadWeeks = settings?.ahead_weeks ?? DEFAULT_AHEAD_WEEKS;
  const aheadCutoff = new Date();
  aheadCutoff.setDate(aheadCutoff.getDate() + aheadWeeks * 7);

  const pickableItems = allItems.filter((i) => {
    if (i.status === "in_progress") return true;
    if (i.status === "available" || i.status === "planned") {
      if (!i.due_date) return true;
      return new Date(i.due_date) <= aheadCutoff;
    }
    return false;
  });

  const activeItems = openSession?.expand?.study_items ?? [];

  return (
    <Stack id="sessions" gap={6}>
      <Heading size="lg">Study Sessions</Heading>

      <Tabs.Root
        defaultValue={openSession ? "active" : "new"}
        key={openSession?.id ?? "no-session"}
        variant="line"
      >
        <Tabs.List>
          <Tabs.Trigger value="active">
            Active Session
            {openSession && (
              <Badge ml={2} size="xs" variant="solid" colorPalette="orange">
                Live
              </Badge>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="new">New Session</Tabs.Trigger>
          <Tabs.Trigger value="history">History</Tabs.Trigger>
        </Tabs.List>

        {/* Active session */}
        <Tabs.Content value="active" pt={5}>
          {activeSessionId && activeStartedAt ? (
            <Stack gap={5}>
              <SessionTimer
                startedAt={activeStartedAt}
                onStop={() =>
                  endMut.mutate({
                    sessionId: activeSessionId,
                    outcome,
                    notes: sessionNotes,
                    type: sessionType,
                  })
                }
              />

              {activeItems.length > 0 && (
                <Box
                  p={4}
                  borderWidth={1}
                  borderRadius="md"
                  bg="bg.subtle"
                  maxW="480px"
                >
                  <Text fontWeight="medium" mb={3} fontSize="sm">
                    Studying
                  </Text>
                  <Stack gap={2}>
                    {activeItems.map((item) => (
                      <HStack key={item.id} justify="space-between">
                        <Text fontSize="sm">{item.title}</Text>
                        <StatusBadge status={item.status} />
                      </HStack>
                    ))}
                  </Stack>
                </Box>
              )}

              <Stack gap={3} maxW="400px">
                <Field.Root>
                  <Field.Label fontSize="sm">Session Type</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={sessionType}
                      onChange={(e) =>
                        setSessionType(
                          e.target
                            .value as import("@/types/domain").SessionType,
                        )
                      }
                    >
                      {(
                        [
                          "deep_work",
                          "light_review",
                          "planning",
                          "reread",
                          "exercise",
                          "writing",
                        ] as const
                      ).map((v) => (
                        <option key={v} value={v}>
                          {v.replace(/_/g, " ")}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label fontSize="sm">Outcome when stopping</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={outcome}
                      onChange={(e) =>
                        setOutcome(e.target.value as SessionOutcome)
                      }
                    >
                      {(
                        [
                          "completed",
                          "partial",
                          "blocked",
                          "abandoned",
                        ] as const
                      ).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label fontSize="sm">Notes</Field.Label>
                  <Textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    rows={2}
                  />
                </Field.Root>
              </Stack>
            </Stack>
          ) : (
            <Box py={10} textAlign="center" color="fg.muted">
              <Text>
                No active session. Start one from the New Session tab.
              </Text>
            </Box>
          )}
        </Tabs.Content>

        {/* New session */}
        <Tabs.Content value="new" pt={5}>
          {activeSessionId ? (
            <Box py={10} textAlign="center" color="fg.muted">
              <Text>
                A session is already in progress. Stop it before starting a new
                one.
              </Text>
            </Box>
          ) : (
            <Stack gap={4} w="full">
              <Text fontSize="sm" color="fg.muted">
                Items due within the next{" "}
                <strong>
                  {aheadWeeks} week{aheadWeeks !== 1 ? "s" : ""}
                </strong>{" "}
                are shown. Adjust the window in Settings.
              </Text>
              <Field.Root>
                <Field.Label>Study Items</Field.Label>
                <StudyItemPicker
                  items={pickableItems}
                  value={selectedItemIds}
                  onChange={setSelectedItemIds}
                />
              </Field.Root>
              <Box>
                <Button
                  colorPalette="green"
                  disabled={selectedItemIds.length === 0}
                  loading={startMut.isPending}
                  onClick={() =>
                    selectedItemIds.length > 0 &&
                    startMut.mutate(selectedItemIds)
                  }
                >
                  Start Session
                </Button>
              </Box>
            </Stack>
          )}
        </Tabs.Content>

        {/* History */}
        <Tabs.Content value="history" pt={5}>
          <Stack gap={4}>
            <Flex justify="space-between" align="center">
              <NativeSelect.Root w="140px">
                <NativeSelect.Field
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                >
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="all">All time</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLogModalOpen(true)}
              >
                Log Past Session
              </Button>
            </Flex>

            {sessions.length === 0 ? (
              <Box py={10} textAlign="center" color="fg.muted">
                <Text>No sessions found for this period.</Text>
              </Box>
            ) : (
              <Table.Root variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Date</Table.ColumnHeader>
                    <Table.ColumnHeader>Items</Table.ColumnHeader>
                    <Table.ColumnHeader>Outcome</Table.ColumnHeader>
                    <Table.ColumnHeader>Duration</Table.ColumnHeader>
                    <Table.ColumnHeader>Notes</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sessions.map((s) => (
                    <Table.Row key={s.id}>
                      <Table.Cell whiteSpace="nowrap">
                        {formatDate(s.started_at)}
                      </Table.Cell>
                      <Table.Cell color="fg.muted" maxW="260px">
                        {(() => {
                          const ids = ([] as string[]).concat(
                            s.study_items ?? [],
                          );
                          return ids.length
                            ? ids
                                .map(
                                  (id) =>
                                    allItems.find((i) => i.id === id)?.title ??
                                    id,
                                )
                                .join(", ")
                            : "—";
                        })()}
                      </Table.Cell>
                      <Table.Cell>
                        {s.outcome ? (
                          <Badge
                            colorPalette={outcomeColor[s.outcome]}
                            variant="subtle"
                          >
                            {s.outcome}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Table.Cell>
                      <Table.Cell whiteSpace="nowrap">
                        {formatMinutes(s.duration_minutes)}
                      </Table.Cell>
                      <Table.Cell color="fg.muted">{s.notes || "—"}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Stack>
        </Tabs.Content>
      </Tabs.Root>

      <SessionLogModal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        items={allItems}
        loading={logMut.isPending}
        onSubmit={(data) => logMut.mutateAsync(data)}
      />
    </Stack>
  );
}
