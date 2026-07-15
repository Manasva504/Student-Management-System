const hasRequiredFields = (obj, fields) => fields.every((f) => obj[f]);

module.exports = { hasRequiredFields };
