/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId("regula_assessments");

    // Update assessment_type select values
    const assessmentTypeField = col.fields.getByName("assessment_type");
    assessmentTypeField.values = [
      "exam",
      "paper",
      "essay",
      "oral",
      "translation",
      "recitation",
      "reflection",
      "project",
      "practicum",
    ];

    // Remove attempt_number field
    col.fields.removeByName("attempt_number");

    // Add prompt field
    col.fields.add(new TextField({ name: "prompt", required: false }));

    // Add metadata_json field
    col.fields.add(new TextField({ name: "metadata_json", required: false }));

    // Add submitted_at field
    col.fields.add(new DateField({ name: "submitted_at", required: false }));

    // Add weight field
    col.fields.add(new NumberField({ name: "weight", required: false }));

    return app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("regula_assessments");

    // Restore assessment_type select values
    const assessmentTypeField = col.fields.getByName("assessment_type");
    assessmentTypeField.values = [
      "quiz",
      "essay",
      "oral_recitation",
      "translation",
      "exam",
      "self_check",
      "other",
    ];

    // Remove added fields
    col.fields.removeByName("prompt");
    col.fields.removeByName("metadata_json");
    col.fields.removeByName("submitted_at");
    col.fields.removeByName("weight");

    // Restore attempt_number
    col.fields.add(
      new NumberField({ name: "attempt_number", required: false }),
    );

    return app.save(col);
  },
);
