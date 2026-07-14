// services/BaseService.js
const AppError = require("../utils/AppError");
class BaseService {
  constructor(repository) {
    this.repository = repository; // injected, same idea as BaseRepository
  }

  async getById(id) {
    const item = await this.repository.findById(id);
    if (!item) throw new AppError("Not found", 404);
    return item;
  }

  async getAll(filter = {}) {
    return this.repository.findAll(filter);
  }

  async create(data) {
    return this.repository.create(data);
  }

  async updateById(id, data) {
    const item = await this.repository.updateById(id, data);
    if (!item) throw new AppError("Not found", 404);
    return item;
  }

  async deleteById(id) {
    const item = await this.repository.deleteById(id);
    if (!item) throw new AppError("Not found", 404);
    return item;
  }
}

module.exports = BaseService;