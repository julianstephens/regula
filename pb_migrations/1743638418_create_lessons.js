/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const programsCollection = app.findCollectionByNameOrId("regula_programs");
    const modulesCollection = app.findCollectionByNameOrId("regula_modules");
    const resourcesCollection =
      app.findCollectionByNameOrId("regula_resources");

    const lessons = new Collection({
      name: "regula_lessons",
      type: "base",
      fields: [
        { name: "title", type: "text", required: true },
        {
          name: "type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: [
            "lesson",
            "reading",
            "writing",
            "exercise",
            "memorization",
            "review",
            "other",
          ],
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "not_started",
            "active",
            "blocked",
            "submitted",
            "completed",
            "archived",
          ],
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
          name: "module",
          type: "relation",
          required: false,
          collectionId: modulesCollection.id,
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
        { name: "available_on", type: "date", required: false },
        { name: "due_at", type: "date", required: false },
        { name: "completed_at", type: "date", required: false },
        { name: "estimated_minutes", type: "number", required: false },
        {
          name: "grade_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["none", "pass_fail", "numeric", "rubric"],
        },
        { name: "mastery_evidence", type: "text", required: false },
        { name: "notes", type: "text", required: false },
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

    app.save(lessons);

    // Add self-referential prerequisites and autodate fields after the collection exists
    const col = app.findCollectionByNameOrId("regula_lessons");
    col.fields.add(
      new RelationField({
        name: "prerequisites",
        required: false,
        collectionId: col.id,
        cascadeDelete: false,
        maxSelect: null,
      }),
    );
    col.fields.add(
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    );
    col.fields.add(
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    );
    return app.save(col);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("regula_lessons"));
  },
);
