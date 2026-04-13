/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Remove block_weeks from regula_programs
    const programs = app.findCollectionByNameOrId("regula_programs");
    programs.fields.removeByName("block_weeks");

    // Remove "block" from type select values in regula_programs
    const typeField = programs.fields.getByName("type");
    typeField.values = ["year", "term", "custom", "course"];

    app.save(programs);

    // Remove block_weeks from regula_user_settings
    const settings = app.findCollectionByNameOrId("regula_user_settings");
    settings.fields.removeByName("block_weeks");

    app.save(settings);
  },
  (app) => {
    // Restore block_weeks to regula_programs
    const programs = app.findCollectionByNameOrId("regula_programs");
    programs.fields.add(
      new NumberField({ name: "block_weeks", required: false }),
    );

    // Restore "block" to type select values
    const typeField = programs.fields.getByName("type");
    typeField.values = ["year", "term", "block", "custom", "course"];

    app.save(programs);

    // Restore block_weeks to regula_user_settings
    const settings = app.findCollectionByNameOrId("regula_user_settings");
    settings.fields.add(
      new NumberField({ name: "block_weeks", required: false }),
    );

    app.save(settings);
  },
);
