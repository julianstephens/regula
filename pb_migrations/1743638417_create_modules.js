/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const programsCollection = app.findCollectionByNameOrId("regula_programs");

    const modules = new Collection({
      name: "regula_modules",
      type: "base",
      fields: [
        {
          name: "program",
          type: "relation",
          required: true,
          collectionId: programsCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: "title", type: "text", required: true },
        { name: "slug", type: "text", required: false },
        { name: "order", type: "number", required: false },
        { name: "goal", type: "text", required: false },
        { name: "start_date", type: "date", required: false },
        { name: "end_date", type: "date", required: false },
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

    app.save(modules);

    const col = app.findCollectionByNameOrId("regula_modules");
    col.fields.add(
      new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    );
    col.fields.add(
      new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    );
    return app.save(col);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("regula_modules"));
  },
);
