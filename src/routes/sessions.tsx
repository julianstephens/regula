import { SessionTimer } from "@/components/feedback/SessionTimer";
import { SessionLogModal } from "@/components/forms/SessionLogModal";
import { StudyItemPicker } from "@/components/forms/StudyItemPicker";
import { endOfDay, formatDate, startOfDay } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import { listStudyItems } from "@/lib/services/studyItemService";
import {
  endSession,
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
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type DateFilter = "today" | "week" | "all";

export default function Sessions() {
  const qc = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeStartedAt, setActiveStartedAt] = useState<Date | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<SessionOutcome>("completed");
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const getFilters = () => {
    if (dateFilter === "today")
      return {
        dateFrom: startOfDay().toISOString(),
        dateTo: endOfDay().toISOString(),
      };
    if (dateFilter === "week") {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      return { dateFrom: weekStart.toISOString() };
    }
    return {};
  };

  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions", dateFilter],
    queryFn: () => listSessions(getFilters()),
  });
  const { data: allItems = [] } = useQuery<StudyItem[]>({
    queryKey: ["study_items", "all"],
    queryFn: () => listStudyItems(),
  });

  const startMut = useMutation({
    mutationFn: startSession,
    onSuccess: (session) => {
      setActiveSessionId(session.id);
      setActiveStartedAt(new Date());
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setSelectedItemIds([]);
    },
  });
  const endMut = useMutation({
    mutationFn: ({
      sessionId,
      outcome,
    }: {
      sessionId: string;
      outcome: SessionOutcome;
    }) => endSession(sessionId, outcome),
    onSuccess: () => {
      setActiveSessionId(null);
      setActiveStartedAt(null);
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

  const allActiveItems = allItems.filter((i) =>
    ["planned", "available", "in_progress"].includes(i.status),
  );

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="lg">Sessions</Heading>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLogModalOpen(true)}
        >
          Log Past Session
        </Button>
      </Flex>

      {/* Active timer */}
      {activeSessionId && activeStartedAt ? (
        <Box>
          <Text fontWeight="medium" mb={3}>
            Active Session
          </Text>
          <SessionTimer
            startedAt={activeStartedAt}
            onStop={() => {
              endMut.mutate({ sessionId: activeSessionId, outcome });
            }}
          />
          <HStack mt={3}>
            <Text fontSize="sm">Outcome:</Text>
            <NativeSelect.Root w="160px">
              <NativeSelect.Field
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as SessionOutcome)}
              >
                {(
                  ["completed", "partial", "blocked", "abandoned"] as const
                ).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </HStack>
        </Box>
      ) : (
        <Box w="full" p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
          <Text fontWeight="medium" mb={3}>
            Start New Session
          </Text>
          <Stack w="full" gap={3}>
            <Field.Root>
              <Field.Label fontSize="sm">Study Items</Field.Label>
              <StudyItemPicker
                items={allActiveItems}
                value={selectedItemIds}
                onChange={setSelectedItemIds}
              />
            </Field.Root>
            <Button
              colorPalette="green"
              alignSelf="flex-end"
              disabled={selectedItemIds.length === 0}
              loading={startMut.isPending}
              onClick={() =>
                selectedItemIds.length > 0 && startMut.mutate(selectedItemIds)
              }
            >
              Start Session
            </Button>
          </Stack>
        </Box>
      )}

      {/* Session history */}
      <Stack gap={3}>
        <Flex justify="space-between" align="center">
          <Heading size="md">History</Heading>
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
        </Flex>

        {sessions.length === 0 ? (
          <Box py={8} textAlign="center" color="fg.muted">
            <Text>No sessions found for this period.</Text>
          </Box>
        ) : (
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Date</Table.ColumnHeader>
                <Table.ColumnHeader>Item</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>Outcome</Table.ColumnHeader>
                <Table.ColumnHeader>Duration</Table.ColumnHeader>
                <Table.ColumnHeader>Notes</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sessions.map((s) => (
                <Table.Row key={s.id}>
                  <Table.Cell>{formatDate(s.started_at)}</Table.Cell>
                  <Table.Cell color="fg.muted">
                    {s.expand?.study_items?.length
                      ? s.expand.study_items.map((it) => it.title).join(", ")
                      : "—"}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="subtle">{s.session_type || "—"}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="outline">{s.outcome || "—"}</Badge>
                  </Table.Cell>
                  <Table.Cell>{formatMinutes(s.duration_minutes)}</Table.Cell>
                  <Table.Cell color="fg.muted">{s.notes || "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Stack>

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
