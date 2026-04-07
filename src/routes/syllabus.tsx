import { formatDate } from "@/lib/dates";
import { getProgram, listPrograms } from "@/lib/services/programService";
import { listStudyItemsByPrograms } from "@/lib/services/studyItemService";
import type { Area, Program, Resource, StudyItem } from "@/types/domain";
import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const RESOURCE_TYPE_COLORS: Record<string, string> = {
  book: "teal",
  article: "blue",
  video: "purple",
  podcast: "orange",
  course: "green",
  other: "gray",
};

const PROGRAM_STATUS_COLORS: Record<string, string> = {
  planned: "gray",
  active: "green",
  completed: "blue",
  archived: "orange",
};

function ResourceRow({ resource }: { resource: Resource }) {
  return (
    <HStack gap={3} py={1}>
      <Box flex={1}>
        <Text fontWeight="semibold" fontSize="sm">
          {resource.title}
        </Text>
        {resource.author && (
          <Text fontSize="xs" color="fg.muted">
            {resource.author}
          </Text>
        )}
      </Box>
      <Badge
        colorPalette={RESOURCE_TYPE_COLORS[resource.resource_type] ?? "gray"}
        variant="subtle"
        size="sm"
        textTransform="capitalize"
      >
        {resource.resource_type}
      </Badge>
    </HStack>
  );
}

function CourseCard({
  course,
  items,
}: {
  course: Program;
  items: StudyItem[];
}) {
  // Build area → resources map preserving insertion order
  const areaResourceMap = new Map<
    string,
    { area: Area; resources: Map<string, Resource> }
  >();
  const ungroupedResources = new Map<string, Resource>();

  for (const item of items) {
    const area = item.expand?.area;
    const resource = item.expand?.resource;
    if (area) {
      if (!areaResourceMap.has(area.id)) {
        areaResourceMap.set(area.id, { area, resources: new Map() });
      }
      if (resource) {
        areaResourceMap.get(area.id)!.resources.set(resource.id, resource);
      }
    } else if (resource) {
      ungroupedResources.set(resource.id, resource);
    }
  }

  const areaGroups = Array.from(areaResourceMap.values());

  return (
    <Card.Root variant="outline">
      <Card.Header pb={2}>
        <Flex justify="space-between" align="baseline" wrap="wrap" gap={2}>
          <Heading size="sm">{course.name}</Heading>
          <Text fontSize="xs" color="fg.muted">
            {formatDate(course.start_date)}
            {course.end_date ? ` – ${formatDate(course.end_date)}` : ""}
          </Text>
        </Flex>
      </Card.Header>
      <Card.Body pt={0}>
        {items.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No resources scheduled
          </Text>
        ) : (
          <Stack gap={4}>
            {areaGroups.map(({ area, resources }) => (
              <Box key={area.id}>
                <HStack mb={2} gap={2}>
                  <Badge
                    css={{ background: area.color }}
                    color="white"
                    variant="solid"
                    size="sm"
                  >
                    {area.name}
                  </Badge>
                </HStack>
                {resources.size === 0 ? (
                  <Text fontSize="sm" color="fg.muted" pl={3}>
                    No resources
                  </Text>
                ) : (
                  <Stack
                    gap={0}
                    pl={3}
                    borderLeft="2px solid"
                    borderColor="border.muted"
                    divideY="1px"
                  >
                    {Array.from(resources.values()).map((resource) => (
                      <ResourceRow key={resource.id} resource={resource} />
                    ))}
                  </Stack>
                )}
              </Box>
            ))}
            {ungroupedResources.size > 0 && (
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color="fg.muted"
                  mb={2}
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Other
                </Text>
                <Stack gap={0} divideY="1px">
                  {Array.from(ungroupedResources.values()).map((resource) => (
                    <ResourceRow key={resource.id} resource={resource} />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}

export default function Syllabus() {
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  const { data: programs = [], isLoading: programsLoading } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const terms = programs.filter((p) => p.type === "term");

  // Derive the effective term selection without needing an effect
  const effectiveTermId: string | null =
    selectedTermId && terms.some((t) => t.id === selectedTermId)
      ? selectedTermId
      : (terms.find((t) => t.status === "active")?.id ?? terms[0]?.id ?? null);

  const { data: term, isLoading: termLoading } = useQuery({
    queryKey: ["program", effectiveTermId],
    queryFn: () => getProgram(effectiveTermId!),
    enabled: !!effectiveTermId,
  });

  const courses: Program[] = (
    (term?.expand?.regula_programs_via_parent as Program[] | undefined) ?? []
  )
    .filter((p) => p.type === "course")
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    );

  const allProgramIds = effectiveTermId
    ? [effectiveTermId, ...courses.map((c) => c.id)]
    : [];

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["study-items", "syllabus", effectiveTermId],
    queryFn: () => listStudyItemsByPrograms(allProgramIds),
    enabled: !!effectiveTermId && !termLoading,
  });

  const isLoading = programsLoading || (!!effectiveTermId && termLoading);

  if (isLoading) {
    return (
      <Flex h="40vh" align="center" justify="center">
        <Spinner />
      </Flex>
    );
  }

  return (
    <Box>
      <Flex mb={6} align="center" justify="space-between" gap={4} wrap="wrap">
        <Heading size="lg">Syllabus</Heading>
        {terms.length > 0 && (
          <NativeSelect.Root w="220px" size="sm">
            <NativeSelect.Field
              value={effectiveTermId ?? ""}
              onChange={(e) => setSelectedTermId(e.target.value)}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        )}
      </Flex>

      {terms.length === 0 ? (
        <Flex
          h="40vh"
          align="center"
          justify="center"
          direction="column"
          gap={2}
        >
          <Text fontWeight="semibold" color="fg.muted">
            No terms found
          </Text>
          <Text fontSize="sm" color="fg.subtle">
            Create a program with type "term" to get started.
          </Text>
        </Flex>
      ) : term ? (
        <Stack gap={6}>
          {/* Term info strip */}
          <Card.Root variant="subtle">
            <Card.Body>
              <Flex align="center" gap={3} wrap="wrap">
                <Heading size="md">{term.name}</Heading>
                <Badge
                  colorPalette={PROGRAM_STATUS_COLORS[term.status] ?? "gray"}
                  variant="subtle"
                  textTransform="capitalize"
                >
                  {term.status}
                </Badge>
                <Text fontSize="sm" color="fg.muted">
                  {formatDate(term.start_date)}
                  {term.end_date ? ` – ${formatDate(term.end_date)}` : ""}
                </Text>
              </Flex>
              {term.description && (
                <Text mt={2} fontSize="sm" color="fg.muted">
                  {term.description}
                </Text>
              )}
            </Card.Body>
          </Card.Root>

          {/* Course sections */}
          {itemsLoading ? (
            <Flex justify="center" py={8}>
              <Spinner />
            </Flex>
          ) : (
            <Stack gap={4}>
              {courses.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  No courses in this term.
                </Text>
              ) : (
                courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    items={items.filter((i) => i.program === course.id)}
                  />
                ))
              )}
            </Stack>
          )}
        </Stack>
      ) : null}
    </Box>
  );
}
