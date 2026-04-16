/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );

    userSettingsCol.fields.add(
      new SelectField({
        name: "dashboard_modules",
        required: false,
        maxSelect: 2,
        values: [
          "due_today",
          "review_queue",
          "overdue",
          "upcoming_assessments",
        ],
      }),
    );

    return app.save(userSettingsCol);
  },
  (app) => {
    const userSettingsCol = app.findCollectionByNameOrId(
      "regula_user_settings",
    );
    userSettingsCol.fields.removeByName("dashboard_modules");
    return app.save(userSettingsCol);
  },
);
