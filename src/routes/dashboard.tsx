import { StatusBadge } from "@/components/cards/StatusBadge";
import { AppLink } from "@/components/ui/app-link";
import {
  endOfDay,
  formatDate,
  startOfDay,
  startOfWeek,
  toPbDate,
} from "@/lib/dates";
import pb from "@/lib/pocketbase";
import { listAssessments } from "@/lib/services/assessmentService";
import { listLessons } from "@/lib/services/lessonService";
import { listPrograms } from "@/lib/services/programService";
import { listReviews } from "@/lib/services/reviewService";
import {
  DEFAULT_DASHBOARD_MODULES,
  getSettings,
} from "@/lib/services/settingsService";
import { listVacations } from "@/lib/services/vacationService";
import type { Assessment, Lesson, Review, Vacation } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

function GettingStartedCard() {
  const steps = [
    {
      title: "Create a Program",
      description: "A program is the top-level container for your study plan.",
      to: "/programs",
      label: "Go to Programs",
    },
    {
      title: "Add Modules",
      description: "Break your program into focused modules or units.",
      to: "/modules",
      label: "Go to Modules",
    },
    {
      title: "Add Lessons",
      description:
        "Create lessons inside each module with due dates and content.",
      to: "/modules",
      label: "Open a Module",
    },
    {
      title: "Start Reviewing",
      description: "Once lessons are complete, scheduled reviews appear here.",
      to: "/reviews",
      label: "Go to Reviews",
    },
  ];

  return (
    <Box
      p={8}
      borderWidth={2}
      borderRadius="xl"
      bg="bg.subtle"
      borderColor="border.emphasized"
      maxW="2xl"
      mx="auto"
    >
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading size="lg">Welcome to Regula</Heading>
          <Text color="fg.muted">
            Follow these steps to set up your first study program.
          </Text>
        </Stack>
        <Stack gap={4}>
          {steps.map((step, i) => (
            <HStack key={step.to + step.title} align="start" gap={4}>
              <Box
                flexShrink={0}
                w={8}
                h={8}
                borderRadius="full"
                bg="colorPalette.subtle"
                borderWidth={1}
                borderColor="colorPalette.emphasized"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontWeight="bold" fontSize="sm" color="colorPalette.fg">
                  {i + 1}
                </Text>
              </Box>
              <Stack gap={1} flex={1}>
                <Text fontWeight="semibold">{step.title}</Text>
                <Text fontSize="sm" color="fg.muted">
                  {step.description}
                </Text>
              </Stack>
              <AppLink to={step.to}>
                <Button size="sm" variant="outline">
                  {step.label}
                </Button>
              </AppLink>
            </HStack>
          ))}
        </Stack>
        <HStack justify="space-between" align="center">
          <Text fontSize="xs" color="fg.subtle">
            Come back here once you have lessons to see your daily work queue.
          </Text>
          <AppLink to="/programs/import">
            <Button size="xs" variant="ghost">
              Import Program
            </Button>
          </AppLink>
        </HStack>
      </Stack>
    </Box>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const today = startOfDay();
  const todayEnd = endOfDay();
  const todayStr = toPbDate(today);
  const todayEndStr = toPbDate(todayEnd);

  const { data: allPrograms = [], isPending: programsPending } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const activeModules: string[] = settings?.dashboard_modules?.length
    ? settings.dashboard_modules
    : DEFAULT_DASHBOARD_MODULES;

  // Week bounds
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStartStr = toPbDate(weekStart);
  const weekEndStr = toPbDate(weekEnd);

  // Due Today: lessons due on today's date
  const { data: dueTodayLessons = [] } = useQuery<Lesson[]>({
    queryKey: ["dashboard", "due_today_lessons"],
    queryFn: () =>
      listLessons({
        sort: "due_at",
        dueBefore: todayEndStr,
        dueAfter: todayStr,
      }),
    enabled: activeModules.includes("due_today"),
  });

  // Weekly lessons (with program.area for color dots)
  const { data: weeklyLessons = [] } = useQuery<Lesson[]>({
    queryKey: ["dashboard", "weekly_lessons"],
    queryFn: () =>
      listLessons({
        sort: "due_at",
        dueAfter: weekStartStr,
        dueBefore: weekEndStr,
        expand: "program,program.area,module,resource",
      }),
  });

  // Vacations
  const { data: vacations = [] } = useQuery<Vacation[]>({
    queryKey: ["vacations"],
    queryFn: listVacations,
  });

  // Review queue: due_at <= today, status = active
  const { data: reviewQueue = [] } = useQuery<Review[]>({
    queryKey: ["dashboard", "review_queue"],
    queryFn: () =>
      listReviews({ status: "active", dueBefore: todayEndStr, sort: "due_at" }),
    enabled: activeModules.includes("review_queue"),
  });

  // Overdue: not_started or active lessons past due
  const { data: overdueLessons = [] } = useQuery<Lesson[]>({
    queryKey: ["dashboard", "overdue"],
    queryFn: () =>
      listLessons({
        sort: "due_at",
        dueBefore: todayStr,
        statuses: ["not_started", "active"],
        expand: "program",
      }),
    enabled: activeModules.includes("overdue"),
  });

  // Upcoming assessments: next 3 not-yet-due
  const { data: upcomingAssessments = [] } = useQuery<Assessment[]>({
    queryKey: ["dashboard", "upcoming_assessments"],
    queryFn: () =>
      listAssessments({
        dueAfter: todayStr,
        sort: "due_at",
      }),
    select: (data) => data.slice(0, 3),
    enabled: activeModules.includes("upcoming_assessments"),
  });

  // Vacation date set keyed by YYYY-MM-DD
  const vacationDateSet = useMemo(() => {
    const dateSet = new Set<string>();
    vacations.forEach((v) => {
      const start = new Date(v.start_date + "T12:00:00");
      const end = new Date(v.end_date + "T12:00:00");
      const cur = new Date(start);
      while (cur <= end) {
        dateSet.add(
          `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
        );
        cur.setDate(cur.getDate() + 1);
      }
    });
    return dateSet;
  }, [vacations]);

  // Group weekly lessons by local date
  function toDateKey(d: Date): string {
    return d.toDateString();
  }

  function toDayIsoKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const lessonsByDay = weeklyLessons.reduce<Record<string, Lesson[]>>(
    (acc, l) => {
      if (!l.due_at) return acc;
      const key = toDateKey(new Date(l.due_at.slice(0, 10) + "T12:00:00"));
      (acc[key] ??= []).push(l);
      return acc;
    },
    {},
  );
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Realtime subscription
  useEffect(() => {
    let unsub: (() => void) | undefined;
    void pb
      .collection("regula_lessons")
      .subscribe("*", () => {
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .then((fn) => {
        unsub = fn;
      });

    return () => {
      void pb.collection("regula_lessons").unsubscribe("*");
      unsub?.();
    };
  }, [qc]);

  if (!programsPending && allPrograms.length === 0) {
    return (
      <Stack id="dashboard" gap={8}>
        <Heading size="lg">Dashboard</Heading>
        <GettingStartedCard />
      </Stack>
    );
  }

  return (
    <Stack id="dashboard" gap={5}>
      <Heading size="lg">Dashboard</Heading>

      {/* Configurable modules grid */}
      {activeModules.length > 0 && (
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={6}>
          {activeModules.map((key) => {
            if (key === "due_today") {
              return (
                <Stack key="due_today" id="dashboard-due-today" gap={2}>
                  <HStack
                    id="dashboard-due-today-header"
                    justify="space-between"
                  >
                    <Heading size="sm">Due Today</Heading>
                    {dueTodayLessons.length > 0 && (
                      <Badge colorPalette="orange" variant="solid">
                        {dueTodayLessons.length}
                      </Badge>
                    )}
                  </HStack>
                  {dueTodayLessons.length === 0 ? (
                    <Box
                      id="dashboard-due-today-empty"
                      p={3}
                      borderRadius="md"
                      bg="green.subtle"
                      borderWidth={1}
                      borderColor="green.emphasized"
                    >
                      <Text color="green.fg" fontWeight="medium" fontSize="sm">
                        ✓ Nothing due today
                      </Text>
                    </Box>
                  ) : (
                    <Stack
                      id="dashboard-due-today-list"
                      gap={1}
                      maxH="280px"
                      overflowY="auto"
                    >
                      {dueTodayLessons.map((l) => (
                        <HStack
                          id="dashboard-due-today-lesson"
                          key={l.id}
                          p={2}
                          borderWidth={1}
                          borderRadius="md"
                          bg="bg.subtle"
                          justify="space-between"
                          align="flex-start"
                        >
                          <Stack gap={0}>
                            <AppLink
                              to={`/lessons/${l.id}`}
                              fontWeight="medium"
                              color="colorPalette.fg"
                            >
                              {l.title}
                            </AppLink>
                            {l.expand?.program && (
                              <Text
                                id="dashboard-due-today-lesson-program"
                                alignSelf="flex-start"
                                fontSize="xs"
                                color="fg.muted"
                              >
                                {l.expand.program.name}
                              </Text>
                            )}
                          </Stack>
                          <StatusBadge status={l.status} />
                        </HStack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              );
            }

            if (key === "review_queue") {
              return (
                <Stack
                  key="review_queue"
                  id="dashboard-review-queue"
                  gap={2}
                  h="full"
                >
                  <HStack
                    id="dashboard-review-queue-header"
                    justify="space-between"
                  >
                    <Heading size="sm">Review Queue</Heading>
                    {reviewQueue.length > 0 && (
                      <Badge colorPalette="purple" variant="solid">
                        {reviewQueue.length}
                      </Badge>
                    )}
                  </HStack>
                  {reviewQueue.length === 0 ? (
                    <Flex
                      id="dashboard-review-queue-empty"
                      flex={1}
                      align="center"
                      justify="center"
                      p={3}
                      borderRadius="md"
                      bg="bg.subtle"
                      borderWidth={1}
                    >
                      <Text color="fg.muted" fontSize="sm">
                        No reviews due today.
                      </Text>
                    </Flex>
                  ) : (
                    <Stack
                      id="dashboard-review-queue-list"
                      gap={1}
                      maxH="280px"
                      overflowY="auto"
                    >
                      {reviewQueue.slice(0, 5).map((r) => (
                        <HStack
                          key={r.id}
                          p={2}
                          borderWidth={1}
                          borderRadius="md"
                          bg="purple.subtle"
                          borderColor="purple.emphasized"
                          justify="space-between"
                          align="flex-start"
                        >
                          <Stack gap={0}>
                            <Text fontWeight="medium" color="purple.fg">
                              {r.expand?.lesson?.title ?? "—"}
                            </Text>
                            {r.last_reviewed_at && (
                              <Text fontSize="xs" color="fg.muted">
                                Last reviewed: {formatDate(r.last_reviewed_at)}
                              </Text>
                            )}
                          </Stack>
                          <AppLink to="/reviews">
                            <Button
                              size="xs"
                              colorPalette="purple"
                              variant="subtle"
                            >
                              Review
                            </Button>
                          </AppLink>
                        </HStack>
                      ))}
                      {reviewQueue.length > 5 && (
                        <AppLink to="/reviews">
                          <Text fontSize="sm" color="colorPalette.fg">
                            + {reviewQueue.length - 5} more reviews due →
                          </Text>
                        </AppLink>
                      )}
                    </Stack>
                  )}
                </Stack>
              );
            }

            if (key === "overdue") {
              return (
                <Stack key="overdue" id="dashboard-overdue" gap={2}>
                  <HStack
                    id="dashboard-overdue-header"
                    justify="space-between"
                    align="flex-start"
                  >
                    <Heading size="sm">Overdue</Heading>
                    {overdueLessons.length > 0 && (
                      <Badge colorPalette="red" variant="solid">
                        {overdueLessons.length}
                      </Badge>
                    )}
                  </HStack>
                  {overdueLessons.length === 0 ? (
                    <Box
                      id="dashboard-overdue-empty"
                      p={3}
                      borderRadius="md"
                      bg="green.subtle"
                      borderWidth={1}
                      borderColor="green.emphasized"
                    >
                      <Text color="green.fg" fontWeight="medium" fontSize="sm">
                        ✓ Nothing overdue
                      </Text>
                    </Box>
                  ) : (
                    <Stack
                      id="dashboard-overdue-list"
                      gap={1}
                      maxH="280px"
                      overflowY="auto"
                    >
                      {overdueLessons.map((l) => (
                        <HStack
                          key={l.id}
                          p={2}
                          borderWidth={1}
                          borderRadius="md"
                          bg="red.subtle"
                          borderColor="red.emphasized"
                          justify="space-between"
                        >
                          <Stack gap={0}>
                            <AppLink
                              to={`/lessons/${l.id}`}
                              fontWeight="medium"
                              color="red.fg"
                            >
                              {l.title}
                            </AppLink>
                            {l.expand?.program && (
                              <Text fontSize="xs" color="fg.muted">
                                {l.expand.program.name}
                              </Text>
                            )}
                          </Stack>
                          <StatusBadge status={l.status} />
                        </HStack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              );
            }

            if (key === "upcoming_assessments") {
              return (
                <Stack
                  key="upcoming_assessments"
                  id="dashboard-upcoming-assessments"
                  gap={2}
                >
                  <HStack
                    id="dashboard-upcoming-assessments-header"
                    justify="space-between"
                  >
                    <Heading size="sm">Upcoming Assessments</Heading>
                    {upcomingAssessments.length > 0 && (
                      <Badge colorPalette="blue" variant="solid">
                        {upcomingAssessments.length}
                      </Badge>
                    )}
                  </HStack>
                  {upcomingAssessments.length === 0 ? (
                    <Box
                      id="dashboard-upcoming-assessments-empty"
                      p={3}
                      borderRadius="md"
                      bg="bg.subtle"
                      borderWidth={1}
                    >
                      <Text color="fg.muted" fontSize="sm">
                        No upcoming assessments.
                      </Text>
                    </Box>
                  ) : (
                    <Stack
                      id="dashboard-upcoming-assessments-list"
                      gap={1}
                      maxH="280px"
                      overflowY="auto"
                    >
                      {upcomingAssessments.map((a) => (
                        <HStack
                          key={a.id}
                          p={2}
                          borderWidth={1}
                          borderRadius="md"
                          bg="blue.subtle"
                          borderColor="blue.emphasized"
                          justify="space-between"
                          align="flex-start"
                        >
                          <Stack gap={0}>
                            <AppLink
                              textAlign="left"
                              to={`/assessments/${a.id}`}
                              fontWeight="medium"
                              color="blue.fg"
                            >
                              {a.title}
                            </AppLink>
                            {a.expand?.program && (
                              <Text
                                textAlign="left"
                                fontSize="xs"
                                color="fg.muted"
                              >
                                {a.expand.program.name}
                              </Text>
                            )}
                          </Stack>
                          {a.due_at && (
                            <Badge
                              colorPalette="blue"
                              variant="outline"
                              size="sm"
                            >
                              {formatDate(a.due_at)}
                            </Badge>
                          )}
                        </HStack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              );
            }

            return null;
          })}
        </Grid>
      )}

      {/* Weekly Overview */}
      <Stack id="dashboard-weekly" gap={2}>
        <Heading size="sm">This Week</Heading>
        <Stack gap={1}>
          {weekDays.map((day) => {
            const key = toDateKey(day);
            const isToday = day.toDateString() === today.toDateString();
            const isPast = day < today;
            const lessons = lessonsByDay[key] ?? [];
            const isVacation = vacationDateSet.has(toDayIsoKey(day));
            return (
              <HStack
                key={key}
                p={2}
                borderWidth={isToday ? 2 : 1}
                borderRadius="md"
                bg={isToday ? "colorPalette.subtle" : "bg.subtle"}
                borderColor={
                  isToday ? "colorPalette.emphasized" : "border.subtle"
                }
                opacity={isPast && !isToday ? 0.55 : 1}
                gap={3}
                align="start"
              >
                <Box flexShrink={0} w="48px">
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color={isToday ? "colorPalette.fg" : "fg.muted"}
                  >
                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    {day.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </Box>
                {lessons.length === 0 ? (
                  isVacation ? (
                    <Badge colorPalette="orange" variant="subtle" size="sm">
                      vacation
                    </Badge>
                  ) : (
                    <Text fontSize="xs" color="fg.subtle" pt="1px">
                      —
                    </Text>
                  )
                ) : (
                  <Stack gap={1} flex={1}>
                    {isVacation && (
                      <Badge
                        colorPalette="orange"
                        variant="subtle"
                        size="sm"
                        alignSelf="flex-start"
                      >
                        vacation
                      </Badge>
                    )}
                    <Stack gap={1} wrap="wrap">
                      {lessons.slice(0, 5).map((l) => {
                        const color = l.expand?.program?.expand?.area?.color;
                        const isCompleted = l.status === "completed";
                        const isOverdueNotStarted =
                          !isCompleted && isPast && l.status === "not_started";
                        const isOverdueInProgress =
                          !isCompleted && isPast && l.status === "active";
                        const isOverdue =
                          isOverdueNotStarted || isOverdueInProgress;
                        return (
                          <AppLink key={l.id} to={`/lessons/${l.id}`}>
                            <HStack gap={1}>
                              {isCompleted ? (
                                <Box
                                  w="6px"
                                  h="6px"
                                  borderRadius="full"
                                  flexShrink={0}
                                  bg="green.500"
                                />
                              ) : isOverdue ? (
                                <Box
                                  w="6px"
                                  h="6px"
                                  flexShrink={0}
                                  bg={
                                    isOverdueNotStarted
                                      ? "red.500"
                                      : "orange.400"
                                  }
                                  transform="rotate(45deg)"
                                />
                              ) : color ? (
                                <Box
                                  w="6px"
                                  h="6px"
                                  borderRadius="full"
                                  flexShrink={0}
                                  bg={color}
                                />
                              ) : null}
                              <Text
                                fontSize="xs"
                                fontWeight="medium"
                                color={
                                  isCompleted
                                    ? "green.fg"
                                    : isOverdueNotStarted
                                      ? "red.fg"
                                      : isOverdueInProgress
                                        ? "orange.fg"
                                        : "colorPalette.fg"
                                }
                                textDecoration={
                                  isCompleted ? "line-through" : undefined
                                }
                              >
                                {l.title}
                              </Text>
                            </HStack>
                          </AppLink>
                        );
                      })}
                      {lessons.length > 5 && (
                        <Text fontSize="xs" color="fg.muted">
                          +{lessons.length - 5} more
                        </Text>
                      )}
                    </Stack>
                  </Stack>
                )}
              </HStack>
            );
          })}
        </Stack>
      </Stack>
    </Stack>
  );
}
