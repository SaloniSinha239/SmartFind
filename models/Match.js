const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  lostItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  foundItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'dismissed', 'resolved'],
    default: 'pending'
  },
  alertSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

matchSchema.index({ lostItemId: 1, foundItemId: 1 }, { unique: true });
matchSchema.index({ status: 1, alertSent: 1 });

module.exports = mongoose.model('Match', matchSchema);
