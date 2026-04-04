# Regula

Regula is a PocketBase-backed study planning and session tracking app for managing learning areas, programs, resources, study items, and focused work sessions.

## Core features

- Dashboard with today, in-progress, overdue, and weekly time summaries
- Program planning across year, term, block, and custom program types
- Configurable block durations with automatic rest weeks
- Area, resource, and study item management
- Session timer plus manual session logging
- Timeline view for item events and study sessions
- Settings page for block defaults and JSON/CSV data export
- PocketBase authentication and realtime updates
- Markdown syllabus import for creating study items from term materials

## Tech stack

- React 19
- TypeScript 5
- Vite 8
- Chakra UI 3
- TanStack Query 5
- React Router 7
- PocketBase
- Nginx for the production container

## PocketBase collections

The app is built around these collections:

- `regula_areas`
- `regula_programs`
- `regula_resources`
- `regula_study_items`
- `regula_study_sessions`
- `regula_item_events`
- `regula_user_settings`

Schema changes live in `pb_migrations/`.

## Local development

### Prerequisites

- Node.js with `pnpm` available
- A running PocketBase instance that this frontend can reach

### Environment

Create a `.env.local` file in the project root:

```bash
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

### Install and run

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:5173`.

## Available scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm build` | Type-check and create a production build |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format the codebase with Prettier |

## Docker

Build the production image with a PocketBase URL baked into the frontend bundle:

```bash
docker build \
  --build-arg VITE_POCKETBASE_URL=http://127.0.0.1:8090 \
  -t regula .
```

Run the built container:

```bash
docker run --rm -p 8080:80 regula
```

The container serves the static app with Nginx. PocketBase must still be available at the URL used during the build.

## Deployment notes

- `Dockerfile` builds the frontend and serves `dist/` through Nginx.
- `coolify.manifest.json` is configured for a `Regula` service using `ghcr.io/julianstephens/regula`.
- `scripts/release.py` creates a git tag and GitHub release from the latest entry in `CHANGELOG.md`.

## Repository layout

```text
src/                 Frontend app, routes, UI components, and services
pb_migrations/       PocketBase schema migrations
pb_data/             Local PocketBase data checked into the repo
public/              Static assets
scripts/release.py   Release automation
```

## Notes

This repo contains the frontend plus PocketBase schema/data artifacts. It does not include a PocketBase server binary, so you will need to run or connect to an existing PocketBase instance for local development and production use.
