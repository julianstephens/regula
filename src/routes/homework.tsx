import { StatusBadge } from "@/components/cards/StatusBadge";
import { SessionTimer } from "@/components/feedback/SessionTimer";
import { SessionLogModal } from "@/components/forms/SessionLogModal";
import { StudyItemForm } from "@/components/forms/StudyItemForm";
import { StudyItemPicker } from "@/components/forms/StudyItemPicker";
import { AppLink } from "@/components/ui/app-link";
import { DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import {
  endOfDay,
  formatDate,
  isOverdue,
  startOfDay,
  toPbDate,
} from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import { listAreas } from "@/lib/services/areaService";
import { listPrograms } from "@/lib/services/programService";
import { listResources } from "@/lib/services/resourceService";
import {
  DEFAULT_AHEAD_WEEKS,
  getSettings,
} from "@/lib/services/settingsService";
import {
  changeStatus,
  createStudyItem,
  listStudyItems,
  updateStudyItem,
} from "@/lib/services/studyItemService";
import {
  endSession,
  getOpenSession,
  listSessions,
  logSession,
  startSession,
} from "@/lib/services/studySessionService";
import type {
  ItemStatus,
  SessionOutcome,
  SessionType,
  StudyItem,
} from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
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

// ─── Items tab ────────────────────────────────────────────────────────────────

function ItemsTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "">("");
  const [areaFilter, setAreaFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [sortBy, setSortBy] = useState("due_date");
  const [formLoading, setFormLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResourceId, setBulkResourceId] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["study_items", statusFilter, areaFilter, programFilter, sortBy],
    queryFn: () =>
      listStudyItems({
        status: statusFilter || undefined,
        area: areaFilter || undefined,
        program: programFilter || undefined,
        sort: sortBy,
      }),
  });
  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: listAreas,
  });
  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });
  const { data: resources = [] } = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
  });
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });
  const blockWeeksDefault = settings?.block_weeks ?? DEFAULT_BLOCK_WEEKS;

  const createMut = useMutation({
    mutationFn: createStudyItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setCreating(false);
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ItemStatus }) =>
      changeStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
    },
  });

  const bulkResourceMut = useMutation({
    mutationFn: async ({
      ids,
      resourceId,
    }: {
      ids: string[];
      resourceId: string;
    }) => {
      await Promise.all(
        ids.map((id) => updateStudyItem(id, { resource: resourceId })),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setSelectedIds(new Set());
      setBulkResourceId("");
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i: StudyItem) => i.id)));
    }
  };

  const handleBulkResourceUpdate = () => {
    if (!bulkResourceId || selectedIds.size === 0) return;
    bulkResourceMut.mutate({
      ids: Array.from(selectedIds),
      resourceId: bulkResourceId,
    });
  };

  const handleCreate = async (data: Parameters<typeof createStudyItem>[0]) => {
    setFormLoading(true);
    try {
      await createMut.mutateAsync(data);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="md">Assigned Work</Heading>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New Item
          </Button>
        )}
      </Flex>

      {!creating && (
        <HStack gap={3} flexWrap="wrap">
          <NativeSelect.Root w="180px">
            <NativeSelect.Field
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ItemStatus | "")
              }
            >
              <option value="">All statuses</option>
              {(
                [
                  "planned",
                  "available",
                  "in_progress",
                  "completed",
                  "deferred",
                  "cancelled",
                ] as const
              ).map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, " ")}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root w="180px">
            <NativeSelect.Field
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root w="200px">
            <NativeSelect.Field
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
            >
              <option value="">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root w="160px">
            <NativeSelect.Field
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="-created">Newest first</option>
              <option value="created">Oldest first</option>
              <option value="due_date">Due date</option>
              <option value="title">Title A–Z</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </HStack>
      )}

      {creating && (
        <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
          <Heading size="sm" mb={4}>
            New Study Item
          </Heading>
          <StudyItemForm
            areas={areas}
            programs={programs}
            resources={resources}
            loading={formLoading}
            submitLabel="Create Item"
            onSubmit={handleCreate}
            blockWeeksDefault={blockWeeksDefault}
          />
          <Button
            size="sm"
            variant="ghost"
            mt={2}
            onClick={() => setCreating(false)}
          >
            Cancel
          </Button>
        </Box>
      )}

      {isLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : items.length === 0 ? (
        <Box py={12} textAlign="center" color="fg.muted">
          <Text>No items match the current filters.</Text>
        </Box>
      ) : (
        <Stack gap={2}>
          {selectedIds.size > 0 && (
            <HStack
              p={3}
              borderWidth={1}
              borderRadius="md"
              bg="bg.subtle"
              gap={3}
              flexWrap="wrap"
            >
              <Text fontSize="sm" fontWeight="medium" flexShrink={0}>
                {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}{" "}
                selected
              </Text>
              <HStack gap={2} flex={1} flexWrap="wrap">
                <NativeSelect.Root w="220px">
                  <NativeSelect.Field
                    value={bulkResourceId}
                    onChange={(e) => setBulkResourceId(e.target.value)}
                  >
                    <option value="">Select resource…</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Button
                  size="sm"
                  disabled={!bulkResourceId}
                  loading={bulkResourceMut.isPending}
                  onClick={handleBulkResourceUpdate}
                >
                  Update Resource
                </Button>
              </HStack>
              <CloseButton
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              />
            </HStack>
          )}
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader w={10}>
                  <Checkbox.Root
                    checked={
                      items.length > 0 && selectedIds.size === items.length
                        ? true
                        : selectedIds.size > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleSelectAll}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Table.ColumnHeader>
                <Table.ColumnHeader>Title</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Area</Table.ColumnHeader>
                <Table.ColumnHeader>Resource</Table.ColumnHeader>
                <Table.ColumnHeader>Due</Table.ColumnHeader>
                <Table.ColumnHeader w={24} />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item: StudyItem) => (
                <Table.Row
                  key={item.id}
                  bg={
                    isOverdue(item.due_date, item.status)
                      ? "red.subtle"
                      : undefined
                  }
                >
                  <Table.Cell>
                    <Checkbox.Root
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <AppLink
                      to={`/study-items/${item.id}`}
                      color="colorPalette.fg"
                      fontWeight="medium"
                    >
                      {item.title}
                    </AppLink>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={item.status} />
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.area?.name ?? "—"}
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.resource?.title ?? "—"}
                  </Table.Cell>
                  <Table.Cell
                    color={
                      isOverdue(item.due_date, item.status)
                        ? "red.fg"
                        : "fg.muted"
                    }
                  >
                    {formatDate(item.due_date)}
                  </Table.Cell>
                  <Table.Cell>
                    <HStack gap={1}>
                      {item.status === "available" && (
                        <Button
                          size="xs"
                          colorPalette="orange"
                          variant="subtle"
                          loading={statusMut.isPending}
                          onClick={() =>
                            statusMut.mutate({
                              id: item.id,
                              status: "in_progress",
                            })
                          }
                        >
                          Start
                        </Button>
                      )}
                      {item.status === "in_progress" && (
                        <Button
                          size="xs"
                          colorPalette="green"
                          variant="subtle"
                          loading={statusMut.isPending}
                          onClick={() =>
                            statusMut.mutate({
                              id: item.id,
                              status: "completed",
                            })
                          }
                        >
                          Complete
                        </Button>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Stack>
      )}
    </Stack>
  );
}

// ─── Sessions tab ─────────────────────────────────────────────────────────────

function SessionsTab() {
  const qc = useQueryClient();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<SessionOutcome>("completed");
  const [sessionType, setSessionType] = useState<SessionType>("deep_work");
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
      type: SessionType;
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
    <>
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
                        setSessionType(e.target.value as SessionType)
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
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Homework() {
  return (
    <Stack id="homework" gap={6}>
      <Heading size="lg">Homework &amp; Revision</Heading>

      <Tabs.Root defaultValue="items" variant="enclosed">
        <Tabs.List>
          <Tabs.Trigger value="items">Work Items</Tabs.Trigger>
          <Tabs.Trigger value="sessions">Study Sessions</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="items" pt={6}>
          <ItemsTab />
        </Tabs.Content>

        <Tabs.Content value="sessions" pt={6}>
          <SessionsTab />
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
