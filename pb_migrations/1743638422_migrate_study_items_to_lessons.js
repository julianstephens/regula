/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const statusMap = {
      planned: "not_started",
      available: "not_started",
      in_progress: "active",
      completed: "completed",
      deferred: "blocked",
      cancelled: "archived",
    };

    const typeMap = {
      reading: "reading",
      writing: "writing",
      memorization: "memorization",
      exercise: "exercise",
      review: "review",
      quiz: "other",
      exam: "other",
      paper: "other",
      other: "other",
    };

    const studyItemsCol = app.findCollectionByNameOrId("regula_study_items");
    const lessonsCol = app.findCollectionByNameOrId("regula_lessons");
    const records = app.findAllRecords(studyItemsCol);

    for (const item of records) {
      const rawStatus = item.get("status");
      const rawType = item.get("item_type");

      const lesson = new Record(lessonsCol, {
        id: item.id,
        title: item.get("title"),
        type: typeMap[rawType] ?? "other",
        status: statusMap[rawStatus] ?? "not_started",
        program: item.get("program"),
        resource: item.get("resource"),
        available_on: item.get("scheduled_date"),
        due_at: item.get("due_date"),
        completed_at: item.get("completion_date"),
        estimated_minutes: item.get("estimated_minutes"),
        notes: item.get("notes"),
        owner: item.get("owner"),
      });
      app.saveNoValidate(lesson);
    }
  },
  (app) => {
    const studyItemsCol = app.findCollectionByNameOrId("regula_study_items");
    const lessonsCol = app.findCollectionByNameOrId("regula_lessons");
    const records = app.findAllRecords(studyItemsCol);

    for (const item of records) {
      try {
        const lesson = app.findRecordById(lessonsCol, item.id);
        app.delete(lesson);
      } catch (_) {
        // Record may not exist; skip
      }
    }
  },
);
