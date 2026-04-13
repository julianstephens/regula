import type {
  GradeType,
  LessonStatus,
  LessonType,
  Module,
  Program,
  Resource,
} from "@/types/domain";
import {
  Button,
  Field,
  Input,
  NativeSelect,
  Stack,
  Textarea,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export interface LessonFormValues {
  title: string;
  type: LessonType | "";
  status: LessonStatus;
  program: string;
  module: string;
  resource: string;
  available_on: string;
  due_at: string;
  estimated_minutes: number | undefined;
  grade_type: GradeType | "";
  mastery_evidence: string;
  notes: string;
}

interface Props {
  defaultValues?: Partial<LessonFormValues>;
  programs: Program[];
  modules: Module[];
  resources: Resource[];
  onSubmit: (data: LessonFormValues) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function LessonForm({
  defaultValues,
  programs,
  modules,
  resources,
  onSubmit,
  loading,
  submitLabel = "Save",
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LessonFormValues>({
    defaultValues: {
      status: "not_started",
      type: "",
      grade_type: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (defaultValues)
      reset({
        status: "not_started",
        type: "",
        grade_type: "",
        ...defaultValues,
      });
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit((data) => void onSubmit(data))}>
      <Stack gap={4}>
        <Field.Root required invalid={!!errors.title}>
          <Field.Label>Title</Field.Label>
          <Input {...register("title", { required: "Title is required" })} />
          {errors.title && (
            <Field.ErrorText>{errors.title.message}</Field.ErrorText>
          )}
        </Field.Root>

        <Stack direction="row" gap={4}>
          <Field.Root>
            <Field.Label>Type</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field {...register("type")}>
                <option value="">—</option>
                {(
                  [
                    "lesson",
                    "reading",
                    "writing",
                    "exercise",
                    "memorization",
                    "review",
                    "other",
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
            <Field.Label>Status</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field {...register("status")}>
                {(
                  [
                    "not_started",
                    "active",
                    "submitted",
                    "completed",
                    "archived",
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
        </Stack>

        <Stack direction="row" gap={4}>
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

          <Field.Root>
            <Field.Label>Resource</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field {...register("resource")}>
                <option value="">—</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
        </Stack>

        <Stack direction="row" gap={4}>
          <Field.Root invalid={!!errors.available_on}>
            <Field.Label>Available On</Field.Label>
            <Input type="date" {...register("available_on")} />
            {errors.available_on && (
              <Field.ErrorText>{errors.available_on.message}</Field.ErrorText>
            )}
          </Field.Root>
          <Field.Root>
            <Field.Label>Due At</Field.Label>
            <Input type="date" {...register("due_at")} />
          </Field.Root>
          <Field.Root>
            <Field.Label>Est. Minutes</Field.Label>
            <Input
              type="number"
              min={0}
              {...register("estimated_minutes", {
                setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
              })}
            />
          </Field.Root>
        </Stack>

        <Stack direction="row" gap={4}>
          <Field.Root>
            <Field.Label>Grade Type</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field {...register("grade_type")}>
                <option value="">—</option>
                {(["none", "pass_fail", "numeric", "rubric"] as const).map(
                  (v) => (
                    <option key={v} value={v}>
                      {v.replace(/_/g, " ")}
                    </option>
                  ),
                )}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
        </Stack>

        <Field.Root>
          <Field.Label>Mastery Evidence</Field.Label>
          <Textarea {...register("mastery_evidence")} rows={2} />
        </Field.Root>

        <Field.Root>
          <Field.Label>Notes</Field.Label>
          <Textarea {...register("notes")} rows={3} />
        </Field.Root>

        <Button type="submit" loading={loading} alignSelf="flex-start">
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
