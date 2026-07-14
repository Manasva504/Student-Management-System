// repositories/userRepository.js
const BaseRepository = require("./BaseRepository");
const User = require("../models/User");

class UserRepository extends BaseRepository {
  constructor() {
    super(User); // hands the User model down to BaseRepository — DI happening right here
  }

  // only what's actually specific to users goes here
  async findByEmail(email) {
    return this.model.findOne({ email });
  }
}

module.exports = new UserRepository();