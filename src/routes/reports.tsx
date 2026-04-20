import { AppLink } from "@/components/ui/app-link";
import { formatDate } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { listLessons } from "@/lib/services/lessonService";
import { listPrograms } from "@/lib/services/programService";
import { listReviews } from "@/lib/services/reviewService";
import { getSettings } from "@/lib/services/settingsService";
import { listSessions } from "@/lib/services/studySessionService";
import type { Lesson, Program, Review, StudySession } from "@/types/domain";
import {
  Badge,
  Box,
  Grid,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export default function Reports() {
  // null = user hasn't made a choice yet (default to active program)
  // ""   = user explicitly chose "All programs"
  const [programFilter, setProgramFilter] = useState<string | null>(null);

  logger.debug("Reports: Rendering reports page");

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const { data: allPrograms = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const programs = allPrograms.filter(
    (p) => p.type === "term" || p.type === "year",
  );

  const activeIds: string[] = useMemo(
    () =>
      Array.isArray(settings?.active_programs) ? settings.active_programs : [],
    [settings],
  );
  const effectiveProgramFilter = useMemo(() => {
    const filter =
      programFilter !== null
        ? programFilter
        : (programs.find((p) => activeIds.includes(p.id))?.id ??
          programs[0]?.id ??
          "");

    if (filter) {
      logger.debug("Reports: Program filter applied", { filter });
    }
    return filter;
  }, [programFilter, programs, activeIds]);

  // Lessons belong to courses (type === "course"), which are children of the selected term/year
  const courseIds = useMemo(() => {
    const ids = effectiveProgramFilter
      ? allPrograms
          .filter(
            (p) => p.type === "course" && p.parent === effectiveProgramFilter,
          )
          .map((p) => p.id)
      : [];

    logger.debug("Reports: Course IDs resolved", {
      count: ids.length,
      programFilter: effectiveProgramFilter,
    });
    return ids;
  }, [allPrograms, effectiveProgramFilter]);

  const { data: allLessons = [] } = useQuery<Lesson[]>({
    queryKey: ["lessons", "reports"],
    queryFn: () => listLessons({ sort: "-updated" }),
  });

  const { data: allSessions = [] } = useQuery<StudySession[]>({
    queryKey: ["study_sessions", "reports", effectiveProgramFilter, courseIds],
    queryFn: () => {
      logger.debug("Reports: Fetching sessions for reports", {
        effectiveProgramFilter,
        courseIdCount: courseIds.length,
      });
      if (!effectiveProgramFilter) {
        // "All programs" — fetch all completed sessions
        return listSessions({});
      }
      if (courseIds.length === 0) {
        // Program selected but courses not resolved yet
        return Promise.resolve([]);
      }
      // Filter server-side by the course programs under the selected term
      return listSessions({ programIds: courseIds });
    },
  });

  const { data: allReviews = [] } = useQuery<Review[]>({
    queryKey: ["reviews", "reports"],
    queryFn: () => listReviews({ sort: "due_at" }),
  });

  logger.debug("Reports: Data fetched", {
    lessonCount: allLessons.length,
    sessionCount: allSessions.length,
    reviewCount: allReviews.length,
  });

  // Apply program filter to lessons via their course
  const filteredLessons =
    courseIds.length > 0
      ? allLessons.filter((l) => courseIds.includes(l.program))
      : effectiveProgramFilter
        ? []
        : allLessons;

  logger.debug("Reports: Filtered lessons", {
    total: allLessons.length,
    filtered: filteredLessons.length,
    programFilter: effectiveProgramFilter,
  });

  // Sessions are already filtered server-side by courseIds; just alias for clarity
  const filteredSessions = allSessions;

  logger.debug("Reports: Filtered sessions", {
    total: allSessions.length,
    programFilter: effectiveProgramFilter,
  });

  // Apply program filter to reviews via their lesson's program (course)
  const filteredReviews =
    courseIds.length > 0
      ? allReviews.filter((r) =>
          r.expand?.lesson?.program
            ? courseIds.includes(r.expand.lesson.program)
            : false,
        )
      : effectiveProgramFilter
        ? []
        : allReviews;

  logger.debug("Reports: Filtered reviews", {
    total: allReviews.length,
    filtered: filteredReviews.length,
  });

  // Lesson status breakdown
  const byStatus: Record<string, number> = {};
  filteredLessons.forEach((l) => {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
  });

  logger.debug("Reports: Lesson status breakdown calculated", byStatus);

  const total = filteredLessons.length;
  const completed = byStatus["completed"] ?? 0;
  const active = byStatus["active"] ?? 0;
  const not_started = byStatus["not_started"] ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  logger.info("Reports: Lesson stats calculated", {
    total,
    completed,
    active,
    not_started,
    completionPercentage: pct,
  });

  // Session stats
  const totalSessionMinutes = filteredSessions.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0,
  );
  const sessionHours = Math.floor(totalSessionMinutes / 60);
  const sessionMins = totalSessionMinutes % 60;
  const activeReviews = filteredReviews.filter(
    (r) => r.status === "active",
  ).length;
  const completedReviews = filteredReviews.filter(
    (r) => r.status === "completed",
  ).length;

  logger.info("Reports: Session stats calculated", {
    sessionCount: filteredSessions.length,
    totalMinutes: totalSessionMinutes,
    totalHours: sessionHours,
    totalMins: sessionMins,
  });

  logger.info("Reports: Review stats calculated", {
    activeReviews,
    completedReviews,
    totalReviews: filteredReviews.length,
  });

  // Top 5 recently reviewed lessons
  const recentlyCompleted = filteredLessons
    .filter((l) => l.status === "completed" && l.completed_at)
    .sort(
      (a, b) =>
        new Date(b.completed_at!).getTime() -
        new Date(a.completed_at!).getTime(),
    )
    .slice(0, 5);

  logger.debug("Reports: Recently completed lessons", {
    count: recentlyCompleted.length,
  });

  // Lessons with no module
  const unassigned = filteredLessons.filter((l) => !l.module);
  logger.debug("Reports: Unassigned lessons (no module)", {
    count: unassigned.length,
  });

  return (
    <Stack id="reports" gap={8}>
      <Heading size="lg">Reports</Heading>

      {/* Filter */}
      <HStack gap={3}>
        <NativeSelect.Root maxW="220px" size="sm">
          <NativeSelect.Field
            value={effectiveProgramFilter}
            onChange={(e) => {
              logger.info("Reports: Program filter changed", {
                filter: e.target.value,
              });
              setProgramFilter(e.target.value);
            }}
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
      </HStack>

      {/* Overview stats */}
      <Stack gap={3}>
        <Heading size="md">Lesson Progress</Heading>
        <Grid
          templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(5, 1fr)" }}
          gap={4}
        >
          {[
            { label: "Total", value: total, color: "gray" },
            { label: "Reviewed", value: completed, color: "blue" },
            { label: "Active", value: active, color: "green" },
            { label: "Not Started", value: not_started, color: "gray" },
          ].map(({ label, value, color }) => (
            <Box
              key={label}
              p={4}
              borderWidth={1}
              borderRadius="md"
              bg="bg.subtle"
              textAlign="center"
            >
              <Text fontSize="2xl" fontWeight="bold" color={`${color}.fg`}>
                {value}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {label}
              </Text>
            </Box>
          ))}
        </Grid>

        {/* Progress bar */}
        {total > 0 && (
          <Box>
            <HStack justify="space-between" mb={1}>
              <Text fontSize="sm">Completion</Text>
              <Text fontSize="sm" fontWeight="bold">
                {pct}%
              </Text>
            </HStack>
            <Box h={3} bg="bg.muted" borderRadius="full" overflow="hidden">
              <Box
                h="full"
                bg="blue.solid"
                borderRadius="full"
                style={{ width: `${pct}%`, transition: "width 0.5s" }}
              />
            </Box>
          </Box>
        )}
      </Stack>

      {/* Session stats */}
      <Stack gap={3}>
        <Heading size="md">Study Sessions</Heading>
        <Grid
          templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }}
          gap={4}
        >
          <Box
            p={4}
            borderWidth={1}
            borderRadius="md"
            bg="bg.subtle"
            textAlign="center"
          >
            <Text fontSize="2xl" fontWeight="bold">
              {filteredSessions.length}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Total Sessions
            </Text>
          </Box>
          <Box
            p={4}
            borderWidth={1}
            borderRadius="md"
            bg="bg.subtle"
            textAlign="center"
          >
            <Text fontSize="2xl" fontWeight="bold">
              {sessionHours}h {sessionMins}m
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Total Time
            </Text>
          </Box>
          <Box
            p={4}
            borderWidth={1}
            borderRadius="md"
            bg="bg.subtle"
            textAlign="center"
          >
            <Text fontSize="2xl" fontWeight="bold">
              {filteredSessions.length > 0
                ? Math.round(totalSessionMinutes / filteredSessions.length)
                : 0}
              m
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Avg Session Length
            </Text>
          </Box>
        </Grid>
      </Stack>

      {/* Review stats */}
      <Stack gap={3}>
        <Heading size="md">Reviews</Heading>
        <Grid
          templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }}
          gap={4}
        >
          <Box
            p={4}
            borderWidth={1}
            borderRadius="md"
            bg="bg.subtle"
            textAlign="center"
          >
            <Text fontSize="2xl" fontWeight="bold" color="purple.fg">
              {activeReviews}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Active Reviews
            </Text>
          </Box>
          <Box
            p={4}
            borderWidth={1}
            borderRadius="md"
            bg="bg.subtle"
            textAlign="center"
          >
            <Text fontSize="2xl" fontWeight="bold" color="green.fg">
              {completedReviews}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Completed
            </Text>
          </Box>
          <Box
            p={4}
            borderWidth={1}
            borderRadius="md"
            bg="bg.subtle"
            textAlign="center"
          >
            <Text fontSize="2xl" fontWeight="bold">
              {filteredReviews.length}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Total in Queue
            </Text>
          </Box>
        </Grid>
      </Stack>

      {/* Recently reviewed */}
      {recentlyCompleted.length > 0 && (
        <Stack gap={3}>
          <Heading size="md">Recently Reviewed</Heading>
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Lesson</Table.ColumnHeader>
                <Table.ColumnHeader>Program</Table.ColumnHeader>
                <Table.ColumnHeader>Reviewed</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recentlyCompleted.map((l) => (
                <Table.Row key={l.id}>
                  <Table.Cell>
                    <AppLink
                      to={`/lessons/${l.id}`}
                      color="colorPalette.fg"
                      fontWeight="medium"
                    >
                      {l.title}
                    </AppLink>
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {l.expand?.program?.name ?? "—"}
                  </Table.Cell>
                  <Table.Cell>{formatDate(l.completed_at)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Stack>
      )}

      {/* Unassigned lessons */}
      {unassigned.length > 0 && (
        <Stack gap={3}>
          <HStack justify="space-between">
            <Heading size="md">Lessons Without Module</Heading>
            <Badge colorPalette="orange" variant="subtle">
              {unassigned.length}
            </Badge>
          </HStack>
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Title</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Due</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {unassigned.slice(0, 10).map((l) => (
                <Table.Row key={l.id}>
                  <Table.Cell>
                    <AppLink
                      to={`/lessons/${l.id}`}
                      color="colorPalette.fg"
                      fontWeight="medium"
                    >
                      {l.title}
                    </AppLink>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="subtle">{l.status}</Badge>
                  </Table.Cell>
                  <Table.Cell>{formatDate(l.due_at)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Stack>
      )}
    </Stack>
  );
}
