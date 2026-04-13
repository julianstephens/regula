# Managing Programs

Programs are the foundation of your study plan in Regula. Learn how to create, organize, and manage them effectively.

## What Is a Program?

A **Program** is a container for your study material. It represents a course, semester, year, or any other study period. See [Core Concepts: Programs](core-concepts.md#programs) for an overview.

## Creating a Program

### Basic Steps

1. Go to **Programs** in the sidebar
2. Click **New Program**
3. Fill in the form:
   - **Name**: Title of the program (required)
   - **Type**: Year, Term, Block, or Custom
   - **Status**: Planned, Active, Completed, or Archived
   - **Start Date**: When it begins
   - **End Date**: When it ends
4. Click **Create**

### Program Types Explained

| Type       | Use When                             | Duration    |
| ---------- | ------------------------------------ | ----------- |
| **Year**   | Planning a full academic year        | ~52 weeks   |
| **Term**   | Planning a semester/quarter          | 12-16 weeks |
| **Block**  | Focused study period (intense focus) | 2-8 weeks   |
| **Custom** | Any other study organization         | Variable    |

### Optional Settings

When creating a **Term-type** program, you'll also set:

**Block Weeks**: Number of weeks per study block

- Example: 4 (each block lasts 4 weeks)
- This is used to divide the term into focused periods
- You can override this for individual terms in Settings

**Area** (Optional): Categorize by subject area

- Helps organize programs
- Makes filtering easier
- Examples: "Computer Science", "Mathematics", "Languages"

**Meeting Days** (Optional): Days the program meets

- Useful for tracking scheduled class times
- Format: List of days (Mon, Tue, Wed, etc.)

**Makeup Days** (Optional): Days reserved for makeup sessions

- For rescheduled or make-up work
- Helps plan flexibility into your schedule

## Program Status

Each program has a status that affects how it appears:

- **Planned**: Yellow/Gray - Not yet started
- **Active**: Green - Currently ongoing (appears on dashboard)
- **Completed**: Blue - Finished
- **Archived**: Orange - Historical, not active

**To change status:**

1. Open the program
2. Edit the status field
3. Click **Update**

**Tip**: Archive programs to keep them organized without clutter.

## Program Hierarchy

Programs can contain sub-programs. This creates a hierarchy:

```
Year
├── Term 1
│   ├── Course 1
│   └── Course 2
└── Term 2
    ├── Course 3
    └── Course 4
```

### Creating Sub-Programs

When creating a new program, you can set a **Parent Program**:

1. Click **New Program**
2. In the form, set **Parent Program** to another program
3. Set the relationship type based on program types

This creates a hierarchy where sub-programs inherit high-level planning from their parent.

## Viewing Program Details

### Overview Tab

Shows key information:

- Program name, type, and status
- Dates and duration
- Area assignment
- Meeting days and makeup days
- Edit/Delete buttons

### Modules Tab

Lists all modules in the program with:

- Module title
- Date range
- Lesson count
- Click to view module details

**Add modules here** or go to **Modules** page.

### Lessons Tab

Lists all lessons in the program:

- Lesson title
- Status
- Due date
- Click to view/edit lesson

**Filter by module** if many modules exist.

**Add new lessons** by:

1. Opening a module
2. Creating lessons within it

### Sub-Programs Tab

If the program has children, shows:

- Sub-program name
- Type and status
- Parent-child relationship

Only visible if this program has sub-programs.

## Editing a Program

1. Go to **Programs**
2. Click on the program name to open it
3. Click **Edit** button
4. Modify fields:
   - Name
   - Status
   - Dates
   - Area
   - Meeting/makeup days
5. Click **Update**

**Note**: Changing a program affects all lessons within it.

## Blocking a Term

For **Term-type** programs, you can automatically divide it into blocks.

### What Blocking Does

Creates a regular schedule of study blocks with rest weeks:

- Example: 4-week blocks with 1-week rest periods
- Helps structure the term
- Used for planning study sessions

### To Block a Term

1. Open a Term program
2. Click **Block Term** button
3. Confirm the number of block weeks
4. The term is divided into labeled periods

**Result**: Blocks created in the dashboard and used for progress tracking.

## Deleting a Program

**Warning**: This is permanent and removes all associated data.

1. Open the program
2. Click **Delete**
3. Confirm the deletion

**Deleting a program also deletes:**

- All modules in it
- All lessons in it
- All assessments linked to it
- Associated sessions and events

**Tip**: Archive instead of delete if you might need the data later.

## Organizing Programs

### Using Areas

Group related programs by area:

1. Create programs with the same **Area** value
2. Go to **Resources** page to filter by area
3. Similar programs appear together

### Using Status

Keep your program list clean:

- **Active**: Currently using
- **Planned**: Future study periods
- **Completed**: Finished courses (consider archiving)
- **Archived**: Historical reference

### Import Programs

Instead of creating manually:

1. Go to **Programs**
2. Click **Import Program**
3. Provide YAML course data
4. Regula creates the program structure

See [YAML Import Guide](yaml-import.md) for format details.

## Program Tips

### Planning a Term

1. Create the Term program with dates
2. Set **Block Weeks** (usually 4-6 weeks)
3. Create Modules for each week or unit
4. Create Lessons within each Module
5. Use the Dashboard to track progress

### Managing Multiple Programs

- Use **Areas** to organize by subject
- Use **Status** to show only active programs
- Archive completed programs
- Filter by program when viewing modules/lessons

### Rescheduling a Program

If you need to move dates:

1. Open the program
2. Edit the dates
3. Click **Update**

**Note**: This doesn't automatically reschedule lessons. Update lesson dates individually if needed.

## Next Steps

- **[Creating Modules & Lessons](modules-and-lessons.md)** - Add content to programs
- **[Importing from YAML](yaml-import.md)** - Quick import of full courses
- **[Dashboard Guide](dashboard.md)** - See programs in action
- **[Settings](settings.md)** - Configure defaults
