import { AppLink } from "@/components/ui/app-link";
import { DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import { formatDate } from "@/lib/dates";
import { listAreas } from "@/lib/services/areaService";
import { getProgram } from "@/lib/services/programService";
import { getSettings } from "@/lib/services/settingsService";
import {
  checkExistingBlocks,
  computeBlockRanges,
  importSyllabi,
} from "@/lib/services/syllabusImportService";
import type { ParsedSyllabus } from "@/lib/syllabusParser";
import { parseSyllabus } from "@/lib/syllabusParser";
import type { Area } from "@/types/domain";
import {
  Badge,
  Box,
  Button,
  Field,
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
import { useParams } from "react-router";

type Step = "upload" | "match" | "preview" | "importing" | "done";

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function Import() {
  const { id: termId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [syllabi, setSyllabi] = useState<ParsedSyllabus[]>([]);
  const [areaMatches, setAreaMatches] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    blocksCreated: number;
    itemsCreated: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: term } = useQuery({
    queryKey: ["programs", termId],
    queryFn: () => getProgram(termId!),
    enabled: !!termId,
  });

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const globalBlockWeeks = settings?.block_weeks ?? DEFAULT_BLOCK_WEEKS;

  // Collect unique area slugs across all uploaded syllabi
  const uniqueSlugs = Array.from(new Set(syllabi.map((s) => s.area))).filter(
    Boolean,
  );

  // --- Preview: check for existing blocks ---
  const { data: hasExistingBlocks, isLoading: checkingBlocks } = useQuery({
    queryKey: ["existingBlocks", termId],
    queryFn: () => checkExistingBlocks(termId!),
    enabled: step === "preview" && !!termId,
  });

  // Compute preview block ranges client-side
  const previewBlocks =
    term?.start_date && term?.end_date
      ? computeBlockRanges(
          new Date(term.start_date),
          new Date(term.end_date),
          term.block_weeks || globalBlockWeeks,
        )
      : [];

  const importMut = useMutation({
    mutationFn: () =>
      importSyllabi({
        term: term!,
        syllabi,
        areaMatches,
        globalBlockWeeks,
      }),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ["programs"] });
      void qc.invalidateQueries({ queryKey: ["study_items"] });
      setStep("done");
    },
  });

  // --- Handlers ---

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setParseError(null);
    try {
      const parsed: ParsedSyllabus[] = [];
      for (const file of Array.from(files)) {
        const content = await readFileAsText(file);
        parsed.push(parseSyllabus(file.name, content));
      }
      setSyllabi(parsed);

      // Pre-populate area matches: auto-match by name containment
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

  // --- Step components ---

  if (!term) {
    return <Text>Loading…</Text>;
  }

  return (
    <Stack gap={6} maxW="3xl">
      <Flex align="center" gap={3}>
        <AppLink to={`/programs/${termId}`} color="fg.muted" fontSize="sm">
          ← {term.name}
        </AppLink>
        <Heading size="lg">Import Syllabi</Heading>
        <Badge variant="outline">{term.name}</Badge>
      </Flex>

      {/* Step indicator */}
      <HStack gap={2} fontSize="sm">
        {(["upload", "match", "preview", "done"] as const).map((s) => (
          <Text
            key={s}
            fontWeight={
              step === s || (step === "importing" && s === "preview")
                ? "bold"
                : "normal"
            }
            color={
              step === s || (step === "importing" && s === "preview")
                ? "fg"
                : "fg.muted"
            }
            textTransform="capitalize"
          >
            {s}
          </Text>
        ))}
      </HStack>

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <Stack gap={4}>
          <Text color="fg.muted" fontSize="sm">
            Upload one or more <strong>.md</strong> syllabus files for this
            term. Each file should include YAML frontmatter with an{" "}
            <code>area</code> field and a <strong>Meeting:</strong> line.
          </Text>
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              multiple
              style={{ display: "none" }}
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Files
            </Button>
          </Box>

          {parseError && (
            <Text color="red.500" fontSize="sm">
              {parseError}
            </Text>
          )}

          {syllabi.length > 0 && (
            <Stack gap={3}>
              <Table.Root variant="outline" size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>File</Table.ColumnHeader>
                    <Table.ColumnHeader>Area</Table.ColumnHeader>
                    <Table.ColumnHeader>Tracks</Table.ColumnHeader>
                    <Table.ColumnHeader>Sessions</Table.ColumnHeader>
                    <Table.ColumnHeader>Meeting Days</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {syllabi.map((s) => (
                    <Table.Row key={s.filename}>
                      <Table.Cell fontSize="xs">{s.filename}</Table.Cell>
                      <Table.Cell>
                        <Badge variant="subtle">{s.area || "—"}</Badge>
                      </Table.Cell>
                      <Table.Cell>{s.tracks.length}</Table.Cell>
                      <Table.Cell>
                        {s.tracks.reduce(
                          (acc, t) => acc + t.sessions.length,
                          0,
                        )}
                      </Table.Cell>
                      <Table.Cell fontSize="xs">
                        {s.meetingDays
                          .map(
                            (d) =>
                              ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                                d
                              ],
                          )
                          .join(", ")}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              <Box>
                <Button
                  size="sm"
                  onClick={() => setStep("match")}
                  disabled={syllabi.length === 0}
                >
                  Next: Match Areas
                </Button>
              </Box>
            </Stack>
          )}
        </Stack>
      )}

      {/* ── Step 2: Area Matching ── */}
      {step === "match" && (
        <Stack gap={4}>
          <Text color="fg.muted" fontSize="sm">
            Map each area slug from your syllabi to a Regula area. Choose{" "}
            <em>Skip</em> to exclude a syllabus from the import.
          </Text>

          <Stack gap={3}>
            {uniqueSlugs.map((slug) => (
              <Field.Root key={slug}>
                <Field.Label>
                  <code>{slug}</code>
                </Field.Label>
                <NativeSelect.Root maxW="xs">
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
            ))}
          </Stack>

          <HStack gap={2}>
            <Button size="sm" variant="ghost" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button size="sm" onClick={() => setStep("preview")}>
              Next: Preview
            </Button>
          </HStack>
        </Stack>
      )}

      {/* ── Step 3: Preview ── */}
      {step === "preview" && (
        <Stack gap={5}>
          {checkingBlocks ? (
            <Text fontSize="sm">Checking existing blocks…</Text>
          ) : hasExistingBlocks ? (
            <Box
              p={4}
              borderWidth={1}
              borderColor="red.300"
              borderRadius="md"
              bg="red.subtle"
            >
              <Text color="red.600" fontWeight="medium">
                This term already has blocks.
              </Text>
              <Text color="red.500" fontSize="sm" mt={1}>
                Delete the existing block programs before importing.
              </Text>
            </Box>
          ) : (
            <>
              <Stack gap={3}>
                <Heading size="sm">Blocks to be created</Heading>
                <Table.Root variant="outline" size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Name</Table.ColumnHeader>
                      <Table.ColumnHeader>Start</Table.ColumnHeader>
                      <Table.ColumnHeader>End</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {previewBlocks.map((b) => (
                      <Table.Row key={b.name}>
                        <Table.Cell>{b.name}</Table.Cell>
                        <Table.Cell>
                          {formatDate(b.start.toISOString())}
                        </Table.Cell>
                        <Table.Cell>
                          {formatDate(b.end.toISOString())}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    {term.end_date &&
                      (() => {
                        const examEnd = new Date(term.end_date);
                        const examStart = new Date(examEnd);
                        examStart.setDate(examEnd.getDate() - 6);
                        return (
                          <Table.Row key="exam-week">
                            <Table.Cell fontStyle="italic" color="fg.muted">
                              Exam Week
                            </Table.Cell>
                            <Table.Cell>
                              {formatDate(examStart.toISOString())}
                            </Table.Cell>
                            <Table.Cell>
                              {formatDate(examEnd.toISOString())}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })()}
                  </Table.Body>
                </Table.Root>
              </Stack>

              <Stack gap={3}>
                <Heading size="sm">Items to be created</Heading>
                <Table.Root variant="outline" size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Syllabus</Table.ColumnHeader>
                      <Table.ColumnHeader>Area</Table.ColumnHeader>
                      <Table.ColumnHeader>Tracks</Table.ColumnHeader>
                      <Table.ColumnHeader>Sessions</Table.ColumnHeader>
                      <Table.ColumnHeader>Homework items</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {syllabi
                      .filter((s) => areaMatches[s.area])
                      .map((s) => {
                        const areaName =
                          areas.find((a) => a.id === areaMatches[s.area])
                            ?.name ?? "";
                        const totalSessions = s.tracks.reduce(
                          (acc, t) => acc + t.sessions.length,
                          0,
                        );
                        const homeworkCount = s.tracks.reduce(
                          (acc, t) =>
                            acc +
                            t.sessions.filter(
                              (sess) => sess.homework && !sess.isSpecial,
                            ).length,
                          0,
                        );
                        return (
                          <Table.Row key={s.filename}>
                            <Table.Cell fontSize="xs">{s.filename}</Table.Cell>
                            <Table.Cell>{areaName}</Table.Cell>
                            <Table.Cell>{s.tracks.length}</Table.Cell>
                            <Table.Cell>{totalSessions}</Table.Cell>
                            <Table.Cell>{homeworkCount}</Table.Cell>
                          </Table.Row>
                        );
                      })}
                  </Table.Body>
                </Table.Root>
              </Stack>
            </>
          )}

          <HStack gap={2}>
            <Button size="sm" variant="ghost" onClick={() => setStep("match")}>
              Back
            </Button>
            <Button
              size="sm"
              colorPalette="blue"
              loading={importMut.isPending}
              disabled={!!hasExistingBlocks || checkingBlocks}
              onClick={() => {
                setStep("importing");
                importMut.mutate();
              }}
            >
              Import
            </Button>
          </HStack>

          {importMut.isError && (
            <Text color="red.500" fontSize="sm">
              Import failed: {String(importMut.error)}
            </Text>
          )}
        </Stack>
      )}

      {/* ── Importing spinner ── */}
      {step === "importing" && (
        <Text color="fg.muted">Importing… this may take a moment.</Text>
      )}

      {/* ── Step 4: Done ── */}
      {step === "done" && result && (
        <Stack gap={4}>
          <Box
            p={4}
            borderWidth={1}
            borderColor="green.300"
            borderRadius="md"
            bg="green.subtle"
          >
            <Text color="green.700" fontWeight="medium">
              Import complete
            </Text>
            <Text color="green.600" fontSize="sm" mt={1}>
              Created {result.blocksCreated} block
              {result.blocksCreated !== 1 ? "s" : ""} and {result.itemsCreated}{" "}
              study item{result.itemsCreated !== 1 ? "s" : ""}.
            </Text>
          </Box>
          <Box>
            <AppLink to={`/programs/${termId}`}>
              <Button size="sm">View Program</Button>
            </AppLink>
          </Box>
        </Stack>
      )}
    </Stack>
  );
}
