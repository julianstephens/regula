/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");

    const programs = new Collection({
      name: "programs",
      type: "base",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "description", type: "text", required: false },
        { name: "start_date", type: "date", required: false },
        { name: "end_date", type: "date", required: false },
        {
          name: "type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["year", "term", "block", "custom"],
        },
        {
          name: "status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["planned", "active", "completed", "archived"],
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
    app.save(programs);

    // Add self-referential parent field after the collection exists
    const saved = app.findCollectionByNameOrId("programs");
    saved.fields.add(
      new RelationField({
        name: "parent",
        required: false,
        collectionId: saved.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    return app.save(saved);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("programs"));
  },
);
