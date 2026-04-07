import { AppLink } from "@/components/ui/app-link";
import { formatDate } from "@/lib/dates";
import { listAreas } from "@/lib/services/areaService";
import { getProgram } from "@/lib/services/programService";
import { listResources } from "@/lib/services/resourceService";
import { importSyllabi } from "@/lib/services/syllabusImportService";
import type { ParsedSyllabus } from "@/lib/syllabusParser";
import { parseSyllabus } from "@/lib/syllabusParser";
import type { Area } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Heading,
  HStack,
  NativeSelect,
  Separator,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useParams } from "react-router";

type Step = "upload" | "match" | "preview" | "importing" | "done";

const STEPS: { key: Exclude<Step, "importing">; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "match", label: "Match Areas" },
  { key: "preview", label: "Preview" },
  { key: "done", label: "Done" },
];

function StepIndicator({ current }: { current: Step }) {
  const activeIndex =
    current === "importing" ? 2 : STEPS.findIndex((s) => s.key === current);

  return (
    <HStack gap={0} flexWrap="wrap">
      {STEPS.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <HStack key={s.key} gap={0}>
            <HStack gap={2}>
              <Flex
                align="center"
                justify="center"
                w={7}
                h={7}
                borderRadius="full"
                borderWidth={2}
                borderColor={done || active ? "blue.500" : "border"}
                bg={done ? "blue.500" : active ? "bg" : "bg.subtle"}
                flexShrink={0}
              >
                {done ? (
                  <Text fontSize="xs" color="white" fontWeight="bold">
                    ✓
                  </Text>
                ) : (
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={active ? "blue.500" : "fg.muted"}
                  >
                    {i + 1}
                  </Text>
                )}
              </Flex>
              <Text
                fontSize="sm"
                fontWeight={active ? "semibold" : "normal"}
                color={active ? "fg" : done ? "fg.muted" : "fg.subtle"}
              >
                {s.label}
              </Text>
            </HStack>
            {i < STEPS.length - 1 && (
              <Box
                h="1px"
                w={8}
                mx={2}
                bg={done ? "blue.500" : "border"}
                flexShrink={0}
              />
            )}
          </HStack>
        );
      })}
    </HStack>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Import() {
  const { id: termId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [syllabi, setSyllabi] = useState<ParsedSyllabus[]>([]);
  const [areaMatches, setAreaMatches] = useState<Record<string, string>>({});
  const [areaResources, setAreaResources] = useState<Record<string, string>>(
    {},
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<{
    coursesCreated: number;
    courseSessionsUpdated: number;
    itemsCreated: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: term } = useQuery({
    queryKey: ["programs", termId],
    queryFn: () => getProgram(termId!),
    enabled: !!termId,
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const { data: allResources = [] } = useQuery({
    queryKey: ["resources"],
    queryFn: () => listResources(),
  });

  const uniqueSlugs = Array.from(new Set(syllabi.map((s) => s.area))).filter(
    Boolean,
  );

  const importMut = useMutation({
    mutationFn: () =>
      importSyllabi({
        term: term!,
        syllabi,
        areaMatches,
        areaResources,
        areas,
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      void qc.invalidateQueries({ queryKey: ["programs"] });
    },
  });

  async function processFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.name.endsWith(".md"));
    if (list.length === 0) return;
    setParseError(null);
    try {
      const parsed: ParsedSyllabus[] = [];
      for (const file of list) {
        const content = await readFileAsText(file);
        parsed.push(parseSyllabus(file.name, content));
      }
      setSyllabi(parsed);

      const initial: Record<string, string> = {};
      const slugs = Array.from(new Set(parsed.map((s) => s.area))).filter(
        Boolean,
      );
      for (const slug of slugs) {
        const match = areas.find((a) =>
          a.name.toLowerCase().includes(slug.toLowerCase()),
        );
        initial[slug] = match?.id ?? "";
      }
      setAreaMatches(initial);
    } catch (e) {
      setParseError(String(e));
    }
  }

  if (!term) {
    return (
      <Flex align="center" justify="center" h="40">
        <Spinner size="md" color="fg.muted" />
      </Flex>
    );
  }

  return (
    <Stack id="import-syllabi" gap={8} w="full">
      {/* Header */}
      <Stack id="import-syllabi-header" gap={1}>
        <AppLink
          alignSelf="flex-start"
          mb="6"
          to={`/programs/${termId}`}
          color="fg.muted"
          fontSize="sm"
        >
          ← {term.name}
        </AppLink>
        <Flex align="center" gap={3}>
          <Heading size="lg">Import Syllabi</Heading>
          <Badge variant="subtle" colorPalette="blue">
            {term.name}
          </Badge>
        </Flex>
      </Stack>

      <StepIndicator current={step} />

      <Separator />

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <Stack id="import-syllabi-upload" gap={6}>
          <Text color="fg.muted" fontSize="sm">
            Upload one or more <strong>.md</strong> syllabus files for this
            term. Each file should have YAML frontmatter with an{" "}
            <code>area</code> field and a <strong>Meeting:</strong> line.
          </Text>

          {/* Drop zone */}
          <Box
            borderWidth={2}
            borderStyle="dashed"
            borderColor={isDragOver ? "blue.400" : "border"}
            borderRadius="xl"
            bg={isDragOver ? "blue.subtle" : "bg.subtle"}
            p={10}
            textAlign="center"
            cursor="pointer"
            transition="all 0.15s"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              void processFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              multiple
              style={{ display: "none" }}
              onChange={(e) => void processFiles(e.target.files ?? [])}
            />
            <Stack gap={2} align="center">
              <Text fontSize="2xl">📄</Text>
              <Text fontWeight="medium">
                {isDragOver
                  ? "Drop files to upload"
                  : "Drag & drop .md files here"}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                or{" "}
                <Text as="span" color="blue.500" fontWeight="medium">
                  click to browse
                </Text>
              </Text>
            </Stack>
          </Box>

          {parseError && (
            <Box
              p={3}
              borderWidth={1}
              borderColor="red.300"
              borderRadius="md"
              bg="red.subtle"
            >
              <Text color="red.600" fontSize="sm">
                {parseError}
              </Text>
            </Box>
          )}

          {/* Parsed file cards */}
          {syllabi.length > 0 && (
            <Stack gap={4}>
              <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                {syllabi.length} file{syllabi.length !== 1 ? "s" : ""} parsed
              </Text>
              <Stack gap={2}>
                {syllabi.map((s) => (
                  <Box
                    key={s.filename}
                    p={4}
                    borderWidth={1}
                    borderRadius="lg"
                    bg="bg.subtle"
                  >
                    <Flex justify="space-between" align="flex-start">
                      <Stack gap={1}>
                        <Text fontWeight="medium" fontSize="sm">
                          {s.filename}
                        </Text>
                        <HStack gap={2} flexWrap="wrap">
                          <Badge variant="subtle" colorPalette="purple">
                            {s.area || "unknown area"}
                          </Badge>
                          <Text fontSize="xs" color="fg.muted">
                            {s.tracks.length} track
                            {s.tracks.length !== 1 ? "s" : ""} ·{" "}
                            {s.tracks.reduce(
                              (acc, t) => acc + t.sessions.length,
                              0,
                            )}{" "}
                            sessions
                          </Text>
                        </HStack>
                      </Stack>
                      <HStack gap={1} flexWrap="wrap">
                        {s.meetingDays.map((d) => (
                          <Badge
                            key={d}
                            size="sm"
                            variant="outline"
                            colorPalette="gray"
                          >
                            {DAY_LABELS[d]}
                          </Badge>
                        ))}
                      </HStack>
                    </Flex>
                  </Box>
                ))}
              </Stack>
              <HStack gap={2}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSyllabi([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Clear
                </Button>
                <Button size="sm" onClick={() => setStep("match")}>
                  Next: Match Areas →
                </Button>
              </HStack>
            </Stack>
          )}
        </Stack>
      )}

      {/* ── Step 2: Area Matching ── */}
      {step === "match" && (
        <Stack id="import-syllabi-match" gap={6}>
          <Text color="fg.muted" fontSize="sm">
            Map each syllabus area to a Regula area. Choose <em>Skip</em> to
            exclude a syllabus from the import.
          </Text>

          <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap={3}>
            {uniqueSlugs.map((slug) => {
              const matched = areaMatches[slug];
              const matchedArea = areas.find((a) => a.id === matched);
              const areaResourceOptions = allResources.filter(
                (r) => !r.area || r.area === matched,
              );
              return (
                <Box
                  key={slug}
                  p={4}
                  borderWidth={1}
                  borderRadius="lg"
                  bg="bg.subtle"
                  borderColor={matched ? "blue.200" : "border"}
                >
                  <Stack gap={2}>
                    <Flex justify="space-between" align="center">
                      <Badge variant="subtle" colorPalette="purple" size="sm">
                        {slug}
                      </Badge>
                      {matched && (
                        <Text
                          fontSize="xs"
                          color="blue.500"
                          fontWeight="medium"
                        >
                          ✓ matched
                        </Text>
                      )}
                    </Flex>
                    <Field.Root>
                      <Field.Label fontSize="xs" color="fg.muted">
                        Area
                      </Field.Label>
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field
                          value={areaMatches[slug] ?? ""}
                          onChange={(e) =>
                            setAreaMatches((prev) => ({
                              ...prev,
                              [slug]: e.target.value,
                            }))
                          }
                        >
                          <option value="">— Skip —</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Field.Root>
                    {matched && (
                      <Field.Root>
                        <Field.Label fontSize="xs" color="fg.muted">
                          Default resource
                        </Field.Label>
                        <NativeSelect.Root size="sm">
                          <NativeSelect.Field
                            value={areaResources[matched] ?? ""}
                            onChange={(e) =>
                              setAreaResources((prev) => ({
                                ...prev,
                                [matched]: e.target.value,
                              }))
                            }
                          >
                            <option value="">— None —</option>
                            {areaResourceOptions.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.title}
                              </option>
                            ))}
                          </NativeSelect.Field>
                          <NativeSelect.Indicator />
                        </NativeSelect.Root>
                      </Field.Root>
                    )}
                    {matchedArea && (
                      <Text fontSize="xs" color="fg.muted">
                        → {matchedArea.name}
                      </Text>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Grid>

          <HStack gap={2}>
            <Button size="sm" variant="ghost" onClick={() => setStep("upload")}>
              ← Back
            </Button>
            <Button size="sm" onClick={() => setStep("preview")}>
              Next: Preview →
            </Button>
          </HStack>
        </Stack>
      )}

      {/* ── Step 3: Preview ── */}
      {step === "preview" && (
        <Stack id="import-syllabi-preview" gap={6}>
          <Stack gap={3}>
            <Heading size="sm">Courses to be created</Heading>
            {syllabi.filter(
              (s) => areaMatches[s.area] && s.meetingDays.length > 0,
            ).length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                No syllabi have meeting days — no courses will be created.
              </Text>
            ) : (
              <Table.Root variant="outline" size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Area</Table.ColumnHeader>
                    <Table.ColumnHeader>Meeting days</Table.ColumnHeader>
                    <Table.ColumnHeader>Date range</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {syllabi
                    .filter(
                      (s) => areaMatches[s.area] && s.meetingDays.length > 0,
                    )
                    .map((s) => {
                      const areaName =
                        areas.find((a) => a.id === areaMatches[s.area])?.name ??
                        s.area;
                      return (
                        <Table.Row key={s.filename}>
                          <Table.Cell fontWeight="medium">
                            {areaName}
                          </Table.Cell>
                          <Table.Cell>
                            <HStack gap={1} flexWrap="wrap">
                              {s.meetingDays.map((d) => (
                                <Badge
                                  key={d}
                                  size="sm"
                                  variant="outline"
                                  colorPalette="gray"
                                >
                                  {DAY_LABELS[d]}
                                </Badge>
                              ))}
                            </HStack>
                          </Table.Cell>
                          <Table.Cell color="fg.muted">
                            {term.start_date
                              ? formatDate(term.start_date)
                              : "—"}{" "}
                            → {term.end_date ? formatDate(term.end_date) : "—"}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                </Table.Body>
              </Table.Root>
            )}
          </Stack>

          <Stack gap={3}>
            <Heading size="sm">Study items to be created</Heading>
            <Stack gap={2}>
              {syllabi
                .filter((s) => areaMatches[s.area])
                .map((s) => {
                  const areaName =
                    areas.find((a) => a.id === areaMatches[s.area])?.name ?? "";
                  const allSessions = s.tracks.flatMap((t) => t.sessions);
                  const homeworkCount = allSessions.filter(
                    (sess) => sess.homework && !sess.isSpecial,
                  ).length;
                  const examCount = allSessions.filter(
                    (sess) => sess.isSpecial,
                  ).length;
                  const inClassCount = allSessions.filter(
                    (sess) =>
                      !sess.isSpecial && (!!sess.reading || !!sess.inSession),
                  ).length;
                  const totalItems = homeworkCount + examCount;
                  return (
                    <Box
                      key={s.filename}
                      p={4}
                      borderWidth={1}
                      borderRadius="lg"
                      bg="bg.subtle"
                    >
                      <Flex justify="space-between" align="center">
                        <Stack gap={1}>
                          <Text fontWeight="medium" fontSize="sm">
                            {s.filename}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {areaName}
                          </Text>
                        </Stack>
                        <HStack gap={2} flexWrap="wrap" justify="flex-end">
                          <Stack gap={0} align="flex-end">
                            <Text
                              fontSize="lg"
                              fontWeight="bold"
                              lineHeight="1"
                            >
                              {totalItems}
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                              items
                            </Text>
                          </Stack>
                          {homeworkCount > 0 && (
                            <Badge
                              size="sm"
                              variant="subtle"
                              colorPalette="blue"
                            >
                              {homeworkCount} hw
                            </Badge>
                          )}
                          {examCount > 0 && (
                            <Badge
                              size="sm"
                              variant="subtle"
                              colorPalette="orange"
                            >
                              {examCount} exam
                              {examCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {inClassCount > 0 && (
                            <Badge
                              size="sm"
                              variant="subtle"
                              colorPalette="purple"
                            >
                              {inClassCount} class notes
                            </Badge>
                          )}
                        </HStack>
                      </Flex>
                    </Box>
                  );
                })}
            </Stack>
          </Stack>

          <HStack gap={2}>
            <Button size="sm" variant="ghost" onClick={() => setStep("match")}>
              ← Back
            </Button>
            <Button
              size="sm"
              colorPalette="blue"
              loading={importMut.isPending}
              onClick={() => {
                setStep("importing");
                importMut.mutate();
              }}
            >
              Import
            </Button>
          </HStack>

          {importMut.isError && (
            <Box
              p={3}
              borderWidth={1}
              borderColor="red.300"
              borderRadius="md"
              bg="red.subtle"
            >
              <Text color="red.600" fontSize="sm">
                Import failed: {String(importMut.error)}
              </Text>
            </Box>
          )}
        </Stack>
      )}

      {/* ── Importing ── */}
      {step === "importing" && (
        <Flex
          id="import-syllabi-importing"
          direction="column"
          align="center"
          gap={4}
          py={12}
        >
          <Spinner size="xl" color="blue.500" />
          <Stack gap={1} align="center">
            <Text fontWeight="medium">Importing syllabi…</Text>
            <Text fontSize="sm" color="fg.muted">
              Creating courses and study items. This may take a moment.
            </Text>
          </Stack>
        </Flex>
      )}

      {/* ── Done ── */}
      {step === "done" && result && (
        <Stack id="import-syllabi-done" gap={6}>
          <Box
            p={6}
            borderWidth={1}
            borderColor="green.300"
            borderRadius="xl"
            bg="green.subtle"
            textAlign="center"
          >
            <Text fontSize="3xl" mb={2}>
              🎉
            </Text>
            <Text color="green.700" fontWeight="semibold" fontSize="lg">
              Import complete
            </Text>
            <HStack gap={6} justify="center" mt={4} flexWrap="wrap">
              <Stack gap={0} align="center">
                <Text
                  fontSize="2xl"
                  fontWeight="bold"
                  color="green.700"
                  lineHeight="1"
                >
                  {result.coursesCreated}
                </Text>
                <Text fontSize="sm" color="green.600">
                  course{result.coursesCreated !== 1 ? "s" : ""} created
                </Text>
              </Stack>
              <Box w="1px" h={8} bg="green.200" />
              <Stack gap={0} align="center">
                <Text
                  fontSize="2xl"
                  fontWeight="bold"
                  color="green.700"
                  lineHeight="1"
                >
                  {result.itemsCreated}
                </Text>
                <Text fontSize="sm" color="green.600">
                  study item{result.itemsCreated !== 1 ? "s" : ""} created
                </Text>
              </Stack>
              <Box w="1px" h={8} bg="green.200" />
              <Stack gap={0} align="center">
                <Text
                  fontSize="2xl"
                  fontWeight="bold"
                  color="green.700"
                  lineHeight="1"
                >
                  {result.courseSessionsUpdated}
                </Text>
                <Text fontSize="sm" color="green.600">
                  class session{result.courseSessionsUpdated !== 1 ? "s" : ""}{" "}
                  annotated
                </Text>
              </Stack>
            </HStack>
          </Box>
          <HStack gap={2} justify="center">
            <AppLink to={`/programs/${termId}`}>
              <Button size="sm" colorPalette="blue">
                View Program
              </Button>
            </AppLink>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSyllabi([]);
                setAreaMatches({});
                setResult(null);
                setStep("upload");
              }}
            >
              Import More
            </Button>
          </HStack>
        </Stack>
      )}
    </Stack>
  );
}
