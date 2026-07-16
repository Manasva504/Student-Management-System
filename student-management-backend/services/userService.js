// services/userService.js
const BaseService = require("./BaseService");
const userRepository = require("../repositories/userRepository");
const bcrypt = require("bcryptjs");
const { createAuthToken } = require("../utils/tokenFactory");
const authEvents = require("../events/authEvents");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

class UserService extends BaseService {
  constructor() {
    super(userRepository);
  }

  async login(email, password) {
    if (!email || !password) {
      logger.warn("Login failed: missing email or password");
      throw new AppError("Please provide Email and Password", 400);
    }

    const user = await this.repository.findByEmail(email);
    if (!user) {
      logger.warn(`Login failed: invalid credentials for email=${email}`);
      throw new AppError("Invalid Credentials", 400);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn(`Login failed: invalid credentials for email=${email}`);
      throw new AppError("Invalid Credentials", 400);
    }

    const token = createAuthToken(user);
    authEvents.emit("userLoggedIn", user);
    logger.info(`Login successful: user=${user.email}`);

    return { message: "Login successful", token };
  }
}

module.exports = new UserService();