/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const programsCollection = app.findCollectionByNameOrId("regula_programs");
    const col = app.findCollectionByNameOrId("regula_study_items");

    col.fields.add(
      new RelationField({
        name: "course",
        required: false,
        collectionId: programsCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );

    return app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("regula_study_items");
    col.fields.removeByName("course");
    return app.save(col);
  },
);
