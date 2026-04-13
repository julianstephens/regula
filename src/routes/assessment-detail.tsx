import { AssessmentStepper } from "@/components/assessments/AssessmentStepper";
import { StatusBadge } from "@/components/cards/StatusBadge";
import { AppLink } from "@/components/ui/app-link";
import { toaster } from "@/components/ui/toaster";
import { formatDate } from "@/lib/dates";
import pb from "@/lib/pocketbase";
import {
  deleteAssessment,
  deleteAttachment,
  getAssessment,
  updateAssessment,
} from "@/lib/services/assessmentService";
import { listLessons } from "@/lib/services/lessonService";
import { listModules } from "@/lib/services/moduleService";
import { listPrograms } from "@/lib/services/programService";
import {
  checkQuotaForReplacement,
  decrementStorageUsed,
  incrementStorageUsed,
} from "@/lib/services/storageService";
import type {
  Assessment,
  AssessmentStatus,
  AssessmentType,
  GradeType,
  Lesson,
  Module,
  Program,
  SubmissionMode,
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
  Input,
  Link,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

// ─── Shared update callback type ─────────────────────────────────────────────

type UpdateFn = (data: Partial<Assessment>, file?: File) => Promise<void>;

// ─── SectionCard wrapper ──────────────────────────────────────────────────────

function SectionCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box borderWidth={1} borderRadius="md" overflow="hidden">
      <Flex
        justify="space-between"
        align="center"
        px={4}
        py={2}
        bg="bg.subtle"
        borderBottomWidth={1}
      >
        <Text
          fontWeight="semibold"
          fontSize="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          {title}
        </Text>
        {onEdit && (
          <Button size="xs" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
        )}
      </Flex>
      <Box p={4}>{children}</Box>
    </Box>
  );
}

// ─── OverviewCard ─────────────────────────────────────────────────────────────

interface OverviewFormValues {
  assessment_type: AssessmentType | "";
  submission_mode: SubmissionMode | "";
  program: string;
  module: string;
  lesson: string;
  due_at: string;
  weight: number | undefined;
}

function OverviewCard({
  assessment,
  programs,
  modules,
  lessons,
  onUpdate,
  loading,
}: {
  assessment: Assessment;
  programs: Program[];
  modules: Module[];
  lessons: Lesson[];
  onUpdate: UpdateFn;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const makeDefaults = (): OverviewFormValues => ({
    assessment_type: assessment.assessment_type ?? "",
    submission_mode: assessment.submission_mode ?? "",
    program: assessment.program ?? "",
    module: assessment.module ?? "",
    lesson: assessment.lesson ?? "",
    due_at: assessment.due_at?.slice(0, 10) ?? "",
    weight: assessment.weight,
  });

  const { register, handleSubmit, reset } = useForm<OverviewFormValues>({
    defaultValues: makeDefaults(),
  });

  const cancel = () => {
    setEditing(false);
    reset(makeDefaults());
  };

  const handleSave = async (data: OverviewFormValues) => {
    setSaving(true);
    try {
      await onUpdate({
        assessment_type: (data.assessment_type || undefined) as
          | AssessmentType
          | undefined,
        submission_mode: (data.submission_mode || undefined) as
          | SubmissionMode
          | undefined,
        program: data.program || undefined,
        module: data.module || undefined,
        lesson: data.lesson || undefined,
        due_at: data.due_at || undefined,
        weight: data.weight,
      });
      setEditing(false);
    } catch (err) {
      toaster.create({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <SectionCard title="Overview">
        <form onSubmit={handleSubmit((d) => void handleSave(d))}>
          <Stack gap={3}>
            <Stack direction="row" gap={3}>
              <Field.Root>
                <Field.Label>Type</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field {...register("assessment_type")}>
                    <option value="">—</option>
                    {(
                      [
                        "exam",
                        "paper",
                        "essay",
                        "oral",
                        "translation",
                        "recitation",
                        "reflection",
                        "project",
                        "practicum",
                      ] as const
                    ).map((v) => (
                      <option key={v} value={v}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              <Field.Root>
                <Field.Label>Submission Mode</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field {...register("submission_mode")}>
                    <option value="">—</option>
                    {(["written", "oral", "digital", "none"] as const).map(
                      (v) => (
                        <option key={v} value={v}>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </option>
                      ),
                    )}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            </Stack>

            <Stack direction="row" gap={3}>
              <Field.Root>
                <Field.Label>Program</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field {...register("program")}>
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
              <Field.Root>
                <Field.Label>Module</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field {...register("module")}>
                    <option value="">—</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            </Stack>

            <Stack direction="row" gap={3}>
              <Field.Root>
                <Field.Label>Lesson</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field {...register("lesson")}>
                    <option value="">—</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              <Field.Root>
                <Field.Label>Due At</Field.Label>
                <Input type="date" {...register("due_at")} />
              </Field.Root>
              <Field.Root>
                <Field.Label>Weight</Field.Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...register("weight", {
                    setValueAs: (v: string) =>
                      v === "" ? undefined : Number(v),
                  })}
                />
              </Field.Root>
            </Stack>

            <HStack>
              <Button type="submit" size="sm" loading={saving || loading}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            </HStack>
          </Stack>
        </form>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Overview" onEdit={() => setEditing(true)}>
      <Grid templateColumns="repeat(2, 1fr)" gap={4}>
        <Box>
          <Text fontSize="xs" color="fg.subtle" mb={1}>
            Type
          </Text>
          <Text fontWeight="medium">
            {assessment.assessment_type
              ? assessment.assessment_type.charAt(0).toUpperCase() +
                assessment.assessment_type.slice(1)
              : "—"}
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="fg.subtle" mb={1}>
            Submission Mode
          </Text>
          <Text fontWeight="medium">
            {assessment.submission_mode
              ? assessment.submission_mode.charAt(0).toUpperCase() +
                assessment.submission_mode.slice(1)
              : "—"}
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="fg.subtle" mb={1}>
            Program
          </Text>
          {assessment.expand?.program ? (
            <AppLink
              to={`/programs/${assessment.program}`}
              fontWeight="medium"
              color="colorPalette.fg"
            >
              {assessment.expand.program.name}
            </AppLink>
          ) : (
            <Text>—</Text>
          )}
        </Box>
        <Box>
          <Text fontSize="xs" color="fg.subtle" mb={1}>
            Module
          </Text>
          {assessment.expand?.module ? (
            <AppLink
              to={`/modules/${assessment.module}`}
              fontWeight="medium"
              color="colorPalette.fg"
            >
              {assessment.expand.module.title}
            </AppLink>
          ) : (
            <Text>—</Text>
          )}
        </Box>
        <Box>
          <Text fontSize="xs" color="fg.subtle" mb={1}>
            Due
          </Text>
          <Text fontWeight="medium">{formatDate(assessment.due_at)}</Text>
        </Box>
        {assessment.weight != null && assessment.weight > 0 && (
          <Box>
            <Text fontSize="xs" color="fg.subtle" mb={1}>
              Weight
            </Text>
            <Text fontWeight="medium">{assessment.weight}</Text>
          </Box>
        )}
      </Grid>
    </SectionCard>
  );
}

// ─── ContentCard ──────────────────────────────────────────────────────────────

interface ContentFormValues {
  prompt: string;
  metadata_json: string;
}

function ContentCard({
  assessment,
  onUpdate,
  loading,
}: {
  assessment: Assessment;
  onUpdate: UpdateFn;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const makeDefaults = (): ContentFormValues => ({
    prompt: assessment.prompt ?? "",
    metadata_json: assessment.metadata_json ?? "",
  });

  const { register, handleSubmit, reset } = useForm<ContentFormValues>({
    defaultValues: makeDefaults(),
  });

  const cancel = () => {
    setEditing(false);
    reset(makeDefaults());
  };

  const handleSave = async (data: ContentFormValues) => {
    setSaving(true);
    try {
      await onUpdate({
        prompt: data.prompt || undefined,
        metadata_json: data.metadata_json || undefined,
      });
      setEditing(false);
    } catch (err) {
      toaster.create({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <SectionCard title="Content">
        <form onSubmit={handleSubmit((d) => void handleSave(d))}>
          <Stack gap={3}>
            <Field.Root>
              <Field.Label>Prompt</Field.Label>
              <Textarea {...register("prompt")} rows={4} />
            </Field.Root>
            <Field.Root>
              <Field.Label>Metadata (JSON)</Field.Label>
              <Textarea
                {...register("metadata_json")}
                rows={4}
                fontFamily="mono"
                fontSize="sm"
                placeholder='{"durationMinutes": 120}'
              />
            </Field.Root>
            <HStack>
              <Button type="submit" size="sm" loading={saving || loading}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            </HStack>
          </Stack>
        </form>
      </SectionCard>
    );
  }

  const hasContent = assessment.prompt || assessment.metadata_json;

  return (
    <SectionCard title="Content" onEdit={() => setEditing(true)}>
      {!hasContent ? (
        <Text fontSize="sm" color="fg.subtle">
          No prompt or metadata yet. Click Edit to add.
        </Text>
      ) : (
        <Stack gap={4}>
          {assessment.prompt && (
            <Box>
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Prompt
              </Text>
              <Text whiteSpace="pre-wrap" fontSize="sm">
                {assessment.prompt}
              </Text>
            </Box>
          )}
          {assessment.metadata_json && (
            <Box>
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Metadata
              </Text>
              <Text
                as="pre"
                whiteSpace="pre-wrap"
                fontSize="sm"
                fontFamily="mono"
                bg="bg.muted"
                p={3}
                borderRadius="md"
              >
                {(() => {
                  try {
                    return JSON.stringify(
                      JSON.parse(assessment.metadata_json),
                      null,
                      2,
                    );
                  } catch {
                    return assessment.metadata_json;
                  }
                })()}
              </Text>
            </Box>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}

// ─── SubmissionCard ───────────────────────────────────────────────────────────

interface SubmissionFormValues {
  submitted_at: string;
  attachmentFile: File | null;
  attachment_url: string;
}

function SubmissionCard({
  assessment,
  onUpdate,
  onRemoveAttachment,
  loading,
}: {
  assessment: Assessment;
  onUpdate: UpdateFn;
  onRemoveAttachment: () => void;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const makeDefaults = (): SubmissionFormValues => ({
    submitted_at: assessment.submitted_at?.slice(0, 10) ?? "",
    attachmentFile: null,
    attachment_url: assessment.attachment_url ?? "",
  });

  const { register, handleSubmit, reset, control } =
    useForm<SubmissionFormValues>({ defaultValues: makeDefaults() });

  const cancel = () => {
    setEditing(false);
    reset(makeDefaults());
  };

  const handleSave = async (data: SubmissionFormValues) => {
    setSaving(true);
    try {
      const { attachmentFile, ...rest } = data;
      if (attachmentFile) {
        await checkQuotaForReplacement(
          attachmentFile.size,
          assessment.attachment_size_bytes ?? 0,
        );
      }
      await onUpdate(rest as Partial<Assessment>, attachmentFile ?? undefined);
      setEditing(false);
    } catch (err) {
      toaster.create({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <SectionCard title="Submission">
        <form onSubmit={handleSubmit((d) => void handleSave(d))}>
          <Stack gap={3}>
            <Field.Root>
              <Field.Label>Submitted At</Field.Label>
              <Input type="date" {...register("submitted_at")} />
            </Field.Root>
            <Controller
              control={control}
              name="attachmentFile"
              render={({ field: { onChange } }) => (
                <Field.Root>
                  <Field.Label>Attachment (PDF)</Field.Label>
                  {assessment.attachment && (
                    <Text fontSize="xs" color="fg.muted" mb={1}>
                      Current: {assessment.attachment}
                    </Text>
                  )}
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => onChange(e.target.files?.[0] ?? null)}
                  />
                  <Field.HelperText>Max 20 MB per file</Field.HelperText>
                </Field.Root>
              )}
            />
            <Field.Root>
              <Field.Label>Attachment URL</Field.Label>
              <Input
                type="url"
                placeholder="https://docs.google.com/…"
                {...register("attachment_url")}
              />
            </Field.Root>
            <HStack>
              <Button type="submit" size="sm" loading={saving || loading}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            </HStack>
          </Stack>
        </form>
      </SectionCard>
    );
  }

  const hasSubmission =
    assessment.submitted_at ||
    assessment.attachment ||
    assessment.attachment_url;

  return (
    <>
      <SectionCard title="Submission" onEdit={() => setEditing(true)}>
        {!hasSubmission ? (
          <Text fontSize="sm" color="fg.subtle">
            Not yet submitted. Advance the status above or edit to record
            submission details.
          </Text>
        ) : (
          <Stack gap={3}>
            {assessment.submitted_at && (
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Submitted At
                </Text>
                <Text fontWeight="medium">
                  {formatDate(assessment.submitted_at)}
                </Text>
              </Box>
            )}
            {(assessment.attachment || assessment.attachment_url) && (
              <Box>
                <Text fontSize="xs" color="fg.subtle" mb={1}>
                  Attachment
                </Text>
                <Stack gap={1}>
                  {assessment.attachment && (
                    <HStack gap={3}>
                      <Link
                        href={pb.files.getURL(
                          assessment,
                          assessment.attachment,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="colorPalette.fg"
                        fontSize="sm"
                        fontWeight="medium"
                      >
                        {assessment.attachment}
                      </Link>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => setConfirmRemove(true)}
                      >
                        Remove
                      </Button>
                    </HStack>
                  )}
                  {assessment.attachment_url && (
                    <Link
                      href={assessment.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      color="colorPalette.fg"
                      fontSize="sm"
                      fontWeight="medium"
                    >
                      External link ↗
                    </Link>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </SectionCard>

      <Dialog.Root
        open={confirmRemove}
        onOpenChange={({ open: o }) => !o && setConfirmRemove(false)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Remove Attachment</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Remove <strong>{assessment.attachment}</strong>? The file will
                be deleted and your storage usage updated.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
              <Button
                colorPalette="red"
                onClick={() => {
                  onRemoveAttachment();
                  setConfirmRemove(false);
                }}
              >
                Remove
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}

// ─── ResultsCard ──────────────────────────────────────────────────────────────

interface ResultsFormValues {
  score: number | undefined;
  max_score: number | undefined;
  grade_type: GradeType | "";
  passed: boolean;
  feedback: string;
  completed_at: string;
}

function ResultsCard({
  assessment,
  onUpdate,
  loading,
}: {
  assessment: Assessment;
  onUpdate: UpdateFn;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const makeDefaults = (): ResultsFormValues => ({
    score: assessment.score,
    max_score: assessment.max_score,
    grade_type: (assessment.grade_type as GradeType) ?? "",
    passed: assessment.passed ?? false,
    feedback: assessment.feedback ?? "",
    completed_at: assessment.completed_at?.slice(0, 10) ?? "",
  });

  const { register, handleSubmit, reset, control } =
    useForm<ResultsFormValues>({ defaultValues: makeDefaults() });

  const cancel = () => {
    setEditing(false);
    reset(makeDefaults());
  };

  const handleSave = async (data: ResultsFormValues) => {
    setSaving(true);
    try {
      await onUpdate({
        score: data.score,
        max_score: data.max_score,
        grade_type: (data.grade_type || undefined) as GradeType | undefined,
        passed: data.passed,
        feedback: data.feedback || undefined,
        completed_at: data.completed_at || undefined,
      });
      setEditing(false);
    } catch (err) {
      toaster.create({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <SectionCard title="Results">
        <form onSubmit={handleSubmit((d) => void handleSave(d))}>
          <Stack gap={3}>
            <Stack direction="row" gap={3}>
              <Field.Root>
                <Field.Label>Score</Field.Label>
                <Input
                  type="number"
                  min={0}
                  {...register("score", {
                    setValueAs: (v: string) =>
                      v === "" ? undefined : Number(v),
                  })}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Max Score</Field.Label>
                <Input
                  type="number"
                  min={0}
                  {...register("max_score", {
                    setValueAs: (v: string) =>
                      v === "" ? undefined : Number(v),
                  })}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Grade Type</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field {...register("grade_type")}>
                    <option value="">—</option>
                    {(
                      ["none", "pass_fail", "numeric", "rubric"] as const
                    ).map((v) => (
                      <option key={v} value={v}>
                        {v.replace(/_/g, " ")}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            </Stack>

            <Stack direction="row" gap={3}>
              <Controller
                control={control}
                name="passed"
                render={({ field }) => (
                  <Checkbox.Root
                    checked={field.value}
                    onCheckedChange={(e) => field.onChange(e.checked)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>Passed</Checkbox.Label>
                  </Checkbox.Root>
                )}
              />
              <Field.Root>
                <Field.Label>Completed At</Field.Label>
                <Input type="date" {...register("completed_at")} />
              </Field.Root>
            </Stack>

            <Field.Root>
              <Field.Label>Feedback</Field.Label>
              <Textarea {...register("feedback")} rows={3} />
            </Field.Root>

            <HStack>
              <Button type="submit" size="sm" loading={saving || loading}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
            </HStack>
          </Stack>
        </form>
      </SectionCard>
    );
  }

  const hasResults =
    assessment.score != null ||
    (assessment.grade_type && assessment.grade_type !== "none") ||
    assessment.feedback ||
    assessment.completed_at;

  return (
    <SectionCard title="Results" onEdit={() => setEditing(true)}>
      {!hasResults ? (
        <Text fontSize="sm" color="fg.subtle">
          No results recorded yet. Grade the assessment when ready.
        </Text>
      ) : (
        <Stack gap={3}>
          {assessment.score != null && (
            <Box>
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Score
              </Text>
              <Text fontWeight="medium">
                {assessment.score}
                {assessment.max_score ? ` / ${assessment.max_score}` : ""}
              </Text>
            </Box>
          )}
          {assessment.grade_type && assessment.grade_type !== "none" && (
            <Box>
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Grade Type
              </Text>
              <Text fontWeight="medium">
                {assessment.grade_type.replace(/_/g, " ")}
              </Text>
            </Box>
          )}
          {assessment.passed != null && (
            <Box>
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Result
              </Text>
              <Badge
                colorPalette={assessment.passed ? "green" : "red"}
                variant="subtle"
              >
                {assessment.passed ? "Passed" : "Failed"}
              </Badge>
            </Box>
          )}
          {assessment.completed_at && (
            <Box>
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Completed At
              </Text>
              <Text fontWeight="medium">
                {formatDate(assessment.completed_at)}
              </Text>
            </Box>
          )}
          {assessment.feedback && (
            <Box>
              <Text fontSize="xs" color="fg.subtle" mb={1}>
                Feedback
              </Text>
              <Text whiteSpace="pre-wrap" fontSize="sm">
                {assessment.feedback}
              </Text>
            </Box>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssessmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: assessment, isLoading } = useQuery<Assessment>({
    queryKey: ["assessments", id],
    queryFn: () => getAssessment(id!),
    enabled: !!id,
  });

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

  const updateMut = useMutation({
    mutationFn: ({ data, file }: { data: Partial<Assessment>; file?: File }) =>
      updateAssessment(id!, data, file),
    onSuccess: (_, { file }) => {
      if (file) {
        const oldSize = assessment?.attachment_size_bytes ?? 0;
        const delta = file.size - oldSize;
        if (delta > 0) void incrementStorageUsed(delta);
        else if (delta < 0) void decrementStorageUsed(-delta);
      }
      void qc.invalidateQueries({ queryKey: ["assessments"] });
    },
  });

  const removeAttachmentMut = useMutation({
    mutationFn: () =>
      deleteAttachment(id!, assessment?.attachment_size_bytes ?? 0),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      toaster.create({ type: "success", title: "Attachment removed" });
    },
    onError: () =>
      toaster.create({ type: "error", title: "Failed to remove attachment" }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteAssessment(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      void navigate("/assessments");
    },
  });

  const handleUpdate: UpdateFn = async (data, file) => {
    await updateMut.mutateAsync({ data, file });
  };

  const handleTransition = async (
    newStatus: AssessmentStatus,
    extraData?: Partial<Assessment>,
    file?: File,
  ) => {
    if (file) {
      await checkQuotaForReplacement(
        file.size,
        assessment?.attachment_size_bytes ?? 0,
      );
    }
    await updateMut.mutateAsync({
      data: { status: newStatus, ...(extraData ?? {}) },
      file,
    });
  };

  if (isLoading) return <Text>Loading…</Text>;
  if (!assessment) return <Text>Assessment not found.</Text>;

  return (
    <Stack id="assessment-detail" gap={6}>
      {/* Header */}
      <Flex justify="space-between" align="start" flexWrap="wrap" gap={3}>
        <Stack gap={2}>
          <AppLink
            to={
              assessment.module
                ? `/modules/${assessment.module}`
                : "/assessments"
            }
            alignSelf="flex-start"
            color="fg.muted"
            fontSize="sm"
          >
            ← {assessment.expand?.module?.title ?? "Assessments"}
          </AppLink>
          <HStack flexWrap="wrap" gap={2}>
            <Heading size="lg">{assessment.title}</Heading>
            <StatusBadge status={assessment.status} />
            {assessment.assessment_type && (
              <Badge variant="outline">
                {assessment.assessment_type.charAt(0).toUpperCase() +
                  assessment.assessment_type.slice(1)}
              </Badge>
            )}
          </HStack>
        </Stack>
        <Button
          size="sm"
          colorPalette="red"
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      </Flex>

      {/* Lifecycle stepper */}
      <AssessmentStepper
        assessment={assessment}
        onTransition={handleTransition}
        loading={updateMut.isPending}
      />

      {/* Two-column body */}
      <Grid
        templateColumns={{ base: "1fr", lg: "3fr 2fr" }}
        gap={6}
        alignItems="start"
      >
        {/* Left column */}
        <Stack gap={6}>
          <OverviewCard
            assessment={assessment}
            programs={programs}
            modules={modules}
            lessons={lessons}
            onUpdate={handleUpdate}
            loading={updateMut.isPending}
          />
          <ContentCard
            assessment={assessment}
            onUpdate={handleUpdate}
            loading={updateMut.isPending}
          />
        </Stack>

        {/* Right column */}
        <Stack gap={6}>
          <SubmissionCard
            assessment={assessment}
            onUpdate={handleUpdate}
            onRemoveAttachment={() => removeAttachmentMut.mutate()}
            loading={updateMut.isPending || removeAttachmentMut.isPending}
          />
          <ResultsCard
            assessment={assessment}
            onUpdate={handleUpdate}
            loading={updateMut.isPending}
          />
        </Stack>
      </Grid>

      {/* Delete confirm */}
      <Dialog.Root
        open={confirmDelete}
        onOpenChange={({ open: o }) => !o && setConfirmDelete(false)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Delete Assessment</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Are you sure you want to delete{" "}
                <strong>{assessment.title}</strong>? This cannot be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
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
    </Stack>
  );
}
