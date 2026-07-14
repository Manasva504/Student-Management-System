// services/userService.js
const BaseService = require("./BaseService");
const userRepository = require("../repositories/userRepository");
const bcrypt = require("bcryptjs");
const { createAuthToken } = require("../utils/tokenFactory");
const authEvents = require("../events/authEvents");
const AppError = require("../utils/AppError");

class UserService extends BaseService {
  constructor() {
    super(userRepository);
  }

  async login(email, password) {
    if (!email || !password) throw new AppError("Please provide Email and Password", 400);

    const user = await this.repository.findByEmail(email);
    if (!user) throw new AppError("Invalid Credentials", 400);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid Credentials", 400);

    const token = createAuthToken(user);
    authEvents.emit("userLoggedIn", user);

    return { message: "Login successful", token };
  }
}

module.exports = new UserService();