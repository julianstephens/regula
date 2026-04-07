import { AppLink } from "@/components/ui/app-link";
import { createArea, listAreas } from "@/lib/services/areaService";
import {
  createProgram,
  deleteProgram,
  listPrograms,
} from "@/lib/services/programService";
import type { Area, Program } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Checkbox,
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

function AreaForm({
  onSubmit,
  loading,
  onCancel,
}: {
  onSubmit: (
    data: Omit<Area, "id" | "created" | "updated" | "owner">,
  ) => Promise<unknown>;
  loading: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit({ name, color, description });
  };

  return (
    <Box
      id="area-form"
      as="form"
      onSubmit={handleSubmit}
      p={4}
      borderWidth={1}
      borderRadius="md"
      bg="bg.subtle"
    >
      <Stack gap={3}>
        <Heading size="sm">New Area</Heading>
        <Stack direction="row" gap={3}>
          <Field.Root required>
            <Field.Label>Name</Field.Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Color</Field.Label>
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              w="16"
              p={1}
              h="10"
              cursor="pointer"
            />
          </Field.Root>
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

const statusColor: Record<string, string> = {
  planned: "gray",
  active: "green",
  completed: "blue",
  archived: "orange",
};

const ALL_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function DayCheckboxGroup({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: string[];
  onChange: (days: string[]) => void;
}) {
  const toggle = (day: string) => {
    onChange(
      selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day],
    );
  };
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <HStack gap={2} flexWrap="wrap">
        {ALL_DAYS.map((d) => (
          <Checkbox.Root
            key={d}
            checked={selected.includes(d)}
            onCheckedChange={() => toggle(d)}
            size="sm"
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label textTransform="capitalize">{d}</Checkbox.Label>
          </Checkbox.Root>
        ))}
      </HStack>
    </Field.Root>
  );
}

function CourseForm({
  areas,
  onSubmit,
  loading,
  onCancel,
}: {
  areas: Area[];
  onSubmit: (data: Partial<Program>) => Promise<unknown>;
  loading: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Program["status"]>("planned");
  const [description, setDescription] = useState("");
  const [areaId, setAreaId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [meetingDays, setMeetingDays] = useState<string[]>([]);
  const [makeupDays, setMakeupDays] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit({
      name,
      type: "course",
      status,
      description,
      area: areaId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      meeting_days: meetingDays.length ? meetingDays : undefined,
      makeup_days: makeupDays.length ? makeupDays : undefined,
    });
  };

  return (
    <Box
      id="course-form"
      as="form"
      onSubmit={handleSubmit}
      p={4}
      borderWidth={1}
      borderRadius="md"
      bg="bg.subtle"
    >
      <Stack gap={3}>
        <Heading size="sm">New Course</Heading>
        <Stack direction="row" gap={3}>
          <Field.Root required>
            <Field.Label>Name</Field.Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
          <Field.Root required>
            <Field.Label>Area</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
              >
                <option value="">— select area —</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
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
          <Field.Root>
            <Field.Label>End Date</Field.Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field.Root>
        </Stack>
        <DayCheckboxGroup
          label="Meeting Days"
          selected={meetingDays}
          onChange={setMeetingDays}
        />
        <DayCheckboxGroup
          label="Makeup Days"
          selected={makeupDays}
          onChange={setMakeupDays}
        />
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

export default function Courses() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [creatingArea, setCreatingArea] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: allPrograms = [], isLoading } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const courses = allPrograms.filter((p) => p.type === "course");
  const areaMap = Object.fromEntries(areas.map((a) => [a.id, a]));

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

  const createAreaMut = useMutation({
    mutationFn: createArea,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["areas"] });
      setCreatingArea(false);
    },
  });

  return (
    <Stack id="courses" gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="lg">Courses</Heading>
        <HStack gap={2}>
          {!creatingArea && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreatingArea(true);
                setCreating(false);
              }}
            >
              New Area
            </Button>
          )}
          {!creating && (
            <Button
              size="sm"
              onClick={() => {
                setCreating(true);
                setCreatingArea(false);
              }}
            >
              New Course
            </Button>
          )}
        </HStack>
      </Flex>

      {creatingArea && (
        <AreaForm
          loading={createAreaMut.isPending}
          onCancel={() => setCreatingArea(false)}
          onSubmit={(data) => createAreaMut.mutateAsync(data)}
        />
      )}

      {creating && (
        <CourseForm
          areas={areas}
          loading={createMut.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(data) => createMut.mutateAsync(data)}
        />
      )}

      {isLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : courses.length === 0 ? (
        <Box py={12} textAlign="center" color="fg.muted">
          <Text>No courses yet. Create one to get started.</Text>
        </Box>
      ) : (
        <Table.Root variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader>Area</Table.ColumnHeader>
              <Table.ColumnHeader>Meeting Days</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader w={8} />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {courses.map((c) => {
              const area = c.area ? areaMap[c.area] : undefined;
              return (
                <Table.Row key={c.id}>
                  <Table.Cell>
                    <AppLink
                      to={`/programs/${c.id}`}
                      color="colorPalette.fg"
                      fontWeight="medium"
                    >
                      {c.name}
                    </AppLink>
                  </Table.Cell>
                  <Table.Cell>
                    {area ? (
                      <HStack gap={2}>
                        <Box
                          w={3}
                          h={3}
                          borderRadius="sm"
                          bg={area.color || "gray.400"}
                          flexShrink={0}
                        />
                        <Text>{area.name}</Text>
                      </HStack>
                    ) : (
                      <Text color="fg.muted">—</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {c.meeting_days?.length ? (
                      <HStack gap={1} flexWrap="wrap">
                        {c.meeting_days.map((d) => (
                          <Badge
                            key={d}
                            variant="subtle"
                            size="sm"
                            textTransform="capitalize"
                          >
                            {d}
                          </Badge>
                        ))}
                      </HStack>
                    ) : (
                      <Text color="fg.muted">—</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      colorPalette={statusColor[c.status] ?? "gray"}
                      variant="subtle"
                      size="sm"
                    >
                      {c.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <HStack gap={3} justify="flex-end">
                      <AppLink
                        to={`/programs/${c.id}`}
                        fontSize="sm"
                        color="colorPalette.fg"
                      >
                        View
                      </AppLink>
                      {deletingId === c.id ? (
                        <HStack gap={1}>
                          <Button
                            size="xs"
                            colorPalette="red"
                            loading={deleteMut.isPending}
                            onClick={() => deleteMut.mutate(c.id)}
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
                          onClick={() => setDeletingId(c.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      )}
    </Stack>
  );
}
