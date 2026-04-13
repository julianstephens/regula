/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );
    const programsCollection = app.findCollectionByNameOrId("regula_programs");

    userSettingsCol.fields.add(
      new RelationField({
        name: "active_programs",
        required: false,
        collectionId: programsCollection.id,
        cascadeDelete: false,
        maxSelect: null,
      }),
    );

    return app.save(userSettingsCol);
  },
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );
    userSettingsCol.fields.removeByName("active_programs");
    return app.save(userSettingsCol);
  },
);
