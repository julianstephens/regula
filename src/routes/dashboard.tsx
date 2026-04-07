import { StatusBadge } from "@/components/cards/StatusBadge";
import { AppLink } from "@/components/ui/app-link";
import {
  DEFAULT_BLOCK_WEEKS,
  getBlockWeekNumber,
  getRestWeek,
} from "@/lib/blocks";
import {
  endOfDay,
  formatDate,
  isOverdue,
  startOfDay,
  toPbDate,
} from "@/lib/dates";
import pb from "@/lib/pocketbase";
import { listCourseSessions } from "@/lib/services/courseSessionService";
import { listPrograms } from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import { listStudyItems } from "@/lib/services/studyItemService";
import type { CourseSession, Program, StudyItem } from "@/types/domain";
import {
  Badge,
  Box,
  Heading,
  HStack,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

function AllClearCard() {
  return (
    <Box
      p={6}
      borderWidth={1}
      borderRadius="lg"
      bg="green.subtle"
      borderColor="green.emphasized"
      textAlign="center"
    >
      <Text fontSize="2xl" mb={1}>
        ✓
      </Text>
      <Text fontWeight="semibold" color="green.fg" fontSize="md">
        All caught up
      </Text>
      <Text color="fg.muted" fontSize="sm" mt={1}>
        No sessions today and no overdue assignments.
      </Text>
    </Box>
  );
}

function BlockStatusCard({
  program,
  globalDefault,
  today,
}: {
  program: Program;
  globalDefault: number;
  today: Date;
}) {
  const weekNum = getBlockWeekNumber(today, program, globalDefault);
  const restWeek = getRestWeek(program, globalDefault);
  const inRest = restWeek && today >= restWeek.start && today <= restWeek.end;
  const totalWeeks = program.block_weeks ?? globalDefault;

  if (!weekNum && !inRest) return null;

  return (
    <Box
      p={4}
      borderWidth={2}
      borderRadius="lg"
      bg={inRest ? "orange.subtle" : "blue.subtle"}
      borderColor={inRest ? "orange.emphasized" : "blue.emphasized"}
    >
      <HStack justify="space-between">
        <Stack gap={0}>
          <Text fontWeight="semibold" fontSize="sm">
            {program.name}
          </Text>
          {inRest ? (
            <Text fontSize="lg" fontWeight="bold" color="orange.fg">
              Rest Week
            </Text>
          ) : (
            <Text fontSize="lg" fontWeight="bold" color="blue.fg">
              Week {weekNum} of {totalWeeks}
            </Text>
          )}
        </Stack>
        <Stack gap={0} textAlign="right">
          {inRest && restWeek ? (
            <Text fontSize="sm" color="fg.muted">
              Resumes{" "}
              {new Date(restWeek.end.getTime() + 86400000).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" },
              )}
            </Text>
          ) : restWeek ? (
            <Text fontSize="sm" color="fg.muted">
              Rest week starts{" "}
              {restWeek.start.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
          ) : null}
        </Stack>
      </HStack>
    </Box>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();

  const today = startOfDay();
  const todayEnd = endOfDay();

  // Next 7 days for upcoming homework
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const { data: todaySessions = [] } = useQuery<CourseSession[]>({
    queryKey: ["dashboard", "today_sessions"],
    queryFn: () =>
      listCourseSessions({
        dateFrom: toPbDate(today),
        dateTo: toPbDate(todayEnd),
      }),
  });

  const { data: allItems = [] } = useQuery<StudyItem[]>({
    queryKey: ["dashboard", "all"],
    queryFn: () => listStudyItems({ sort: "due_date" }),
  });

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const { data: allPrograms = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const globalDefault = settings?.block_weeks ?? DEFAULT_BLOCK_WEEKS;
  const activeBlocks = allPrograms.filter(
    (p) => p.type === "block" && p.status === "active",
  );

  const overdueItems = allItems.filter((i) => isOverdue(i.due_date, i.status));

  const upcomingHomework = allItems.filter(
    (i) =>
      !["completed", "cancelled"].includes(i.status) &&
      i.due_date &&
      new Date(i.due_date) >= today &&
      new Date(i.due_date) <= weekEnd,
  );

  const inProgress = allItems.filter((i) => i.status === "in_progress");

  const allClear =
    todaySessions.length === 0 &&
    overdueItems.length === 0 &&
    inProgress.length === 0 &&
    upcomingHomework.length === 0;

  // Realtime subscriptions for dashboard refresh
  useEffect(() => {
    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;

    void pb
      .collection("regula_course_sessions")
      .subscribe("*", () => {
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .then((fn) => {
        unsub1 = fn;
      });

    void pb
      .collection("regula_study_items")
      .subscribe("*", () => {
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .then((fn) => {
        unsub2 = fn;
      });

    return () => {
      void pb.collection("regula_course_sessions").unsubscribe("*");
      void pb.collection("regula_study_items").unsubscribe("*");
      unsub1?.();
      unsub2?.();
    };
  }, [qc]);

  return (
    <Stack id="dashboard" gap={8}>
      <Heading size="lg">Dashboard</Heading>

      {/* Active block status */}
      {activeBlocks.length > 0 && (
        <Stack id="dashboard-active-blocks" gap={3}>
          {activeBlocks.map((p) => (
            <BlockStatusCard
              key={p.id}
              program={p}
              globalDefault={globalDefault}
              today={today}
            />
          ))}
        </Stack>
      )}

      {allClear && <AllClearCard />}

      {/* Today's sessions */}
      {todaySessions.length > 0 && (
        <Stack id="dashboard-today-sessions" gap={3}>
          <Heading size="md">Today's Sessions</Heading>
          <Stack gap={3}>
            {todaySessions.map((cs) => (
              <Box
                key={cs.id}
                p={4}
                borderWidth={1}
                borderRadius="md"
                bg="bg.subtle"
              >
                <HStack justify="space-between" mb={cs.notes ? 2 : 0}>
                  <Text fontWeight="semibold" fontSize="sm">
                    {cs.expand?.course?.name ?? "—"}
                  </Text>
                  <Badge
                    variant="subtle"
                    colorPalette={
                      cs.status === "completed"
                        ? "green"
                        : cs.status === "missed"
                          ? "red"
                          : "gray"
                    }
                  >
                    {cs.status}
                  </Badge>
                </HStack>
                {cs.notes && (
                  <Text fontSize="sm" color="fg.muted" whiteSpace="pre-wrap">
                    {cs.notes}
                  </Text>
                )}
              </Box>
            ))}
          </Stack>
        </Stack>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <Stack id="dashboard-in-progress" gap={3}>
          <Heading size="md">In Progress</Heading>
          <Stack gap={2}>
            {inProgress.map((item) => (
              <HStack
                key={item.id}
                p={3}
                borderWidth={1}
                borderRadius="md"
                bg="bg.subtle"
                justify="space-between"
              >
                <AppLink
                  to={`/study-items/${item.id}`}
                  fontWeight="medium"
                  color="colorPalette.fg"
                >
                  {item.title}
                </AppLink>
                <HStack>
                  {item.expand?.area && (
                    <Badge variant="subtle" colorPalette="gray">
                      {item.expand.area.name}
                    </Badge>
                  )}
                  <StatusBadge status={item.status} />
                </HStack>
              </HStack>
            ))}
          </Stack>
        </Stack>
      )}

      {/* Overdue */}
      {overdueItems.length > 0 && (
        <Stack id="dashboard-overdue" gap={3}>
          <Heading size="md" color="red.fg">
            Overdue
          </Heading>
          <Table.Root variant="outline">
            <Table.Body>
              {overdueItems.slice(0, 10).map((item) => (
                <Table.Row key={item.id} bg="red.subtle">
                  <Table.Cell>
                    <AppLink
                      to={`/study-items/${item.id}`}
                      fontWeight="medium"
                      color="red.fg"
                    >
                      {item.title}
                    </AppLink>
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.area?.name ?? "—"}
                  </Table.Cell>
                  <Table.Cell color="red.fg" whiteSpace="nowrap">
                    {formatDate(item.due_date)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Stack>
      )}

      {/* Upcoming homework (next 7 days) */}
      {upcomingHomework.length > 0 && (
        <Stack id="dashboard-upcoming" gap={3}>
          <Heading size="md">Due This Week</Heading>
          <Table.Root variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Assignment</Table.ColumnHeader>
                <Table.ColumnHeader>Area</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Due</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {upcomingHomework.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <AppLink
                      to={`/study-items/${item.id}`}
                      fontWeight="medium"
                      color="colorPalette.fg"
                    >
                      {item.title}
                    </AppLink>
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.area?.name ?? "—"}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={item.status} />
                  </Table.Cell>
                  <Table.Cell color="fg.muted" whiteSpace="nowrap">
                    {formatDate(item.due_date)}
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
