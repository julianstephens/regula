import type { Program } from "@/types/domain";
import { Button, Field, Input, Stack, Textarea } from "@chakra-ui/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

export interface ModuleFormValues {
  title: string;
  slug: string;
  order: number | undefined;
  goal: string;
  start_date: string;
  end_date: string;
}

interface Props {
  program: Program;
  defaultValues?: Partial<ModuleFormValues>;
  onSubmit: (data: ModuleFormValues) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
}

export function ModuleForm({
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
  } = useForm<ModuleFormValues>({
    defaultValues: defaultValues ?? {},
  });

  useEffect(() => {
    if (defaultValues) reset(defaultValues);
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
            <Field.Label>Slug</Field.Label>
            <Input {...register("slug")} placeholder="e.g. week-1" />
          </Field.Root>
          <Field.Root>
            <Field.Label>Order</Field.Label>
            <Input
              type="number"
              min={0}
              {...register("order", {
                setValueAs: (v: string) => (v === "" ? undefined : Number(v)),
              })}
              maxW="80px"
            />
          </Field.Root>
        </Stack>

        <Stack direction="row" gap={4}>
          <Field.Root>
            <Field.Label>Start Date</Field.Label>
            <Input type="date" {...register("start_date")} />
          </Field.Root>
          <Field.Root>
            <Field.Label>End Date</Field.Label>
            <Input type="date" {...register("end_date")} />
          </Field.Root>
        </Stack>

        <Field.Root>
          <Field.Label>Goal</Field.Label>
          <Textarea {...register("goal")} rows={3} />
        </Field.Root>

        <Button type="submit" loading={loading} alignSelf="flex-start">
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}
