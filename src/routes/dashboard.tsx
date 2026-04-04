import { StatusBadge } from "@/components/cards/StatusBadge";
import { AppLink } from "@/components/ui/app-link";
import {
  DEFAULT_BLOCK_WEEKS,
  getBlockWeekNumber,
  getRestWeek,
} from "@/lib/blocks";
import { endOfDay, isOverdue, startOfDay, startOfWeek } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import pb from "@/lib/pocketbase";
import { listAreas } from "@/lib/services/areaService";
import { listPrograms } from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import { listStudyItems } from "@/lib/services/studyItemService";
import { listSessions } from "@/lib/services/studySessionService";
import type { Program, StudyItem } from "@/types/domain";
import {
  Badge,
  Box,
  Grid,
  Heading,
  HStack,
  Stack,
  Stat,
  Table,
  Text,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Box p={4} borderWidth={1} borderRadius="lg" bg="bg.subtle">
      <Stat.Root>
        <Stat.Label>{label}</Stat.Label>
        <Stat.ValueText>{value}</Stat.ValueText>
        {sub && <Stat.HelpText>{sub}</Stat.HelpText>}
      </Stat.Root>
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
  const weekStart = startOfWeek();

  const { data: todayItems = [] } = useQuery<StudyItem[]>({
    queryKey: ["dashboard", "today"],
    queryFn: () =>
      listStudyItems({
        sort: "due_date",
      }).then((items) =>
        items.filter(
          (i) =>
            !["completed", "cancelled"].includes(i.status) &&
            ((i.scheduled_date &&
              new Date(i.scheduled_date) >= today &&
              new Date(i.scheduled_date) <= todayEnd) ||
              (i.status === "planned" &&
                i.due_date &&
                new Date(i.due_date) >= today &&
                new Date(i.due_date) <= todayEnd)),
        ),
      ),
  });

  const { data: inProgress = [] } = useQuery<StudyItem[]>({
    queryKey: ["dashboard", "in_progress"],
    queryFn: () => listStudyItems({ status: "in_progress", sort: "-updated" }),
  });

  const { data: allItems = [] } = useQuery<StudyItem[]>({
    queryKey: ["dashboard", "all"],
    queryFn: () => listStudyItems({}),
  });

  const { data: weeklySessions = [] } = useQuery({
    queryKey: ["dashboard", "weekly_sessions"],
    queryFn: () => listSessions({ dateFrom: weekStart.toISOString() }),
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

  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const overdueItems = allItems.filter((i) => isOverdue(i.due_date, i.status));
  const recentCompletions = allItems
    .filter((i) => i.status === "completed" && i.completion_date)
    .sort(
      (a, b) =>
        new Date(b.completion_date).getTime() -
        new Date(a.completion_date).getTime(),
    )
    .slice(0, 5);

  const weeklyMinutes = weeklySessions.reduce(
    (s, sess) => s + (sess.duration_minutes ?? 0),
    0,
  );

  // Area summary: minutes this week per area
  const areaSummary = areas
    .map((area) => {
      const mins = weeklySessions
        .filter((s) => s.area === area.id)
        .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
      return { area, mins };
    })
    .filter((a) => a.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  // Realtime subscriptions for dashboard refresh
  useEffect(() => {
    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;

    void pb
      .collection("regula_study_sessions")
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
      void pb.collection("regula_study_sessions").unsubscribe("*");
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

      {/* Stats row */}
      <Grid id="dashboard-stats" templateColumns="repeat(auto-fill, minmax(180px, 1fr))" gap={4}>
        <StatCard label="In Progress" value={inProgress.length} />
        <StatCard label="Today Scheduled" value={todayItems.length} />
        <StatCard label="Overdue" value={overdueItems.length} />
        <StatCard label="This Week Time" value={formatMinutes(weeklyMinutes)} />
        <StatCard label="Sessions This Week" value={weeklySessions.length} />
      </Grid>

      {/* In Progress */}
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

      {/* Today Scheduled */}
      {todayItems.length > 0 && (
        <Stack id="dashboard-today-scheduled" gap={3}>
          <Heading size="md">Today</Heading>
          <Table.Root variant="outline">
            <Table.Body>
              {todayItems.map((item) => (
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
                  <Table.Cell>
                    <StatusBadge status={item.status} />
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.area?.name ?? "—"}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
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
                  <Table.Cell>
                    <StatusBadge status={item.status} />
                  </Table.Cell>
                  <Table.Cell color="fg.muted">
                    {item.expand?.area?.name ?? "—"}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Stack>
      )}

      {/* Recent Completions */}
      {recentCompletions.length > 0 && (
        <Stack id="dashboard-recent-completions" gap={3}>
          <Heading size="md">Recent Completions</Heading>
          <Stack gap={2}>
            {recentCompletions.map((item) => (
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
                <Badge colorPalette="green" variant="subtle">
                  Completed
                </Badge>
              </HStack>
            ))}
          </Stack>
        </Stack>
      )}

      {/* Area Summary */}
      {areaSummary.length > 0 && (
        <Stack id="dashboard-area-summary" gap={3}>
          <Heading size="md">This Week by Area</Heading>
          <HStack gap={4} flexWrap="wrap">
            {areaSummary.map(({ area, mins }) => (
              <Box
                key={area.id}
                p={3}
                borderWidth={1}
                borderRadius="md"
                bg="bg.subtle"
                minW="140px"
              >
                <HStack mb={1}>
                  <Box
                    w={3}
                    h={3}
                    borderRadius="sm"
                    bg={area.color || "gray.400"}
                  />
                  <Text fontWeight="medium" fontSize="sm">
                    {area.name}
                  </Text>
                </HStack>
                <Text color="fg.muted" fontSize="sm">
                  {formatMinutes(mins)}
                </Text>
              </Box>
            ))}
          </HStack>
        </Stack>
      )}
    </Stack>
  );
}
