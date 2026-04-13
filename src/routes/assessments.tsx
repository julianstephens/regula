import { StatusBadge } from "@/components/cards/StatusBadge";
import type { AssessmentFormValues } from "@/components/forms/AssessmentForm";
import { AssessmentForm } from "@/components/forms/AssessmentForm";
import { AppLink } from "@/components/ui/app-link";
import { toaster } from "@/components/ui/toaster";
import { formatDate } from "@/lib/dates";
import {
  createAssessment,
  listAssessments,
} from "@/lib/services/assessmentService";
import { listLessons } from "@/lib/services/lessonService";
import { listModules } from "@/lib/services/moduleService";
import { listPrograms } from "@/lib/services/programService";
import type {
  Assessment,
  AssessmentStatus,
  Lesson,
  Module,
  Program,
} from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Dialog,
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

const STATUS_OPTIONS: AssessmentStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "graded",
  "archived",
];

export default function Assessments() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<AssessmentStatus | "">("");
  const [programFilter, setProgramFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const { data: programs = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["modules"],
    queryFn: () => listModules(),
  });

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["lessons"],
    queryFn: () => listLessons(),
  });

  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ["assessments", { status: statusFilter, program: programFilter }],
    queryFn: () =>
      listAssessments({
        status: statusFilter || undefined,
        program: programFilter || undefined,
        sort: "due_at",
      }),
  });

  const createMut = useMutation({
    mutationFn: ({ formData }: { formData: Partial<Assessment>; }) =>
      createAssessment(formData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      setCreating(false);
    },
  });

  return (
    <Stack id="assessments" gap={6}>
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="lg">Assessments</Heading>
        <Button size="sm" onClick={() => setCreating(true)}>
          New Assessment
        </Button>
      </Flex>

      {/* Filters */}
      <HStack gap={3} flexWrap="wrap">
        <NativeSelect.Root maxW="160px" size="sm">
          <NativeSelect.Field
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as AssessmentStatus | "")
            }
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <NativeSelect.Root maxW="220px" size="sm">
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
      </HStack>

      {/* Create dialog */}
      <Dialog.Root
        open={creating}
        onOpenChange={({ open: o }) => !o && setCreating(false)}
        size="lg"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>New Assessment</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <AssessmentForm
                programs={programs}
                modules={modules}
                lessons={lessons}
                loading={createLoading}
                submitLabel="Create Assessment"
                onSubmit={async (data: AssessmentFormValues) => {
                  setCreateLoading(true);
                  try {
                    await createMut.mutateAsync({
                      formData: data as Partial<Assessment>,
                    });
                  } catch (err) {
                    toaster.create({
                      type: "error",
                      title:
                        err instanceof Error
                          ? err.message
                          : "Failed to create assessment",
                    });
                  } finally {
                    setCreateLoading(false);
                  }
                }}
              />
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {isLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : assessments.length === 0 ? (
        <Box
          p={12}
          textAlign="center"
          borderWidth={1}
          borderRadius="md"
          borderStyle="dashed"
        >
          <Text color="fg.muted">No assessments yet.</Text>
        </Box>
      ) : (
        <Table.Root variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Program</Table.ColumnHeader>
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
                    {a.assessment_type
                      ? a.assessment_type.charAt(0).toUpperCase() +
                      a.assessment_type.slice(1)
                      : "—"}
                  </Badge>
                </Table.Cell>
                <Table.Cell color="fg.muted">
                  {a.expand?.program?.name ?? "—"}
                </Table.Cell>
                <Table.Cell>{formatDate(a.due_at)}</Table.Cell>
                <Table.Cell>
                  <StatusBadge status={a.status} />
                </Table.Cell>
                <Table.Cell>
                  {a.status === "graded" || a.status === "archived" ? (
                    <Badge
                      colorPalette={a.passed ? "green" : "red"}
                      variant="subtle"
                      size="sm"
                    >
                      {a.passed ? "Pass" : "Fail"}
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
  );
}
