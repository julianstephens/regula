/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Fix sessions where the `lessons` multi-relation field is stored as a plain
    // string ID instead of a JSON array. PocketBase's JSON_EACH() traversal fails
    // on plain strings, breaking both expand and relation-filter queries.
    const sessionsCol = app.findCollectionByNameOrId("regula_study_sessions");
    const sessions = app.findAllRecords(sessionsCol);

    for (const session of sessions) {
      const raw = session.get("lessons");

      // Needs repair if it's a non-empty string that isn't already a JSON array
      if (typeof raw === "string" && raw !== "" && !raw.startsWith("[")) {
        session.set("lessons", [raw]);
        app.saveNoValidate(session);
      }
    }
  },
  (app) => {
    // Rollback: convert single-element arrays back to plain strings
    const sessionsCol = app.findCollectionByNameOrId("regula_study_sessions");
    const sessions = app.findAllRecords(sessionsCol);

    for (const session of sessions) {
      const raw = session.get("lessons");

      if (Array.isArray(raw) && raw.length === 1) {
        session.set("lessons", raw[0]);
        app.saveNoValidate(session);
      }
    }
  },
);
