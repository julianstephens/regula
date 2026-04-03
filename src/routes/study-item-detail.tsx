import { StatusBadge } from "@/components/cards/StatusBadge";
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
import { listSessions } from "@/lib/services/studySessionService";
import type { ItemEvent, ItemStatus } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
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
import { useParams } from "react-router";

export default function StudyItemDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

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
        filter: `study_item = "${id}"`,
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
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
        <HStack flexWrap="wrap">
          <AppLink to="/study-items" color="fg.muted" fontSize="sm">
            ← Study Items
          </AppLink>
          <Heading size="lg">{item.title}</Heading>
          <StatusBadge status={item.status} />
          {item.priority !== "normal" && (
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
        <HStack>
          {item.status === "available" && (
            <Button
              size="sm"
              colorPalette="orange"
              onClick={() => statusMut.mutate("in_progress")}
            >
              Start
            </Button>
          )}
          {item.status === "in_progress" && (
            <Button
              size="sm"
              colorPalette="green"
              onClick={() => statusMut.mutate("completed")}
            >
              Complete
            </Button>
          )}
          {!["completed", "cancelled"].includes(item.status) &&
            item.status !== "deferred" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => statusMut.mutate("deferred")}
              >
                Defer
              </Button>
            )}
          <NativeSelect.Root w="140px">
            <NativeSelect.Field
              value={item.status}
              onChange={(e) => statusMut.mutate(e.target.value as ItemStatus)}
            >
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
          {!editing && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
        </HStack>
      </Flex>

      {editing && (
        <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
          <Heading size="sm" mb={4}>
            Edit Study Item
          </Heading>
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
          <Button
            size="sm"
            variant="ghost"
            mt={2}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </Box>
      )}

      {/* Metadata */}
      <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
        <HStack gap={8} flexWrap="wrap">
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Area
            </Text>
            <Text>{item.expand?.area?.name ?? "—"}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Program
            </Text>
            <Text>{item.expand?.program?.name ?? "—"}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Resource
            </Text>
            <Text>{item.expand?.resource?.title ?? "—"}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Type
            </Text>
            <Text>{item.item_type || "—"}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Due
            </Text>
            <Text>{formatDate(item.due_date)}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Scheduled
            </Text>
            <Text>{formatDate(item.scheduled_date)}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Completed
            </Text>
            <Text>{formatDate(item.completion_date)}</Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Est. Minutes
            </Text>
            <Text>
              {item.estimated_minutes
                ? formatMinutes(item.estimated_minutes)
                : "—"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Total Time
            </Text>
            <Text>{totalMinutes > 0 ? formatMinutes(totalMinutes) : "—"}</Text>
          </Box>
        </HStack>
        {item.notes && (
          <Text mt={3} color="fg.muted">
            {item.notes}
          </Text>
        )}
      </Box>

      {/* Session history */}
      <Stack gap={3}>
        <Heading size="md">Session History</Heading>
        {sessions.length === 0 ? (
          <Text color="fg.muted">No sessions logged yet.</Text>
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
                  <Table.Cell>{formatMinutes(s.duration_minutes)}</Table.Cell>
                  <Table.Cell color="fg.muted">{s.notes || "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Stack>

      {/* Event log */}
      <Stack gap={3}>
        <Heading size="md">Event Log</Heading>
        {events.length === 0 ? (
          <Text color="fg.muted">No events yet.</Text>
        ) : (
          <Stack gap={1}>
            {events.map((ev) => (
              <HStack key={ev.id} fontSize="sm" color="fg.muted">
                <Text w="160px" flexShrink={0}>
                  {formatDate(ev.created)}
                </Text>
                <Badge variant="subtle" colorPalette="gray">
                  {ev.event_type}
                </Badge>
                {ev.notes && <Text>{ev.notes}</Text>}
              </HStack>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
