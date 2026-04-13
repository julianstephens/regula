/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId("users");

    const vacations = new Collection({
      name: "regula_vacations",
      type: "base",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "start_date", type: "text", required: true },
        { name: "end_date", type: "text", required: true },
        {
          name: "strategy",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["stack", "recovery", "push_back"],
        },
        {
          name: "recovery_before_days",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "recovery_after_days",
          type: "number",
          required: false,
          min: 0,
        },
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: usersCollection.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
      ],
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: "owner = @request.auth.id",
      updateRule: "owner = @request.auth.id",
      deleteRule: "owner = @request.auth.id",
    });

    vacations.fields.add(
      new AutodateField({
        name: "created",
        onCreate: true,
        onUpdate: false,
        system: true,
      }),
    );

    vacations.fields.add(
      new AutodateField({
        name: "updated",
        onCreate: true,
        onUpdate: true,
        system: true,
      }),
    );

    return app.save(vacations);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("regula_vacations");
    return app.delete(col);
  },
);
