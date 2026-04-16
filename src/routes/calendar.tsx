import { StatusBadge } from "@/components/cards/StatusBadge";
import { AppLink } from "@/components/ui/app-link";
import { toPbDate } from "@/lib/dates";
import { listLessons } from "@/lib/services/lessonService";
import { listPrograms } from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import { listVacations } from "@/lib/services/vacationService";
import type { Lesson, Program, Vacation } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

const DEFAULT_AHEAD_WEEKS = 1;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const FALLBACK_DOT_COLOR = "gray.400";

export default function Calendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });
  const aheadWeeks = settings?.ahead_weeks ?? DEFAULT_AHEAD_WEEKS;

  const { data: allPrograms = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const { data: vacations = [] } = useQuery<Vacation[]>({
    queryKey: ["vacations"],
    queryFn: listVacations,
  });

  // Build date window for fetch
  const windowStart = startOfMonth(viewYear, viewMonth);
  const windowEnd = new Date(viewYear, viewMonth + 1, 0);
  const aheadEnd = new Date(today);
  aheadEnd.setDate(aheadEnd.getDate() + aheadWeeks * 7);
  const fetchEnd = windowEnd > aheadEnd ? windowEnd : aheadEnd;

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["lessons", "calendar", viewYear, viewMonth, aheadWeeks],
    queryFn: () =>
      listLessons({
        calendarStart: toPbDate(windowStart),
        calendarEnd: toPbDate(fetchEnd),
        sort: "due_at",
      }),
  });

  // Map program id → name
  const programNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    allPrograms.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [allPrograms]);

  // Map program id → area color, and collect unique areas for the legend
  const { programAreaColorMap, areaLegend } = useMemo(() => {
    const colorMap: Record<string, string> = {};
    const seen = new Map<string, { name: string; color: string }>();
    allPrograms.forEach((p) => {
      const area = p.expand?.area;
      if (area?.color) {
        colorMap[p.id] = area.color;
        if (!seen.has(area.id))
          seen.set(area.id, { name: area.name, color: area.color });
      }
    });
    return {
      programAreaColorMap: colorMap,
      areaLegend: Array.from(seen.values()),
    };
  }, [allPrograms]);

  // Group lessons by available_on date (YYYY-MM-DD)
  const lessonsByDate = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    lessons.forEach((l) => {
      const dateStr = l.available_on || l.due_at;
      if (!dateStr) return;
      const key = dateStr.split("T")[0].split(" ")[0];
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    return map;
  }, [lessons]);

  // Build vacation date set
  const vacationDateSet = useMemo(() => {
    const dateSet = new Set<string>();
    vacations.forEach((v) => {
      const start = new Date(v.start_date + "T12:00:00");
      const end = new Date(v.end_date + "T12:00:00");
      const cur = new Date(start);
      while (cur <= end) {
        dateSet.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return dateSet;
  }, [vacations]);

  // Vacation strategy label for selected-date panel
  const vacationByDate = useMemo(() => {
    const map: Record<string, Vacation> = {};
    vacations.forEach((v) => {
      const start = new Date(v.start_date + "T12:00:00");
      const end = new Date(v.end_date + "T12:00:00");
      const cur = new Date(start);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        if (!map[key]) map[key] = v;
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [vacations]);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Overdue/completed lesson flags for legend
  const { hasOverdueNotStarted, hasOverdueInProgress, hasCompleted } =
    useMemo(() => {
      let notStarted = false;
      let inProgress = false;
      let completed = false;
      lessons.forEach((l) => {
        if (l.status === "completed") {
          completed = true;
          return;
        }
        const dueDateKey = l.due_at
          ? l.due_at.split("T")[0].split(" ")[0]
          : null;
        if (!dueDateKey || dueDateKey >= todayKey) return;
        if (l.status === "not_started") notStarted = true;
        if (l.status === "active") inProgress = true;
      });
      return {
        hasOverdueNotStarted: notStarted,
        hasOverdueInProgress: inProgress,
        hasCompleted: completed,
      };
    }, [lessons, todayKey]);

  // Calendar grid construction
  const firstDayOfMonth = startOfMonth(viewYear, viewMonth).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = firstDayOfMonth;
  const totalCells = leadingBlanks + totalDays;
  const trailingBlanks = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  const selectedLessons = selectedDate
    ? (lessonsByDate[selectedDate] ?? [])
    : [];

  const closeDetail = () => setSelectedDate(null);

  return (
    <Stack id="calendar" gap={6}>
      <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="lg">Calendar</Heading>
        <HStack gap={2}>
          <Button size="sm" variant="outline" onClick={prevMonth}>
            ←
          </Button>
          <Text fontWeight="semibold" minW="160px" textAlign="center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <Button size="sm" variant="outline" onClick={nextMonth}>
            →
          </Button>
        </HStack>
      </Flex>

      {/* Area legend */}
      {(areaLegend.length > 0 || vacationDateSet.size > 0) && (
        <HStack id="area-legend" gap={4} flexWrap="wrap">
          {areaLegend.map((a) => (
            <HStack key={a.name} gap={1.5}>
              <Box
                w="8px"
                h="8px"
                borderRadius="full"
                bg={a.color}
                flexShrink={0}
              />
              <Text fontSize="xs" color="fg.muted">
                {a.name}
              </Text>
            </HStack>
          ))}
          {vacationDateSet.size > 0 && (
            <HStack gap={1.5}>
              <Box
                w="8px"
                h="8px"
                borderRadius="sm"
                bg="orange.subtle"
                borderWidth={1}
                borderColor="orange.emphasized"
                flexShrink={0}
              />
              <Text fontSize="xs" color="fg.muted">
                Vacation
              </Text>
            </HStack>
          )}
          {hasOverdueNotStarted && (
            <HStack gap={1.5}>
              <Box
                w="6px"
                h="6px"
                bg="red.500"
                transform="rotate(45deg)"
                flexShrink={0}
              />
              <Text fontSize="xs" color="fg.muted">
                Not started (past due)
              </Text>
            </HStack>
          )}
          {hasOverdueInProgress && (
            <HStack gap={1.5}>
              <Box
                w="6px"
                h="6px"
                bg="orange.400"
                transform="rotate(45deg)"
                flexShrink={0}
              />
              <Text fontSize="xs" color="fg.muted">
                In progress (past due)
              </Text>
            </HStack>
          )}
          {hasCompleted && (
            <HStack gap={1.5}>
              <Box
                w="8px"
                h="8px"
                borderRadius="full"
                bg="green.500"
                flexShrink={0}
              />
              <Text fontSize="xs" color="fg.muted">
                Completed
              </Text>
            </HStack>
          )}
        </HStack>
      )}

      {/* Calendar grid */}
      <Box
        id="calendar-grid"
        borderWidth={1}
        borderRadius="md"
        overflow="hidden"
      >
        {/* Weekday headers */}
        <Grid
          id="weekday-headers"
          templateColumns="repeat(7, 1fr)"
          bg="bg.muted"
        >
          {WEEKDAY_LABELS.map((d) => (
            <Box key={d} p={2} textAlign="center">
              <Text fontSize="xs" fontWeight="semibold" color="fg.subtle">
                {d}
              </Text>
            </Box>
          ))}
        </Grid>

        {/* Day cells */}
        <Grid id="day-cells" templateColumns="repeat(7, 1fr)">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <Box
              key={`blank-start-${i}`}
              minH="80px"
              borderTopWidth={1}
              borderRightWidth={1}
              bg="bg.subtle"
              opacity={0.4}
            />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateKey === todayKey;
            const isPastDate = dateKey < todayKey;
            const dayLessons = lessonsByDate[dateKey] ?? [];
            const isSelected = selectedDate === dateKey;
            const isVacation = vacationDateSet.has(dateKey);

            return (
              <Box
                key={dateKey}
                minH="80px"
                borderTopWidth={1}
                borderRightWidth={1}
                p={1}
                cursor={dayLessons.length > 0 ? "pointer" : "default"}
                bg={
                  isSelected
                    ? "colorPalette.subtle"
                    : isToday
                      ? "blue.subtle"
                      : isVacation
                        ? "orange.subtle"
                        : "bg.canvas"
                }
                borderColor={isSelected ? "colorPalette.emphasized" : undefined}
                onClick={() =>
                  dayLessons.length > 0 && setSelectedDate(dateKey)
                }
                _hover={dayLessons.length > 0 ? { bg: "bg.muted" } : undefined}
                transition="background 0.1s"
              >
                <Text
                  fontSize="xs"
                  fontWeight={isToday ? "bold" : "normal"}
                  color={isToday ? "blue.fg" : "fg"}
                  mb={1}
                >
                  {day}
                </Text>
                <Stack id={`day-lessons-${dateKey}`} gap={0.5}>
                  {dayLessons.slice(0, 3).map((l) => {
                    const dueDateKey = l.due_at
                      ? l.due_at.split("T")[0].split(" ")[0]
                      : null;
                    const isCompleted = l.status === "completed";
                    const isOverdueNotStarted =
                      !isCompleted &&
                      isPastDate &&
                      dueDateKey !== null &&
                      dueDateKey < todayKey &&
                      l.status === "not_started";
                    const isOverdueInProgress =
                      !isCompleted &&
                      isPastDate &&
                      dueDateKey !== null &&
                      dueDateKey < todayKey &&
                      l.status === "active";
                    const isOverdue =
                      isOverdueNotStarted || isOverdueInProgress;
                    return (
                      <Box
                        key={l.id}
                        display="flex"
                        alignItems="center"
                        gap="4px"
                      >
                        <Box
                          w="6px"
                          h="6px"
                          borderRadius={isOverdue ? "none" : "full"}
                          bg={
                            isCompleted
                              ? "green.500"
                              : isOverdueNotStarted
                                ? "red.500"
                                : isOverdueInProgress
                                  ? "orange.400"
                                  : (programAreaColorMap[l.program] ??
                                    FALLBACK_DOT_COLOR)
                          }
                          flexShrink={0}
                          transform={isOverdue ? "rotate(45deg)" : undefined}
                        />
                        <Text
                          textAlign="left"
                          fontSize="2xs"
                          lineClamp={1}
                          overflow="hidden"
                          w="full"
                          color={
                            isCompleted
                              ? "green.fg"
                              : isOverdueNotStarted
                                ? "red.fg"
                                : isOverdueInProgress
                                  ? "orange.fg"
                                  : "fg"
                          }
                          textDecoration={
                            isCompleted ? "line-through" : undefined
                          }
                        >
                          {l.title}
                        </Text>
                      </Box>
                    );
                  })}
                  {dayLessons.length > 3 && (
                    <Text fontSize="2xs" color="fg.muted">
                      +{dayLessons.length - 3} more
                    </Text>
                  )}
                </Stack>
              </Box>
            );
          })}
          {Array.from({ length: trailingBlanks }).map((_, i) => (
            <Box
              key={`blank-end-${i}`}
              minH="80px"
              borderTopWidth={1}
              borderRightWidth={1}
              bg="bg.subtle"
              opacity={0.4}
            />
          ))}
        </Grid>
      </Box>

      {/* Selected day dialog */}
      <Dialog.Root
        open={!!selectedDate && selectedLessons.length > 0}
        onOpenChange={(e) => {
          if (!e.open) closeDetail();
        }}
        placement="center"
        motionPreset="slide-in-bottom"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="lg">
            <Dialog.Header>
              <Dialog.Title>
                {selectedDate
                  ? new Date(selectedDate + "T12:00:00").toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )
                  : ""}
              </Dialog.Title>
              <IconButton
                aria-label="Close"
                variant="ghost"
                size="sm"
                onClick={closeDetail}
                ml="auto"
              >
                ✕
              </IconButton>
            </Dialog.Header>
            <Dialog.Body pb={6}>
              <Stack id="selected-lessons-stack" gap={3}>
                {selectedDate && vacationByDate[selectedDate] && (
                  <Box
                    id={`vacation-${selectedDate}`}
                    p={3}
                    borderWidth={1}
                    borderRadius="md"
                    bg="orange.subtle"
                    borderColor="orange.emphasized"
                  >
                    <HStack gap={2}>
                      <Text fontWeight="medium" fontSize="sm" color="orange.fg">
                        {vacationByDate[selectedDate].name}
                      </Text>
                      <Badge colorPalette="orange" variant="subtle" size="sm">
                        {vacationByDate[selectedDate].strategy.replace(
                          /_/g,
                          " ",
                        )}
                      </Badge>
                    </HStack>
                  </Box>
                )}
                {selectedLessons.map((l) => (
                  <Box
                    id={`selected-lesson-${l.id}`}
                    key={l.id}
                    p={3}
                    borderWidth={1}
                    borderRadius="md"
                    bg="bg.subtle"
                  >
                    <Flex justify="space-between" align="start" gap={2}>
                      <Stack gap={0}>
                        <AppLink
                          textAlign="left"
                          to={`/lessons/${l.id}`}
                          fontWeight="medium"
                          color="colorPalette.fg"
                          onClick={closeDetail}
                        >
                          {l.title}
                        </AppLink>
                        {l.expand?.program && (
                          <Text textAlign="left" fontSize="xs" color="fg.muted">
                            {l.expand.program.name}
                          </Text>
                        )}
                        {!l.expand?.program &&
                          l.program &&
                          programNameMap[l.program] && (
                            <Text fontSize="xs" color="fg.muted">
                              {programNameMap[l.program]}
                            </Text>
                          )}
                      </Stack>
                      <HStack id={`selected-lesson-${l.id}-badges`} gap={2}>
                        {selectedDate &&
                          selectedDate < todayKey &&
                          l.status === "not_started" && (
                            <Badge
                              colorPalette="red"
                              variant="subtle"
                              size="sm"
                            >
                              Past Due
                            </Badge>
                          )}
                        {selectedDate &&
                          selectedDate < todayKey &&
                          l.status === "active" && (
                            <Badge
                              colorPalette="orange"
                              variant="subtle"
                              size="sm"
                            >
                              Past Due
                            </Badge>
                          )}
                        {l.type && (
                          <Badge variant="subtle" size="sm">
                            {l.type}
                          </Badge>
                        )}
                        <StatusBadge status={l.status} />
                      </HStack>
                    </Flex>
                  </Box>
                ))}
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
}
