import { DEFAULT_BLOCK_WEEKS, isInRestWeek } from "@/lib/blocks";
import type { Area, Program, Resource, StudyItem } from "@/types/domain";
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

interface StudyItemFormValues {
  title: string;
  item_type: StudyItem["item_type"];
  status: StudyItem["status"];
  area: string;
  program: string;
  resource: string;
  due_date: string;
  scheduled_date: string;
  estimated_minutes: number | undefined;
  notes: string;
}

interface Props {
  defaultValues?: Partial<StudyItemFormValues>;
  areas: Area[];
  programs: Program[];
  resources: Resource[];
  onSubmit: (data: StudyItemFormValues) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
  blockWeeksDefault?: number;
}

export function StudyItemForm({
  defaultValues,
  areas,
  programs,
  resources,
  onSubmit,
  loading,
  submitLabel = "Save",
  blockWeeksDefault = DEFAULT_BLOCK_WEEKS,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StudyItemFormValues>({
    defaultValues: {
      status: "planned",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (defaultValues) reset({ status: "planned", ...defaultValues });
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
              <NativeSelect.Field {...register("item_type")}>
                <option value="">—</option>
                {(
                  [
                    "reading",
                    "writing",
                    "memorization",
                    "exercise",
                    "review",
                    "quiz",
                    "exam",
                    "paper",
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
          </Field.Root>
        </Stack>

        <Stack direction="row" gap={4}>
          <Field.Root>
            <Field.Label>Area</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field {...register("area")}>
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
          <Field.Root>
            <Field.Label>Due Date</Field.Label>
            <Input type="date" {...register("due_date")} />
          </Field.Root>
          <Field.Root invalid={!!errors.scheduled_date}>
            <Field.Label>Scheduled Date</Field.Label>
            <Input
              type="date"
              {...register("scheduled_date", {
                validate: (value) => {
                  if (!value) return true;
                  const blockProgs = programs.filter(
                    (p) => p.type === "block" && !!p.end_date,
                  );
                  return isInRestWeek(
                    new Date(value),
                    blockProgs,
                    blockWeeksDefault,
                  )
                    ? "This date falls in a rest week"
                    : true;
                },
              })}
            />
            {errors.scheduled_date && (
              <Field.ErrorText>{errors.scheduled_date.message}</Field.ErrorText>
            )}
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
