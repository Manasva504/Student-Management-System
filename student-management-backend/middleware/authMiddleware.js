const jwt = require("jsonwebtoken");
const { isTokenBlacklisted } = require("../utils/cache");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from headers
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res
        .status(401)
        .json({ message: "Access denied. No token provided" });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        message: "Access denied. No token provided",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // A signature-valid token can still have been explicitly logged out —
    // checked after verify() so we never waste a Redis round trip on a
    // token that's malformed/expired/wrongly-signed anyway.
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ message: "Token has been invalidated" });
    }

    req.user = decoded;
    req.token = token;

    next();
  } catch (error) {
    res.status(401).json({
      message: "Invalid Token",
    });
  }
};

module.exports = authMiddleware;
