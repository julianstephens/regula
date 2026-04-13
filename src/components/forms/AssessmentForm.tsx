import type {
  AssessmentType,
  Lesson,
  Module,
  Program,
  SubmissionMode,
} from "@/types/domain";
import {
  Button,
  Field,
  Input,
  NativeSelect,
  Stack,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export interface AssessmentFormValues {
  title: string;
  assessment_type: AssessmentType | "";
  submission_mode: SubmissionMode | "";
  program: string;
  module: string;
  lesson: string;
  due_at: string;
  weight: number | undefined;
}

interface Props {
  programs: Program[];
  modules: Module[];
  lessons: Lesson[];
  defaultValues?: Partial<AssessmentFormValues>;
  onSubmit: (data: AssessmentFormValues) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function AssessmentForm({
  programs,
  modules,
  lessons,
  defaultValues,
  onSubmit,
  loading,
  submitLabel = "Save",
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssessmentFormValues>({
    defaultValues: {
      assessment_type: "",
      submission_mode: "",
      program: "",
      module: "",
      lesson: "",
      due_at: "",
      weight: undefined,
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (defaultValues)
      reset({
        assessment_type: "",
        submission_mode: "",
        program: "",
        module: "",
        lesson: "",
        due_at: "",
        weight: undefined,
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
            <Field.Label>Assessment Type</Field.Label>
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
                {(["written", "oral", "digital", "none"] as const).map((v) => (
                  <option key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
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
            <Field.Label>Lesson (optional)</Field.Label>
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
        </Stack>

        <Stack direction="row" gap={4}>
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
                setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
              })}
            />
          </Field.Root>
        </Stack>

        <Button type="submit" loading={loading} alignSelf="flex-start">
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
