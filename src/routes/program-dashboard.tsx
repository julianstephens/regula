import { StatusBadge } from "@/components/cards/StatusBadge";
import type { ModuleFormValues } from "@/components/forms/ModuleForm";
import { ModuleForm } from "@/components/forms/ModuleForm";
import { AppLink } from "@/components/ui/app-link";
import { formatDate } from "@/lib/dates";
import { listAreas } from "@/lib/services/areaService";
import { listAssessments } from "@/lib/services/assessmentService";
import { listLessons } from "@/lib/services/lessonService";
import {
  createModule,
  deleteModule,
  getModule,
  listModules,
  updateModule,
} from "@/lib/services/moduleService";
import {
  createProgram,
  deleteProgramWithChildren,
  listPrograms,
  updateProgram,
} from "@/lib/services/programService";
import {
  createResource,
  listResources,
  updateResource,
} from "@/lib/services/resourceService";
import { autoActivateIfFirstYearTermProgram } from "@/lib/services/settingsService";
import type {
  Area,
  Assessment,
  Lesson,
  Module,
  Program,
  Resource,
} from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  Field,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LuLayoutGrid, LuList } from "react-icons/lu";
import { useSearchParams } from "react-router";

// ─── Constants ────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  planned: "teal",
  active: "green",
  completed: "blue",
  archived: "orange",
};

const RESOURCE_TYPES = [
  "book",
  "article",
  "video",
  "podcast",
  "course",
  "other",
] as const;

const ALL_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// Returns the IDs of all descendant courses under a parent program.
// year → terms → courses, or year → courses, etc.
function descendantCourseIds(programs: Program[], parentId: string): string[] {
  const result: string[] = [];
  for (const p of programs) {
    if (p.parent !== parentId) continue;
    if (p.type === "course") {
      result.push(p.id);
    } else {
      result.push(...descendantCourseIds(programs, p.id));
    }
  }
  return result;
}

// ─── DayCheckboxGroup ─────────────────────────────────────────────────────────

function DayCheckboxGroup({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: string[];
  onChange: (days: string[]) => void;
}) {
  const toggle = (day: string) =>
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day],
    );

  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <HStack gap={2} flexWrap="wrap">
        {ALL_DAYS.map((d) => (
          <Checkbox.Root
            key={d}
            checked={selected.includes(d)}
            onCheckedChange={() => toggle(d)}
            size="sm"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label textTransform="capitalize">{d}</Checkbox.Label>
          </Checkbox.Root>
        ))}
      </HStack>
    </Field.Root>
  );
}

// ─── ProgramForm ──────────────────────────────────────────────────────────────

function ProgramForm({
  programs,
  areas,
  onSubmit,
  loading,
  onCancel,
}: {
  programs: Program[];
  areas: Area[];
  onSubmit: (data: Partial<Program>) => Promise<unknown>;
  loading: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Program["type"]>("term");
  const [status, setStatus] = useState<Program["status"]>("planned");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [areaId, setAreaId] = useState("");
  const [meetingDays, setMeetingDays] = useState<string[]>([]);
  const [makeupDays, setMakeupDays] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Program> = {
      name,
      type,
      status,
      description,
      parent: parent || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    };
    if (type === "course") {
      data.area = areaId || undefined;
      data.meeting_days = meetingDays.length ? meetingDays : undefined;
      data.makeup_days = makeupDays.length ? makeupDays : undefined;
    }
    void onSubmit(data);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      p={4}
      borderWidth={1}
      borderRadius="md"
      bg="bg.subtle"
    >
      <Stack gap={3}>
        <Heading size="sm">New Program</Heading>
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
            <Field.Label>Type</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={type}
                onChange={(e) => setType(e.target.value as Program["type"])}
              >
                {(["year", "term", "custom"] as const).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <Field.Root>
            <Field.Label>Status</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={status}
                onChange={(e) => setStatus(e.target.value as Program["status"])}
              >
                {(["planned", "active", "completed", "archived"] as const).map(
                  (v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ),
                )}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <Field.Root>
            <Field.Label>Parent Program</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">—</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
        </Stack>
        <Stack direction="row" gap={3}>
          <Field.Root>
            <Field.Label>Start Date</Field.Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>End Date</Field.Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field.Root>
        </Stack>
        {type === "course" && (
          <Stack gap={3}>
            <Field.Root required>
              <Field.Label>Area</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                >
                  <option value="">— select area —</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <DayCheckboxGroup
              label="Meeting Days"
              selected={meetingDays}
              onChange={setMeetingDays}
            />
            <DayCheckboxGroup
              label="Makeup Days"
              selected={makeupDays}
              onChange={setMakeupDays}
            />
          </Stack>
        )}
        <Field.Root>
          <Field.Label>Description</Field.Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field.Root>
        <HStack>
          <Button type="submit" size="sm" loading={loading}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
}

// ─── ResourceForm ─────────────────────────────────────────────────────────────

function ResourceForm({
  areas,
  defaultValues,
  onSubmit,
  loading,
  onCancel,
  bare,
}: {
  areas: Area[];
  defaultValues?: Partial<Resource>;
  onSubmit: (data: Partial<Resource>) => Promise<unknown>;
  loading: boolean;
  onCancel: () => void;
  bare?: boolean;
}) {
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [author, setAuthor] = useState(defaultValues?.author ?? "");
  const [url, setUrl] = useState(defaultValues?.url ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [resourceType, setResourceType] = useState<Resource["resource_type"]>(
    defaultValues?.resource_type ?? "book",
  );
  const [area, setArea] = useState(defaultValues?.area ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit({
      title,
      author,
      url,
      notes,
      resource_type: resourceType,
      area: area || undefined,
    });
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      {...(!bare && {
        p: 4,
        borderWidth: 1,
        borderRadius: "md",
        bg: "bg.subtle",
      })}
    >
      <Stack gap={3}>
        {!bare && (
          <Heading size="sm">
            {defaultValues ? "Edit Resource" : "New Resource"}
          </Heading>
        )}
        <Field.Root required>
          <Field.Label>Title</Field.Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Field.Root>
        <Stack direction="row" gap={3} flexWrap="wrap">
          <Field.Root>
            <Field.Label>Author</Field.Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field.Root>
          <Field.Root>
            <Field.Label>Type</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={resourceType}
                onChange={(e) =>
                  setResourceType(e.target.value as Resource["resource_type"])
                }
              >
                {RESOURCE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <Field.Root>
            <Field.Label>Area</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="">—</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
        </Stack>
        <Field.Root>
          <Field.Label>URL</Field.Label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Notes</Field.Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </Field.Root>
        <HStack>
          <Button type="submit" size="sm" loading={loading}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </HStack>
      </Stack>
    </Box>
  );
}

// ─── ModuleDrawer ─────────────────────────────────────────────────────────────

function ModuleDrawer({
  moduleId,
  onClose,
}: {
  moduleId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: mod, isLoading } = useQuery<Module>({
    queryKey: ["modules", moduleId],
    queryFn: () => getModule(moduleId),
  });

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["lessons", { module: moduleId }],
    queryFn: () => listLessons({ module: moduleId }),
  });

  const { data: assessments = [] } = useQuery<Assessment[]>({
    queryKey: ["assessments", { module: moduleId }],
    queryFn: () => listAssessments({ module: moduleId }),
  });

  const updateMut = useMutation({
    mutationFn: (data: Partial<Module>) => updateModule(moduleId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["modules"] });
      setEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteModule(moduleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["modules"] });
      void qc.invalidateQueries({ queryKey: ["lessons"] });
      onClose();
    },
  });

  return (
    <Dialog.Root open size="xl" onOpenChange={({ open: o }) => !o && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content mx="auto" maxH="90vh" overflowY="auto">
          <Dialog.Header>
            <Dialog.Title>
              {isLoading ? "Loading…" : (mod?.title ?? "Module")}
            </Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>
          <Dialog.Body pb={6}>
            {isLoading ? (
              <Text>Loading…</Text>
            ) : !mod ? (
              <Text>Module not found.</Text>
            ) : (
              <Stack gap={6}>
                {/* Module meta */}
                <Flex
                  justify="space-between"
                  align="start"
                  flexWrap="wrap"
                  gap={3}
                >
                  <Stack gap={1}>
                    {mod.goal && (
                      <Text color="fg.muted" fontSize="sm" maxW="500px">
                        {mod.goal}
                      </Text>
                    )}
                    <HStack gap={2} mt={1}>
                      {(mod.start_date || mod.end_date) && (
                        <Badge variant="subtle" colorPalette="gray">
                          {formatDate(mod.start_date)} →{" "}
                          {formatDate(mod.end_date)}
                        </Badge>
                      )}
                      {mod.order != null && (
                        <Badge variant="outline" colorPalette="gray">
                          Order: {mod.order}
                        </Badge>
                      )}
                    </HStack>
                  </Stack>
                  <HStack gap={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!mod.expand?.program}
                      onClick={() => setEditing(true)}
                    >
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
                  open={editing}
                  onOpenChange={({ open: o }) => !o && setEditing(false)}
                  size="lg"
                >
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content mx="auto" maxH="90vh" overflowY="auto">
                      <Dialog.Header>
                        <Dialog.Title>Edit Module</Dialog.Title>
                      </Dialog.Header>
                      <Dialog.Body>
                        {mod.expand?.program && (
                          <ModuleForm
                            program={mod.expand.program}
                            loading={editLoading}
                            submitLabel="Save Changes"
                            defaultValues={{
                              title: mod.title,
                              slug: mod.slug,
                              order: mod.order,
                              goal: mod.goal,
                              start_date: mod.start_date?.slice(0, 10) ?? "",
                              end_date: mod.end_date?.slice(0, 10) ?? "",
                            }}
                            onSubmit={async (data: ModuleFormValues) => {
                              setEditLoading(true);
                              try {
                                await updateMut.mutateAsync(data);
                              } finally {
                                setEditLoading(false);
                              }
                            }}
                          />
                        )}
                      </Dialog.Body>
                      <Dialog.Footer>
                        <Button
                          variant="ghost"
                          onClick={() => setEditing(false)}
                        >
                          Cancel
                        </Button>
                      </Dialog.Footer>
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Dialog.Root>

                {/* Delete confirm dialog */}
                <Dialog.Root
                  open={confirmDelete}
                  onOpenChange={({ open: o }) => !o && setConfirmDelete(false)}
                >
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content>
                      <Dialog.Header>
                        <Dialog.Title>Delete Module</Dialog.Title>
                      </Dialog.Header>
                      <Dialog.Body>
                        <Text>
                          Are you sure you want to delete{" "}
                          <strong>{mod.title}</strong>?
                        </Text>
                      </Dialog.Body>
                      <Dialog.Footer>
                        <Button
                          variant="ghost"
                          onClick={() => setConfirmDelete(false)}
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

                {/* Tabs */}
                <Tabs.Root defaultValue="lessons" variant="line">
                  <Tabs.List>
                    <Tabs.Trigger value="lessons">
                      Lessons
                      {lessons.length > 0 && (
                        <Badge
                          ml={2}
                          variant="subtle"
                          colorPalette="gray"
                          size="sm"
                        >
                          {lessons.length}
                        </Badge>
                      )}
                    </Tabs.Trigger>
                    <Tabs.Trigger value="assessments">
                      Assessments
                      {assessments.length > 0 && (
                        <Badge
                          ml={2}
                          variant="subtle"
                          colorPalette="gray"
                          size="sm"
                        >
                          {assessments.length}
                        </Badge>
                      )}
                    </Tabs.Trigger>
                  </Tabs.List>

                  <Tabs.Content value="lessons">
                    <Stack gap={3} pt={4}>
                      {lessons.length === 0 ? (
                        <Box
                          p={8}
                          textAlign="center"
                          borderWidth={1}
                          borderRadius="md"
                          borderStyle="dashed"
                        >
                          <Text color="fg.muted">
                            No lessons in this module.
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
                            {lessons.map((lesson) => (
                              <Table.Row key={lesson.id}>
                                <Table.Cell>
                                  <AppLink
                                    to={`/lessons/${lesson.id}`}
                                    color="colorPalette.fg"
                                    fontWeight="medium"
                                  >
                                    {lesson.title}
                                  </AppLink>
                                </Table.Cell>
                                <Table.Cell>
                                  <Badge variant="subtle">
                                    {lesson.type || "—"}
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell>
                                  {formatDate(lesson.due_at)}
                                </Table.Cell>
                                <Table.Cell>
                                  <StatusBadge status={lesson.status} />
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      )}
                    </Stack>
                  </Tabs.Content>

                  <Tabs.Content value="assessments">
                    <Stack gap={3} pt={4}>
                      {assessments.length === 0 ? (
                        <Box
                          p={8}
                          textAlign="center"
                          borderWidth={1}
                          borderRadius="md"
                          borderStyle="dashed"
                        >
                          <Text color="fg.muted">
                            No assessments in this module.
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
                              <Table.ColumnHeader>Passed</Table.ColumnHeader>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {assessments.map((a) => (
                              <Table.Row key={a.id}>
                                <Table.Cell>
                                  <AppLink
                                    to={`/assessments/${a.id}`}
                                    color="colorPalette.fg"
                                    fontWeight="medium"
                                  >
                                    {a.title}
                                  </AppLink>
                                </Table.Cell>
                                <Table.Cell>
                                  <Badge variant="subtle">
                                    {a.assessment_type || "—"}
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell>{formatDate(a.due_at)}</Table.Cell>
                                <Table.Cell>
                                  <StatusBadge status={a.status} />
                                </Table.Cell>
                                <Table.Cell>
                                  {a.passed != null ? (
                                    <Badge
                                      colorPalette={a.passed ? "green" : "red"}
                                      variant="subtle"
                                    >
                                      {a.passed ? "Yes" : "No"}
                                    </Badge>
                                  ) : (
                                    "—"
                                  )}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      )}
                    </Stack>
                  </Tabs.Content>
                </Tabs.Root>
              </Stack>
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

// ─── ProgramDashboard ─────────────────────────────────────────────────────────

export default function ProgramDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const programId = searchParams.get("program") ?? "";
  const moduleId = searchParams.get("module") ?? "";
  const activeTab = searchParams.get("view") ?? "overview";

  const qc = useQueryClient();

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [creating, setCreating] = useState(false);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(
    null,
  );

  // Selected program edit/delete state
  const [editingProgram, setEditingProgram] = useState(false);
  const [confirmDeleteProgram, setConfirmDeleteProgram] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<Program["status"]>("planned");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editAreaId, setEditAreaId] = useState("");
  const [editMeetingDays, setEditMeetingDays] = useState<string[]>([]);
  const [editMakeupDays, setEditMakeupDays] = useState<string[]>([]);

  // Module create state
  const [creatingModule, setCreatingModule] = useState(false);
  const [createModuleLoading, setCreateModuleLoading] = useState(false);

  // Resource state
  const [creatingResource, setCreatingResource] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: programs = [], isLoading: programsLoading } = useQuery<
    Program[]
  >({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  // When arriving via /modules/:id redirect we have a moduleId but no programId.
  // Fetch the module to resolve its parent program and sync the URL.
  const { data: orphanModule } = useQuery<Module>({
    queryKey: ["modules", moduleId],
    queryFn: () => getModule(moduleId),
    enabled: !!moduleId && !programId,
  });

  useEffect(() => {
    if (orphanModule?.program && !programId) {
      setSearchParams(
        { program: orphanModule.program, module: moduleId },
        { replace: true },
      );
    }
  }, [orphanModule, programId, moduleId, setSearchParams]);

  // ── Derived (pre-query) ───────────────────────────────────────────────────────

  const selectedProgram = programs.find((p) => p.id === programId);
  const isCourse = selectedProgram?.type === "course";

  // For course programmes, fetch modules/lessons directly.
  // For year/term, aggregate across all descendant course children.
  const courseIds = useMemo(() => {
    if (!programId || !selectedProgram) return [];
    if (isCourse) return [programId];
    return descendantCourseIds(programs, programId);
  }, [programs, programId, selectedProgram, isCourse]);

  // Direct children (for Sub-programs tab); derived from flat list, not expand.
  const children = programs.filter((p) => p.parent === programId);

  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["modules", { courseIds }],
    queryFn: () =>
      courseIds.length === 1
        ? listModules({ program: courseIds[0] })
        : listModules({ programIds: courseIds }),
    enabled: courseIds.length > 0,
  });

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["lessons", { courseIds }],
    queryFn: () =>
      courseIds.length === 1
        ? listLessons({ program: courseIds[0] })
        : listLessons({ programIds: courseIds }),
    enabled: courseIds.length > 0,
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ["resources", resourceTypeFilter],
    queryFn: () => listResources(resourceTypeFilter || undefined),
    enabled: !!programId,
  });

  // ── Derived (post-query) ──────────────────────────────────────────────────────

  const programModuleIds = new Set(modules.map((m) => m.id));
  const programResources = resources.filter(
    (r) =>
      r.expand?.["regula_lessons_via_resource"]?.some((lesson: Lesson) =>
        programModuleIds.has(lesson.module),
      ) ?? false,
  );

  const total = lessons.length;
  const completed = lessons.filter((l) => l.status === "completed").length;
  const active = lessons.filter((l) => l.status === "active").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const lessonCountByModule = modules.reduce<Record<string, number>>(
    (acc, m) => {
      acc[m.id] = lessons.filter((l) => l.module === m.id).length;
      return acc;
    },
    {},
  );

  const editingResource = resources.find((r) => r.id === editingResourceId);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createProgramMut = useMutation({
    mutationFn: createProgram,
    onSuccess: async (createdProgram) => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      setCreating(false);
      if (createdProgram.type === "year" || createdProgram.type === "term") {
        await autoActivateIfFirstYearTermProgram(createdProgram.id);
        void qc.invalidateQueries({ queryKey: ["user_settings"] });
      }
    },
  });

  const deleteProgramMut = useMutation({
    mutationFn: deleteProgramWithChildren,
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      setDeletingProgramId(null);
      if (id === programId) setSearchParams({});
    },
  });

  const updateProgramMut = useMutation({
    mutationFn: (data: Partial<Program>) => updateProgram(programId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      setEditingProgram(false);
    },
  });

  const deleteProgramDetailMut = useMutation({
    mutationFn: () => deleteProgramWithChildren(programId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      setSearchParams({});
      setConfirmDeleteProgram(false);
    },
  });

  const createModuleMut = useMutation({
    mutationFn: (data: Partial<Module>) => createModule(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["modules"] });
      setCreatingModule(false);
    },
  });

  const createResourceMut = useMutation({
    mutationFn: createResource,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["resources"] });
      setCreatingResource(false);
    },
  });

  const updateResourceMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) =>
      updateResource(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["resources"] });
      setEditingResourceId(null);
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const selectProgram = (id: string) => {
    setSearchParams({ program: id });
  };

  const selectModule = (id: string) => {
    setSearchParams({ program: programId, module: id });
  };

  const closeModule = () => {
    const params: Record<string, string> = { program: programId };
    if (activeTab !== "overview") params.view = activeTab;
    setSearchParams(params);
  };

  const setTab = (tab: string) => {
    const params: Record<string, string> = { program: programId };
    if (tab !== "overview") params.view = tab;
    setSearchParams(params);
  };

  const startEditProgram = () => {
    if (!selectedProgram) return;
    setEditName(selectedProgram.name);
    setEditStatus(selectedProgram.status);
    setEditDescription(selectedProgram.description ?? "");
    setEditStartDate(
      selectedProgram.start_date
        ? selectedProgram.start_date.split("T")[0]
        : "",
    );
    setEditEndDate(
      selectedProgram.end_date ? selectedProgram.end_date.split("T")[0] : "",
    );
    setEditAreaId(selectedProgram.area ?? "");
    setEditMeetingDays(selectedProgram.meeting_days ?? []);
    setEditMakeupDays(selectedProgram.makeup_days ?? []);
    setEditingProgram(true);
  };

  const handleEditProgramSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;
    const data: Partial<Program> = {
      name: editName,
      status: editStatus,
      description: editDescription,
      start_date: editStartDate || undefined,
      end_date: editEndDate || undefined,
    };
    if (selectedProgram.type === "course") {
      data.area = editAreaId || undefined;
      data.meeting_days = editMeetingDays.length ? editMeetingDays : undefined;
      data.makeup_days = editMakeupDays.length ? editMakeupDays : undefined;
    }
    void updateProgramMut.mutateAsync(data);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Stack id="program-dashboard" gap={6}>
      {/* ── Programs List ──────────────────────────────────────────────────────── */}
      <Flex
        id="programs-list"
        justify="space-between"
        align="center"
        flexWrap="wrap"
        gap={3}
      >
        <Heading size="lg">Programs</Heading>
        <HStack gap={2}>
          <HStack gap={1}>
            <IconButton
              aria-label="Card view"
              size="sm"
              variant={viewMode === "cards" ? "solid" : "ghost"}
              onClick={() => setViewMode("cards")}
            >
              <LuLayoutGrid />
            </IconButton>
            <IconButton
              aria-label="Table view"
              size="sm"
              variant={viewMode === "table" ? "solid" : "ghost"}
              onClick={() => setViewMode("table")}
            >
              <LuList />
            </IconButton>
          </HStack>
          <AppLink to="/programs/import">
            <Button size="sm" variant="outline">
              Import Program
            </Button>
          </AppLink>
          {!creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              New Program
            </Button>
          )}
        </HStack>
      </Flex>

      {creating && (
        <ProgramForm
          programs={programs}
          areas={areas}
          loading={createProgramMut.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(data) => createProgramMut.mutateAsync(data)}
        />
      )}

      {programsLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : programs.length === 0 ? (
        <Box py={12} textAlign="center" color="fg.muted">
          <Text>No programs yet. Create one to get started.</Text>
        </Box>
      ) : viewMode === "cards" ? (
        /* Card view */
        <SimpleGrid
          id="program-cards"
          columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
          gap={4}
        >
          {programs
            .filter((p) => p.type !== "course")
            .map((p) => (
              <Box
                key={p.id}
                cursor="pointer"
                borderWidth={p.id === programId ? 2 : 1}
                borderColor={
                  p.id === programId ? "colorPalette.emphasized" : "border"
                }
                borderRadius="md"
                p={4}
                _hover={{
                  borderColor: "colorPalette.emphasized",
                  shadow: "sm",
                }}
                transition="all 0.15s"
                onClick={() => selectProgram(p.id)}
              >
                <Stack gap={2}>
                  <Text fontWeight="semibold" lineClamp={2}>
                    {p.name}
                  </Text>
                  <HStack gap={2} flexWrap="wrap">
                    <Badge
                      variant="subtle"
                      colorPalette={statusColor[p.status] ?? "gray"}
                      size="sm"
                    >
                      {p.status}
                    </Badge>
                    <Badge variant="outline" size="sm">
                      {p.type}
                    </Badge>
                  </HStack>
                  {(p.start_date || p.end_date) && (
                    <Text fontSize="xs" color="fg.muted">
                      {formatDate(p.start_date)} → {formatDate(p.end_date)}
                    </Text>
                  )}
                </Stack>
              </Box>
            ))}
        </SimpleGrid>
      ) : (
        /* Table view */
        <Table.Root id="program-table" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Parent</Table.ColumnHeader>
              <Table.ColumnHeader w={8} />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {programs
              .filter((p) => p.type !== "course")
              .map((p) => (
                <Table.Row
                  key={p.id}
                  cursor="pointer"
                  bg={p.id === programId ? "colorPalette.subtle" : undefined}
                  _hover={{ bg: "bg.muted" }}
                  onClick={() => selectProgram(p.id)}
                >
                  <Table.Cell fontWeight="medium" color="colorPalette.fg">
                    {p.name}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="subtle">{p.type}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      colorPalette={statusColor[p.status] ?? "gray"}
                      variant="subtle"
                    >
                      {p.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {p.expand?.parent?.name ?? "—"}
                  </Table.Cell>
                  <Table.Cell onClick={(e) => e.stopPropagation()}>
                    <HStack gap={3} justify="flex-end">
                      {deletingProgramId === p.id ? (
                        <HStack gap={1}>
                          <Button
                            size="xs"
                            colorPalette="red"
                            loading={deleteProgramMut.isPending}
                            onClick={() => deleteProgramMut.mutate(p.id)}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setDeletingProgramId(null)}
                          >
                            Cancel
                          </Button>
                        </HStack>
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => setDeletingProgramId(p.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
          </Table.Body>
        </Table.Root>
      )}

      {/* ── Selected Program Detail ────────────────────────────────────────────── */}
      {selectedProgram && (
        <Stack
          id={`program-detail-${selectedProgram.id}`}
          gap={6}
          pt={6}
          borderTopWidth={1}
          borderColor="border"
        >
          {/* Program header */}
          <Flex justify="space-between" align="start" flexWrap="wrap" gap={3}>
            <HStack flexWrap="wrap" gap={2}>
              <Heading size="lg">{selectedProgram.name}</Heading>
              <Badge
                colorPalette={statusColor[selectedProgram.status] ?? "teal"}
                variant="subtle"
              >
                {selectedProgram.status}
              </Badge>
              <Badge variant="outline">{selectedProgram.type}</Badge>
            </HStack>
            <HStack gap={2} flexWrap="wrap">
              <Button size="sm" variant="outline" onClick={startEditProgram}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={() => setConfirmDeleteProgram(true)}
              >
                Delete
              </Button>
            </HStack>
          </Flex>

          {/* Edit program dialog */}
          <Dialog.Root
            id={`edit-program-dialog-${selectedProgram.id}`}
            open={editingProgram}
            onOpenChange={({ open: o }) => !o && setEditingProgram(false)}
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
                  onSubmit={handleEditProgramSubmit}
                >
                  <Stack gap={3}>
                    <Field.Root required>
                      <Field.Label>Name</Field.Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </Field.Root>
                    <Stack direction="row" gap={3} flexWrap="wrap">
                      <Field.Root>
                        <Field.Label>Status</Field.Label>
                        <NativeSelect.Root>
                          <NativeSelect.Field
                            value={editStatus}
                            onChange={(e) =>
                              setEditStatus(e.target.value as Program["status"])
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
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>End Date</Field.Label>
                        <Input
                          type="date"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                        />
                      </Field.Root>
                    </Stack>
                    <Field.Root>
                      <Field.Label>Description</Field.Label>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                      />
                    </Field.Root>
                    {selectedProgram.type === "course" && (
                      <Stack gap={3}>
                        <Field.Root>
                          <Field.Label>Area</Field.Label>
                          <NativeSelect.Root>
                            <NativeSelect.Field
                              value={editAreaId}
                              onChange={(e) => setEditAreaId(e.target.value)}
                            >
                              <option value="">— select area —</option>
                              {areas.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>
                        <DayCheckboxGroup
                          label="Meeting Days"
                          selected={editMeetingDays}
                          onChange={setEditMeetingDays}
                        />
                        <DayCheckboxGroup
                          label="Makeup Days"
                          selected={editMakeupDays}
                          onChange={setEditMakeupDays}
                        />
                      </Stack>
                    )}
                  </Stack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    variant="ghost"
                    onClick={() => setEditingProgram(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="edit-program-form"
                    loading={updateProgramMut.isPending}
                  >
                    Save
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Root>

          {/* Delete program dialog */}
          <Dialog.Root
            id={`delete-program-dialog-${selectedProgram.id}`}
            open={confirmDeleteProgram}
            onOpenChange={({ open: o }) => !o && setConfirmDeleteProgram(false)}
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
                      <strong>{selectedProgram.name}</strong>? All modules,
                      lessons, and other items assigned to it will also be
                      deleted.
                    </Text>
                    {children.length > 0 && (
                      <Text fontSize="sm" color="red.fg">
                        This will also permanently delete {children.length}{" "}
                        sub-program{children.length !== 1 ? "s" : ""} and all
                        their contents.
                      </Text>
                    )}
                  </Stack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDeleteProgram(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    colorPalette="red"
                    loading={deleteProgramDetailMut.isPending}
                    onClick={() => deleteProgramDetailMut.mutate()}
                  >
                    Delete
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Root>

          {/* Tabs */}
          <Tabs.Root
            value={activeTab}
            onValueChange={({ value }) => setTab(value)}
            variant="line"
            id={`program-detail-tabs-${selectedProgram.id}`}
          >
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="modules">
                Modules
                {modules.length > 0 && (
                  <Badge ml={2} variant="subtle" colorPalette="gray" size="sm">
                    {modules.length}
                  </Badge>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="resources">
                Resources
                {programResources.length > 0 && (
                  <Badge ml={2} variant="subtle" colorPalette="gray" size="sm">
                    {programResources.length}
                  </Badge>
                )}
              </Tabs.Trigger>
              {children.length > 0 && (
                <Tabs.Trigger value="subprograms">
                  {selectedProgram.type === "term" ||
                  selectedProgram.type === "year"
                    ? "Courses"
                    : "Sub-programs"}
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
                  templateColumns={{
                    base: "repeat(2, 1fr)",
                    md: "repeat(4, 1fr)",
                  }}
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
                    <Text fontWeight="medium">{selectedProgram.type}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.subtle" mb={1}>
                      Status
                    </Text>
                    <Text fontWeight="medium">{selectedProgram.status}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.subtle" mb={1}>
                      Start Date
                    </Text>
                    <Text fontWeight="medium">
                      {formatDate(selectedProgram.start_date)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.subtle" mb={1}>
                      End Date
                    </Text>
                    <Text fontWeight="medium">
                      {formatDate(selectedProgram.end_date)}
                    </Text>
                  </Box>
                  {selectedProgram.expand?.parent && (
                    <Box>
                      <Text fontSize="xs" color="fg.subtle" mb={1}>
                        Parent Program
                      </Text>
                      <Text
                        fontWeight="medium"
                        color="colorPalette.fg"
                        cursor="pointer"
                        onClick={() =>
                          selectProgram(selectedProgram.expand!.parent!.id)
                        }
                      >
                        {selectedProgram.expand.parent.name}
                      </Text>
                    </Box>
                  )}
                </Grid>

                {selectedProgram.description && (
                  <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
                    <Text fontSize="xs" color="fg.subtle" mb={2}>
                      Description
                    </Text>
                    <Text whiteSpace="pre-wrap">
                      {selectedProgram.description}
                    </Text>
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
                        Total Lessons
                      </Text>
                    </Box>
                    <Box textAlign="center">
                      <Text fontSize="2xl" fontWeight="bold" color="orange.fg">
                        {active}
                      </Text>
                      <Text fontSize="xs" color="fg.subtle">
                        Active
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

            {/* Modules */}
            <Tabs.Content value="modules">
              <Stack gap={4} pt={4}>
                {isCourse ? (
                  <Flex justify="flex-end">
                    <Button size="sm" onClick={() => setCreatingModule(true)}>
                      New Module
                    </Button>
                  </Flex>
                ) : (
                  <Text fontSize="sm" color="fg.muted">
                    Modules below are aggregated from this program's child
                    courses. Select a course in the Sub-programs tab to create
                    new modules.
                  </Text>
                )}

                {/* Create module dialog (course only) */}
                {isCourse && (
                  <Dialog.Root
                    open={creatingModule}
                    onOpenChange={({ open: o }) =>
                      !o && setCreatingModule(false)
                    }
                    size="lg"
                  >
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                      <Dialog.Content>
                        <Dialog.Header>
                          <Dialog.Title>New Module</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                          <ModuleForm
                            program={selectedProgram}
                            loading={createModuleLoading}
                            submitLabel="Create Module"
                            onSubmit={async (data: ModuleFormValues) => {
                              setCreateModuleLoading(true);
                              try {
                                await createModuleMut.mutateAsync({
                                  ...data,
                                  program: programId,
                                });
                              } finally {
                                setCreateModuleLoading(false);
                              }
                            }}
                          />
                        </Dialog.Body>
                        <Dialog.Footer>
                          <Button
                            variant="ghost"
                            onClick={() => setCreatingModule(false)}
                          >
                            Cancel
                          </Button>
                        </Dialog.Footer>
                      </Dialog.Content>
                    </Dialog.Positioner>
                  </Dialog.Root>
                )}

                {modules.length === 0 ? (
                  <Box
                    p={8}
                    textAlign="center"
                    borderWidth={1}
                    borderRadius="md"
                    borderStyle="dashed"
                  >
                    <Text color="fg.muted">No modules yet.</Text>
                  </Box>
                ) : (
                  <Table.Root variant="outline">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Title</Table.ColumnHeader>
                        {!isCourse && (
                          <Table.ColumnHeader>Course</Table.ColumnHeader>
                        )}
                        <Table.ColumnHeader>Date Range</Table.ColumnHeader>
                        <Table.ColumnHeader>Lessons</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {modules.map((m) => (
                        <Table.Row
                          key={m.id}
                          cursor="pointer"
                          _hover={{ bg: "bg.muted" }}
                          onClick={() => selectModule(m.id)}
                        >
                          <Table.Cell
                            fontWeight="medium"
                            color="colorPalette.fg"
                          >
                            {m.title}
                          </Table.Cell>
                          {!isCourse && (
                            <Table.Cell color="fg.muted">
                              {m.expand?.program?.name ?? "—"}
                            </Table.Cell>
                          )}
                          <Table.Cell color="fg.muted">
                            {m.start_date || m.end_date
                              ? `${formatDate(m.start_date)} → ${formatDate(m.end_date)}`
                              : "—"}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant="subtle" colorPalette="gray">
                              {lessonCountByModule[m.id] ?? 0}
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Stack>
            </Tabs.Content>

            {/* Resources */}
            <Tabs.Content value="resources">
              <Stack gap={4} pt={4}>
                <Flex
                  justify="space-between"
                  align="center"
                  flexWrap="wrap"
                  gap={3}
                >
                  <NativeSelect.Root w="200px" size="sm">
                    <NativeSelect.Field
                      value={resourceTypeFilter}
                      onChange={(e) => setResourceTypeFilter(e.target.value)}
                    >
                      <option value="">All types</option>
                      {RESOURCE_TYPES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  {!creatingResource && (
                    <Button size="sm" onClick={() => setCreatingResource(true)}>
                      New Resource
                    </Button>
                  )}
                </Flex>

                {creatingResource && (
                  <ResourceForm
                    areas={areas}
                    loading={createResourceMut.isPending}
                    onCancel={() => setCreatingResource(false)}
                    onSubmit={(data) => createResourceMut.mutateAsync(data)}
                  />
                )}
                <Dialog.Root
                  open={!!editingResource}
                  onOpenChange={({ open: o }) =>
                    !o && setEditingResourceId(null)
                  }
                >
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content mx="auto" maxH="90vh" overflowY="auto">
                      <Dialog.Header>
                        <Dialog.Title>Edit Resource</Dialog.Title>
                        <Dialog.CloseTrigger />
                      </Dialog.Header>
                      <Dialog.Body pb={6}>
                        {editingResource && (
                          <ResourceForm
                            areas={areas}
                            defaultValues={editingResource}
                            loading={updateResourceMut.isPending}
                            onCancel={() => setEditingResourceId(null)}
                            onSubmit={(data) =>
                              updateResourceMut.mutateAsync({
                                id: editingResource.id,
                                data,
                              })
                            }
                            bare
                          />
                        )}
                      </Dialog.Body>
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Dialog.Root>

                {programResources.length === 0 ? (
                  <Box py={12} textAlign="center" color="fg.muted">
                    <Text>No resources linked to this program's lessons.</Text>
                  </Box>
                ) : (
                  <Table.Root variant="outline">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Title</Table.ColumnHeader>
                        <Table.ColumnHeader>Type</Table.ColumnHeader>
                        <Table.ColumnHeader>Author</Table.ColumnHeader>
                        <Table.ColumnHeader>Area</Table.ColumnHeader>
                        <Table.ColumnHeader>Lessons</Table.ColumnHeader>
                        <Table.ColumnHeader w={16} />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {programResources.map((r) => (
                        <Table.Row key={r.id}>
                          <Table.Cell fontWeight="medium">{r.title}</Table.Cell>
                          <Table.Cell>
                            <Badge variant="subtle">{r.resource_type}</Badge>
                          </Table.Cell>
                          <Table.Cell color="fg.muted">
                            {r.author || "—"}
                          </Table.Cell>
                          <Table.Cell>
                            {r.expand?.area ? (
                              <HStack gap={1}>
                                <Box
                                  w={2.5}
                                  h={2.5}
                                  borderRadius="sm"
                                  bg={r.expand.area.color || "gray.400"}
                                  flexShrink={0}
                                />
                                <Text fontSize="sm">{r.expand.area.name}</Text>
                              </HStack>
                            ) : (
                              <Text color="fg.muted">—</Text>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            {r.expand?.["regula_lessons_via_resource"]
                              ?.length ? (
                              <Stack gap={1}>
                                {r.expand["regula_lessons_via_resource"].map(
                                  (item: Lesson) => (
                                    <AppLink
                                      key={item.id}
                                      to={`/lessons/${item.id}`}
                                      fontSize="sm"
                                      color="colorPalette.fg"
                                    >
                                      {item.title}
                                    </AppLink>
                                  ),
                                )}
                              </Stack>
                            ) : (
                              <Text color="fg.muted" fontSize="sm">
                                —
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setEditingResourceId(r.id)}
                            >
                              Edit
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Stack>
            </Tabs.Content>

            {/* Sub-programs / Courses */}
            {children.length > 0 && (
              <Tabs.Content value="subprograms">
                <Stack gap={3} pt={4}>
                  <Table.Root variant="outline">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Name</Table.ColumnHeader>
                        <Table.ColumnHeader>Status</Table.ColumnHeader>
                        <Table.ColumnHeader>Date Range</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {children.map((child) => (
                        <Table.Row
                          key={child.id}
                          cursor="pointer"
                          _hover={{ bg: "bg.muted" }}
                          onClick={() => selectProgram(child.id)}
                        >
                          <Table.Cell
                            fontWeight="medium"
                            color="colorPalette.fg"
                          >
                            {child.name}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              colorPalette={statusColor[child.status] ?? "gray"}
                              variant="subtle"
                            >
                              {child.status}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell color="fg.muted">
                            {child.start_date || child.end_date
                              ? `${formatDate(child.start_date)} → ${formatDate(child.end_date)}`
                              : "—"}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Stack>
              </Tabs.Content>
            )}
          </Tabs.Root>
        </Stack>
      )}

      {/* ── Module Drawer ──────────────────────────────────────────────────────── */}
      {moduleId && <ModuleDrawer moduleId={moduleId} onClose={closeModule} />}
    </Stack>
  );
}
