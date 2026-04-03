import { StatusBadge } from "@/components/cards/StatusBadge";
import { SessionLogModal } from "@/components/forms/SessionLogModal";
import { StudyItemForm } from "@/components/forms/StudyItemForm";
import { AppLink } from "@/components/ui/app-link";
import { DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import pb from "@/lib/pocketbase";
import { listAreas } from "@/lib/services/areaService";
import { listPrograms } from "@/lib/services/programService";
import { listResources } from "@/lib/services/resourceService";
import { getSettings } from "@/lib/services/settingsService";
import {
  changeStatus,
  getStudyItem,
  updateStudyItem,
} from "@/lib/services/studyItemService";
import { listSessions, logSession } from "@/lib/services/studySessionService";
import type { ItemEvent, ItemStatus } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  Heading,
  HStack,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";

export default function StudyItemDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [logSessionOpen, setLogSessionOpen] = useState(false);
  const [logSessionLoading, setLogSessionLoading] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ["study_items", id],
    queryFn: () => getStudyItem(id!),
    enabled: !!id,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions", { studyItem: id }],
    queryFn: () => listSessions({ studyItem: id }),
    enabled: !!id,
  });
  const { data: events = [] } = useQuery<ItemEvent[]>({
    queryKey: ["item_events", id],
    queryFn: () =>
      pb.collection("item_events").getFullList({
        filter: `study_items ~ "${id}"`,
        sort: "-created",
      }) as Promise<ItemEvent[]>,
    enabled: !!id,
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

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof updateStudyItem>[1]) =>
      updateStudyItem(id!, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setEditing(false);
    },
  });
  const statusMut = useMutation({
    mutationFn: (status: ItemStatus) => changeStatus(id!, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      void qc.invalidateQueries({ queryKey: ["item_events"] });
    },
  });

  if (isLoading) return <Text>Loading…</Text>;
  if (!item) return <Text>Item not found.</Text>;

  const totalMinutes = sessions.reduce(
    (s, sess) => s + (sess.duration_minutes ?? 0),
    0,
  );

  return (
    <Stack gap={6}>
      {/* Header */}
      <Flex justify="space-between" align="start" flexWrap="wrap" gap={3}>
        <Stack gap={1}>
          <AppLink
            to="/study-items"
            mb="6"
            alignSelf="flex-start"
            color="fg.muted"
            fontSize="sm"
          >
            ← Study Items
          </AppLink>
          <HStack flexWrap="wrap" gap={2}>
            <Heading size="lg">{item.title}</Heading>
            <StatusBadge status={item.status} />
            {item.priority && item.priority !== "normal" && (
              <Badge
                colorPalette={
                  item.priority === "critical"
                    ? "red"
                    : item.priority === "high"
                      ? "orange"
                      : "gray"
                }
                variant="outline"
              >
                {item.priority}
              </Badge>
            )}
          </HStack>
        </Stack>

        <HStack flexWrap="wrap" gap={2}>
          {item.status === "available" && (
            <Button
              size="sm"
              colorPalette="orange"
              loading={statusMut.isPending}
              onClick={() => statusMut.mutate("in_progress")}
            >
              Start
            </Button>
          )}
          {item.status === "in_progress" && (
            <Button
              size="sm"
              colorPalette="green"
              loading={statusMut.isPending}
              onClick={() => statusMut.mutate("completed")}
            >
              Complete
            </Button>
          )}
          {!["completed", "cancelled", "deferred"].includes(item.status) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => statusMut.mutate("deferred")}
            >
              Defer
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLogSessionOpen(true)}
          >
            Log Session
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </HStack>
      </Flex>

      {/* Edit dialog */}
      <Dialog.Root
        open={editing}
        onOpenChange={({ open: o }) => !o && setEditing(false)}
        size="lg"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Edit Study Item</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <StudyItemForm
                areas={areas}
                programs={programs}
                resources={resources}
                loading={formLoading}
                submitLabel="Save Changes"
                defaultValues={{
                  title: item.title,
                  item_type: item.item_type,
                  status: item.status,
                  priority: item.priority,
                  area: item.area,
                  program: item.program,
                  resource: item.resource,
                  due_date: item.due_date?.slice(0, 10) ?? "",
                  scheduled_date: item.scheduled_date?.slice(0, 10) ?? "",
                  estimated_minutes: item.estimated_minutes ?? undefined,
                  notes: item.notes,
                }}
                blockWeeksDefault={blockWeeksDefault}
                onSubmit={async (data) => {
                  setFormLoading(true);
                  try {
                    await updateMut.mutateAsync(data);
                  } finally {
                    setFormLoading(false);
                  }
                }}
              />
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Log session modal */}
      <SessionLogModal
        open={logSessionOpen}
        onClose={() => setLogSessionOpen(false)}
        items={[item]}
        defaultStudyItemIds={[item.id]}
        loading={logSessionLoading}
        onSubmit={async (data) => {
          setLogSessionLoading(true);
          try {
            await logSession(data);
            void qc.invalidateQueries({
              queryKey: ["study_sessions", { studyItem: id }],
            });
          } finally {
            setLogSessionLoading(false);
          }
        }}
      />

      {/* Tabbed content */}
      <Tabs.Root defaultValue="details" variant="line">
        <Tabs.List>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="sessions">
            Sessions
            {sessions.length > 0 && (
              <Badge ml={2} variant="subtle" colorPalette="gray" size="sm">
                {sessions.length}
              </Badge>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="events">
            Events
            {events.length > 0 && (
              <Badge ml={2} variant="subtle" colorPalette="gray" size="sm">
                {events.length}
              </Badge>
            )}
          </Tabs.Trigger>
        </Tabs.List>

        {/* Details tab */}
        <Tabs.Content value="details">
          <Stack gap={4} pt={4}>
            <Grid
              templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
              gap={4}
              p={4}
              borderWidth={1}
              borderRadius="md"
              bg="bg.subtle"
            >
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Area
                </Text>
                <Text fontWeight="medium">
                  {item.expand?.area?.name ?? "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Program
                </Text>
                <Text fontWeight="medium">
                  {item.expand?.program?.name ?? "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Resource
                </Text>
                <Text fontWeight="medium">
                  {item.expand?.resource?.title ?? "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Type
                </Text>
                <Text fontWeight="medium">{item.item_type || "—"}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Due
                </Text>
                <Text fontWeight="medium">{formatDate(item.due_date)}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Scheduled
                </Text>
                <Text fontWeight="medium">
                  {formatDate(item.scheduled_date)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Completed
                </Text>
                <Text fontWeight="medium">
                  {formatDate(item.completion_date)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Est. Time
                </Text>
                <Text fontWeight="medium">
                  {item.estimated_minutes
                    ? formatMinutes(item.estimated_minutes)
                    : "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Total Time
                </Text>
                <Text fontWeight="medium">
                  {totalMinutes > 0 ? formatMinutes(totalMinutes) : "—"}
                </Text>
              </Box>
            </Grid>

            {item.notes && (
              <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
                <Text fontSize="xs" color="fg.subtle" mb={2}>
                  Notes
                </Text>
                <Text whiteSpace="pre-wrap">{item.notes}</Text>
              </Box>
            )}
          </Stack>
        </Tabs.Content>

        {/* Sessions tab */}
        <Tabs.Content value="sessions">
          <Stack gap={3} pt={4}>
            {sessions.length === 0 ? (
              <Box
                p={8}
                textAlign="center"
                borderWidth={1}
                borderRadius="md"
                borderStyle="dashed"
              >
                <Text color="fg.muted" mb={3}>
                  No sessions logged yet.
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLogSessionOpen(true)}
                >
                  Log a Session
                </Button>
              </Box>
            ) : (
              <Table.Root variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Date</Table.ColumnHeader>
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
                      <Table.Cell>
                        <Badge variant="subtle">{s.session_type || "—"}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant="outline">{s.outcome || "—"}</Badge>
                      </Table.Cell>
                      <Table.Cell>
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

        {/* Events tab */}
        <Tabs.Content value="events">
          <Stack gap={2} pt={4}>
            {events.length === 0 ? (
              <Text color="fg.muted">No events yet.</Text>
            ) : (
              events.map((ev) => (
                <HStack key={ev.id} fontSize="sm" color="fg.muted" gap={3}>
                  <Text w="160px" flexShrink={0} color="fg.subtle">
                    {formatDate(ev.created)}
                  </Text>
                  <Badge variant="subtle" colorPalette="gray">
                    {ev.event_type}
                  </Badge>
                  {ev.notes && <Text>{ev.notes}</Text>}
                </HStack>
              ))
            )}
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
