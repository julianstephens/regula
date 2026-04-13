/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );

    userSettingsCol.fields.add(
      new NumberField({
        name: "storage_quota_bytes",
        required: false,
        min: 0,
        onlyInt: true,
      }),
    );

    userSettingsCol.fields.add(
      new NumberField({
        name: "storage_used_bytes",
        required: false,
        min: 0,
        onlyInt: true,
      }),
    );

    return app.save(userSettingsCol);
  },
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );
    userSettingsCol.fields.removeByName("storage_quota_bytes");
    userSettingsCol.fields.removeByName("storage_used_bytes");
    return app.save(userSettingsCol);
  },
);
