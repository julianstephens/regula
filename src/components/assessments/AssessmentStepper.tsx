import { toaster } from "@/components/ui/toaster";
import type { Assessment, AssessmentStatus, GradeType } from "@/types/domain";
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    Field,
    Flex,
    HStack,
    Input,
    NativeSelect,
    Stack,
    Text,
    Textarea,
} from "@chakra-ui/react";
import { Fragment, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const LIFECYCLE_STEPS: AssessmentStatus[] = [
    "not_started",
    "in_progress",
    "submitted",
    "graded",
];

const STEP_LABELS: Record<string, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    submitted: "Submitted",
    graded: "Graded",
};

interface SubmissionFormValues {
    submitted_at: string;
    attachmentFile: File | null;
    attachment_url: string;
}

interface GradeFormValues {
    score: number | undefined;
    max_score: number | undefined;
    grade_type: GradeType | "";
    passed: boolean;
    feedback: string;
    completed_at: string;
}

interface Props {
    assessment: Assessment;
    onTransition: (
        status: AssessmentStatus,
        data?: Partial<Assessment>,
        file?: File,
    ) => Promise<void>;
    loading?: boolean;
}

export function AssessmentStepper({ assessment, onTransition, loading }: Props) {
    const { status } = assessment;
    const isArchived = status === "archived";
    const effectiveStatus = isArchived ? "graded" : status;
    const currentIdx = LIFECYCLE_STEPS.indexOf(effectiveStatus as AssessmentStatus);

    const [submissionOpen, setSubmissionOpen] = useState(false);
    const [gradeOpen, setGradeOpen] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const isLoading = loading || transitioning;

    const submissionForm = useForm<SubmissionFormValues>({
        defaultValues: {
            submitted_at: assessment.submitted_at?.slice(0, 10) ?? "",
            attachmentFile: null,
            attachment_url: assessment.attachment_url ?? "",
        },
    });

    const gradeForm = useForm<GradeFormValues>({
        defaultValues: {
            score: assessment.score,
            max_score: assessment.max_score,
            grade_type: (assessment.grade_type as GradeType) ?? "",
            passed: assessment.passed ?? false,
            feedback: assessment.feedback ?? "",
            completed_at: assessment.completed_at?.slice(0, 10) ?? "",
        },
    });

    const withTransition = async (fn: () => Promise<void>) => {
        setTransitioning(true);
        try {
            await fn();
        } catch (err) {
            toaster.create({
                type: "error",
                title: err instanceof Error ? err.message : "Failed to update status",
            });
        } finally {
            setTransitioning(false);
        }
    };

    const handleStepClick = (targetStatus: AssessmentStatus) => {
        if (isArchived || isLoading) return;
        if (targetStatus === "submitted") {
            setSubmissionOpen(true);
        } else if (targetStatus === "graded") {
            setGradeOpen(true);
        } else {
            void withTransition(() => onTransition(targetStatus));
        }
    };

    const handleSubmissionSubmit = (data: SubmissionFormValues) => {
        void withTransition(async () => {
            const { attachmentFile, ...rest } = data;
            await onTransition(
                "submitted",
                rest as Partial<Assessment>,
                attachmentFile ?? undefined,
            );
            setSubmissionOpen(false);
            submissionForm.reset();
        });
    };

    const handleGradeSubmit = (data: GradeFormValues) => {
        void withTransition(async () => {
            await onTransition("graded", {
                score: data.score,
                max_score: data.max_score,
                grade_type: (data.grade_type || undefined) as GradeType | undefined,
                passed: data.passed,
                feedback: data.feedback || undefined,
                completed_at: data.completed_at || undefined,
            } as Partial<Assessment>);
            setGradeOpen(false);
            gradeForm.reset();
        });
    };

    return (
        <>
            <Box p={4} borderWidth={1} borderRadius="md" bg="bg.subtle">
                <Flex align="center" gap={6} flexWrap="wrap">
                    {/* Step track */}
                    <HStack flex={1} minW={0} gap={0} alignItems="flex-start">
                        {LIFECYCLE_STEPS.map((step, idx) => {
                            const stepIdx = idx;
                            const isCompleted = stepIdx < currentIdx && !isArchived;
                            const isCurrent = stepIdx === currentIdx && !isArchived;
                            const isClickable =
                                stepIdx > currentIdx && !isArchived && !isLoading;
                            const isLast = idx === LIFECYCLE_STEPS.length - 1;

                            return (
                                <Fragment key={step}>
                                    <Stack
                                        align="center"
                                        gap={1}
                                        flexShrink={0}
                                        cursor={isClickable ? "pointer" : "default"}
                                        onClick={isClickable ? () => handleStepClick(step) : undefined}
                                        role={isClickable ? "button" : undefined}
                                        _hover={isClickable ? { opacity: 0.7 } : undefined}
                                        transition="opacity 0.15s"
                                        title={
                                            isClickable
                                                ? `Advance to ${STEP_LABELS[step]}`
                                                : undefined
                                        }
                                    >
                                        <Flex
                                            w={8}
                                            h={8}
                                            borderRadius="full"
                                            align="center"
                                            justify="center"
                                            fontSize="xs"
                                            fontWeight="bold"
                                            bg={
                                                isCompleted
                                                    ? "green.500"
                                                    : isCurrent
                                                        ? "blue.500"
                                                        : isArchived && stepIdx === currentIdx
                                                            ? "gray.400"
                                                            : "bg.muted"
                                            }
                                            color={isCompleted || isCurrent ? "white" : "fg.muted"}
                                            borderWidth={1}
                                            borderColor={
                                                isCompleted
                                                    ? "green.500"
                                                    : isCurrent
                                                        ? "blue.500"
                                                        : "border"
                                            }
                                            transition="all 0.2s"
                                        >
                                            {isCompleted ? "✓" : idx + 1}
                                        </Flex>
                                        <Text
                                            fontSize="xs"
                                            fontWeight={isCurrent ? "semibold" : "normal"}
                                            color={
                                                isCurrent
                                                    ? "fg"
                                                    : isArchived && stepIdx === currentIdx
                                                        ? "fg.muted"
                                                        : "fg.subtle"
                                            }
                                            whiteSpace="nowrap"
                                        >
                                            {STEP_LABELS[step]}
                                        </Text>
                                    </Stack>

                                    {!isLast && (
                                        <Box
                                            flex={1}
                                            h="2px"
                                            mt={4}
                                            mx={1}
                                            bg={
                                                stepIdx < currentIdx && !isArchived
                                                    ? "green.500"
                                                    : "border"
                                            }
                                        />
                                    )}
                                </Fragment>
                            );
                        })}
                    </HStack>

                    {/* Side action */}
                    <Box flexShrink={0}>
                        {isArchived ? (
                            <Button
                                size="sm"
                                variant="outline"
                                loading={isLoading}
                                onClick={() =>
                                    void withTransition(() => onTransition("in_progress"))
                                }
                            >
                                Reopen
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="ghost"
                                colorPalette="gray"
                                disabled={isLoading}
                                onClick={() =>
                                    void withTransition(() => onTransition("archived"))
                                }
                            >
                                Archive
                            </Button>
                        )}
                    </Box>
                </Flex>

                {isArchived && (
                    <Text fontSize="xs" color="fg.muted" mt={2}>
                        This assessment is archived. Click Reopen to resume the workflow.
                    </Text>
                )}
            </Box>

            {/* Submission dialog */}
            <Dialog.Root
                open={submissionOpen}
                onOpenChange={({ open: o }) => !o && setSubmissionOpen(false)}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content>
                        <Dialog.Header>
                            <Dialog.Title>Record Submission</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <form
                                id="stepper-submission-form"
                                onSubmit={submissionForm.handleSubmit(handleSubmissionSubmit)}
                            >
                                <Stack gap={4}>
                                    <Field.Root>
                                        <Field.Label>Submitted At</Field.Label>
                                        <Input
                                            type="date"
                                            {...submissionForm.register("submitted_at")}
                                        />
                                    </Field.Root>
                                    <Controller
                                        control={submissionForm.control}
                                        name="attachmentFile"
                                        render={({ field: { onChange } }) => (
                                            <Field.Root>
                                                <Field.Label>Attachment (PDF, optional)</Field.Label>
                                                <Input
                                                    type="file"
                                                    accept="application/pdf"
                                                    onChange={(e) =>
                                                        onChange(e.target.files?.[0] ?? null)
                                                    }
                                                />
                                                <Field.HelperText>Max 20 MB</Field.HelperText>
                                            </Field.Root>
                                        )}
                                    />
                                    <Field.Root>
                                        <Field.Label>Attachment URL (optional)</Field.Label>
                                        <Input
                                            type="url"
                                            placeholder="https://docs.google.com/…"
                                            {...submissionForm.register("attachment_url")}
                                        />
                                    </Field.Root>
                                </Stack>
                            </form>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={() => setSubmissionOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="stepper-submission-form"
                                loading={transitioning}
                            >
                                Mark Submitted
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* Grade dialog */}
            <Dialog.Root
                open={gradeOpen}
                onOpenChange={({ open: o }) => !o && setGradeOpen(false)}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content>
                        <Dialog.Header>
                            <Dialog.Title>Record Grade</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <form
                                id="stepper-grade-form"
                                onSubmit={gradeForm.handleSubmit(handleGradeSubmit)}
                            >
                                <Stack gap={4}>
                                    <Stack direction="row" gap={4}>
                                        <Field.Root>
                                            <Field.Label>Score</Field.Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                {...gradeForm.register("score", {
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
                                                {...gradeForm.register("max_score", {
                                                    setValueAs: (v: string) =>
                                                        v === "" ? undefined : Number(v),
                                                })}
                                            />
                                        </Field.Root>
                                    </Stack>

                                    <Stack direction="row" gap={4}>
                                        <Field.Root>
                                            <Field.Label>Grade Type</Field.Label>
                                            <NativeSelect.Root>
                                                <NativeSelect.Field
                                                    {...gradeForm.register("grade_type")}
                                                >
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
                                        <Field.Root>
                                            <Field.Label>Completed At</Field.Label>
                                            <Input
                                                type="date"
                                                {...gradeForm.register("completed_at")}
                                            />
                                        </Field.Root>
                                    </Stack>

                                    <Controller
                                        control={gradeForm.control}
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
                                        <Field.Label>Feedback</Field.Label>
                                        <Textarea {...gradeForm.register("feedback")} rows={3} />
                                    </Field.Root>
                                </Stack>
                            </form>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setGradeOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="stepper-grade-form"
                                loading={transitioning}
                            >
                                Record Grade
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </>
    );
}
