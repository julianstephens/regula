import { AppLink } from "@/components/ui/app-link";
import { computeBlockEndDate, DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import {
  createProgram,
  deleteProgram,
  listPrograms,
} from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import type { Program } from "@/types/domain";
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

const statusColor: Record<string, string> = {
  planned: "gray",
  active: "green",
  completed: "blue",
  archived: "orange",
};

function ProgramForm({
  programs,
  onSubmit,
  loading,
  onCancel,
  globalDefault,
}: {
  programs: Program[];
  onSubmit: (data: Partial<Program>) => Promise<unknown>;
  loading: boolean;
  onCancel: () => void;
  globalDefault: number;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Program["type"]>("term");
  const [status, setStatus] = useState<Program["status"]>("planned");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [blockWeeksInput, setBlockWeeksInput] = useState("");

  const resolvedBlockWeeks = blockWeeksInput
    ? Number(blockWeeksInput)
    : globalDefault;
  const computedEndDate =
    type === "block" && startDate
      ? computeBlockEndDate(new Date(startDate), resolvedBlockWeeks)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Program> = {
      name,
      type,
      status,
      description,
      parent: parent || undefined,
      start_date: startDate || undefined,
    };
    if (type === "block") {
      data.end_date = computedEndDate?.toISOString();
      data.block_weeks = blockWeeksInput ? Number(blockWeeksInput) : undefined;
    } else {
      data.end_date = endDate || undefined;
    }
    void onSubmit(data);
  };

  return (
    <Box
      id="program-form"
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
        <Stack direction="row" gap={3}>
          <Field.Root>
            <Field.Label>Type</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={type}
                onChange={(e) => setType(e.target.value as Program["type"])}
              >
                {(["year", "term", "block", "custom"] as const).map((v) => (
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
          {type === "block" ? (
            <>
              <Field.Root>
                <Field.Label>Block Weeks (override)</Field.Label>
                <Field.HelperText>Default: {globalDefault}</Field.HelperText>
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

export default function Programs() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });
  const globalDefault = settings?.block_weeks ?? DEFAULT_BLOCK_WEEKS;

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const createMut = useMutation({
    mutationFn: createProgram,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      setCreating(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteProgram,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      setDeletingId(null);
    },
  });

  return (
    <Stack id="programs" gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="lg">Programs</Heading>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New Program
          </Button>
        )}
      </Flex>

      {creating && (
        <ProgramForm
          programs={programs}
          loading={createMut.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(data) => createMut.mutateAsync(data)}
          globalDefault={globalDefault}
        />
      )}

      {isLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : programs.length === 0 ? (
        <Box py={12} textAlign="center" color="fg.muted">
          <Text>No programs yet. Create one to get started.</Text>
        </Box>
      ) : (
        <Table.Root variant="outline">
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
            {programs.map((p) => (
              <Table.Row key={p.id}>
                <Table.Cell>
                  <AppLink
                    to={`/programs/${p.id}`}
                    color="colorPalette.fg"
                    fontWeight="medium"
                  >
                    {p.name}
                  </AppLink>
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
                <Table.Cell>
                  <HStack gap={3} justify="flex-end">
                    <AppLink
                      to={`/programs/${p.id}`}
                      fontSize="sm"
                      color="colorPalette.fg"
                    >
                      View
                    </AppLink>
                    {deletingId === p.id ? (
                      <HStack gap={1}>
                        <Button
                          size="xs"
                          colorPalette="red"
                          loading={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(p.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setDeletingId(null)}
                        >
                          Cancel
                        </Button>
                      </HStack>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => setDeletingId(p.id)}
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
    </Stack>
  );
}
