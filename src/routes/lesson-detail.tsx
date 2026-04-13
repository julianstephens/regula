import { StatusBadge } from "@/components/cards/StatusBadge";
import type { LessonFormValues } from "@/components/forms/LessonForm";
import { LessonForm } from "@/components/forms/LessonForm";
import { SessionLogModal } from "@/components/forms/SessionLogModal";
import { AppLink } from "@/components/ui/app-link";
import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import { listEvents } from "@/lib/services/itemEventService";
import {
  changeStatus,
  getLesson,
  updateLesson,
} from "@/lib/services/lessonService";
import { listModules } from "@/lib/services/moduleService";
import { listPrograms } from "@/lib/services/programService";
import { listResources } from "@/lib/services/resourceService";
import { createReview, listReviews } from "@/lib/services/reviewService";
import { listSessions, logSession } from "@/lib/services/studySessionService";
import type { ItemEvent, Lesson, LessonStatus } from "@/types/domain";
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

export default function LessonDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [logSessionOpen, setLogSessionOpen] = useState(false);
  const [logSessionLoading, setLogSessionLoading] = useState(false);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lessons", id],
    queryFn: () => getLesson(id!),
    enabled: !!id,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["study_sessions", { lesson: id }],
    queryFn: () => listSessions({ lesson: id }),
    enabled: !!id,
  });

  const { data: events = [] } = useQuery<ItemEvent[]>({
    queryKey: ["item_events", id],
    queryFn: () => listEvents(id!),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", { lesson: id }],
    queryFn: () => listReviews({ lesson: id }),
    enabled: !!id,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["modules", { program: lesson?.program }],
    queryFn: () =>
      lesson?.program ? listModules({ program: lesson.program }) : [],
    enabled: !!lesson?.program,
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<Parameters<typeof updateLesson>[1]>) =>
      updateLesson(id!, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lessons"] });
      setEditing(false);
    },
  });

  const statusMut = useMutation({
    mutationFn: (status: LessonStatus) => changeStatus(id!, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lessons"] });
      void qc.invalidateQueries({ queryKey: ["item_events"] });
    },
  });

  const reviewMut = useMutation({
    mutationFn: () =>
      createReview({
        lesson: id!,
        due_at: new Date().toISOString(),
        status: "active",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reviews", { lesson: id }] });
    },
  });

  if (isLoading) return <Text>Loading…</Text>;
  if (!lesson) return <Text>Lesson not found.</Text>;

  const totalMinutes = sessions.reduce(
    (s, sess) => s + (sess.duration_minutes ?? 0),
    0,
  );

  const activeReview = reviews.find((r) => r.status === "active");

  return (
    <Stack id="lesson-detail" gap={6}>
      {/* Header */}
      <Flex
        id="lesson-header"
        justify="space-between"
        align="start"
        flexWrap="wrap"
        gap={3}
      >
        <Stack gap={1}>
          <AppLink
            to={
              lesson.expand?.module ? `/modules/${lesson.module}` : "/modules"
            }
            mb="6"
            alignSelf="flex-start"
            color="fg.muted"
            fontSize="sm"
          >
            ← {lesson.expand?.module ? lesson.expand.module.title : "Modules"}
          </AppLink>
          <HStack flexWrap="wrap" gap={2}>
            <Heading size="lg">{lesson.title}</Heading>
            <StatusBadge status={lesson.status} />
            {lesson.type && <Badge variant="outline">{lesson.type}</Badge>}
          </HStack>
        </Stack>

        <HStack flexWrap="wrap" gap={2}>
          {lesson.status === "not_started" && (
            <Button
              size="sm"
              colorPalette="green"
              variant="outline"
              loading={statusMut.isPending}
              onClick={() => statusMut.mutate("active")}
            >
              Start
            </Button>
          )}
          {lesson.status === "active" && (
            <Button
              size="sm"
              colorPalette="blue"
              variant="outline"
              loading={statusMut.isPending}
              onClick={() => statusMut.mutate("submitted")}
            >
              Submit
            </Button>
          )}
          {lesson.status === "submitted" && (
            <Button
              size="sm"
              colorPalette="green"
              variant="outline"
              loading={statusMut.isPending}
              onClick={() => statusMut.mutate("completed")}
            >
              Mark Reviewed
            </Button>
          )}
          {!activeReview && lesson.status === "completed" && (
            <Button
              size="sm"
              variant="outline"
              loading={reviewMut.isPending}
              onClick={() => reviewMut.mutate()}
            >
              Add to Review Queue
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
        id="edit-lesson"
        open={editing}
        onOpenChange={({ open: o }) => !o && setEditing(false)}
        size="lg"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Edit Lesson</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <LessonForm
                programs={programs}
                modules={modules}
                resources={resources}
                loading={formLoading}
                submitLabel="Save Changes"
                defaultValues={{
                  title: lesson.title,
                  type: lesson.type,
                  status: lesson.status,
                  program: lesson.program,
                  module: lesson.module,
                  resource: lesson.resource,
                  available_on: lesson.available_on?.slice(0, 10) ?? "",
                  due_at: lesson.due_at?.slice(0, 10) ?? "",
                  estimated_minutes: lesson.estimated_minutes ?? undefined,
                  grade_type: lesson.grade_type,
                  mastery_evidence: lesson.mastery_evidence,
                  notes: lesson.notes,
                }}
                onSubmit={async (data: LessonFormValues) => {
                  setFormLoading(true);
                  try {
                    await updateMut.mutateAsync(data as Partial<Lesson>);
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
        items={[lesson]}
        defaultLessonIds={[lesson.id]}
        loading={logSessionLoading}
        onSubmit={async (data) => {
          setLogSessionLoading(true);
          try {
            await logSession(data);
            void qc.invalidateQueries({
              queryKey: ["study_sessions", { lesson: id }],
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
        <Tabs.Content id="lesson-details" value="details">
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
                  Program
                </Text>
                {lesson.expand?.program ? (
                  <AppLink
                    to={`/programs/${lesson.program}`}
                    fontWeight="medium"
                    color="colorPalette.fg"
                  >
                    {lesson.expand.program.name}
                  </AppLink>
                ) : (
                  <Text fontWeight="medium">—</Text>
                )}
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Module
                </Text>
                {lesson.expand?.module ? (
                  <AppLink
                    to={`/modules/${lesson.module}`}
                    fontWeight="medium"
                    color="colorPalette.fg"
                  >
                    {lesson.expand.module.title}
                  </AppLink>
                ) : (
                  <Text fontWeight="medium">—</Text>
                )}
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Resource
                </Text>
                <Text fontWeight="medium">
                  {lesson.expand?.resource?.title ?? "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Type
                </Text>
                <Text fontWeight="medium">{lesson.type || "—"}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Available On
                </Text>
                <Text fontWeight="medium">
                  {formatDate(lesson.available_on)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Due
                </Text>
                <Text fontWeight="medium">{formatDate(lesson.due_at)}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Completed
                </Text>
                <Text fontWeight="medium">
                  {formatDate(lesson.completed_at)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Est. Time
                </Text>
                <Text fontWeight="medium">
                  {lesson.estimated_minutes
                    ? formatMinutes(lesson.estimated_minutes)
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
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Grade Type
                </Text>
                <Text fontWeight="medium">{lesson.grade_type || "—"}</Text>
              </Box>
            </Grid>

            {lesson.expand?.prerequisites &&
              lesson.expand.prerequisites.length > 0 && (
                <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
                  <Text fontSize="xs" color="fg.subtle" mb={2}>
                    Prerequisites
                  </Text>
                  <Stack gap={1}>
                    {lesson.expand.prerequisites.map((p) => (
                      <HStack key={p.id} gap={2}>
                        <AppLink
                          to={`/lessons/${p.id}`}
                          color="colorPalette.fg"
                          fontWeight="medium"
                          fontSize="sm"
                        >
                          {p.title}
                        </AppLink>
                        <StatusBadge status={p.status} />
                      </HStack>
                    ))}
                  </Stack>
                </Box>
              )}

            {lesson.mastery_evidence && (
              <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
                <Text fontSize="xs" color="fg.subtle" mb={2}>
                  Mastery Evidence
                </Text>
                <Text whiteSpace="pre-wrap">{lesson.mastery_evidence}</Text>
              </Box>
            )}

            {lesson.notes && (
              <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
                <Text fontSize="xs" color="fg.subtle" mb={2}>
                  Notes
                </Text>
                <Text whiteSpace="pre-wrap">{lesson.notes}</Text>
              </Box>
            )}
          </Stack>
        </Tabs.Content>

        {/* Sessions tab */}
        <Tabs.Content id="lesson-sessions" value="sessions">
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
