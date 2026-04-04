import { StatusBadge } from "@/components/cards/StatusBadge";
import { StudyItemForm } from "@/components/forms/StudyItemForm";
import { AppLink } from "@/components/ui/app-link";
import { DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import { formatDate, isOverdue } from "@/lib/dates";
import { listAreas } from "@/lib/services/areaService";
import { listPrograms } from "@/lib/services/programService";
import { listResources } from "@/lib/services/resourceService";
import { getSettings } from "@/lib/services/settingsService";
import {
  changeStatus,
  createStudyItem,
  listStudyItems,
  updateStudyItem,
} from "@/lib/services/studyItemService";
import type { ItemStatus, StudyItem } from "@/types/domain";
import {
  Box,
  Button,
  Checkbox,
  CloseButton,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function StudyItems() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "">("");
  const [areaFilter, setAreaFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [sortBy, setSortBy] = useState("due_date");
  const [formLoading, setFormLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResourceId, setBulkResourceId] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["study_items", statusFilter, areaFilter, programFilter, sortBy],
    queryFn: () =>
      listStudyItems({
        status: statusFilter || undefined,
        area: areaFilter || undefined,
        program: programFilter || undefined,
        sort: sortBy,
      }),
  });
  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: listAreas,
  });
  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });
  const { data: resources = [] } = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
  });
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });
  const blockWeeksDefault = settings?.block_weeks ?? DEFAULT_BLOCK_WEEKS;

  const createMut = useMutation({
    mutationFn: createStudyItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setCreating(false);
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ItemStatus }) =>
      changeStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
    },
  });

  const bulkResourceMut = useMutation({
    mutationFn: async ({
      ids,
      resourceId,
    }: {
      ids: string[];
      resourceId: string;
    }) => {
      await Promise.all(
        ids.map((id) => updateStudyItem(id, { resource: resourceId })),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setSelectedIds(new Set());
      setBulkResourceId("");
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i: StudyItem) => i.id)));
    }
  };

  const handleBulkResourceUpdate = () => {
    if (!bulkResourceId || selectedIds.size === 0) return;
    bulkResourceMut.mutate({
      ids: Array.from(selectedIds),
      resourceId: bulkResourceId,
    });
  };

  const handleCreate = async (data: Parameters<typeof createStudyItem>[0]) => {
    setFormLoading(true);
    try {
      await createMut.mutateAsync(data);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Stack id="study-items" gap={6}>
      <Flex id="study-items-header" justify="space-between" align="center">
        <Heading size="lg">Study Items</Heading>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            New Item
          </Button>
        )}
      </Flex>

      {!creating && (
        <HStack id="study-items-filters" gap={3} flexWrap="wrap">
          <NativeSelect.Root w="180px">
            <NativeSelect.Field
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ItemStatus | "")
              }
            >
              <option value="">All statuses</option>
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
          <NativeSelect.Root w="180px">
            <NativeSelect.Field
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root w="200px">
            <NativeSelect.Field
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
            >
              <option value="">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <NativeSelect.Root w="160px">
            <NativeSelect.Field
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="-created">Newest first</option>
              <option value="created">Oldest first</option>
              <option value="due_date">Due date</option>
              <option value="title">Title A–Z</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </HStack>
      )}

      {creating && (
        <Box
          id="new-study-item"
          p={4}
          borderWidth={1}
          borderRadius="md"
          bg="bg.subtle"
        >
          <Heading size="sm" mb={4}>
            New Study Item
          </Heading>
          <StudyItemForm
            areas={areas}
            programs={programs}
            resources={resources}
            loading={formLoading}
            submitLabel="Create Item"
            onSubmit={handleCreate}
            blockWeeksDefault={blockWeeksDefault}
          />
          <Button
            size="sm"
            variant="ghost"
            mt={2}
            onClick={() => setCreating(false)}
          >
            Cancel
          </Button>
        </Box>
      )}

      {isLoading ? (
        <Text id="study-items-loading" color="fg.muted">
          Loading…
        </Text>
      ) : items.length === 0 ? (
        <Box id="study-items-empty" py={12} textAlign="center" color="fg.muted">
          <Text>No items match the current filters.</Text>
        </Box>
      ) : (
        <Stack gap={2}>
          {selectedIds.size > 0 && (
            <HStack
              id="bulk-action-toolbar"
              p={3}
              borderWidth={1}
              borderRadius="md"
              bg="bg.subtle"
              gap={3}
              flexWrap="wrap"
            >
              <Text fontSize="sm" fontWeight="medium" flexShrink={0}>
                {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}{" "}
                selected
              </Text>
              <HStack gap={2} flex={1} flexWrap="wrap">
                <NativeSelect.Root w="220px">
                  <NativeSelect.Field
                    value={bulkResourceId}
                    onChange={(e) => setBulkResourceId(e.target.value)}
                  >
                    <option value="">Select resource…</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Button
                  size="sm"
                  disabled={!bulkResourceId}
                  loading={bulkResourceMut.isPending}
                  onClick={handleBulkResourceUpdate}
                >
                  Update Resource
                </Button>
              </HStack>
              <CloseButton
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              />
            </HStack>
          )}
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader w={10}>
                  <Checkbox.Root
                    checked={
                      items.length > 0 && selectedIds.size === items.length
                        ? true
                        : selectedIds.size > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleSelectAll}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Table.ColumnHeader>
                <Table.ColumnHeader>Title</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Area</Table.ColumnHeader>
                <Table.ColumnHeader>Resource</Table.ColumnHeader>
                <Table.ColumnHeader>Due</Table.ColumnHeader>
                <Table.ColumnHeader w={24} />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item: StudyItem) => (
                <Table.Row
                  id={`study-item-${item.id}`}
                  key={item.id}
                  bg={
                    isOverdue(item.due_date, item.status)
                      ? "red.subtle"
                      : undefined
                  }
                >
                  <Table.Cell>
                    <Checkbox.Root
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <AppLink
                      id={`study-item-link-${item.id}`}
                      to={`/study-items/${item.id}`}
                      color="colorPalette.fg"
                      fontWeight="medium"
                    >
                      {item.title}
                    </AppLink>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={item.status} />
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.area?.name ?? "—"}
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.resource?.title ?? "—"}
                  </Table.Cell>
                  <Table.Cell
                    color={
                      isOverdue(item.due_date, item.status)
                        ? "red.fg"
                        : "fg.muted"
                    }
                  >
                    {formatDate(item.due_date)}
                  </Table.Cell>
                  <Table.Cell>
                    <HStack gap={1} id={`study-item-actions-${item.id}`}>
                      {item.status === "available" && (
                        <Button
                          size="xs"
                          colorPalette="orange"
                          variant="subtle"
                          loading={statusMut.isPending}
                          onClick={() =>
                            statusMut.mutate({
                              id: item.id,
                              status: "in_progress",
                            })
                          }
                        >
                          Start
                        </Button>
                      )}
                      {item.status === "in_progress" && (
                        <Button
                          size="xs"
                          colorPalette="green"
                          variant="subtle"
                          loading={statusMut.isPending}
                          onClick={() =>
                            statusMut.mutate({
                              id: item.id,
                              status: "completed",
                            })
                          }
                        >
                          Complete
                        </Button>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Stack>
      )}
    </Stack>
  );
}
