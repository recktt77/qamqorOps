const mongoose = require('mongoose');

const technicalTaskSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  payment: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'completed', 'declined'],
    default: 'new'
  },
  developer: {
    type: String,
    required: true
  },
  worker: {
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
technicalTaskSchema.index({ status: 1, worker: 1 });
technicalTaskSchema.index({ taskId: 1 });

module.exports = mongoose.model('TechnicalTask', technicalTaskSchema);
