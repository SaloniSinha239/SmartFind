const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['lost', 'found']
  },
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'clothing', 'accessories', 'documents', 'other']
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  tags: {
    type: [String],
    default: []
  },
  gridfsId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  locationLabel: {
    type: String,
    trim: true,
    default: ''
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contactEmail: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'claimed', 'resolved'],
    default: 'active'
  },
  privateNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

/* ── Indexes ── */
itemSchema.index({ location: '2dsphere' });
itemSchema.index({ name: 'text', description: 'text', tags: 'text' });
itemSchema.index({ reportedBy: 1, createdAt: -1 });
itemSchema.index({ status: 1 });

module.exports = mongoose.model('Item', itemSchema);
