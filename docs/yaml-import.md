# YAML Import Guide

Regula supports importing programs and lessons from YAML files. This is useful for importing syllabi or course materials quickly.

## What Is YAML Import?

Instead of manually creating every program, module, and lesson, you can:

1. Prepare a YAML file with course structure
2. Upload to Regula
3. Automatically creates programs and lessons

This saves hours of data entry for syllabi-based courses.

## YAML File Format

### Basic Structure

```yaml
name: "Course Name"
type: "term" # or "year", "block", "custom"
start_date: "2026-01-15"
end_date: "2026-05-15"
block_weeks: 4 # optional
modules:
  - title: "Module 1"
    start_date: "2026-01-15"
    end_date: "2026-01-29"
    lessons:
      - title: "Lesson 1.1"
        due_at: "2026-01-20"
      - title: "Lesson 1.2"
        due_at: "2026-01-27"
  - title: "Module 2"
    start_date: "2026-01-30"
    end_date: "2026-02-13"
```

### Field Reference

#### Program Fields

| Field       | Type   | Required | Notes                             |
| ----------- | ------ | -------- | --------------------------------- |
| name        | string | Yes      | Course/program name               |
| type        | string | Yes      | One of: year, term, block, custom |
| start_date  | date   | Yes      | Format: YYYY-MM-DD                |
| end_date    | date   | Yes      | Format: YYYY-MM-DD                |
| block_weeks | number | No       | Weeks per block (term only)       |
| area        | string | No       | Subject area category             |
| description | string | No       | Program details                   |
| modules     | array  | No       | Module definitions (below)        |

#### Module Fields

| Field       | Type   | Required | Notes                      |
| ----------- | ------ | -------- | -------------------------- |
| title       | string | Yes      | Module/chapter name        |
| start_date  | date   | Yes      | Format: YYYY-MM-DD         |
| end_date    | date   | Yes      | Format: YYYY-MM-DD         |
| description | string | No       | Module details             |
| lessons     | array  | No       | Lesson definitions (below) |

#### Lesson Fields

| Field        | Type   | Required | Notes                |
| ------------ | ------ | -------- | -------------------- |
| title        | string | Yes      | Lesson name          |
| due_at       | date   | Yes      | Format: YYYY-MM-DD   |
| available_on | date   | No       | Format: YYYY-MM-DD   |
| type         | string | No       | Lesson type category |
| content      | string | No       | Links or notes       |

### Date Format

All dates use ISO format: **YYYY-MM-DD**

Examples:

- "2026-01-15" = January 15, 2026
- "2026-12-31" = December 31, 2026

## Example YAML File

### Simple Course

```yaml
name: "CS101 - Introduction to Programming"
type: "term"
start_date: "2026-01-15"
end_date: "2026-05-15"
block_weeks: 4
area: "Computer Science"
modules:
  - title: "Week 1-2: Basics"
    start_date: "2026-01-15"
    end_date: "2026-01-29"
    lessons:
      - title: "Ch 1 Reading"
        due_at: "2026-01-20"
      - title: "Ch 1 Problems"
        due_at: "2026-01-22"
      - title: "Ch 2 Reading"
        due_at: "2026-01-27"
```

### With Detailed Info

```yaml
name: "History 200 - World History"
type: "term"
start_date: "2026-02-01"
end_date: "2026-05-15"
description: "Survey of world history from 1500 to present"
area: "History"
block_weeks: 3
modules:
  - title: "Module 1: Age of Exploration"
    start_date: "2026-02-01"
    end_date: "2026-02-21"
    description: "1500-1700: European expansion"
    lessons:
      - title: "Chapter 1: Origins of Exploration"
        due_at: "2026-02-07"
        type: "reading"
        available_on: "2026-02-01"
        content: "Textbook Chapter 1, pages 1-45"
      - title: "Discussion: Exploration Motives"
        due_at: "2026-02-10"
        type: "discussion"
      - title: "Map Quiz"
        due_at: "2026-02-14"
        type: "quiz"
  - title: "Module 2: Colonial Americas"
    start_date: "2026-02-22"
    end_date: "2026-03-14"
```

## Importing a Course

### Step-by-Step

1. **Go to Programs page**
   - Sidebar → Programs

2. **Click "Import Program"**
   - Button at top right

3. **Provide YAML**
   - Paste YAML content OR
   - Upload YAML file

4. **Preview**
   - System shows what will be created
   - Review for accuracy

5. **Confirm Import**
   - Click "Import" button
   - System processes and creates structure

6. **Verify Result**
   - Go to Programs
   - New program should appear
   - Check modules and lessons

### Pasting YAML

```
Option 1: Direct Paste
1. Click "Import Program"
2. Copy YAML content
3. Paste into text area
4. Click Import
```

### Uploading File

```
Option 2: File Upload
1. Click "Import Program"
2. Select "Upload File"
3. Choose your .yaml or .yml file
4. Click Import
```

## Creating YAML from a Syllabus

### Step 1: Extract Structure

From your course syllabus, identify:

- Course name and code
- Start and end dates
- Major topics/modules
- Unit breakdown

### Step 2: Add Lessons

For each module, add lessons with:

- Topic or chapter name
- Due date (from syllabus schedule)
- Lesson type (reading, assignment, quiz, etc.)

### Step 3: Format as YAML

Use the examples above as templates.

### Step 4: Test

- Import into test program
- Verify structure looks right
- Adjust if needed
- Re-import

## Converting from Other Formats

### From a Spreadsheet

If you have a spreadsheet:

1. Export as CSV
2. Write Python/Excel script to convert
3. Output as YAML
4. Import into Regula

### From a PDF Syllabus

1. Manually extract key dates
2. Build YAML structure
3. Import into Regula

### From Plain Text

If you have an outline:

1. Format with dates
2. Structure into YAML
3. Import into Regula

## Common Patterns

### Semester with Weekly Modules

```yaml
name: "Term Spring 2026"
type: "term"
start_date: "2026-01-15"
end_date: "2026-05-15"
block_weeks: 4
modules:
  - title: "Week 1"
    start_date: "2026-01-15"
    end_date: "2026-01-21"
  - title: "Week 2"
    start_date: "2026-01-22"
    end_date: "2026-01-28"
  # ... continue for each week
```

### Course with Unit Exams

```yaml
modules:
  - title: "Unit 1: Chapters 1-3"
    lessons:
      - title: "Ch 1-3 Reading"
        due_at: "YYYY-MM-DD"
      - title: "Practice Problems"
        due_at: "YYYY-MM-DD"
      - title: "Unit 1 Exam"
        due_at: "YYYY-MM-DD"
        type: "exam"
```

## Troubleshooting Import

### Import Failed

**Check:**

- YAML syntax is valid (no typos)
- Dates are correct format (YYYY-MM-DD)
- Required fields present
- Program name not duplicate

### Wrong Import Result

**Verify:**

- Dates are accurate
- Module dates contain lessons
- Title spelling correct

If wrong, delete the program and reimport with corrected YAML.

### Dates Shifted

**If lessons appear on wrong dates:**

- Check available_on vs due_at
- Verify YAML format
- Re-import with corrections

## Tips for Successful Import

1. **Start simple** - Import just structure first
2. **Validate dates** - Double-check against syllabus
3. **Use consistent format** - Same date format throughout
4. **Test small** - Import one module first
5. **Preview first** - Review before confirming
6. **Keep original** - Save original YAML file
7. **Document types** - Use meaningful lesson types

## Advanced: Multiple Programs

To import multiple programs:

1. Create YAML for each
2. Import one at a time
3. Or combine with parent/child relationship

Example structure:

```yaml
# Year.yaml - Top level
name: "Academic Year 2026"
type: "year"
start_date: "2026-01-01"
end_date: "2026-12-31"

# Term.yaml - Under year
name: "Spring 2026"
type: "term"
parent: "Academic Year 2026"
# ... modules with courses
```

## Next Steps

- **[Getting Started](getting-started.md)** - First steps
- **[Programs](programs.md)** - Manage imported programs
- **[Modules & Lessons](modules-and-lessons.md)** - Edit imported content
