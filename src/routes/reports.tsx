import { isOverdue, startOfWeek } from "@/lib/dates";
import { formatMinutes, formatNumber } from "@/lib/format";
import { listAreas } from "@/lib/services/areaService";
import { listStudyItems } from "@/lib/services/studyItemService";
import { listSessions } from "@/lib/services/studySessionService";
import type { Area, StudyItem, StudySession } from "@/types/domain";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Stat,
  Table,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type ReportType =
  | "minutes_by_area"
  | "completed_by_area"
  | "overdue_count"
  | "velocity_by_week"
  | "sessions_per_week";

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - d.getDay());
  return weekStart.toISOString().slice(0, 10);
}

function MinutesByArea({
  sessions,
  areas,
}: {
  sessions: StudySession[];
  areas: Area[];
}) {
  const rows = areas
    .map((area) => {
      const mins = sessions
        .filter((s) => s.area === area.id)
        .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
      return { area, mins };
    })
    .filter((r) => r.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const maxMins = rows[0]?.mins ?? 1;

  if (rows.length === 0)
    return <Text color="fg.muted">No sessions in this period.</Text>;

  return (
    <Stack gap={2}>
      {rows.map(({ area, mins }) => (
        <Box key={area.id}>
          <HStack justify="space-between" mb={1}>
            <HStack>
              <Box
                w={3}
                h={3}
                borderRadius="sm"
                bg={area.color || "gray.400"}
              />
              <Text fontSize="sm" fontWeight="medium">
                {area.name}
              </Text>
            </HStack>
            <Text fontSize="sm" color="fg.muted">
              {formatMinutes(mins)}
            </Text>
          </HStack>
          <Box h={2} borderRadius="full" bg="bg.muted" overflow="hidden">
            <Box
              h="full"
              borderRadius="full"
              bg="colorPalette.solid"
              w={`${(mins / maxMins) * 100}%`}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function CompletedByArea({
  items,
  areas,
}: {
  items: StudyItem[];
  areas: Area[];
}) {
  const completed = items.filter((i) => i.status === "completed");
  const rows = areas
    .map((area) => ({
      area,
      count: completed.filter((i) => i.area === area.id).length,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  if (rows.length === 0)
    return <Text color="fg.muted">No completed items in this period.</Text>;

  return (
    <Table.Root variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Area</Table.ColumnHeader>
          <Table.ColumnHeader>Completed Items</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map(({ area, count }) => (
          <Table.Row key={area.id}>
            <Table.Cell>
              <HStack>
                <Box
                  w={3}
                  h={3}
                  borderRadius="sm"
                  bg={area.color || "gray.400"}
                />
                <Text>{area.name}</Text>
              </HStack>
            </Table.Cell>
            <Table.Cell>{formatNumber(count)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

function VelocityByWeek({ items }: { items: StudyItem[] }) {
  const completed = items.filter(
    (i) => i.status === "completed" && i.completion_date,
  );
  const byWeek: Record<string, number> = {};
  completed.forEach((i) => {
    const key = getWeekKey(i.completion_date);
    byWeek[key] = (byWeek[key] ?? 0) + 1;
  });
  const rows = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b));

  if (rows.length === 0)
    return <Text color="fg.muted">No completions yet.</Text>;

  return (
    <Table.Root variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Week of</Table.ColumnHeader>
          <Table.ColumnHeader>Items Completed</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map(([week, count]) => (
          <Table.Row key={week}>
            <Table.Cell>{week}</Table.Cell>
            <Table.Cell>{count}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

function SessionsPerWeek({ sessions }: { sessions: StudySession[] }) {
  const byWeek: Record<string, { count: number; minutes: number }> = {};
  sessions.forEach((s) => {
    if (!s.started_at) return;
    const key = getWeekKey(s.started_at);
    if (!byWeek[key]) byWeek[key] = { count: 0, minutes: 0 };
    byWeek[key].count++;
    byWeek[key].minutes += s.duration_minutes ?? 0;
  });
  const rows = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b));

  if (rows.length === 0) return <Text color="fg.muted">No sessions yet.</Text>;

  return (
    <Table.Root variant="outline">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Week of</Table.ColumnHeader>
          <Table.ColumnHeader>Sessions</Table.ColumnHeader>
          <Table.ColumnHeader>Total Time</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map(([week, { count, minutes }]) => (
          <Table.Row key={week}>
            <Table.Cell>{week}</Table.Cell>
            <Table.Cell>{count}</Table.Cell>
            <Table.Cell>{formatMinutes(minutes)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

const defaultFrom = () => {
  const d = startOfWeek();
  d.setDate(d.getDate() - 28);
  return d.toISOString().slice(0, 10);
};
const defaultTo = () => new Date().toISOString().slice(0, 10);

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("minutes_by_area");
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", "reports", dateFrom, dateTo],
    queryFn: () =>
      listSessions({
        dateFrom: new Date(dateFrom).toISOString(),
        dateTo: new Date(dateTo + "T23:59:59").toISOString(),
      }),
  });
  const { data: items = [] } = useQuery({
    queryKey: ["study_items", "reports"],
    queryFn: () => listStudyItems({}),
  });
  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const overdueCount = useMemo(
    () => items.filter((i) => isOverdue(i.due_date, i.status)).length,
    [items],
  );

  return (
    <Stack gap={6}>
      <Heading size="lg">Reports</Heading>

      {/* Controls */}
      <Flex gap={3} align="flex-end" flexWrap="wrap">
        <Box>
          <Text fontSize="sm" mb={1} color="fg.muted">
            Report
          </Text>
          <NativeSelect.Root w="240px">
            <NativeSelect.Field
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
            >
              <option value="minutes_by_area">Minutes by Area</option>
              <option value="completed_by_area">Completed Items by Area</option>
              <option value="overdue_count">Overdue Count</option>
              <option value="velocity_by_week">
                Completion Velocity by Week
              </option>
              <option value="sessions_per_week">Sessions per Week</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>
        <Box>
          <Text fontSize="sm" mb={1} color="fg.muted">
            From
          </Text>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb={1} color="fg.muted">
            To
          </Text>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </Box>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDateFrom(defaultFrom());
            setDateTo(defaultTo());
          }}
        >
          Reset
        </Button>
      </Flex>

      {/* Report output */}
      <Box>
        {reportType === "minutes_by_area" && (
          <>
            <Heading size="md" mb={4}>
              Minutes by Area
            </Heading>
            <MinutesByArea sessions={sessions} areas={areas} />
          </>
        )}
        {reportType === "completed_by_area" && (
          <>
            <Heading size="md" mb={4}>
              Completed Items by Area
            </Heading>
            <CompletedByArea items={items} areas={areas} />
          </>
        )}
        {reportType === "overdue_count" && (
          <Box p={6} borderWidth={1} borderRadius="lg" display="inline-block">
            <Stat.Root>
              <Stat.Label>Overdue Items</Stat.Label>
              <Stat.ValueText color="red.fg">{overdueCount}</Stat.ValueText>
              <Stat.HelpText>
                Items past due date that are not completed or cancelled
              </Stat.HelpText>
            </Stat.Root>
          </Box>
        )}
        {reportType === "velocity_by_week" && (
          <>
            <Heading size="md" mb={4}>
              Completion Velocity by Week
            </Heading>
            <VelocityByWeek items={items} />
          </>
        )}
        {reportType === "sessions_per_week" && (
          <>
            <Heading size="md" mb={4}>
              Sessions per Week
            </Heading>
            <SessionsPerWeek sessions={sessions} />
          </>
        )}
      </Box>
    </Stack>
  );
}
