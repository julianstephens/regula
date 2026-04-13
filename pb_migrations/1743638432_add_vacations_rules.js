/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId("regula_vacations");
    col.listRule = "owner = @request.auth.id";
    col.viewRule = "owner = @request.auth.id";
    col.createRule = "owner = @request.auth.id";
    col.updateRule = "owner = @request.auth.id";
    col.deleteRule = "owner = @request.auth.id";
    return app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("regula_vacations");
    col.listRule = null;
    col.viewRule = null;
    col.createRule = null;
    col.updateRule = null;
    col.deleteRule = null;
    return app.save(col);
  },
);
