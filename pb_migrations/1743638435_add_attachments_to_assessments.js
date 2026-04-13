/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const assessmentsCol = app.findCollectionByNameOrId("regula_assessments");

    assessmentsCol.fields.add(
      new FileField({
        name: "attachment",
        required: false,
        mimeTypes: ["application/pdf"],
        maxSelect: 1,
        maxSize: 20971520, // 20 MB
      }),
    );

    assessmentsCol.fields.add(
      new TextField({
        name: "attachment_url",
        required: false,
      }),
    );

    assessmentsCol.fields.add(
      new NumberField({
        name: "attachment_size_bytes",
        required: false,
        min: 0,
        onlyInt: true,
      }),
    );

    return app.save(assessmentsCol);
  },
  (app) => {
    const assessmentsCol = app.findCollectionByNameOrId("regula_assessments");
    assessmentsCol.fields.removeByName("attachment");
    assessmentsCol.fields.removeByName("attachment_url");
    assessmentsCol.fields.removeByName("attachment_size_bytes");
    return app.save(assessmentsCol);
  },
);
