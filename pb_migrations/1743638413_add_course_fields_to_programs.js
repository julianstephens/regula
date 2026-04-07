/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const programs = app.findCollectionByNameOrId("regula_programs");
    const areasCollection = app.findCollectionByNameOrId("regula_areas");

    // Add "course" to the type select values
    const typeField = programs.fields.getByName("type");
    typeField.values = ["year", "term", "block", "custom", "course"];

    // Add meeting_days multi-select
    programs.fields.add(
      new SelectField({
        name: "meeting_days",
        required: false,
        maxSelect: 7,
        values: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      }),
    );

    // Add makeup_days multi-select
    programs.fields.add(
      new SelectField({
        name: "makeup_days",
        required: false,
        maxSelect: 7,
        values: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      }),
    );

    // Add area relation (optional, used by course type)
    programs.fields.add(
      new RelationField({
        name: "area",
        required: false,
        collectionId: areasCollection.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );

    return app.save(programs);
  },
  (app) => {
    const programs = app.findCollectionByNameOrId("regula_programs");

    // Restore type values without "course"
    const typeField = programs.fields.getByName("type");
    typeField.values = ["year", "term", "block", "custom"];

    programs.fields.removeByName("meeting_days");
    programs.fields.removeByName("makeup_days");
    programs.fields.removeByName("area");

    return app.save(programs);
  },
);
