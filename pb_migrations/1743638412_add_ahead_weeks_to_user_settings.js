/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("regula_user_settings");
    collection.fields.add(
      new NumberField({
        name: "ahead_weeks",
        required: false,
        min: 1,
        max: 2,
      }),
    );
    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("regula_user_settings");
    collection.fields.removeByName("ahead_weeks");
    return app.save(collection);
  },
);
