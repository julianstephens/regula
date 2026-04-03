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
import type { Program, StudyItem } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Table,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

const statusColor: Record<string, string> = {
  planned: "gray",
  active: "green",
  completed: "blue",
  archived: "orange",
};

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

  // Fetch assessments (quiz + exam items) for term programs across all child blocks
  const { data: rawAssessments = [] } = useQuery<StudyItem[]>({
    queryKey: ["study_items", "assessments", id],
    queryFn: async () => {
      if (!program) return [];
      // Collect all program ids to check: this program + all direct block children
      const childIds = (
        (program.expand?.["programs(parent)"] ?? []) as Program[]
      ).map((c) => c.id);
      const ids = [id!, ...childIds];
      const results = await Promise.all(
        ids.map((pid) => listStudyItems({ program: pid })),
      );
      return results.flat();
    },
    enabled: !!program && program.type === "term",
  });

  const assessments = rawAssessments.filter(
    (item) => item.item_type === "quiz" || item.item_type === "exam",
  );

  if (isLoading) return <Text>Loading…</Text>;
  if (!program) return <Text>Program not found.</Text>;

  const children = (program.expand?.["programs(parent)"] ?? []) as Program[];

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
    program?.type === "block" && startDate
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
    if (program?.type === "block") {
      data.end_date = computedEndDate?.toISOString();
      data.block_weeks = blockWeeksInput ? Number(blockWeeksInput) : undefined;
    } else {
      data.end_date = endDate || undefined;
    }
    void updateMut.mutateAsync(data);
  };

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <HStack>
          <AppLink to="/programs" color="fg.muted" fontSize="sm">
            ← Programs
          </AppLink>
          <Heading size="lg">{program.name}</Heading>
          <Badge
            colorPalette={statusColor[program.status] ?? "gray"}
            variant="subtle"
          >
            {program.status}
          </Badge>
          <Badge variant="outline">{program.type}</Badge>
        </HStack>
        {!editing && (
          <HStack gap={2}>
            {program.type === "term" && (
              <AppLink to={`/programs/${id}/import`}>
                <Button size="sm" variant="outline">
                  Import Syllabi
                </Button>
              </AppLink>
            )}
            <Button size="sm" onClick={startEdit}>
              Edit
            </Button>
            {confirmDelete ? (
              <HStack gap={1}>
                {children.length > 0 && (
                  <HStack gap={1} mr={1}>
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
                      {children.length !== 1 ? "s" : ""}
                    </label>
                  </HStack>
                )}
                <Button
                  size="sm"
                  colorPalette="red"
                  loading={deleteMut.isPending}
                  onClick={() => deleteMut.mutate()}
                >
                  Confirm Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteChildren(false);
                  }}
                >
                  Cancel
                </Button>
              </HStack>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
          </HStack>
        )}
      </Flex>

      {editing && (
        <Box
          as="form"
          onSubmit={handleSubmit}
          p={4}
          borderWidth={1}
          borderRadius="md"
          bg="bg.subtle"
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
            <Stack direction="row" gap={3}>
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
                      ["planned", "active", "completed", "archived"] as const
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
              {program?.type === "block" ? (
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
            <HStack>
              <Button type="submit" size="sm" loading={updateMut.isPending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </HStack>
          </Stack>
        </Box>
      )}

      {program.description && (
        <Text color="fg.muted">{program.description}</Text>
      )}

      {program.type === "block" && !editing && (
        <HStack gap={4} fontSize="sm" color="fg.muted">
          {program.start_date && (
            <Text>
              Start:{" "}
              <strong>
                {new Date(program.start_date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </strong>
            </Text>
          )}
          {program.end_date && (
            <Text>
              End:{" "}
              <strong>
                {new Date(program.end_date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </strong>
            </Text>
          )}
          <Text>
            Duration:{" "}
            <strong>{program.block_weeks ?? globalDefault} weeks</strong> + 1
            rest week
          </Text>
        </HStack>
      )}

      {program.type !== "block" &&
        !editing &&
        (program.start_date || program.end_date) && (
          <HStack gap={4} fontSize="sm" color="fg.muted">
            {program.start_date && (
              <Text>
                Start:{" "}
                <strong>
                  {new Date(program.start_date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </strong>
              </Text>
            )}
            {program.end_date && (
              <Text>
                End:{" "}
                <strong>
                  {new Date(program.end_date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </strong>
              </Text>
            )}
          </HStack>
        )}

      {children.length > 0 && (
        <Stack gap={3}>
          <Heading size="md">Sub-programs</Heading>
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
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
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Stack>
      )}

      {program.type === "term" && assessments.length > 0 && (
        <Stack gap={3}>
          <Heading size="md">Assessments</Heading>
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Title</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>Area</Table.ColumnHeader>
                <Table.ColumnHeader>Due</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {assessments.map((item) => (
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
                      {item.item_type === "quiz" ? "Midterm" : "Final Exam"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{item.expand?.area?.name ?? "—"}</Table.Cell>
                  <Table.Cell>{formatDate(item.due_date)}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={item.status} />
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
