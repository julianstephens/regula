/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("regula_study_items");
    collection.fields.removeByName("priority");
    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("regula_study_items");
    collection.fields.add(
      new SelectField({
        name: "priority",
        required: false,
        maxSelect: 1,
        values: ["low", "normal", "high", "critical"],
      }),
    );
    return app.save(collection);
  },
);
