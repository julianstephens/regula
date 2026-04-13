/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const lessonsCollection = app.findCollectionByNameOrId("regula_lessons");

    const reviews = new Collection({
      name: "regula_reviews",
      type: "base",
      fields: [
        {
          name: "lesson",
          type: "relation",
          required: true,
          collectionId: lessonsCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "due_at", type: "date", required: false },
        { name: "next_review_at", type: "date", required: false },
        { name: "interval_days", type: "number", required: false },
        { name: "ease_factor", type: "number", required: false },
        { name: "last_reviewed_at", type: "date", required: false },
        {
          name: "status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["active", "suspended", "completed"],
        },
        { name: "failure_count", type: "number", required: false },
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

    app.save(reviews);

    const col = app.findCollectionByNameOrId("regula_reviews");
    col.fields.add(
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    );
    col.fields.add(
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    );
    return app.save(col);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("regula_reviews"));
  },
);
