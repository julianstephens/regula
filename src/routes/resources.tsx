import { AppLink } from "@/components/ui/app-link";
import { listAreas } from "@/lib/services/areaService";
import {
  createResource,
  listResources,
  updateResource,
} from "@/lib/services/resourceService";
import type { Resource } from "@/types/domain";
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

const RESOURCE_TYPES = [
  "book",
  "article",
  "video",
  "podcast",
  "course",
  "other",
] as const;

function ResourceForm({
  areas,
  defaultValues,
  onSubmit,
  loading,
  onCancel,
}: {
  areas: import("@/types/domain").Area[];
  defaultValues?: Partial<Resource>;
  onSubmit: (data: Partial<Resource>) => Promise<unknown>;
  loading: boolean;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [author, setAuthor] = useState(defaultValues?.author ?? "");
  const [url, setUrl] = useState(defaultValues?.url ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [resourceType, setResourceType] = useState<Resource["resource_type"]>(
    defaultValues?.resource_type ?? "book",
  );
  const [area, setArea] = useState(defaultValues?.area ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit({
      title,
      author,
      url,
      notes,
      resource_type: resourceType,
      area: area || undefined,
    });
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      p={4}
      borderWidth={1}
      borderRadius="md"
      bg="bg.subtle"
    >
      <Stack gap={3}>
        <Heading size="sm">
          {defaultValues ? "Edit Resource" : "New Resource"}
        </Heading>
        <Field.Root required>
          <Field.Label>Title</Field.Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Field.Root>
        <Stack direction="row" gap={3}>
          <Field.Root>
            <Field.Label>Author</Field.Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field.Root>
          <Field.Root>
            <Field.Label>Type</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={resourceType}
                onChange={(e) =>
                  setResourceType(e.target.value as Resource["resource_type"])
                }
              >
                {RESOURCE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
          <Field.Root>
            <Field.Label>Area</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
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
        </Stack>
        <Field.Root>
          <Field.Label>URL</Field.Label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Notes</Field.Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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

export default function Resources() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources", typeFilter],
    queryFn: () => listResources(typeFilter || undefined),
  });
  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const createMut = useMutation({
    mutationFn: createResource,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["resources"] });
      setCreating(false);
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) =>
      updateResource(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["resources"] });
      setEditingId(null);
    },
  });

  const editingResource = resources.find((r) => r.id === editingId);

  return (
    <Stack id="resources" gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="lg">Resources</Heading>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New Resource
          </Button>
        )}
      </Flex>

      <HStack>
        <NativeSelect.Root w="200px">
          <NativeSelect.Field
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {RESOURCE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>

      {creating && (
        <ResourceForm
          areas={areas}
          loading={createMut.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(data) => createMut.mutateAsync(data)}
        />
      )}
      {editingResource && (
        <ResourceForm
          areas={areas}
          defaultValues={editingResource}
          loading={updateMut.isPending}
          onCancel={() => setEditingId(null)}
          onSubmit={(data) =>
            updateMut.mutateAsync({ id: editingResource.id, data })
          }
        />
      )}

      {isLoading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : resources.length === 0 ? (
        <Box py={12} textAlign="center" color="fg.muted">
          <Text>No resources yet. Add one to get started.</Text>
        </Box>
      ) : (
        <Table.Root variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Author</Table.ColumnHeader>
              <Table.ColumnHeader>Area</Table.ColumnHeader>
              <Table.ColumnHeader>Study Items</Table.ColumnHeader>
              <Table.ColumnHeader w={16} />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {resources.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell fontWeight="medium">{r.title}</Table.Cell>
                <Table.Cell>
                  <Badge variant="subtle">{r.resource_type}</Badge>
                </Table.Cell>
                <Table.Cell color="fg.muted">{r.author || "—"}</Table.Cell>
                <Table.Cell>
                  {r.expand?.area ? (
                    <HStack gap={1}>
                      <Box
                        w={2.5}
                        h={2.5}
                        borderRadius="sm"
                        bg={r.expand.area.color || "gray.400"}
                        flexShrink={0}
                      />
                      <Text fontSize="sm">{r.expand.area.name}</Text>
                    </HStack>
                  ) : (
                    <Text color="fg.muted">—</Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {r.expand?.["regula_study_items(resource)"]?.length ? (
                    <Stack gap={1}>
                      {r.expand["regula_study_items(resource)"].map((item) => (
                        <AppLink
                          key={item.id}
                          to={`/study-items/${item.id}`}
                          fontSize="sm"
                          color="colorPalette.fg"
                        >
                          {item.title}
                        </AppLink>
                      ))}
                    </Stack>
                  ) : (
                    <Text color="fg.muted" fontSize="sm">
                      —
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setEditingId(r.id)}
                  >
                    Edit
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Stack>
  );
}
