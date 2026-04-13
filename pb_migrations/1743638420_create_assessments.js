/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const programsCollection = app.findCollectionByNameOrId("regula_programs");
    const modulesCollection = app.findCollectionByNameOrId("regula_modules");
    const lessonsCollection = app.findCollectionByNameOrId("regula_lessons");

    const assessments = new Collection({
      name: "regula_assessments",
      type: "base",
      fields: [
        { name: "title", type: "text", required: true },
        {
          name: "assessment_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: [
            "quiz",
            "essay",
            "oral_recitation",
            "translation",
            "exam",
            "self_check",
            "other",
          ],
        },
        {
          name: "submission_mode",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["written", "oral", "digital", "none"],
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
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: "module",
          type: "relation",
          required: false,
          collectionId: modulesCollection.id,
          cascadeDelete: true,
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
        { name: "score", type: "number", required: false },
        { name: "max_score", type: "number", required: false },
        { name: "passed", type: "bool", required: false },
        { name: "feedback", type: "text", required: false },
        { name: "attempt_number", type: "number", required: false },
        { name: "due_at", type: "date", required: false },
        { name: "completed_at", type: "date", required: false },
        {
          name: "grade_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["none", "pass_fail", "numeric", "rubric"],
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

    app.save(assessments);

    const col = app.findCollectionByNameOrId("regula_assessments");
    col.fields.add(
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    );
    col.fields.add(
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    );
    return app.save(col);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("regula_assessments"));
  },
);
