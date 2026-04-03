/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");
    const studyItemsCollection = app.findCollectionByNameOrId("study_items");

    const itemEvents = new Collection({
      name: "item_events",
      type: "base",
      fields: [
        { name: "notes", type: "text", required: false },
        {
          name: "event_type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "created",
            "scheduled",
            "started",
            "completed",
            "deferred",
            "reopened",
            "cancelled",
            "edited",
          ],
        },
        {
          name: "study_item",
          type: "relation",
          required: true,
          collectionId: studyItemsCollection.id,
          cascadeDelete: true,
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
    return app.save(itemEvents);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("item_events"));
  },
);
