import { CourseSessionCard } from "@/components/cards/CourseSessionCard";
import { toPbDate } from "@/lib/dates";
import { listAreas } from "@/lib/services/areaService";
import { listCourseSessions } from "@/lib/services/courseSessionService";
import { listPrograms } from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import type { Area, CourseSession, Program } from "@/types/domain";
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

export default function Calendar() {
  const qc = useQueryClient();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

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

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const courses = allPrograms.filter((p) => p.type === "course");

  // Build date window: full view month + ahead_weeks buffer
  const windowStart = startOfMonth(viewYear, viewMonth);
  const windowEnd = new Date(viewYear, viewMonth + 1, 0); // last day of view month
  // extend by ahead_weeks
  const aheadEnd = new Date(today);
  aheadEnd.setDate(aheadEnd.getDate() + aheadWeeks * 7);
  const fetchEnd = windowEnd > aheadEnd ? windowEnd : aheadEnd;

  const { data: sessions = [] } = useQuery<CourseSession[]>({
    queryKey: ["course_sessions", "calendar", viewYear, viewMonth, aheadWeeks],
    queryFn: () =>
      listCourseSessions({
        dateFrom: toPbDate(windowStart),
        dateTo: toPbDate(fetchEnd),
      }),
    enabled: courses.length > 0,
  });

  // Map course id → area hex color
  const courseColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    courses.forEach((c) => {
      const area = areas.find((a) => a.id === c.area);
      map[c.id] = area?.color ?? "#6366f1";
    });
    return map;
  }, [courses, areas]);

  // Map course id → course name
  const courseNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    courses.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [courses]);

  // Group sessions by YYYY-MM-DD
  const sessionsByDate = useMemo(() => {
    const map: Record<string, CourseSession[]> = {};
    sessions.forEach((s) => {
      const key = s.date.split(" ")[0].split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  // Calendar grid construction
  const firstDayOfMonth = startOfMonth(viewYear, viewMonth).getDay(); // 0=Sun
  const totalDays = daysInMonth(viewYear, viewMonth);
  // padding cells before day 1
  const leadingBlanks = firstDayOfMonth;
  const totalCells = leadingBlanks + totalDays;
  const trailingBlanks = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedSessions = selectedDate
    ? (sessionsByDate[selectedDate] ?? [])
    : [];

  const invalidateSessions = () => {
    void qc.invalidateQueries({ queryKey: ["course_sessions"] });
  };

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

      {courses.length === 0 ? (
        <Box
          p={12}
          textAlign="center"
          borderWidth={1}
          borderRadius="md"
          borderStyle="dashed"
        >
          <Text color="fg.muted">
            No courses yet. Create a program with type "course" to get started.
          </Text>
        </Box>
      ) : (
        <>
          {/* Legend */}
          <HStack gap={4} flexWrap="wrap">
            {courses.map((c) => (
              <HStack key={c.id} gap={1}>
                <Box
                  w={3}
                  h={3}
                  borderRadius="full"
                  bg={courseColorMap[c.id] ?? "blue.500"}
                />
                <Text fontSize="xs" color="fg.muted">
                  {c.name}
                </Text>
              </HStack>
            ))}
          </HStack>

          {/* Calendar grid */}
          <Box borderWidth={1} borderRadius="md" overflow="hidden">
            {/* Weekday headers */}
            <Grid templateColumns="repeat(7, 1fr)" bg="bg.muted">
              {WEEKDAY_LABELS.map((d) => (
                <Box key={d} p={2} textAlign="center">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.subtle">
                    {d}
                  </Text>
                </Box>
              ))}
            </Grid>

            {/* Day cells */}
            <Grid templateColumns="repeat(7, 1fr)">
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
                const daysSessions = sessionsByDate[dateKey] ?? [];
                const isSelected = selectedDate === dateKey;

                return (
                  <Box
                    key={dateKey}
                    minH="80px"
                    borderTopWidth={1}
                    borderRightWidth={1}
                    p={1}
                    cursor={daysSessions.length > 0 ? "pointer" : "default"}
                    bg={
                      isSelected
                        ? "colorPalette.subtle"
                        : isToday
                          ? "blue.subtle"
                          : "bg.canvas"
                    }
                    borderColor={
                      isSelected ? "colorPalette.emphasized" : undefined
                    }
                    onClick={() =>
                      daysSessions.length > 0 &&
                      setSelectedDate(isSelected ? null : dateKey)
                    }
                    _hover={
                      daysSessions.length > 0 ? { bg: "bg.muted" } : undefined
                    }
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
                    <Stack gap={0.5}>
                      {daysSessions.map((s) => (
                        <Badge
                          key={s.id}
                          size="sm"
                          variant="solid"
                          style={{
                            backgroundColor:
                              courseColorMap[s.course] ?? "#6366f1",
                            opacity:
                              s.status === "missed"
                                ? 0.45
                                : s.status === "completed"
                                  ? 0.65
                                  : 1,
                          }}
                          fontSize="2xs"
                          truncate
                        >
                          {courseNameMap[s.course] ?? "Course"}
                        </Badge>
                      ))}
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

          {/* Selected day detail */}
          {selectedDate && selectedSessions.length > 0 && (
            <Stack gap={3}>
              <Text fontWeight="semibold" fontSize="sm" color="fg.muted">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                  undefined,
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </Text>
              {selectedSessions.map((s) => (
                <CourseSessionCard
                  key={s.id}
                  session={s}
                  onUpdated={invalidateSessions}
                  courseName={courseNameMap[s.course]}
                  areaColor={courseColorMap[s.course]}
                />
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
