import { StudyItemPicker } from "@/components/forms/StudyItemPicker";
import type { SessionOutcome, SessionType, StudyItem } from "@/types/domain";
import {
  Button,
  Dialog,
  Field,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Textarea,
} from "@chakra-ui/react";
import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  items: StudyItem[];
  defaultStudyItemIds?: string[];
  onSubmit: (data: {
    study_items: string[];
    session_type: SessionType;
    outcome: SessionOutcome;
    started_at: string;
    ended_at: string;
    duration_minutes: number;
    notes: string;
  }) => Promise<unknown>;
  loading?: boolean;
}

export function SessionLogModal({
  open,
  onClose,
  items,
  defaultStudyItemIds,
  onSubmit,
  loading,
}: Props) {
  const [studyItems, setStudyItems] = useState<string[]>(
    defaultStudyItemIds ?? [],
  );
  const [sessionType, setSessionType] = useState<SessionType>("deep_work");
  const [outcome, setOutcome] = useState<SessionOutcome>("completed");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const durationMinutes = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 60_000),
    );
    void onSubmit({
      study_items: studyItems,
      session_type: sessionType,
      outcome,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      duration_minutes: durationMinutes,
      notes,
    }).then(() => {
      setStudyItems(defaultStudyItemIds ?? []);
      setNotes("");
      onClose();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={({ open: o }) => !o && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Log Past Session</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body as="form" id="log-session-form" onSubmit={handleSubmit}>
            <Stack gap={4}>
              {!defaultStudyItemIds?.length && (
                <Field.Root required>
                  <Field.Label>Study Items</Field.Label>
                  <StudyItemPicker
                    items={items}
                    value={studyItems}
                    onChange={setStudyItems}
                  />
                </Field.Root>
              )}
              <HStack>
                <Field.Root>
                  <Field.Label>Session Type</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={sessionType}
                      onChange={(e) =>
                        setSessionType(e.target.value as SessionType)
                      }
                    >
                      {(
                        [
                          "deep_work",
                          "light_review",
                          "planning",
                          "reread",
                          "exercise",
                          "writing",
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
                  <Field.Label>Outcome</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={outcome}
                      onChange={(e) =>
                        setOutcome(e.target.value as SessionOutcome)
                      }
                    >
                      {(
                        [
                          "completed",
                          "partial",
                          "blocked",
                          "abandoned",
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
              </HStack>
              <HStack>
                <Field.Root required>
                  <Field.Label>Started At</Field.Label>
                  <Input
                    type="datetime-local"
                    value={startedAt}
                    onChange={(e) => setStartedAt(e.target.value)}
                    required
                  />
                </Field.Root>
                <Field.Root required>
                  <Field.Label>Ended At</Field.Label>
                  <Input
                    type="datetime-local"
                    value={endedAt}
                    onChange={(e) => setEndedAt(e.target.value)}
                    required
                  />
                </Field.Root>
              </HStack>
              <Field.Root>
                <Field.Label>Notes</Field.Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </Field.Root>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="log-session-form" loading={loading}>
              Log Session
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
