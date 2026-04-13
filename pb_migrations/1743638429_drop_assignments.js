/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    return app.delete(app.findCollectionByNameOrId("regula_assignments"));
  },
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const programsCollection = app.findCollectionByNameOrId("regula_programs");
    const modulesCollection = app.findCollectionByNameOrId("regula_modules");
    const lessonsCollection = app.findCollectionByNameOrId("regula_lessons");

    const assignments = new Collection({
      name: "regula_assignments",
      type: "base",
      fields: [
        { name: "title", type: "text", required: true },
        {
          name: "type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: [
            "essay",
            "paper",
            "problem_set",
            "reflection",
            "translation",
            "presentation",
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
            "in_progress",
            "submitted",
            "graded",
            "archived",
          ],
        },
        {
          name: "lesson",
          type: "relation",
          required: false,
          collectionId: lessonsCollection.id,
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
          name: "program",
          type: "relation",
          required: false,
          collectionId: programsCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "due_at", type: "date", required: false },
        { name: "submitted_at", type: "date", required: false },
        {
          name: "grade_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["none", "pass_fail", "numeric", "rubric"],
        },
        { name: "mastery_evidence", type: "text", required: false },
        { name: "estimated_minutes", type: "number", required: false },
        { name: "description", type: "text", required: false },
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

    app.save(assignments);

    const col = app.findCollectionByNameOrId("regula_assignments");
    col.fields.add(
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    );
    col.fields.add(
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    );
    return app.save(col);
  },
);
