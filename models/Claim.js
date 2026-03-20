const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  claimantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  proofText: {
    type: String,
    required: [true, 'Proof of ownership is required'],
    minlength: [30, 'Proof must be at least 30 characters']
  },
  proofImageId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  contactPhone: {
    type: String,
    trim: true,
    default: ''
  },
  pickupDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

claimSchema.index({ itemId: 1, claimantId: 1 }, { unique: true });
claimSchema.index({ status: 1 });

module.exports = mongoose.model('Claim', claimSchema);
