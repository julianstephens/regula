# Regula

Regula is a personal learning management system designed to mimic a classroom structure. It helps non-traditional learners organize their learning materials, track their progress, and manage their study sessions. Regula is built with a focus on flexibility and customization, allowing users to tailor the system to their specific learning needs and preferences.

## Features

- Dashboard with customizable modules to display relevant information at a glance
- Calendar view to visualize upcoming sessions, deadlines, and events
- Program management with support for lessons, assessments, and reviews
- In-app documentation for all features
- Import programs from YAML course-of-study files
- Storage quota management to keep track of resource usage
- Vacation management infrastructure to plan breaks and time off
- Reports view to analyze learning progress and performance

## Architecture

Regula is built on PocketBase, a SQL database with a built-in API and authentication system. This vastly simplifies the backend development and allows for rapid prototyping. Since this is a project I was actively using while developing, PocketBase provided a convenient way to manage the data and perform administrative tasks without needing to set up a separate backend server. Data is organized into collections that represent different entities such as programs, lessons, assessments, and sessions. The API provided by PocketBase allows for easy CRUD operations on these collections, enabling the frontend to interact with the data seamlessly.

Each backend collection has a corresponding frontend module that handles the UI and interactions for that collection. For example, there are modules for managing programs, lessons, assessments, and sessions. This modular approach allows for better organization of the code and makes it easier to maintain and extend the application in the future. The frontend is developed using React with Chakra UI, which provides a set of accessible and customizable components.

### Data Model

The data model in Regula is designed to reflect the structure of a traditional classroom while also providing flexibility for non-traditional learners. The main entities in the data model include:

- **Program**: Represents a course of study, which can include multiple modules, lessons, assessments, and reviews. Programs can be imported from YAML files or created manually within the app.
- **Area**: Represents a broad subject area or category that programs can be associated with. This allows users to organize their programs by topic or field of study (e.g. "Computer Science", "History", "Language Learning").
- **Module**: Represents a specific unit of study within a program, which can include multiple lessons, assessments, and reviews. Modules can be used to break down a program into smaller, more manageable sections (e.g. "Introduction to Programming", "Data Structures", "Algorithms").
- **Resource**: Represents a specific text, lecture series, or other learning material that can be associated with lessons, assessments, and reviews.
- **Lesson**: Represents a specific learning activity or assignment that is associated with a resource. Lessons can have due dates and can be marked as completed when finished.
- **Assessment**: Represents a specific evaluation or test that is associated with a resource. Assessments can have due dates and can be marked as completed when finished.
- **Study Session**: Represents a scheduled study session that can include multiple lessons and assessments. Study sessions can be marked as completed when finished, and any associated lessons or assessments will also be marked as completed.
- **Review**: Represents a scheduled review session for previously completed lessons and assessments. Reviews can be used to reinforce learning and help with long-term retention of information.
- **Vacation**: Represents a planned break or time off from studying. Vacations can be scheduled in advance and will be taken into account when planning study sessions and reviews.
- **User Settings**: Represents the personal preferences and settings for a user, including work week configuration, storage quota, and other customizable options.

### Core Workflows

#### Program Creation and Management

Users can create new programs either by importing a YAML course-of-study file or by creating a program manually within the app. When creating a program, users can specify the name, description, associated area(s), and other relevant information. Once a program is created, users can add modules, lessons, assessments, and reviews to the program as needed. The program management interface allows users to easily organize and edit their programs, making it simple to keep track of their learning materials and progress.

Using the program import feature, users can quickly set up their learning materials by importing structured YAML files that define the program, modules, lessons, assessments, and resources. This allows for easy sharing of programs and makes it simple to get started with a new course of study without having to manually enter all the information.

#### Study Session Scheduling and Management

Users specify their work week configuration in the settings, which defines the days and times they are available for studying. When creating modules, users can specify the days of the week they want to study that module, and the system will automatically schedule study sessions based on the user's availability and the module's requirements. This is designed to mimic a traditional classroom schedule while also providing flexibility for non-traditional learners who may have varying availability throughout the week.

When a study session is completed, any associated lessons and assessments will also be marked as completed. This allows users to easily track their progress and ensures that all relevant items are updated when a session is finished. The calendar view provides a visual representation of upcoming sessions, deadlines, and events, making it easy for users to stay organized and plan their study time effectively.

#### Vacation Management

Users can schedule vacations in advance, which will be taken into account when planning study sessions and reviews. This allows users to plan breaks and time off from studying without disrupting their overall learning schedule. When a vacation is scheduled, there are three available strategies for handling any study sessions that would have been scheduled during the vacation period:

- **Push back**: Any sessions that would have been scheduled during the vacation period are pushed back to the next available time slot after the vacation ends.
- **Stack**: Any sessions that would have been scheduled during the vacation period are stacked before the vacation starts, allowing users to complete them in advance.
- **Recovery Days**: Any sessions that would have been scheduled during the vacation period are rescheduled to days off around the vacation period, such as weekends or other non-working days.

This vacation management infrastructure allows users to maintain a consistent study schedule while also accommodating planned breaks and time off, which is essential for long-term learning success and preventing burnout.
