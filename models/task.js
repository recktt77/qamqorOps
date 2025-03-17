const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  contact: {
    type: String,
    required: true
  },
  clientId: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'completed', 'deleted'],
    default: 'new'
  },
  developer: {
    type: String,
    default: null
  },
  history: [{
    action: String,
    timestamp: Date,
    user: String
  }]
}, {
  timestamps: true
});

// Индексы для ускорения поиска
taskSchema.index({ status: 1, clientId: 1 });
taskSchema.index({ status: 1, developer: 1 });

module.exports = mongoose.model('Task', taskSchema);
