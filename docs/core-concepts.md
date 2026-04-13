# Core Concepts

Understanding these key concepts will help you get the most out of Regula.

## Programs

A **Program** is the top-level container for your study plan. Each program has a type and optional metadata.

### Program Types

| Type       | Purpose                        | Duration    |
| ---------- | ------------------------------ | ----------- |
| **Year**   | Full academic or calendar year | ~52 weeks   |
| **Term**   | Semester, quarter, or term     | 12-16 weeks |
| **Block**  | Focused study period           | 2-8 weeks   |
| **Custom** | Any other study period         | Variable    |

### Program Status

- **Planned**: Not yet started
- **Active**: Currently ongoing
- **Completed**: Finished
- **Archived**: Historical reference only

### Program Hierarchy

Programs can contain sub-programs (a term can have courses, a block can have sub-blocks):

- **Year** → **Terms**
- **Term** → **Courses**
- **Block** → **Sub-blocks**
- **Custom** → **Sub-programs**

### Program Settings

When creating a program, you can set:

- **Block Weeks**: Number of weeks per study block (for term-type programs)
- **Meeting Days**: Days the program meets (optional)
- **Makeup Days**: Days used for makeup sessions (optional)
- **Area**: Categorize by area (optional)

## Modules

A **Module** is a collection of related lessons within a program. Think of modules as chapters or units.

### Module Properties

- **Title**: Name of the module
- **Program**: Which program it belongs to
- **Start Date**: When the module begins
- **End Date**: When the module ends

Modules help organize lessons hierarchically and make it easier to track progress within a program.

## Lessons

A **Lesson** is an individual learning unit. Each lesson has:

### Lesson Properties

- **Title**: Name of the lesson
- **Module**: Which module it belongs to
- **Program**: Associated program
- **Due Date**: When the lesson must be completed
- **Available Date**: When you can start working on it
- **Type**: Optional categorization (e.g., reading, assignment, quiz)
- **Course**: Optional course association
- **Status**: The current state of the lesson

### Lesson Status

| Status          | Meaning                   |
| --------------- | ------------------------- |
| **Not Started** | Haven't begun work        |
| **Active**      | Currently working on it   |
| **Blocked**     | Depends on another lesson |
| **Completed**   | Finished and submitted    |

### Lesson Content

You can attach:

- Links to resources
- Notes and descriptions
- Study minutes tracked via sessions

## Assessments

An **Assessment** is an evaluation (test, quiz, project, paper, etc.) that measures your learning.

### Assessment Status

| Status          | Meaning               |
| --------------- | --------------------- |
| **Not Started** | Haven't begun         |
| **In Progress** | Working on it         |
| **Submitted**   | Turned in for grading |
| **Graded**      | Received feedback     |
| **Archived**    | No longer relevant    |

Assessments can be linked to lessons and have their own due dates.

## Reviews

A **Review** is a scheduled spaced-repetition session for reinforcing learning. After completing a lesson, reviews are automatically scheduled at increasing intervals.

### Review Properties

- **Lesson**: Which lesson is being reviewed
- **Due Date**: When the review is scheduled
- **Status**: Not started, in progress, or completed
- **Difficulty**: Optional rating of how challenging it was

Reviews help you retain knowledge through spaced repetition.

## Study Sessions

A **Study Session** tracks time spent studying lessons. Sessions record:

- **Lesson**: Which lesson you studied
- **Duration**: Minutes spent
- **Date**: When the session occurred
- **Notes**: Optional notes about the session

You can log sessions manually or use the built-in timer.

## Item Events

**Item Events** track significant changes to lessons:

- Status changes (not started → active → completed)
- Due date changes
- Other important updates

These create a timeline of your progress for each lesson.

## Blocks

A **Block** is a period of focused study within a term. When creating a term-type program, you can define:

- **Block Duration**: How many weeks each study block lasts
- **Rest Weeks**: Weeks between blocks for rest/catch-up

For example, a 16-week term might have:

- Block 1: Weeks 1-4
- Rest: Week 5
- Block 2: Weeks 6-9
- Rest: Week 10
- Block 3: Weeks 11-14
- Exam: Weeks 15-16

The dashboard shows progress for active blocks and which block week you're in.

## Study Planning

### "Ahead Weeks"

The "Ahead Weeks" setting tells Regula how far in advance to show available lessons:

- **Default**: 2 weeks
- **Use case**: See lessons you can start next week

The dashboard and calendar show lessons up to (today + ahead_weeks).

## Areas

**Areas** are optional organizational tags that help categorize programs and resources. Examples:

- Computer Science
- Mathematics
- Languages
- Physical Education

Areas help you organize and filter your study programs.

## Resources

**Resources** are reference materials (textbooks, websites, videos, etc.) that support your learning. You can:

- Link resources to programs
- Tag them by area
- Mark as favorite

Resources provide quick access to materials you frequently use.

## Color-Coding and Badges

Throughout Regula, you'll see color-coded badges for:

| Feature            | Colors                                                              |
| ------------------ | ------------------------------------------------------------------- |
| **Program Status** | Gray (planned), Green (active), Blue (completed), Orange (archived) |
| **Lesson Status**  | Varies by status                                                    |
| **Item Type**      | Context-dependent                                                   |

These visual cues help you quickly identify what attention is needed.
