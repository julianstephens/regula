import { createArea, listAreas, updateArea } from "@/lib/services/areaService";
import type { Area } from "@/types/domain";
import {
  Box,
  Button,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  Stack,
  Table,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

function AreaRow({ area, onEdit }: { area: Area; onEdit: () => void; }) {
  return (
    <Table.Row>
      <Table.Cell>
        <HStack>
          <Box
            w={4}
            h={4}
            borderRadius="sm"
            bg={area.color || "gray.400"}
            flexShrink={0}
          />
          <Text fontWeight="medium">{area.name}</Text>
        </HStack>
      </Table.Cell>
      <Table.Cell color="fg.muted">{area.description || "—"}</Table.Cell>
      <Table.Cell>
        <Button size="xs" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
      </Table.Cell>
    </Table.Row>
  );
}

interface AreaFormValues {
  name: string;
  color: string;
  description: string;
}

function AreaForm({
  defaultValues,
  onSubmit,
  loading,
  onCancel,
}: {
  defaultValues?: AreaFormValues;
  onSubmit: (v: AreaFormValues) => Promise<unknown>;
  loading: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [color, setColor] = useState(defaultValues?.color ?? "#6366f1");
  const [description, setDescription] = useState(
    defaultValues?.description ?? "",
  );

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
        <Heading size="sm">{defaultValues ? "Edit Area" : "New Area"}</Heading>
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
              w="60px"
              p={1}
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

export default function Areas() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const createMut = useMutation({
    mutationFn: createArea,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["areas"] });
      setCreating(false);
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Area>; }) =>
      updateArea(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["areas"] });
      setEditingId(null);
    },
  });

  const editingArea = areas.find((a) => a.id === editingId);

  return (
    <Stack id="areas" gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="lg">Areas</Heading>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New Area
          </Button>
        )}
      </Flex>

      {creating && (
        <AreaForm
          loading={createMut.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => createMut.mutateAsync(v)}
        />
      )}
      {editingArea && (
        <AreaForm
          defaultValues={{
            name: editingArea.name,
            color: editingArea.color,
            description: editingArea.description,
          }}
          loading={updateMut.isPending}
          onCancel={() => setEditingId(null)}
          onSubmit={(v) =>
            updateMut.mutateAsync({ id: editingArea.id, data: v })
          }
        />
      )}

      {isLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : areas.length === 0 ? (
        <Box py={12} textAlign="center" color="fg.muted">
          <Text>No areas yet. Create one to get started.</Text>
        </Box>
      ) : (
        <Table.Root variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Name</Table.ColumnHeader>
              <Table.ColumnHeader>Description</Table.ColumnHeader>
              <Table.ColumnHeader w={8} />
            </Table.Row>
          </Table.Header>
          <Table.Body id="areas-table-body">
            {areas.map((area) => (
              <AreaRow
                key={area.id}
                area={area}
                onEdit={() => setEditingId(area.id)}
              />
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Stack>
  );
}
