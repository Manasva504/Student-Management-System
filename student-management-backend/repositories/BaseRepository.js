// repositories/BaseRepository.js
class BaseRepository {
  constructor(model) {
    this.model = model; // <-- injected, not hardcoded — this IS the DI
  }

  async findById(id) {
    return this.model.findById(id);
  }
  async findOne(filter) {
    return this.model.findOne(filter);
  }
  async findAll(filter = {}) {
    return this.model.find(filter);
  }
  async create(data) {
    return this.model.create(data);
  }
  async updateById(id, data) {
    return this.model.findByIdAndUpdate(id, data, { new: true });
  }
  async deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }
}

module.exports = BaseRepository;