import { DEFAULT_BLOCK_WEEKS } from "@/lib/blocks";
import pb from "@/lib/pocketbase";
import { getSettings, updateSettings } from "@/lib/services/settingsService";
import {
  Box,
  Button,
  Field,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type CollectionName =
  | "areas"
  | "programs"
  | "resources"
  | "study_items"
  | "study_sessions"
  | "item_events"
  | "user_settings";

const COLLECTIONS: { key: CollectionName; label: string }[] = [
  { key: "areas", label: "Areas" },
  { key: "programs", label: "Programs" },
  { key: "resources", label: "Resources" },
  { key: "study_items", label: "Study Items" },
  { key: "study_sessions", label: "Study Sessions" },
  { key: "item_events", label: "Item Events" },
  { key: "user_settings", label: "User Settings" },
];

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(records: Record<string, unknown>[]): string {
  if (records.length === 0) return "";
  const keys = Object.keys(records[0]).filter(
    (k) => k !== "collectionId" && k !== "collectionName",
  );
  const header = keys.join(",");
  const rows = records.map((r) =>
    keys
      .map((k) => {
        const v = r[k];
        if (v == null) return "";
        const str = String(v);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(","),
  );
  return [header, ...rows].join("\n");
}

function ExportButton({
  label,
  collectionKey,
}: {
  label: string;
  collectionKey: CollectionName;
}) {
  const [loadingJson, setLoadingJson] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);

  const fetchAll = async () => {
    return pb
      .collection(collectionKey)
      .getFullList({ sort: "-created" }) as Promise<Record<string, unknown>[]>;
  };

  const exportJson = async () => {
    setLoadingJson(true);
    try {
      const records = await fetchAll();
      const json = JSON.stringify(records, null, 2);
      downloadBlob(`${collectionKey}.json`, json, "application/json");
    } finally {
      setLoadingJson(false);
    }
  };

  const exportCsv = async () => {
    setLoadingCsv(true);
    try {
      const records = await fetchAll();
      const csv = toCSV(records);
      downloadBlob(`${collectionKey}.csv`, csv, "text/csv");
    } finally {
      setLoadingCsv(false);
    }
  };

  return (
    <HStack
      justify="space-between"
      p={3}
      borderWidth={1}
      borderRadius="md"
      bg="bg.subtle"
    >
      <Text fontWeight="medium">{label}</Text>
      <HStack>
        <Button
          size="xs"
          variant="outline"
          loading={loadingJson}
          onClick={() => void exportJson()}
        >
          JSON
        </Button>
        <Button
          size="xs"
          variant="outline"
          loading={loadingCsv}
          onClick={() => void exportCsv()}
        >
          CSV
        </Button>
      </HStack>
    </HStack>
  );
}

function BlockConfig() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });
  const [blockWeeks, setBlockWeeks] = useState<number>(DEFAULT_BLOCK_WEEKS);

  useEffect(() => {
    if (settings) setBlockWeeks(settings.block_weeks);
  }, [settings]);

  const updateMut = useMutation({
    mutationFn: (weeks: number) =>
      updateSettings(settings!.id, { block_weeks: weeks }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["user_settings"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (settings) updateMut.mutate(blockWeeks);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      p={4}
      borderWidth={1}
      borderRadius="md"
      bg="bg.subtle"
      maxW="480px"
      mx="auto"
    >
      <Stack gap={3}>
        <Field.Root>
          <Field.Label>Default block duration (weeks)</Field.Label>
          <Field.HelperText>
            Blocks are N weeks long (2–6) and are always followed by a rest
            week. Individual blocks can override this default.
          </Field.HelperText>
          <Input
            type="number"
            min={2}
            max={6}
            step={1}
            value={blockWeeks}
            onChange={(e) => setBlockWeeks(Number(e.target.value))}
            maxW="80px"
          />
        </Field.Root>
        <Box>
          <Button
            type="submit"
            size="sm"
            loading={updateMut.isPending}
            disabled={!settings}
          >
            Save
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export default function Settings() {
  return (
    <Stack gap={8}>
      <Heading size="lg">Settings</Heading>

      <Box w="full">
        <Heading size="md" mb={4}>
          Block Configuration
        </Heading>
        <BlockConfig />
      </Box>

      <Box w="full">
        <Heading size="md" mb={4}>
          Export Data
        </Heading>
        <Text color="fg.muted" mb={4}>
          Download a copy of your data in JSON or CSV format.
        </Text>
        <Stack gap={2} mx="auto" maxW="480px">
          {COLLECTIONS.map((c) => (
            <ExportButton key={c.key} label={c.label} collectionKey={c.key} />
          ))}
        </Stack>
      </Box>

      <Box>
        <Heading size="md" mb={4}>
          Account
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          Logged in as{" "}
          <strong>{pb.authStore.record?.email as string | undefined}</strong>
        </Text>
      </Box>
    </Stack>
  );
}
