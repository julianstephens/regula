export interface ParsedSession {
  index: number;
  title: string;
  date?: string;
  reading?: string;
  inSession?: string;
  homework?: string;
  isSpecial: boolean;
  specialType?: "quiz" | "exam";
}

export interface ParsedTrack {
  sessions: ParsedSession[];
}

export interface ParsedSyllabus {
  area: string;
  term: string;
  meetingDays: number[]; // JS getDay() values
  tracks: ParsedTrack[];
  filename: string;
}

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function parseFrontmatter(md: string): { area: string; term: string } {
  const match = /^---\s*\n([\s\S]*?)\n---/.exec(md);
  if (!match) return { area: "", term: "" };
  const block = match[1];
  const area = /^area:\s*(.+)$/m.exec(block)?.[1]?.trim() ?? "";
  const term = /^term:\s*(.+)$/m.exec(block)?.[1]?.trim() ?? "";
  return { area, term };
}

function parseMeetingDays(md: string): number[] {
  // Match lines like: **Meeting:** Tuesday / Thursday
  const match = /\*{0,2}Meeting:\*{0,2}\s*(.+)/i.exec(md);
  if (!match) return [1];
  const raw = match[1];
  const days = raw
    .split(/[/,]/)
    .map((s) => s.trim().toLowerCase())
    .map((s) => DAY_MAP[s])
    .filter((d): d is number => d !== undefined);
  return days.length > 0 ? days : [1];
}

// Strip markdown bold/italic markers and trim cell content
function cleanCell(s: string): string {
  return s
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .trim();
}

function detectSpecial(
  rawTitle: string,
): { isSpecial: true; specialType: "quiz" | "exam"; title: string } | null {
  // Only flag if the title cell has bold markers (indicates an exam/quiz row)
  const hasBold = /\*{2}[^*]+\*{2}/.test(rawTitle.trim());
  if (!hasBold) return null;
  const lower = rawTitle.toLowerCase();
  if (
    lower.includes("block quiz") ||
    lower.includes("midterm") ||
    lower.includes("mid-term")
  ) {
    return { isSpecial: true, specialType: "quiz", title: "Midterm" };
  }
  if (lower.includes("final exam") || lower.includes("final")) {
    return { isSpecial: true, specialType: "exam", title: "Final Exam" };
  }
  if (lower.includes("exam")) {
    return { isSpecial: true, specialType: "exam", title: "Final Exam" };
  }
  if (lower.includes("quiz")) {
    return { isSpecial: true, specialType: "quiz", title: "Midterm" };
  }
  return null;
}

type ColumnRole =
  | "title"
  | "date"
  | "reading"
  | "inSession"
  | "homework"
  | "ignored";

function detectColumnRole(header: string): ColumnRole {
  const h = header.toLowerCase();
  if (h === "date" || h === "session date") return "date";
  if (
    h.includes("focus") ||
    h.includes("topic") ||
    h.includes("emphasis") ||
    h.includes("proposition")
  )
    return "title";
  if (
    h.includes("reading") ||
    h.includes("text focus") ||
    h.includes("section") ||
    h.includes("sections")
  )
    return "reading";
  if (
    h.includes("in-session") ||
    h.includes("in session") ||
    h.includes("assignment") ||
    h.includes("task") ||
    h.includes("work")
  )
    return "inSession";
  if (h.includes("homework") || h.includes("reconstruction")) return "homework";
  return "ignored";
}

function parseTable(lines: string[]): ParsedTrack | null {
  if (lines.length < 3) return null;

  // First line: headers
  const headerCells = lines[0]
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const roles: ColumnRole[] = headerCells.map(detectColumnRole);

  // lines[1] is separator — skip it
  const sessions: ParsedSession[] = [];
  let idx = 0;

  for (let i = 2; i < lines.length; i++) {
    // re-split properly: split on |, drop first/last empty if the line starts/ends with |
    const rawCells = lines[i].split("|");
    // If line starts with |, rawCells[0] is empty; if ends with |, last is empty
    const trimmed = rawCells.slice(
      lines[i].startsWith("|") ? 1 : 0,
      lines[i].endsWith("|") ? rawCells.length - 1 : rawCells.length,
    );
    const dataCells = trimmed.map((c) => c.trim());

    if (dataCells.length === 0) continue;
    // Skip separator rows
    if (dataCells.every((c) => /^[-:]+$/.test(c))) continue;
    // Skip rows that are entirely empty
    if (dataCells.every((c) => c === "")) continue;

    // Find title column
    const titleCol = roles.indexOf("title");
    let rawTitleCell =
      titleCol >= 0 && titleCol < dataCells.length
        ? dataCells[titleCol]
        : dataCells[0];

    // Fall back: if no column was identified as title, use first non-date cell
    if (titleCol < 0) {
      rawTitleCell =
        dataCells.find((c) => !/^\d{4}-\d{2}-\d{2}/.test(c) && c !== "") ??
        dataCells[0];
    }

    const special = detectSpecial(rawTitleCell);

    let title: string;
    let isSpecial = false;
    let specialType: "quiz" | "exam" | undefined;

    if (special) {
      title = special.title;
      isSpecial = true;
      specialType = special.specialType;
    } else {
      title = cleanCell(rawTitleCell);
    }

    if (!title) continue;

    const getCol = (role: ColumnRole): string | undefined => {
      const col = roles.indexOf(role);
      if (col < 0 || col >= dataCells.length) return undefined;
      const val = cleanCell(dataCells[col]);
      return val || undefined;
    };

    sessions.push({
      index: idx++,
      title,
      date: getCol("date"),
      reading: getCol("reading"),
      inSession: getCol("inSession"),
      homework: getCol("homework"),
      isSpecial,
      specialType,
    });
  }

  if (sessions.length === 0) return null;
  return { sessions };
}

function extractTables(md: string): string[][] {
  const lines = md.split("\n");
  const tables: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      if (!current) current = [];
      current.push(trimmed);
    } else {
      if (current && current.length >= 3) {
        tables.push(current);
      }
      current = null;
    }
  }
  if (current && current.length >= 3) {
    tables.push(current);
  }
  return tables;
}

export function parseSyllabus(
  filename: string,
  content: string,
): ParsedSyllabus {
  const { area, term } = parseFrontmatter(content);
  const meetingDays = parseMeetingDays(content);
  const tableLines = extractTables(content);

  const tracks: ParsedTrack[] = tableLines
    .map(parseTable)
    .filter((t): t is ParsedTrack => t !== null);

  return { area, term, meetingDays, tracks, filename };
}
