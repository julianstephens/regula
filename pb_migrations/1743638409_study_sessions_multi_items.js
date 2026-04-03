/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("study_sessions");

    // Remove the single-value study_item field
    collection.fields.removeByName("study_item");

    // Add a multi-value study_items relation field
    const studyItemsCollection = app.findCollectionByNameOrId("study_items");
    collection.fields.add(
      new RelationField({
        name: "study_items",
        required: false,
        collectionId: studyItemsCollection.id,
        cascadeDelete: false,
        maxSelect: null,
      }),
    );

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("study_sessions");
    const studyItemsCollection = app.findCollectionByNameOrId("study_items");

    collection.fields.removeByName("study_items");

    collection.fields.add(
      new RelationField({
        name: "study_item",
        required: true,
        collectionId: studyItemsCollection.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );

    return app.save(collection);
  },
);
