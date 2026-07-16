const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.stack || err.message}`);

  // The real error (Mongoose/Mongo internals, field names, query structure)
  // is only safe to hand back to the client outside production — in
  // production it could be used to probe the schema, so we ship a generic
  // message instead while still logging the real one above.
  const clientMessage =
    process.env.NODE_ENV === "production" ? "Server Error" : err.message || "Server Error";

  res.status(err.status || 500).json({
    success: false,
    message: clientMessage,
    data: null,
  });
};

module.exports = errorHandler;