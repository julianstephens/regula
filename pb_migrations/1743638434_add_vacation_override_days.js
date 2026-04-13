/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const vacationsCol = app.findCollectionByNameOrId("regula_vacations");

    vacationsCol.fields.add(
      new SelectField({
        name: "work_week_override_days",
        required: false,
        maxSelect: 7,
        values: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      }),
    );

    return app.save(vacationsCol);
  },
  (app) => {
    const vacationsCol = app.findCollectionByNameOrId("regula_vacations");
    vacationsCol.fields.removeByName("work_week_override_days");
    return app.save(vacationsCol);
  },
);
