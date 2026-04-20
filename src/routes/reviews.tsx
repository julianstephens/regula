import { AppLink } from "@/components/ui/app-link";
import { invalidateReviewCaches } from "@/lib/cacheInvalidation";
import { endOfDay, formatDate, toPbDate } from "@/lib/dates";
import {
  createNextReview,
  deleteReview,
  listReviews,
  updateReview,
} from "@/lib/services/reviewService";
import type { Review, ReviewStatus } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const todayEnd = toPbDate(endOfDay());

export default function Reviews() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("due");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("");

  const { data: dueReviews = [], isLoading: loadingDue } = useQuery<Review[]>({
    queryKey: ["reviews", "due"],
    queryFn: () =>
      listReviews({ status: "active", dueBefore: todayEnd, sort: "due_at" }),
  });

  const { data: allReviews = [], isLoading: loadingAll } = useQuery<Review[]>({
    queryKey: ["reviews", "all", statusFilter],
    queryFn: () =>
      listReviews({
        status: statusFilter || undefined,
        sort: "due_at",
      }),
    enabled: tab === "all",
  });

  const reviewMut = useMutation({
    mutationFn: ({
      lessonId,
      outcome,
    }: {
      lessonId: string;
      outcome: "pass" | "fail";
    }) => createNextReview(lessonId, outcome),
    onSuccess: () => {
      invalidateReviewCaches(qc);
    },
  });

  const suspendMut = useMutation({
    mutationFn: (id: string) => updateReview(id, { status: "suspended" }),
    onSuccess: () => {
      invalidateReviewCaches(qc);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      invalidateReviewCaches(qc);
    },
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <Stack id="reviews" gap={6}>
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="lg">Reviews</Heading>
        {dueReviews.length > 0 && (
          <Badge colorPalette="purple" variant="solid" size="lg">
            {dueReviews.length} due
          </Badge>
        )}
      </Flex>

      {/* Delete confirm */}
      <Dialog.Root
        open={!!confirmDeleteId}
        onOpenChange={({ open: o }) => {
          if (!o) setConfirmDeleteId(null);
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Remove Review</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Remove this lesson from the review queue? This cannot be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button
                colorPalette="red"
                loading={deleteMut.isPending}
                onClick={() => {
                  if (confirmDeleteId) deleteMut.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Remove
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Tabs.Root
        value={tab}
        onValueChange={(e) => setTab(e.value)}
        variant="line"
      >
        <Tabs.List>
          <Tabs.Trigger value="due">
            Due Now
            {dueReviews.length > 0 && (
              <Badge ml={2} colorPalette="purple" variant="solid" size="sm">
                {dueReviews.length}
              </Badge>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger value="all">All Reviews</Tabs.Trigger>
        </Tabs.List>

        {/* Due tab */}
        <Tabs.Content value="due">
          <Stack gap={4} pt={4}>
            {loadingDue ? (
              <Text color="fg.muted">Loading…</Text>
            ) : dueReviews.length === 0 ? (
              <Box
                p={8}
                textAlign="center"
                borderWidth={1}
                borderRadius="md"
                bg="green.subtle"
                borderColor="green.emphasized"
              >
                <Text color="green.fg" fontWeight="medium">
                  ✓ No reviews due today!
                </Text>
              </Box>
            ) : (
              dueReviews.map((r) => (
                <Box
                  key={r.id}
                  p={4}
                  borderWidth={1}
                  borderRadius="md"
                  bg="bg.subtle"
                >
                  <Flex
                    justify="space-between"
                    align="start"
                    flexWrap="wrap"
                    gap={3}
                  >
                    <Stack gap={1}>
                      <AppLink
                        to={`/lessons/${r.lesson}`}
                        fontWeight="semibold"
                        color="colorPalette.fg"
                        fontSize="md"
                      >
                        {r.expand?.lesson?.title ?? r.lesson}
                      </AppLink>
                      <HStack gap={3}>
                        {r.last_reviewed_at && (
                          <Text fontSize="xs" color="fg.muted">
                            Last: {formatDate(r.last_reviewed_at)}
                          </Text>
                        )}
                        {r.interval_days != null && (
                          <Text fontSize="xs" color="fg.muted">
                            Interval: {r.interval_days}d
                          </Text>
                        )}
                        {r.failure_count > 0 && (
                          <Badge colorPalette="red" variant="subtle" size="sm">
                            {r.failure_count} fail
                            {r.failure_count !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </HStack>
                    </Stack>
                    <HStack gap={2} flexWrap="wrap">
                      <Button
                        size="sm"
                        colorPalette="green"
                        variant="subtle"
                        loading={reviewMut.isPending}
                        onClick={() =>
                          reviewMut.mutate({
                            lessonId: r.lesson,
                            outcome: "pass",
                          })
                        }
                      >
                        Pass ✓
                      </Button>
                      <Button
                        size="sm"
                        colorPalette="red"
                        variant="subtle"
                        loading={reviewMut.isPending}
                        onClick={() =>
                          reviewMut.mutate({
                            lessonId: r.lesson,
                            outcome: "fail",
                          })
                        }
                      >
                        Fail ✗
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => suspendMut.mutate(r.id)}
                        loading={suspendMut.isPending}
                      >
                        Suspend
                      </Button>
                    </HStack>
                  </Flex>
                </Box>
              ))
            )}
          </Stack>
        </Tabs.Content>

        {/* All tab */}
        <Tabs.Content value="all">
          <Stack gap={3} pt={4}>
            <HStack gap={3}>
              <NativeSelect.Root maxW="160px" size="sm">
                <NativeSelect.Field
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as ReviewStatus | "")
                  }
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="completed">Completed</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>
            {loadingAll ? (
              <Text color="fg.muted">Loading…</Text>
            ) : allReviews.length === 0 ? (
              <Box
                p={12}
                textAlign="center"
                borderWidth={1}
                borderRadius="md"
                borderStyle="dashed"
              >
                <Text color="fg.muted">No reviews found.</Text>
              </Box>
            ) : (
              <Table.Root variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Lesson</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Due</Table.ColumnHeader>
                    <Table.ColumnHeader>Interval</Table.ColumnHeader>
                    <Table.ColumnHeader>Last Reviewed</Table.ColumnHeader>
                    <Table.ColumnHeader></Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {allReviews.map((r) => (
                    <Table.Row key={r.id}>
                      <Table.Cell>
                        <AppLink
                          to={`/lessons/${r.lesson}`}
                          color="colorPalette.fg"
                          fontWeight="medium"
                        >
                          {r.expand?.lesson?.title ?? r.lesson}
                        </AppLink>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          colorPalette={
                            r.status === "active"
                              ? "purple"
                              : r.status === "suspended"
                                ? "orange"
                                : "green"
                          }
                          variant="subtle"
                        >
                          {r.status}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{formatDate(r.due_at)}</Table.Cell>
                      <Table.Cell>
                        {r.interval_days != null ? `${r.interval_days}d` : "—"}
                      </Table.Cell>
                      <Table.Cell>{formatDate(r.last_reviewed_at)}</Table.Cell>
                      <Table.Cell>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => setConfirmDeleteId(r.id)}
                        >
                          Remove
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
}
