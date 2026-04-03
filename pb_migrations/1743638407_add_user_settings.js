/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");

    const userSettings = new Collection({
      name: "user_settings",
      type: "base",
      fields: [
        {
          name: "block_weeks",
          type: "number",
          required: true,
          min: 2,
          max: 6,
        },
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: usersCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
      ],
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: "owner = @request.auth.id",
      updateRule: "owner = @request.auth.id",
      deleteRule: "owner = @request.auth.id",
    });
    return app.save(userSettings);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("user_settings"));
  },
);
