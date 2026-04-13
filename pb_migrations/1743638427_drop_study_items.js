/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    return app.delete(app.findCollectionByNameOrId("regula_study_items"));
  },
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const areasCollection = app.findCollectionByNameOrId("regula_areas");
    const programsCollection = app.findCollectionByNameOrId("regula_programs");
    const resourcesCollection =
      app.findCollectionByNameOrId("regula_resources");

    const studyItems = new Collection({
      name: "regula_study_items",
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
          cascadeDelete: true,
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

    app.save(studyItems);

    const col = app.findCollectionByNameOrId("regula_study_items");
    col.fields.add(
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    );
    col.fields.add(
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    );
    return app.save(col);
  },
);
