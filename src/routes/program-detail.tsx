import { StatusBadge } from "@/components/cards/StatusBadge";
import { AppLink } from "@/components/ui/app-link";
import { computeBlockEndDate, DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import { formatDate } from "@/lib/dates";
import {
  deleteProgram,
  deleteProgramWithChildren,
  getProgram,
  updateProgram,
} from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import { listStudyItems } from "@/lib/services/studyItemService";
import type { ItemStatus, Program, StudyItem } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

const statusColor: Record<string, string> = {
  planned: "teal",
  active: "green",
  completed: "blue",
  archived: "orange",
};

const STATUS_ORDER: ItemStatus[] = [
  "in_progress",
  "available",
  "planned",
  "completed",
  "deferred",
  "cancelled",
];

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteChildren, setDeleteChildren] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Program["status"]>("planned");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [blockWeeksInput, setBlockWeeksInput] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });
  const globalDefault = settings?.block_weeks ?? DEFAULT_BLOCK_WEEKS;

  const { data: program, isLoading } = useQuery({
    queryKey: ["programs", id],
    queryFn: () => getProgram(id!),
    enabled: !!id,
  });

  const { data: studyItems = [] } = useQuery<StudyItem[]>({
    queryKey: ["study_items", { program: id }, program?.type],
    queryFn: async () => {
      if (program?.type === "term") {
        const childIds = (
          (program.expand?.["regula_programs(parent)"] ?? []) as Program[]
        ).map((c) => c.id);
        const ids = [id!, ...childIds];
        const results = await Promise.all(
          ids.map((pid) => listStudyItems({ program: pid })),
        );
        return results.flat();
      }
      return listStudyItems({ program: id });
    },
    enabled: !!id,
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<Program>) => updateProgram(id!, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      setEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      deleteChildren ? deleteProgramWithChildren(id!) : deleteProgram(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      void navigate("/programs");
    },
  });

  if (isLoading) return <Text>Loading…</Text>;
  if (!program) return <Text>Program not found.</Text>;

  const children = (program.expand?.["regula_programs(parent)"] ??
    []) as Program[];

  const startEdit = () => {
    setName(program.name);
    setStatus(program.status);
    setDescription(program.description);
    setStartDate(program.start_date ? program.start_date.split("T")[0] : "");
    setEndDate(program.end_date ? program.end_date.split("T")[0] : "");
    setBlockWeeksInput(
      program.block_weeks != null ? String(program.block_weeks) : "",
    );
    setEditing(true);
  };

  const resolvedBlockWeeks = blockWeeksInput
    ? Number(blockWeeksInput)
    : globalDefault;
  const computedEndDate =
    program.type === "block" && startDate
      ? computeBlockEndDate(new Date(startDate), resolvedBlockWeeks)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Program> = {
      name,
      status,
      description,
      start_date: startDate || undefined,
    };
    if (program.type === "block") {
      data.end_date = computedEndDate?.toISOString();
      data.block_weeks = blockWeeksInput ? Number(blockWeeksInput) : undefined;
    } else {
      data.end_date = endDate || undefined;
    }
    void updateMut.mutateAsync(data);
  };

  // Stats derived from direct study items
  const total = studyItems.length;
  const completed = studyItems.filter((i) => i.status === "completed").length;
  const inProgress = studyItems.filter(
    (i) => i.status === "in_progress",
  ).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const sortedItems = [...studyItems].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <Stack id="program-detail" gap={6}>
      {/* Header */}
      <Flex
        id="program-detail-header"
        justify="space-between"
        align="start"
        flexWrap="wrap"
        gap={3}
      >
        <Stack gap={1}>
          <AppLink
            alignSelf="flex-start"
            mb="6"
            to="/programs"
            color="fg.muted"
            fontSize="sm"
          >
            ← Programs
          </AppLink>
          <HStack flexWrap="wrap" gap={2}>
            <Heading size="lg">{program.name}</Heading>
            <Badge
              colorPalette={statusColor[program.status] ?? "teal"}
              variant="subtle"
            >
              {program.status}
            </Badge>
            <Badge variant="outline">{program.type}</Badge>
          </HStack>
        </Stack>
        <HStack gap={2} flexWrap="wrap">
          {program.type === "term" && (
            <AppLink to={`/programs/${id}/import`}>
              <Button size="sm" variant="outline">
                Import Syllabi
              </Button>
            </AppLink>
          )}
          <Button size="sm" variant="outline" onClick={startEdit}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        </HStack>
      </Flex>

      {/* Edit dialog */}
      <Dialog.Root
        id="program-detail-edit-dialog"
        open={editing}
        onOpenChange={({ open: o }) => !o && setEditing(false)}
        size="lg"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Edit Program</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body
              as="form"
              id="edit-program-form"
              onSubmit={handleSubmit}
            >
              <Stack gap={3}>
                <Field.Root required>
                  <Field.Label>Name</Field.Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field.Root>
                <Stack direction="row" gap={3} flexWrap="wrap">
                  <Field.Root>
                    <Field.Label>Status</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as Program["status"])
                        }
                      >
                        {(
                          [
                            "planned",
                            "active",
                            "completed",
                            "archived",
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
                    <Field.Label>Start Date</Field.Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Field.Root>
                  {program.type === "block" ? (
                    <>
                      <Field.Root>
                        <Field.Label>Block Weeks (override)</Field.Label>
                        <Field.HelperText>
                          Default: {globalDefault}
                        </Field.HelperText>
                        <Input
                          type="number"
                          min={2}
                          max={6}
                          step={1}
                          placeholder={String(globalDefault)}
                          value={blockWeeksInput}
                          onChange={(e) => setBlockWeeksInput(e.target.value)}
                          maxW="80px"
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>End Date (computed)</Field.Label>
                        <Text pt={2} fontSize="sm" color="fg.muted">
                          {computedEndDate
                            ? computedEndDate.toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </Text>
                      </Field.Root>
                    </>
                  ) : (
                    <Field.Root>
                      <Field.Label>End Date</Field.Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </Field.Root>
                  )}
                </Stack>
                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </Field.Root>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-program-form"
                loading={updateMut.isPending}
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Delete confirm dialog */}
      <Dialog.Root
        id="program-detail-delete-dialog"
        open={confirmDelete}
        onOpenChange={({ open: o }) => {
          if (!o) {
            setConfirmDelete(false);
            setDeleteChildren(false);
          }
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Delete Program</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Text>
                  Are you sure you want to delete{" "}
                  <strong>{program.name}</strong>? All study items assigned to
                  it will also be deleted.
                </Text>
                {children.length > 0 && (
                  <HStack gap={2}>
                    <input
                      type="checkbox"
                      id="delete-children"
                      checked={deleteChildren}
                      onChange={(e) => setDeleteChildren(e.target.checked)}
                    />
                    <label
                      htmlFor="delete-children"
                      style={{ fontSize: "0.875rem", cursor: "pointer" }}
                    >
                      Also delete {children.length} sub-program
                      {children.length !== 1 ? "s" : ""} and their items
                    </label>
                  </HStack>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteChildren(false);
                }}
              >
                Cancel
              </Button>
              <Button
                colorPalette="red"
                loading={deleteMut.isPending}
                onClick={() => deleteMut.mutate()}
              >
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Tabbed content */}
      <Tabs.Root
        id="program-detail-tabs"
        defaultValue="overview"
        variant="line"
      >
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          {program.type !== "term" && program.type !== "year" && (
            <Tabs.Trigger value="items">
              Study Items
              {total > 0 && (
                <Badge ml={2} variant="subtle" colorPalette="gray" size="sm">
                  {total}
                </Badge>
              )}
            </Tabs.Trigger>
          )}
          {children.length > 0 && (
            <Tabs.Trigger value="subprograms">
              Sub-programs
              <Badge ml={2} variant="subtle" colorPalette="gray" size="sm">
                {children.length}
              </Badge>
            </Tabs.Trigger>
          )}
        </Tabs.List>

        {/* Overview */}
        <Tabs.Content value="overview">
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
                  Type
                </Text>
                <Text fontWeight="medium">{program.type}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Status
                </Text>
                <Text fontWeight="medium">{program.status}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Start Date
                </Text>
                <Text fontWeight="medium">
                  {formatDate(program.start_date)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  End Date
                </Text>
                <Text fontWeight="medium">{formatDate(program.end_date)}</Text>
              </Box>
              {program.type === "block" && (
                <Box>
                  <Text fontSize="xs" color="fg.subtle" mb={1}>
                    Block Weeks
                  </Text>
                  <Text fontWeight="medium">
                    {program.block_weeks ?? globalDefault}
                  </Text>
                </Box>
              )}
              {program.expand?.parent && (
                <Box>
                  <Text fontSize="xs" color="fg.subtle" mb={1}>
                    Parent Program
                  </Text>
                  <AppLink
                    to={`/programs/${program.expand.parent.id}`}
                    fontWeight="medium"
                    color="colorPalette.fg"
                  >
                    {program.expand.parent.name}
                  </AppLink>
                </Box>
              )}
            </Grid>

            {program.description && (
              <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
                <Text fontSize="xs" color="fg.subtle" mb={2}>
                  Description
                </Text>
                <Text whiteSpace="pre-wrap">{program.description}</Text>
              </Box>
            )}

            {total > 0 && (
              <Grid
                templateColumns="repeat(4, 1fr)"
                gap={4}
                p={4}
                borderWidth={1}
                borderRadius="md"
                bg="bg.subtle"
              >
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold">
                    {total}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    Total Items
                  </Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="orange.fg">
                    {inProgress}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    In Progress
                  </Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="green.fg">
                    {completed}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    Completed
                  </Text>
                </Box>
                <Box textAlign="center">
                  <Text fontSize="2xl" fontWeight="bold" color="blue.fg">
                    {pct}%
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    Done
                  </Text>
                </Box>
              </Grid>
            )}
          </Stack>
        </Tabs.Content>

        {/* Study Items */}
        {program.type !== "term" && program.type !== "year" && (
          <Tabs.Content value="items">
            <Stack gap={3} pt={4}>
              {sortedItems.length === 0 ? (
                <Box
                  p={8}
                  textAlign="center"
                  borderWidth={1}
                  borderRadius="md"
                  borderStyle="dashed"
                >
                  <Text color="fg.muted">
                    No study items assigned to this program yet.
                  </Text>
                </Box>
              ) : (
                <Table.Root variant="outline">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Title</Table.ColumnHeader>
                      <Table.ColumnHeader>Type</Table.ColumnHeader>

                      <Table.ColumnHeader>Due</Table.ColumnHeader>
                      <Table.ColumnHeader>Status</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sortedItems.map((item) => (
                      <Table.Row key={item.id}>
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
                          <Badge variant="subtle">
                            {item.item_type || "—"}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>{formatDate(item.due_date)}</Table.Cell>
                        <Table.Cell>
                          <StatusBadge status={item.status} />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Stack>
          </Tabs.Content>
        )}

        {/* Sub-programs */}
        {children.length > 0 && (
          <Tabs.Content value="subprograms">
            <Stack gap={3} pt={4}>
              <Table.Root variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader>Type</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Start</Table.ColumnHeader>
                    <Table.ColumnHeader>End</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {children.map((child) => (
                    <Table.Row key={child.id}>
                      <Table.Cell>
                        <AppLink
                          to={`/programs/${child.id}`}
                          color="colorPalette.fg"
                          fontWeight="medium"
                        >
                          {child.name}
                        </AppLink>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge variant="subtle">{child.type}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          colorPalette={statusColor[child.status] ?? "gray"}
                          variant="subtle"
                        >
                          {child.status}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{formatDate(child.start_date)}</Table.Cell>
                      <Table.Cell>{formatDate(child.end_date)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Stack>
          </Tabs.Content>
        )}
      </Tabs.Root>
    </Stack>
  );
}
