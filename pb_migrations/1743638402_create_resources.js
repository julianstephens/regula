/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const areasCollection = app.findCollectionByNameOrId("areas");

    const resources = new Collection({
      name: "resources",
      type: "base",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "author", type: "text", required: false },
        { name: "url", type: "url", required: false },
        { name: "notes", type: "text", required: false },
        {
          name: "resource_type",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["book", "article", "video", "podcast", "course", "other"],
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
    return app.save(resources);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("resources"));
  },
);
