/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");

    const areas = new Collection({
      name: "areas",
      type: "base",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "color", type: "text", required: false },
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
    return app.save(areas);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("areas"));
  },
);
