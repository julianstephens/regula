/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const programsCollection = app.findCollectionByNameOrId("regula_programs");
    const col = app.findCollectionByNameOrId("regula_study_items");

    // Remove the separate course field (courses are already programs)
    col.fields.removeByName("course");

    // Replace the program field with cascadeDelete: true
    col.fields.removeByName("program");
    col.fields.add(
      new RelationField({
        name: "program",
        required: false,
        collectionId: programsCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );

    return app.save(col);
  },
  (app) => {
    const programsCollection = app.findCollectionByNameOrId("regula_programs");
    const col = app.findCollectionByNameOrId("regula_study_items");

    // Re-add the course field
    col.fields.add(
      new RelationField({
        name: "course",
        required: false,
        collectionId: programsCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );

    // Revert program field to cascadeDelete: false
    col.fields.removeByName("program");
    col.fields.add(
      new RelationField({
        name: "program",
        required: false,
        collectionId: programsCollection.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );

    return app.save(col);
  },
);
