/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const areasCollection = app.findCollectionByNameOrId("areas");
    const studyItemsCollection = app.findCollectionByNameOrId("study_items");

    const studySessions = new Collection({
      name: "study_sessions",
      type: "base",
      fields: [
        { name: "started_at", type: "date", required: false },
        { name: "ended_at", type: "date", required: false },
        { name: "duration_minutes", type: "number", required: false },
        { name: "notes", type: "text", required: false },
        {
          name: "session_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: [
            "deep_work",
            "light_review",
            "planning",
            "reread",
            "exercise",
            "writing",
          ],
        },
        {
          name: "outcome",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["completed", "partial", "blocked", "abandoned"],
        },
        {
          name: "study_item",
          type: "relation",
          required: true,
          collectionId: studyItemsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: "area",
          type: "relation",
          required: false,
          collectionId: areasCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: usersCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
      ],
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: "owner = @request.auth.id",
      updateRule: "owner = @request.auth.id",
      deleteRule: "owner = @request.auth.id",
    });
    return app.save(studySessions);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("study_sessions"));
  },
);
