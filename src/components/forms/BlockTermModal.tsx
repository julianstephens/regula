import {
  computeBlockRanges,
  computeIdealTermEnd,
  DEFAULT_BLOCK_WEEKS,
} from "@/lib/blocks";
import { formatDate, toISODateString } from "@/lib/dates";
import {
  blockTerm,
  checkExistingBlocks,
} from "@/lib/services/blockTermService";
import type { Program } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Field,
  Heading,
  HStack,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Props {
  term: Program;
  globalBlockWeeks: number;
  isOpen: boolean;
  onClose: () => void;
}

export function BlockTermModal({
  term,
  globalBlockWeeks,
  isOpen,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const [blockWeeksInput, setBlockWeeksInput] = useState(
    String(term.block_weeks || globalBlockWeeks),
  );

  const resolvedBlockWeeks =
    Number(blockWeeksInput) || globalBlockWeeks || DEFAULT_BLOCK_WEEKS;

  const termStart = term.start_date ? new Date(term.start_date) : null;
  const termEnd = term.end_date ? new Date(term.end_date) : null;

  const previewRanges =
    termStart && termEnd
      ? computeBlockRanges(termStart, termEnd, resolvedBlockWeeks)
      : [];

  const idealTermEnd =
    termStart && previewRanges.length > 0
      ? computeIdealTermEnd(termStart, previewRanges.length, resolvedBlockWeeks)
      : null;

  const needsExtension =
    idealTermEnd !== null &&
    termEnd !== null &&
    idealTermEnd.getTime() > termEnd.getTime();

  const { data: hasExistingBlocks, isLoading: checkingBlocks } = useQuery({
    queryKey: ["existingBlocks", term.id],
    queryFn: () => checkExistingBlocks(term.id),
    enabled: isOpen,
  });

  const blockMut = useMutation({
    mutationFn: () =>
      blockTerm({
        term,
        blockWeeks: resolvedBlockWeeks,
        extendTerm: needsExtension,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["programs"] });
      onClose();
    },
  });

  const examWeekRow =
    termEnd !== null && !needsExtension
      ? (() => {
          const examEnd = new Date(termEnd);
          const examStart = new Date(examEnd);
          examStart.setDate(examEnd.getDate() - 6);
          return { examStart, examEnd };
        })()
      : idealTermEnd !== null && needsExtension
        ? (() => {
            const examEnd = new Date(idealTermEnd);
            const examStart = new Date(examEnd);
            examStart.setDate(examEnd.getDate() - 6);
            return { examStart, examEnd };
          })()
        : null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={({ open: o }) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="lg">
          <Dialog.Header>
            <Dialog.Title>Block Term</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={5}>
              {hasExistingBlocks && (
                <Box
                  p={4}
                  borderWidth={1}
                  borderColor="red.300"
                  borderRadius="lg"
                  bg="red.subtle"
                >
                  <Text color="red.600" fontWeight="semibold" fontSize="sm">
                    This term already has blocks.
                  </Text>
                  <Text color="red.500" fontSize="sm" mt={1}>
                    Delete the existing block programs before blocking this
                    term.
                  </Text>
                </Box>
              )}

              <Field.Root>
                <Field.Label>Weeks per block</Field.Label>
                <Input
                  type="number"
                  min={2}
                  max={6}
                  value={blockWeeksInput}
                  onChange={(e) => setBlockWeeksInput(e.target.value)}
                  w={24}
                />
              </Field.Root>

              {needsExtension && idealTermEnd && termEnd && (
                <Box
                  p={4}
                  borderWidth={1}
                  borderColor="orange.300"
                  borderRadius="lg"
                  bg="orange.subtle"
                >
                  <Heading size="xs" color="orange.700" mb={1}>
                    Term extension needed
                  </Heading>
                  <Text fontSize="sm" color="orange.700">
                    This term ends on{" "}
                    <strong>{formatDate(toISODateString(termEnd))}</strong>. To
                    fit {previewRanges.length} complete block
                    {previewRanges.length !== 1 ? "s" : ""} with rest weeks, the
                    term needs to end on{" "}
                    <strong>{formatDate(toISODateString(idealTermEnd))}</strong>
                    . Continuing will update the term end date.
                  </Text>
                </Box>
              )}

              {previewRanges.length > 0 && (
                <Stack gap={2}>
                  <Heading size="xs" color="fg.muted">
                    Block preview
                  </Heading>
                  <Table.Root variant="outline" size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader>Name</Table.ColumnHeader>
                        <Table.ColumnHeader>Start</Table.ColumnHeader>
                        <Table.ColumnHeader>End</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {previewRanges.flatMap((b, i) => {
                        const blockRow = (
                          <Table.Row key={b.name}>
                            <Table.Cell fontWeight="medium">
                              {b.name}
                            </Table.Cell>
                            <Table.Cell color="fg.muted">
                              {formatDate(toISODateString(b.start))}
                            </Table.Cell>
                            <Table.Cell color="fg.muted">
                              {formatDate(toISODateString(b.end))}
                            </Table.Cell>
                          </Table.Row>
                        );

                        if (i < previewRanges.length - 1) {
                          const restStart = new Date(b.end);
                          restStart.setDate(restStart.getDate() + 1);
                          restStart.setHours(0, 0, 0, 0);
                          const restEnd = new Date(b.end);
                          restEnd.setDate(restEnd.getDate() + 7);

                          const restRow = (
                            <Table.Row key={`${b.name}-rest`}>
                              <Table.Cell>
                                <HStack gap={2}>
                                  <Text fontStyle="italic" color="fg.muted">
                                    Rest Week
                                  </Text>
                                  <Badge
                                    size="sm"
                                    variant="subtle"
                                    colorPalette="green"
                                  >
                                    rest
                                  </Badge>
                                </HStack>
                              </Table.Cell>
                              <Table.Cell color="fg.muted">
                                {formatDate(toISODateString(restStart))}
                              </Table.Cell>
                              <Table.Cell color="fg.muted">
                                {formatDate(toISODateString(restEnd))}
                              </Table.Cell>
                            </Table.Row>
                          );

                          return [blockRow, restRow];
                        }

                        return [blockRow];
                      })}
                      {examWeekRow && (
                        <Table.Row>
                          <Table.Cell>
                            <HStack gap={2}>
                              <Text fontStyle="italic" color="fg.muted">
                                Exam Week
                              </Text>
                              <Badge
                                size="sm"
                                variant="subtle"
                                colorPalette="orange"
                              >
                                reserved
                              </Badge>
                            </HStack>
                          </Table.Cell>
                          <Table.Cell color="fg.muted">
                            {formatDate(toISODateString(examWeekRow.examStart))}
                          </Table.Cell>
                          <Table.Cell color="fg.muted">
                            {formatDate(toISODateString(examWeekRow.examEnd))}
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table.Root>
                </Stack>
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack gap={2}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                colorPalette="blue"
                loading={blockMut.isPending || checkingBlocks}
                disabled={!!hasExistingBlocks || checkingBlocks}
                onClick={() => blockMut.mutate()}
              >
                {needsExtension ? "Extend & Block" : "Block Term"}
              </Button>
            </HStack>
          </Dialog.Footer>
          {blockMut.isError && (
            <Box
              mx={6}
              mb={4}
              p={3}
              borderWidth={1}
              borderColor="red.300"
              borderRadius="md"
              bg="red.subtle"
            >
              <Text color="red.600" fontSize="sm">
                Failed: {String(blockMut.error)}
              </Text>
            </Box>
          )}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
