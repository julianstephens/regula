/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const programs = app.findCollectionByNameOrId("programs");
    programs.fields.add(
      new NumberField({
        name: "block_weeks",
        required: false,
        min: 2,
        max: 6,
      }),
    );
    return app.save(programs);
  },
  (app) => {
    const programs = app.findCollectionByNameOrId("programs");
    programs.fields.removeByName("block_weeks");
    return app.save(programs);
  },
);
