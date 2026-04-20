import { StorageQuotaBar } from "@/components/StorageQuotaBar";
import { toaster } from "@/components/ui/toaster";
import {
  invalidateAreaCaches,
  invalidateProgramCaches,
  invalidateSettingsCaches,
  invalidateVacationCaches,
} from "@/lib/cacheInvalidation";
import pb from "@/lib/pocketbase";
import {
  createArea,
  deleteArea,
  listAreas,
  updateArea,
} from "@/lib/services/areaService";
import { listPrograms } from "@/lib/services/programService";
import {
  DEFAULT_AHEAD_WEEKS,
  DEFAULT_DASHBOARD_MODULES,
  DEFAULT_WORK_WEEK,
  getSettings,
  setActivePrograms,
  updateSettings,
} from "@/lib/services/settingsService";
import { getStorageUsage } from "@/lib/services/storageService";
import {
  createAndApplyVacation,
  deleteVacation,
  listVacations,
  previewStackOverflow,
} from "@/lib/services/vacationService";
import type { Area, Program, Vacation, VacationStrategy } from "@/types/domain";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  Field,
  Grid,
  Heading,
  HStack,
  Input,
  Link,
  NativeSelect,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type CollectionName =
  | "regula_programs"
  | "regula_modules"
  | "regula_lessons"
  | "regula_assessments"
  | "regula_reviews"
  | "regula_resources"
  | "regula_study_sessions"
  | "regula_item_events"
  | "regula_user_settings"
  | "regula_vacations";

const COLLECTIONS: { key: CollectionName; label: string }[] = [
  { key: "regula_programs", label: "Programs" },
  { key: "regula_modules", label: "Modules" },
  { key: "regula_lessons", label: "Lessons" },
  { key: "regula_assessments", label: "Assessments" },
  { key: "regula_reviews", label: "Reviews" },
  { key: "regula_resources", label: "Resources" },
  { key: "regula_study_sessions", label: "Study Sessions" },
  { key: "regula_item_events", label: "Item Events" },
  { key: "regula_user_settings", label: "User Settings" },
  { key: "regula_vacations", label: "Vacations" },
];

const SECTION_NAV = [
  { id: "areas", label: "Areas" },
  { id: "general", label: "General" },
  { id: "dashboard", label: "Dashboard" },
  { id: "active-programs", label: "Active Programs" },
  { id: "storage", label: "Storage" },
  { id: "vacations", label: "Vacations" },
  { id: "export-data", label: "Export Data" },
  { id: "account", label: "Account" },
];

const DASHBOARD_MODULE_OPTIONS: {
  key: string;
  label: string;
  description: string;
}[] = [
  {
    key: "due_today",
    label: "Due Today",
    description: "Lessons due on today's date",
  },
  {
    key: "review_queue",
    label: "Review Queue",
    description: "Active reviews due today",
  },
  {
    key: "overdue",
    label: "Overdue",
    description: "Lessons past their due date",
  },
  {
    key: "upcoming_assessments",
    label: "Upcoming Assessments",
    description: "Next 3 upcoming assessments",
  },
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
    <Box
      id={`export-${collectionKey}`}
      p={3}
      borderWidth={1}
      borderRadius="md"
      bg="bg.subtle"
    >
      <HStack justify="space-between">
        <Text fontWeight="medium" fontSize="sm">
          {label}
        </Text>
        <HStack gap={2}>
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
    </Box>
  );
}

function StorageConfig() {
  const { data: usage } = useQuery({
    queryKey: ["storage_usage"],
    queryFn: getStorageUsage,
  });

  if (!usage) return null;

  return <StorageQuotaBar used={usage.used} quota={usage.quota} />;
}

function GeneralSettings() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const [aheadWeeks, setAheadWeeks] = useState<number | undefined>(undefined);
  const [workWeek, setWorkWeek] = useState<string[] | undefined>(undefined);

  const currentAheadWeeks =
    aheadWeeks ?? settings?.ahead_weeks ?? DEFAULT_AHEAD_WEEKS;

  const settingsWorkWeek = settings?.work_week?.length
    ? settings.work_week
    : DEFAULT_WORK_WEEK;
  const currentWorkWeek = workWeek ?? settingsWorkWeek;

  const isDirty =
    (aheadWeeks !== undefined && aheadWeeks !== settings?.ahead_weeks) ||
    (workWeek !== undefined &&
      JSON.stringify([...workWeek].sort()) !==
        JSON.stringify([...settingsWorkWeek].sort()));

  const updateMut = useMutation({
    mutationFn: (data: { ahead_weeks: number; work_week: string[] }) =>
      updateSettings(settings!.id, data),
    onSuccess: () => {
      invalidateSettingsCaches(qc);
      setAheadWeeks(undefined);
      setWorkWeek(undefined);
      toaster.create({ type: "success", title: "Settings saved" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to save settings" });
    },
  });

  const toggleWorkDay = (day: string) => {
    const base = currentWorkWeek;
    const next = base.includes(day)
      ? base.filter((d) => d !== day)
      : [...base, day];
    setWorkWeek(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (settings) {
      updateMut.mutate({
        ahead_weeks: currentAheadWeeks,
        work_week: currentWorkWeek,
      });
    }
  };

  const ALL_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const DAY_LABEL: Record<string, string> = {
    sun: "Su",
    mon: "Mo",
    tue: "Tu",
    wed: "We",
    thu: "Th",
    fri: "Fr",
    sat: "Sa",
  };

  return (
    <Box id="general-settings" as="form" onSubmit={handleSubmit}>
      <Stack gap={6}>
        <Field.Root id="ahead-weeks">
          <Field.Label>Study ahead window</Field.Label>
          <Field.HelperText>
            How many weeks ahead of a lesson's scheduled date you can start a
            session for it (1–4).
          </Field.HelperText>
          <HStack mt={1}>
            <Input
              type="number"
              min={1}
              max={4}
              step={1}
              value={currentAheadWeeks}
              onChange={(e) => setAheadWeeks(Number(e.target.value))}
              w="80px"
            />
            <Text fontSize="sm" color="fg.muted">
              weeks
            </Text>
          </HStack>
        </Field.Root>

        <Field.Root id="work-week">
          <Field.Label>Work week</Field.Label>
          <Field.HelperText>
            Days you work on. Lessons will only be scheduled on these days.
          </Field.HelperText>
          <HStack mt={2} gap={1} flexWrap="wrap">
            {ALL_DAYS.map((day) => {
              const active = currentWorkWeek.includes(day);
              return (
                <Box
                  key={day}
                  as="button"
                  onClick={() => toggleWorkDay(day)}
                  px={3}
                  py={1}
                  borderRadius="md"
                  borderWidth={1}
                  fontSize="sm"
                  fontWeight="medium"
                  cursor="pointer"
                  bg={active ? "blue.500" : "bg.subtle"}
                  color={active ? "white" : "fg.muted"}
                  borderColor={active ? "blue.500" : "border"}
                  _hover={{ opacity: 0.85 }}
                  transition="all 0.15s"
                >
                  {DAY_LABEL[day]}
                </Box>
              );
            })}
          </HStack>
        </Field.Root>

        <HStack>
          <Button
            type="submit"
            size="sm"
            loading={updateMut.isPending}
            disabled={!settings}
            colorPalette={isDirty ? "blue" : undefined}
          >
            Save changes
          </Button>
          {isDirty && (
            <Text fontSize="xs" color="fg.muted">
              Unsaved changes
            </Text>
          )}
        </HStack>
      </Stack>
    </Box>
  );
}

function ActiveProgramsConfig() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const { data: allPrograms = [] } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: listPrograms,
  });

  const programs = allPrograms.filter(
    (p) => p.type === "term" || p.type === "year",
  );

  const activeIds: string[] = settings?.active_programs ?? [];

  const updateMut = useMutation({
    mutationFn: (ids: string[]) => setActivePrograms(settings!.id, ids),
    onSuccess: () => {
      invalidateProgramCaches(qc);
      toaster.create({ type: "success", title: "Active programs updated" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to update programs" });
    },
  });

  const toggleProgram = (id: string) => {
    if (!settings) return;
    const updated = activeIds.includes(id)
      ? activeIds.filter((p) => p !== id)
      : [...activeIds, id];
    updateMut.mutate(updated);
  };

  return (
    <Stack id="active-programs" gap={3}>
      <HStack justify="space-between">
        <Text fontSize="sm" color="fg.muted">
          Only active programs appear on the dashboard and in filter views.
        </Text>
        {programs.length > 0 && (
          <Badge variant="subtle" colorPalette="blue">
            {programs.filter((p) => activeIds.includes(p.id)).length} /{" "}
            {programs.length} active
          </Badge>
        )}
      </HStack>
      {programs.length === 0 ? (
        <Text fontSize="sm" color="fg.muted" fontStyle="italic">
          No programs yet.
        </Text>
      ) : (
        <Stack gap={2}>
          {programs.map((p) => (
            <HStack
              key={p.id}
              p={3}
              borderWidth={1}
              borderRadius="md"
              bg={
                activeIds.includes(p.id) ? "colorPalette.subtle" : "bg.subtle"
              }
              borderColor={
                activeIds.includes(p.id) ? "colorPalette.muted" : "border"
              }
              transition="all 0.15s"
              cursor={updateMut.isPending ? "not-allowed" : "pointer"}
              opacity={updateMut.isPending ? 0.7 : 1}
              onClick={() => !updateMut.isPending && toggleProgram(p.id)}
            >
              <Checkbox.Root
                checked={activeIds.includes(p.id)}
                onCheckedChange={() => toggleProgram(p.id)}
                size="sm"
                disabled={updateMut.isPending}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
              </Checkbox.Root>
              <Text
                fontSize="sm"
                fontWeight={activeIds.includes(p.id) ? "medium" : "normal"}
              >
                {p.name}
              </Text>
            </HStack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function AreasConfig() {
  const qc = useQueryClient();

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ["areas"],
    queryFn: listAreas,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editDescription, setEditDescription] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newDescription, setNewDescription] = useState("");

  const createMut = useMutation({
    mutationFn: createArea,
    onSuccess: () => {
      invalidateAreaCaches(qc);
      setCreateOpen(false);
      setNewName("");
      setNewColor("#6366f1");
      setNewDescription("");
      toaster.create({ type: "success", title: "Area created" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to create area" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Area> }) =>
      updateArea(id, data),
    onSuccess: () => {
      invalidateAreaCaches(qc);
      setEditingId(null);
      toaster.create({ type: "success", title: "Area updated" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to update area" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteArea,
    onSuccess: () => {
      invalidateAreaCaches(qc);
      toaster.create({ type: "success", title: "Area deleted" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to delete area" });
    },
  });

  const startEdit = (area: Area) => {
    setEditingId(area.id);
    setEditName(area.name);
    setEditColor(area.color || "#6366f1");
    setEditDescription(area.description || "");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMut.mutate({
      name: newName.trim(),
      color: newColor,
      description: newDescription.trim(),
    });
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    updateMut.mutate({
      id,
      data: {
        name: editName.trim(),
        color: editColor,
        description: editDescription.trim(),
      },
    });
  };

  return (
    <Stack gap={4}>
      {areas.length === 0 && !createOpen && (
        <Text fontSize="sm" color="fg.muted">
          No areas yet. Create one below to get started.
        </Text>
      )}

      {areas.length > 0 && (
        <Stack gap={2}>
          {areas.map((area) =>
            editingId === area.id ? (
              <HStack
                key={area.id}
                p={3}
                borderWidth={1}
                borderRadius="md"
                bg="bg.subtle"
                gap={2}
                flexWrap="wrap"
              >
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  style={{
                    width: 32,
                    height: 32,
                    padding: 2,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
                <Input
                  size="sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                  flex={1}
                  minW="120px"
                />
                <Input
                  size="sm"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                  flex={2}
                  minW="160px"
                />
                <HStack gap={1}>
                  <Button
                    size="xs"
                    colorPalette="blue"
                    loading={updateMut.isPending}
                    onClick={() => handleUpdate(area.id)}
                  >
                    Save
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </HStack>
              </HStack>
            ) : (
              <HStack
                key={area.id}
                p={3}
                borderWidth={1}
                borderRadius="md"
                bg="bg.subtle"
                justify="space-between"
                flexWrap="wrap"
                gap={2}
              >
                <HStack gap={3}>
                  <Box
                    w={5}
                    h={5}
                    borderRadius="sm"
                    bg={area.color || "gray.300"}
                    flexShrink={0}
                  />
                  <Stack gap={0}>
                    <Text fontWeight="medium" fontSize="sm">
                      {area.name}
                    </Text>
                    {area.description && (
                      <Text fontSize="xs" color="fg.muted">
                        {area.description}
                      </Text>
                    )}
                  </Stack>
                </HStack>
                <HStack gap={1}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => startEdit(area)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    loading={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(area.id)}
                  >
                    Delete
                  </Button>
                </HStack>
              </HStack>
            ),
          )}
        </Stack>
      )}

      {createOpen ? (
        <Box
          as="form"
          onSubmit={handleCreate}
          p={3}
          borderWidth={1}
          borderRadius="md"
          bg="bg.subtle"
        >
          <Stack gap={3}>
            <HStack gap={2} flexWrap="wrap">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>
                  Color
                </Text>
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  style={{
                    width: 32,
                    height: 32,
                    padding: 2,
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: "transparent",
                  }}
                />
              </Box>
              <Field.Root flex={1} minW="120px" required>
                <Field.Label fontSize="xs">Name</Field.Label>
                <Input
                  size="sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Mathematics"
                />
              </Field.Root>
              <Field.Root flex={2} minW="160px">
                <Field.Label fontSize="xs">Description</Field.Label>
                <Input
                  size="sm"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional"
                />
              </Field.Root>
            </HStack>
            <HStack gap={2}>
              <Button
                type="submit"
                size="sm"
                colorPalette="blue"
                loading={createMut.isPending}
              >
                Create Area
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
            </HStack>
          </Stack>
        </Box>
      ) : (
        <Button
          size="sm"
          variant="outline"
          alignSelf="flex-start"
          onClick={() => setCreateOpen(true)}
        >
          + New Area
        </Button>
      )}
    </Stack>
  );
}

function DashboardModulesConfig() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const activeModules: string[] = settings?.dashboard_modules?.length
    ? settings.dashboard_modules
    : DEFAULT_DASHBOARD_MODULES;

  const updateMut = useMutation({
    mutationFn: (modules: string[]) =>
      updateSettings(settings!.id, { dashboard_modules: modules }),
    onSuccess: () => {
      invalidateSettingsCaches(qc);
      toaster.create({ type: "success", title: "Dashboard updated" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to update dashboard" });
    },
  });

  const toggle = (key: string) => {
    if (!settings) return;
    if (activeModules.includes(key)) {
      if (activeModules.length <= 1) return; // enforce min 1
      updateMut.mutate(activeModules.filter((k) => k !== key));
    } else {
      if (activeModules.length >= 2) return; // enforce max 2
      updateMut.mutate([...activeModules, key]);
    }
  };

  return (
    <Stack id="dashboard-modules" gap={2}>
      <Text fontSize="sm" color="fg.muted">
        Choose 1–2 modules to show above the This Week view. The This Week view
        is always shown.
      </Text>
      <Stack gap={2}>
        {DASHBOARD_MODULE_OPTIONS.map((opt) => {
          const isActive = activeModules.includes(opt.key);
          const isDisabled =
            updateMut.isPending ||
            (!isActive && activeModules.length >= 2) ||
            (isActive && activeModules.length <= 1);
          return (
            <HStack
              key={opt.key}
              p={3}
              borderWidth={1}
              borderRadius="md"
              bg={isActive ? "colorPalette.subtle" : "bg.subtle"}
              borderColor={isActive ? "colorPalette.muted" : "border"}
              transition="all 0.15s"
              cursor={isDisabled ? "not-allowed" : "pointer"}
              opacity={isDisabled ? 0.5 : 1}
              onClick={() => !isDisabled && toggle(opt.key)}
            >
              <Checkbox.Root
                checked={isActive}
                onCheckedChange={() => toggle(opt.key)}
                size="sm"
                disabled={isDisabled}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
              </Checkbox.Root>
              <Stack gap={0} flex={1}>
                <Text fontSize="sm" fontWeight={isActive ? "medium" : "normal"}>
                  {opt.label}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {opt.description}
                </Text>
              </Stack>
            </HStack>
          );
        })}
      </Stack>
    </Stack>
  );
}

function SettingSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Box id={id} scrollMarginTop={4}>
      <Stack gap={4}>
        <Box>
          <Heading size="md">{title}</Heading>
          {description && (
            <Text mt={1} fontSize="sm" color="fg.muted">
              {description}
            </Text>
          )}
        </Box>
        <Box p={5} borderWidth={1} borderRadius="lg" bg="bg.panel">
          {children}
        </Box>
      </Stack>
    </Box>
  );
}

function VacationsConfig() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: getSettings,
  });

  const { data: vacations = [] } = useQuery<Vacation[]>({
    queryKey: ["vacations"],
    queryFn: listVacations,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [strategy, setStrategy] = useState<VacationStrategy>("push_back");
  const [recoveryBefore, setRecoveryBefore] = useState(0);
  const [recoveryAfter, setRecoveryAfter] = useState(0);
  const [overrideWorkWeek, setOverrideWorkWeek] = useState(false);
  const [workWeekOverrideDays, setWorkWeekOverrideDays] = useState<string[]>(
    [],
  );
  const [overflowCount, setOverflowCount] = useState<number | null>(null);
  const [overflowDialogOpen, setOverflowDialogOpen] = useState(false);
  const [pendingData, setPendingData] = useState<Omit<
    Vacation,
    "id" | "owner" | "created" | "updated"
  > | null>(null);

  const globalWorkWeek = settings?.work_week?.length
    ? settings.work_week
    : DEFAULT_WORK_WEEK;
  const ALL_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const DAY_LABEL: Record<string, string> = {
    sun: "Sunday",
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
  };
  const offDays = ALL_DAYS.filter((d) => !globalWorkWeek.includes(d));

  const createMut = useMutation({
    mutationFn: createAndApplyVacation,
    onSuccess: () => {
      invalidateVacationCaches(qc);
      setFormOpen(false);
      setName("");
      setStartDate("");
      setEndDate("");
      setStrategy("push_back");
      setRecoveryBefore(0);
      setRecoveryAfter(0);
      setOverrideWorkWeek(false);
      setWorkWeekOverrideDays([]);
      setPendingData(null);
      setOverflowCount(null);
      toaster.create({ type: "success", title: "Vacation scheduled" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to schedule vacation" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteVacation,
    onSuccess: () => {
      invalidateVacationCaches(qc);
      toaster.create({ type: "success", title: "Vacation deleted" });
    },
    onError: () => {
      toaster.create({ type: "error", title: "Failed to delete vacation" });
    },
  });

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: Omit<Vacation, "id" | "owner" | "created" | "updated"> = {
      name,
      start_date: startDate,
      end_date: endDate,
      strategy,
      recovery_before_days: recoveryBefore,
      recovery_after_days: recoveryAfter,
      work_week_override_days: overrideWorkWeek ? workWeekOverrideDays : [],
    };

    if (strategy === "stack" && settings) {
      const activeIds: string[] = settings.active_programs ?? [];
      const count = await previewStackOverflow(data, activeIds);
      if (count > 0) {
        setOverflowCount(count);
        setPendingData(data);
        setOverflowDialogOpen(true);
        return;
      }
    }

    createMut.mutate(data);
  };

  const strategyLabel: Record<VacationStrategy, string> = {
    stack: "Stack (pre-vacation)",
    recovery: "Recovery days",
    push_back: "Push back",
  };

  return (
    <Stack id="vacations" gap={4}>
      <Alert.Root colorPalette="orange" size="sm">
        <Alert.Content>
          <Alert.Description>
            Rescheduling is applied immediately and cannot be automatically
            reversed.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>

      {/* Existing vacations list */}
      {vacations.length > 0 && (
        <Stack id="existing-vacations" gap={2}>
          {vacations.map((v) => (
            <HStack
              key={v.id}
              id={`vacation-${v.id}`}
              p={3}
              borderWidth={1}
              borderRadius="md"
              bg="bg.subtle"
              justify="space-between"
              flexWrap="wrap"
              gap={2}
            >
              <Stack align="flex-start" id={`vacation-${v.id}-details`} gap={0}>
                <Text fontWeight="medium" fontSize="sm">
                  {v.name}
                </Text>
                <HStack gap={2} mt={0.5}>
                  <Badge variant="outline" size="sm">
                    {v.start_date} – {v.end_date}
                  </Badge>
                  <Badge colorPalette="blue" variant="subtle" size="sm">
                    {strategyLabel[v.strategy]}
                  </Badge>
                </HStack>
              </Stack>
              <Button
                size="xs"
                variant="ghost"
                colorPalette="red"
                loading={deleteMut.isPending}
                onClick={() => deleteMut.mutate(v.id)}
              >
                Delete
              </Button>
            </HStack>
          ))}
        </Stack>
      )}

      {/* Add form toggle */}
      {!formOpen ? (
        <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
          Add Vacation
        </Button>
      ) : (
        <Box
          id="add-vacation"
          as="form"
          onSubmit={(e: React.FormEvent) => void handleSchedule(e)}
          p={4}
          borderWidth={1}
          borderRadius="md"
          bg="bg.muted"
        >
          <Stack gap={3}>
            <Field.Root required>
              <Field.Label>Name</Field.Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field.Root>

            <Stack direction="row" gap={3}>
              <Field.Root required>
                <Field.Label>Start Date</Field.Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </Field.Root>
              <Field.Root required>
                <Field.Label>End Date</Field.Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </Field.Root>
            </Stack>

            <Field.Root>
              <Field.Label>Strategy</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={strategy}
                  onChange={(e) =>
                    setStrategy(e.target.value as VacationStrategy)
                  }
                >
                  <option value="push_back">
                    Push back (shift all dates forward)
                  </option>
                  <option value="stack">
                    Stack (move lessons before vacation)
                  </option>
                  <option value="recovery">
                    Recovery days (spread lessons around vacation)
                  </option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>

            {strategy === "recovery" && (
              <Stack direction="row" gap={3}>
                <Field.Root>
                  <Field.Label>Recovery days before</Field.Label>
                  <Input
                    type="number"
                    min={0}
                    value={recoveryBefore}
                    onChange={(e) => setRecoveryBefore(Number(e.target.value))}
                    w="80px"
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Recovery days after</Field.Label>
                  <Input
                    type="number"
                    min={0}
                    value={recoveryAfter}
                    onChange={(e) => setRecoveryAfter(Number(e.target.value))}
                    w="80px"
                  />
                </Field.Root>
              </Stack>
            )}

            {offDays.length > 0 && (
              <Stack gap={2}>
                <Checkbox.Root
                  checked={overrideWorkWeek}
                  onCheckedChange={({ checked }) => {
                    setOverrideWorkWeek(!!checked);
                    if (!checked) setWorkWeekOverrideDays([]);
                  }}
                  size="sm"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label fontSize="sm">
                    Override work week for this vacation
                  </Checkbox.Label>
                </Checkbox.Root>
                {overrideWorkWeek && (
                  <Stack gap={1} pl={5}>
                    <Text fontSize="xs" color="fg.muted">
                      Select off-days to allow scheduling during this vacation:
                    </Text>
                    {offDays.map((day) => (
                      <Checkbox.Root
                        key={day}
                        size="sm"
                        checked={workWeekOverrideDays.includes(day)}
                        onCheckedChange={({ checked }) => {
                          setWorkWeekOverrideDays((prev) =>
                            checked
                              ? [...prev, day]
                              : prev.filter((d) => d !== day),
                          );
                        }}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label fontSize="sm">
                          {DAY_LABEL[day]}
                        </Checkbox.Label>
                      </Checkbox.Root>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}

            <HStack>
              <Button type="submit" size="sm" loading={createMut.isPending}>
                Schedule Vacation
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  setOverrideWorkWeek(false);
                  setWorkWeekOverrideDays([]);
                }}
              >
                Cancel
              </Button>
            </HStack>
          </Stack>
        </Box>
      )}

      {/* Stack overflow confirmation dialog */}
      <Dialog.Root
        id="overflow-confirmation"
        open={overflowDialogOpen}
        onOpenChange={({ open: o }) => !o && setOverflowDialogOpen(false)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Confirm Schedule</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                {overflowCount} lesson{overflowCount !== 1 ? "s" : ""} will
                exceed the 2/day cap due to limited pre-vacation days. Continue
                anyway?
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="ghost"
                onClick={() => {
                  setOverflowDialogOpen(false);
                  setPendingData(null);
                  setOverflowCount(null);
                }}
              >
                Cancel
              </Button>
              <Button
                loading={createMut.isPending}
                onClick={() => {
                  if (pendingData) {
                    setOverflowDialogOpen(false);
                    createMut.mutate(pendingData);
                  }
                }}
              >
                Continue
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
}

export default function Settings() {
  const email = pb.authStore.record?.email as string | undefined;
  const initials = email ? email[0].toUpperCase() : "?";

  return (
    <Grid
      id="settings"
      templateColumns={{ base: "1fr", md: "180px 1fr" }}
      gap={8}
      alignItems="start"
    >
      {/* Sidebar nav */}
      <Box
        display={{ base: "none", md: "block" }}
        position="sticky"
        top={4}
        pt={1}
      >
        <Stack gap={1}>
          {SECTION_NAV.map((s) => (
            <Link
              key={s.id}
              id={`nav-${s.id}`}
              href={`#${s.id}`}
              px={3}
              py={1.5}
              borderRadius="md"
              fontSize="sm"
              color="fg.muted"
              _hover={{ bg: "bg.muted", color: "fg" }}
              transition="all 0.15s"
              textDecoration="none"
            >
              {s.label}
            </Link>
          ))}
        </Stack>
      </Box>

      {/* Main content */}
      <Stack id="main-content" gap={10}>
        <Heading size="lg">Settings</Heading>

        <SettingSection
          id="areas"
          title="Areas"
          description="Define subject areas used to categorise programs and resources. Set these up before importing a program."
        >
          <AreasConfig />
        </SettingSection>

        <SettingSection
          id="general"
          title="General"
          description="Configure defaults for scheduling."
        >
          <GeneralSettings />
        </SettingSection>

        <SettingSection
          id="dashboard"
          title="Dashboard"
          description="Choose which modules are shown on the dashboard."
        >
          <DashboardModulesConfig />
        </SettingSection>

        <SettingSection
          id="active-programs"
          title="Active Programs"
          description="Choose which programs are visible on the dashboard."
        >
          <ActiveProgramsConfig />
        </SettingSection>

        <SettingSection
          id="storage"
          title="Storage"
          description="Track your attachment storage usage. Default quota is 500 MB."
        >
          <StorageConfig />
        </SettingSection>

        <SettingSection
          id="vacations"
          title="Vacations"
          description="Schedule vacation periods — lessons will be automatically rescheduled using the chosen strategy."
        >
          <VacationsConfig />
        </SettingSection>

        <SettingSection
          id="export-data"
          title="Export Data"
          description="Download a copy of your data in JSON or CSV format."
        >
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={2}>
            {COLLECTIONS.map((c) => (
              <ExportButton key={c.key} label={c.label} collectionKey={c.key} />
            ))}
          </Grid>
        </SettingSection>

        <SettingSection id="account" title="Account">
          <HStack justify="space-between" gap={4}>
            <Avatar.Root size="md" colorPalette="blue">
              <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar.Root>
            <Stack align="flex-end" gap={2}>
              <Text fontWeight="medium" fontSize="sm">
                {email}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Signed in
              </Text>
            </Stack>
          </HStack>
        </SettingSection>
      </Stack>
    </Grid>
  );
}
