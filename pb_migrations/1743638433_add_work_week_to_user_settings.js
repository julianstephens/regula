/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );

    userSettingsCol.fields.add(
      new SelectField({
        name: "work_week",
        required: false,
        maxSelect: 7,
        values: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      }),
    );

    return app.save(userSettingsCol);
  },
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );
    userSettingsCol.fields.removeByName("work_week");
    return app.save(userSettingsCol);
  },
);
