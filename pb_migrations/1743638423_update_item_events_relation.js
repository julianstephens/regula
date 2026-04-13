/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const itemEventsCol = app.findCollectionByNameOrId("regula_item_events");
    const lessonsCol = app.findCollectionByNameOrId("regula_lessons");

    // Remove the old study_item relation field
    itemEventsCol.fields.removeByName("study_item");

    // Add the new lesson relation field pointing to regula_lessons
    itemEventsCol.fields.add(
      new RelationField({
        name: "lesson",
        required: true,
        collectionId: lessonsCol.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );

    return app.save(itemEventsCol);
  },
  (app) => {
    const itemEventsCol = app.findCollectionByNameOrId("regula_item_events");
    const studyItemsCol = app.findCollectionByNameOrId("regula_study_items");

    itemEventsCol.fields.removeByName("lesson");

    itemEventsCol.fields.add(
      new RelationField({
        name: "study_item",
        required: true,
        collectionId: studyItemsCol.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );

    return app.save(itemEventsCol);
  },
);
