import { AppLink } from "@/components/ui/app-link";
import {
  parseCourseOfStudyFile,
  type ParsedCourseOfStudy,
  type ParsedCourseOfStudyFile,
} from "@/lib/courseOfStudyParser";
import { listAreas } from "@/lib/services/areaService";
import {
  importCourseOfStudyFile,
  type CourseFileImportResult,
} from "@/lib/services/courseOfStudyImportService";
import { listResources } from "@/lib/services/resourceService";
import {
  autoActivateIfFirstYearTermProgram,
  DEFAULT_WORK_WEEK,
  getSettings,
  updateSettings,
} from "@/lib/services/settingsService";
import type { Area, Resource } from "@/types/domain";
import {
  Alert,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  NativeSelect,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

type Step = 1 | 2 | 3 | 4;

// ── Conflict types & helpers ──────────────────────────────────────────────────

interface ConflictEntry {
  programName: string;
  programKey: "parent" | number;
  day: string;
}

type Resolution = "ignore" | "remap" | "work_week";

interface ConflictResolution {
  resolution: Resolution;
  remapTo: string;
}

function detectConflicts(
  file: ParsedCourseOfStudyFile,
  workWeek: string[],
): ConflictEntry[] {
  const effective = workWeek.length ? workWeek : DEFAULT_WORK_WEEK;
  const workSet = new Set(effective.map((d) => d.toLowerCase()));
  const conflicts: ConflictEntry[] = [];

  const check = (p: ParsedCourseOfStudy, key: "parent" | number) => {
    if (!p.meeting_days?.length) return;
    for (const day of p.meeting_days) {
      if (!workSet.has(day.toLowerCase())) {
        conflicts.push({
          programName: p.name,
          programKey: key,
          day: day.toLowerCase(),
        });
      }
    }
  };

  if (file.parent) check(file.parent, "parent");
  file.programs.forEach((p, i) => check(p, i));
  return conflicts;
}

const DAY_LABEL_LONG: Record<string, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

function collectResourceTitles(file: ParsedCourseOfStudyFile): string[] {
  const titles = new Set<string>();
  const addLesson = (l: { resource?: string }) => {
    if (l.resource) titles.add(l.resource);
  };
  const addProgram = (p: ParsedCourseOfStudy) => {
    p.lessons.forEach(addLesson);
    p.modules.forEach((m) => m.lessons.forEach(addLesson));
  };
  if (file.parent) addProgram(file.parent);
  file.programs.forEach(addProgram);
  return Array.from(titles);
}

function collectAreaNames(file: ParsedCourseOfStudyFile): string[] {
  const names = new Set<string>();
  file.programs.forEach((p) => {
    if (p.area) names.add(p.area);
  });
  return Array.from(names);
}

function autoMatchArea(
  areaName: string | undefined,
  areas: Area[],
): string | undefined {
  if (!areaName) return undefined;
  return areas.find((a) => a.name.toLowerCase() === areaName.toLowerCase())?.id;
}

function autoMatchResource(
  title: string,
  resources: Resource[],
): string | undefined {
  return resources.find((r) => r.title.toLowerCase() === title.toLowerCase())
    ?.id;
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────

function StepUpload({
  onParsed,
}: {
  onParsed: (parsed: ParsedCourseOfStudyFile, filename: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError(null);
    if (!file.name.endsWith(".yml") && !file.name.endsWith(".yaml")) {
      setError("Please upload a .yml or .yaml file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseCourseOfStudyFile(file.name, content);
        onParsed(parsed, file.name);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <Stack id="upload-step" gap={4}>
      <Box
        borderWidth={2}
        borderStyle="dashed"
        borderColor={dragging ? "blue.400" : "border"}
        borderRadius="md"
        p={8}
        textAlign="center"
        cursor="pointer"
        bg={dragging ? "bg.subtle" : "transparent"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Text color="fg.muted">
          Drag & drop a <strong>.yml</strong> / <strong>.yaml</strong> file
          here, or click to browse
        </Text>
        <input
          ref={inputRef}
          type="file"
          accept=".yml,.yaml"
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
      </Box>

      {error && (
        <Box p={3} borderRadius="md" bg="red.subtle" color="red.fg">
          <Text fontWeight="semibold">Parse error</Text>
          <Text fontSize="sm">{error}</Text>
        </Box>
      )}

      <Text fontSize="sm" color="fg.muted">
        Don&apos;t have a file?{" "}
        <a
          href="/sample-course.yml"
          download="sample-course.yml"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          Download sample
        </a>
      </Text>
    </Stack>
  );
}

// ── Step 2: Conflict reconciliation ──────────────────────────────────────────

function StepConflicts({
  conflicts,
  workWeek,
  parsedFile,
  onResolved,
  onBack,
}: {
  conflicts: ConflictEntry[];
  workWeek: string[];
  parsedFile: ParsedCourseOfStudyFile;
  onResolved: (
    updatedFile: ParsedCourseOfStudyFile,
    newWorkWeekDays: string[],
  ) => void;
  onBack: () => void;
}) {
  const effectiveWorkWeek = workWeek.length ? workWeek : DEFAULT_WORK_WEEK;

  const [resolutions, setResolutions] = useState<
    Record<string, ConflictResolution>
  >(() =>
    Object.fromEntries(
      conflicts.map((c) => [
        `${c.programKey}-${c.day}`,
        {
          resolution: "ignore" as Resolution,
          remapTo: effectiveWorkWeek[0] ?? "mon",
        },
      ]),
    ),
  );

  function setResolution(key: string, update: Partial<ConflictResolution>) {
    setResolutions((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  }

  function handleProceed() {
    const workWeekAdditions: string[] = [];

    for (const c of conflicts) {
      const key = `${c.programKey}-${c.day}`;
      if (resolutions[key]?.resolution === "work_week") {
        workWeekAdditions.push(c.day);
      }
    }

    // Deep-copy parsedFile so we can mutate meeting_days for remap resolutions
    const updatedFile: ParsedCourseOfStudyFile = {
      parent: parsedFile.parent
        ? {
            ...parsedFile.parent,
            meeting_days: [...(parsedFile.parent.meeting_days ?? [])],
          }
        : undefined,
      programs: parsedFile.programs.map((p) => ({
        ...p,
        meeting_days: [...(p.meeting_days ?? [])],
      })),
    };

    for (const c of conflicts) {
      const key = `${c.programKey}-${c.day}`;
      if (resolutions[key]?.resolution === "remap") {
        const remapTo = resolutions[key].remapTo;
        if (c.programKey === "parent" && updatedFile.parent?.meeting_days) {
          const idx = updatedFile.parent.meeting_days.indexOf(c.day);
          if (idx !== -1) updatedFile.parent.meeting_days[idx] = remapTo;
        } else if (typeof c.programKey === "number") {
          const prog = updatedFile.programs[c.programKey];
          if (prog?.meeting_days) {
            const idx = prog.meeting_days.indexOf(c.day);
            if (idx !== -1) prog.meeting_days[idx] = remapTo;
          }
        }
      }
    }

    onResolved(updatedFile, [...new Set(workWeekAdditions)]);
  }

  return (
    <Stack id="conflicts-step" gap={5}>
      <Alert.Root colorPalette="orange" size="sm">
        <Alert.Content>
          <Alert.Description>
            Some import meeting days conflict with your global work week. Choose
            how to handle each conflict before proceeding.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>

      <Box
        id="conflicts-box"
        borderWidth={1}
        borderRadius="md"
        p={4}
        bg="bg.subtle"
      >
        <Heading size="sm" mb={3}>
          Schedule Conflicts
        </Heading>
        <Stack gap={3}>
          {conflicts.map((c) => {
            const key = `${c.programKey}-${c.day}`;
            const res = resolutions[key] ?? {
              resolution: "ignore",
              remapTo: effectiveWorkWeek[0] ?? "mon",
            };
            return (
              <Box
                key={key}
                borderWidth={1}
                borderRadius="md"
                p={3}
                bg="bg.panel"
              >
                <HStack justify="space-between" flexWrap="wrap" gap={2}>
                  <Stack align="flex-start" gap={0}>
                    <Text fontSize="sm" fontWeight="medium">
                      {c.programName}
                    </Text>
                    <HStack gap={1} mt={0.5}>
                      <Badge colorPalette="orange" variant="subtle" size="sm">
                        {DAY_LABEL_LONG[c.day] ?? c.day}
                      </Badge>
                      <Text fontSize="xs" color="fg.muted">
                        not in work week
                      </Text>
                    </HStack>
                  </Stack>
                  <NativeSelect.Root size="sm" w="200px">
                    <NativeSelect.Field
                      value={res.resolution}
                      onChange={(e) =>
                        setResolution(key, {
                          resolution: e.target.value as Resolution,
                        })
                      }
                    >
                      <option value="ignore">Drop (ignore this day)</option>
                      <option value="remap">Remap to a work day</option>
                      <option value="work_week">Add to my work week</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </HStack>
                {res.resolution === "remap" && (
                  <HStack mt={2} gap={2}>
                    <Text fontSize="xs" color="fg.muted">
                      Remap to:
                    </Text>
                    <NativeSelect.Root size="sm" w="160px">
                      <NativeSelect.Field
                        value={res.remapTo}
                        onChange={(e) =>
                          setResolution(key, { remapTo: e.target.value })
                        }
                      >
                        {effectiveWorkWeek.map((d) => (
                          <option key={d} value={d}>
                            {DAY_LABEL_LONG[d] ?? d}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </HStack>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>

      <HStack>
        <Button size="sm" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={handleProceed}>
          Continue
        </Button>
      </HStack>
    </Stack>
  );
}

// ── Step 3: Preview ───────────────────────────────────────────────────────────

function ResolutionBadge({
  resolved,
  willCreate,
}: {
  resolved: boolean;
  willCreate?: boolean;
}) {
  if (resolved) {
    return (
      <Badge colorPalette="green" variant="subtle">
        ✓ matched
      </Badge>
    );
  }
  if (willCreate) {
    return (
      <Badge colorPalette="blue" variant="subtle">
        + will create
      </Badge>
    );
  }
  return (
    <Badge colorPalette="yellow" variant="subtle">
      ⚠ not found
    </Badge>
  );
}

function StepPreview({
  parsedFile,
  areas,
  resources,
  areaMap,
  onAreaMapChange,
  resourceMap,
  onResourceMapChange,
  onNext,
  onBack,
}: {
  parsedFile: ParsedCourseOfStudyFile;
  areas: Area[];
  resources: Resource[];
  areaMap: Record<string, string>;
  onAreaMapChange: (areaName: string, id: string) => void;
  resourceMap: Record<string, string>;
  onResourceMapChange: (title: string, id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const resourceTitles = collectResourceTitles(parsedFile);
  const areaNames = collectAreaNames(parsedFile);
  const { parent, programs } = parsedFile;

  return (
    <Stack id="summary-step" gap={5}>
      {/* Summary counts */}
      <Box borderWidth={1} borderRadius="md" p={4} bg="bg.subtle">
        <Heading size="sm" mb={3}>
          Summary
        </Heading>
        <Table.Root variant="outline" size="sm">
          <Table.Body>
            {parent && (
              <Table.Row>
                <Table.Cell fontWeight="medium">Parent term</Table.Cell>
                <Table.Cell>{parent.name}</Table.Cell>
              </Table.Row>
            )}
            <Table.Row>
              <Table.Cell fontWeight="medium">
                {parent ? "Courses" : "Program"}
              </Table.Cell>
              <Table.Cell>
                {parent ? `${programs.length} courses` : programs[0]?.name}
              </Table.Cell>
            </Table.Row>
            {programs.map((p) => (
              <Table.Row key={p.name}>
                <Table.Cell pl={parent ? 8 : undefined} color="fg.muted">
                  {parent ? p.name : ""}
                </Table.Cell>
                <Table.Cell color="fg.muted">
                  {parent
                    ? `${p.modules.length} modules · ${p.lessons.length + p.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons · ${p.modules.reduce((s, m) => s + m.assessments.length, 0)} assessments`
                    : `${p.modules.length} modules · ${p.lessons.length + p.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons · ${p.modules.reduce((s, m) => s + m.assessments.length, 0)} assessments`}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Area resolution */}
      {areaNames.length > 0 && (
        <Box
          id="areas-step"
          borderWidth={1}
          borderRadius="md"
          p={4}
          bg="bg.subtle"
        >
          <Heading size="sm" mb={3}>
            Areas
          </Heading>
          <Stack gap={3}>
            {areaNames.map((areaName) => (
              <HStack key={areaName} gap={3} align="center">
                <ResolutionBadge resolved={!!areaMap[areaName.toLowerCase()]} />
                <Text fontSize="sm" color="fg.muted" flexShrink={0}>
                  {areaName}
                </Text>
                <NativeSelect.Root flex={1} size="sm">
                  <NativeSelect.Field
                    value={areaMap[areaName.toLowerCase()] ?? ""}
                    onChange={(e) =>
                      onAreaMapChange(areaName.toLowerCase(), e.target.value)
                    }
                  >
                    <option value="">— none —</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </HStack>
            ))}
          </Stack>
        </Box>
      )}

      {resourceTitles.length > 0 && (
        <Box
          id="resources-step"
          borderWidth={1}
          borderRadius="md"
          p={4}
          bg="bg.subtle"
        >
          <Heading size="sm" mb={3}>
            Resource Mapping
          </Heading>
          <Stack gap={3}>
            {resourceTitles.map((title) => {
              const val = resourceMap[title.toLowerCase()] ?? "";
              return (
                <HStack key={title} gap={3} align="center">
                  <ResolutionBadge
                    resolved={!!val && val !== "__create__"}
                    willCreate={val === "__create__"}
                  />
                  <Text fontSize="sm" flex={1} minW={0} truncate>
                    {title}
                  </Text>
                  <NativeSelect.Root flex={1} size="sm">
                    <NativeSelect.Field
                      value={val}
                      onChange={(e) =>
                        onResourceMapChange(title.toLowerCase(), e.target.value)
                      }
                    >
                      <option value="">— unresolved —</option>
                      <option value="__create__">+ Create new resource</option>
                      {resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </HStack>
              );
            })}
          </Stack>
        </Box>
      )}

      <HStack>
        <Button size="sm" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onNext}>
          Import
        </Button>
      </HStack>
    </Stack>
  );
}

// ── Step 4: Done ──────────────────────────────────────────────────────────────

function StepDone({
  result,
  error,
}: {
  result: CourseFileImportResult | null;
  error: string | null;
}) {
  if (error) {
    return (
      <Box
        id="error-step"
        p={4}
        borderRadius="md"
        bg="red.subtle"
        color="red.fg"
      >
        <Text fontWeight="semibold">Import failed</Text>
        <Text fontSize="sm">{error}</Text>
      </Box>
    );
  }

  if (!result) {
    return <Text color="fg.muted">Importing…</Text>;
  }

  return (
    <Stack id="done-step" gap={4}>
      <Box p={4} borderRadius="md" bg="green.subtle" color="green.fg">
        <Text fontWeight="semibold">Import complete!</Text>
      </Box>
      <Table.Root variant="outline" size="sm">
        <Table.Body>
          <Table.Row>
            <Table.Cell>Programs created</Table.Cell>
            <Table.Cell>{result.programsCreated}</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Modules created</Table.Cell>
            <Table.Cell>{result.modulesCreated}</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Lessons created</Table.Cell>
            <Table.Cell>{result.lessonsCreated}</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>Assessments created</Table.Cell>
            <Table.Cell>{result.assessmentsCreated}</Table.Cell>
          </Table.Row>
          {result.resourcesCreated > 0 && (
            <Table.Row>
              <Table.Cell>Resources created</Table.Cell>
              <Table.Cell>{result.resourcesCreated}</Table.Cell>
            </Table.Row>
          )}
          {result.vacationsApplied > 0 && (
            <Table.Row>
              <Table.Cell>Vacations applied</Table.Cell>
              <Table.Cell>{result.vacationsApplied}</Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
      <AppLink to={`/programs/${result.rootProgramId}`}>
        <Button size="sm">View Program →</Button>
      </AppLink>
    </Stack>
  );
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

export default function ProgramImport() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [parsedFile, setParsedFile] = useState<ParsedCourseOfStudyFile | null>(
    null,
  );
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [resolvedWorkWeek, setResolvedWorkWeek] = useState<string[] | null>(
    null,
  );
  const [areaMap, setAreaMap] = useState<Record<string, string>>({});
  const [resourceMap, setResourceMap] = useState<Record<string, string>>({});
  const [importResult, setImportResult] =
    useState<CourseFileImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ["resources"],
    queryFn: () => listResources(),
  });

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const updateSettingsMut = useMutation({
    mutationFn: (newWorkWeek: string[]) =>
      updateSettings(settings!.id, { work_week: newWorkWeek }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user_settings"] });
    },
  });

  function initMaps(p: ParsedCourseOfStudyFile) {
    const areaNames = collectAreaNames(p);
    const map: Record<string, string> = {};
    for (const name of areaNames) {
      const id = autoMatchArea(name, areas);
      if (id) map[name.toLowerCase()] = id;
    }
    setAreaMap(map);

    const titles = collectResourceTitles(p);
    const resMap: Record<string, string> = {};
    for (const title of titles) {
      const id = autoMatchResource(title, resources);
      if (id) resMap[title.toLowerCase()] = id;
    }
    setResourceMap(resMap);
  }

  function handleParsed(p: ParsedCourseOfStudyFile) {
    const workWeek = settings?.work_week?.length
      ? settings.work_week
      : DEFAULT_WORK_WEEK;
    const detected = detectConflicts(p, workWeek);

    setParsedFile(p);
    initMaps(p);

    if (detected.length > 0) {
      setConflicts(detected);
      setStep(2);
    } else {
      setConflicts([]);
      setStep(3);
    }
  }

  function handleConflictsResolved(
    updatedFile: ParsedCourseOfStudyFile,
    newWorkWeekDays: string[],
  ) {
    setParsedFile(updatedFile);
    initMaps(updatedFile);

    if (newWorkWeekDays.length > 0 && settings) {
      const currentWorkWeek = settings.work_week?.length
        ? settings.work_week
        : DEFAULT_WORK_WEEK;
      const merged = [...new Set([...currentWorkWeek, ...newWorkWeekDays])];
      setResolvedWorkWeek(merged);
      updateSettingsMut.mutate(merged);
    }

    setStep(3);
  }

  function handleResourceMapChange(title: string, id: string) {
    setResourceMap((prev) => ({ ...prev, [title]: id }));
  }

  async function handleImport() {
    if (!parsedFile) return;
    setImporting(true);
    setStep(4);
    try {
      const result = await importCourseOfStudyFile({
        file: parsedFile,
        areaMap,
        resourceMap,
        workWeek: resolvedWorkWeek ?? undefined,
      });
      await autoActivateIfFirstYearTermProgram(result.rootProgramId);
      setImportResult(result);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const workWeek = settings?.work_week?.length
    ? settings.work_week
    : DEFAULT_WORK_WEEK;

  const hasConflictStep = conflicts.length > 0;

  const stepLabels: Record<Step, string> = {
    1: "1. Upload",
    2: hasConflictStep ? "2. Conflicts" : "2. Preview",
    3: hasConflictStep ? "3. Preview" : "2. Preview",
    4: hasConflictStep ? "4. Done" : "3. Done",
  };

  const visibleSteps: Step[] = hasConflictStep ? [1, 2, 3, 4] : [1, 3, 4];

  return (
    <Stack id="program-import" gap={6} maxW="2xl" mx="auto">
      <Flex justify="space-between" align="center">
        <Heading size="lg">Import Program</Heading>
        <Button size="sm" variant="ghost" onClick={() => navigate("/programs")}>
          Cancel
        </Button>
      </Flex>

      {/* Step indicator */}
      <HStack gap={4}>
        {visibleSteps.map((s) => (
          <Text
            key={s}
            fontWeight={step === s ? "bold" : "normal"}
            color={step === s ? "fg" : "fg.muted"}
            fontSize="sm"
          >
            {stepLabels[s]}
          </Text>
        ))}
      </HStack>

      {step === 1 && <StepUpload onParsed={handleParsed} />}

      {step === 2 && parsedFile && (
        <StepConflicts
          conflicts={conflicts}
          workWeek={workWeek}
          parsedFile={parsedFile}
          onResolved={handleConflictsResolved}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && parsedFile && (
        <StepPreview
          parsedFile={parsedFile}
          areas={areas}
          resources={resources}
          areaMap={areaMap}
          onAreaMapChange={(name, id) =>
            setAreaMap((prev) => ({ ...prev, [name]: id }))
          }
          resourceMap={resourceMap}
          onResourceMapChange={handleResourceMapChange}
          onNext={() => void handleImport()}
          onBack={() => setStep(hasConflictStep ? 2 : 1)}
        />
      )}

      {step === 4 && (
        <>
          {importing ? (
            <Text color="fg.muted">Importing…</Text>
          ) : (
            <StepDone result={importResult} error={importError} />
          )}
        </>
      )}
    </Stack>
  );
}
