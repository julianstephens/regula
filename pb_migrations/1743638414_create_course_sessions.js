/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const programsCollection = app.findCollectionByNameOrId("regula_programs");

    const courseSessions = new Collection({
      name: "regula_course_sessions",
      type: "base",
      fields: [
        {
          name: "course",
          type: "relation",
          required: true,
          collectionId: programsCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: "date",
          type: "date",
          required: true,
        },
        {
          name: "notes",
          type: "text",
          required: false,
        },
        {
          name: "status",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["scheduled", "completed", "missed", "made_up"],
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

    const saved = app.save(courseSessions);

    // Add autodate fields
    const col = app.findCollectionByNameOrId("regula_course_sessions");
    col.fields.add(
      new AutodateField({
        name: "created",
        onCreate: true,
        onUpdate: false,
      }),
    );
    col.fields.add(
      new AutodateField({
        name: "updated",
        onCreate: true,
        onUpdate: true,
      }),
    );
    return app.save(col);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("regula_course_sessions"));
  },
);
