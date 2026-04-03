/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const areasCollection = app.findCollectionByNameOrId("areas");
    const programsCollection = app.findCollectionByNameOrId("programs");
    const resourcesCollection = app.findCollectionByNameOrId("resources");

    const studyItems = new Collection({
      name: "study_items",
      type: "base",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "notes", type: "text", required: false },
        { name: "due_date", type: "date", required: false },
        { name: "scheduled_date", type: "date", required: false },
        { name: "completion_date", type: "date", required: false },
        { name: "estimated_minutes", type: "number", required: false },
        {
          name: "item_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: [
            "reading",
            "writing",
            "memorization",
            "exercise",
            "review",
            "quiz",
            "exam",
            "paper",
            "other",
          ],
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "planned",
            "available",
            "in_progress",
            "completed",
            "deferred",
            "cancelled",
          ],
        },
        {
          name: "priority",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["low", "normal", "high", "critical"],
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
          name: "program",
          type: "relation",
          required: false,
          collectionId: programsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: "resource",
          type: "relation",
          required: false,
          collectionId: resourcesCollection.id,
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
    return app.save(studyItems);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("study_items"));
  },
);
