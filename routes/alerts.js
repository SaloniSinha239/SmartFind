const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Item = require('../models/Item');
const sessionGuard = require('../middleware/sessionGuard');

/* ── GET /api/alerts — Fetch unread match alerts for current user ── */
router.get('/', sessionGuard, async (req, res) => {
  try {
    // Find all items reported by this user
    const userItems = await Item.find({ reportedBy: req.session.userId }).select('_id');
    const userItemIds = userItems.map(i => i._id);

    // Find matches involving user's items
    const alerts = await Match.find({
      $or: [
        { lostItemId: { $in: userItemIds } },
        { foundItemId: { $in: userItemIds } }
      ],
      status: 'pending',
      alertSent: true
    })
      .populate('lostItemId', 'name category gridfsId locationLabel')
      .populate('foundItemId', 'name category gridfsId locationLabel')
      .sort({ createdAt: -1 })
      .lean();

    // Count unread (alertSent but status still pending)
    const unreadCount = alerts.length;

    // Update session alert count
    req.session.alertCount = unreadCount;

    res.json({ alerts, unreadCount });
  } catch (err) {
    console.error('Fetch alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
});

/* ── GET /api/alerts/count — Get unread alert count ── */
router.get('/count', sessionGuard, async (req, res) => {
  try {
    const userItems = await Item.find({ reportedBy: req.session.userId }).select('_id');
    const userItemIds = userItems.map(i => i._id);

    const count = await Match.countDocuments({
      $or: [
        { lostItemId: { $in: userItemIds } },
        { foundItemId: { $in: userItemIds } }
      ],
      status: 'pending',
      alertSent: true
    });

    req.session.alertCount = count;
    res.json({ count });
  } catch (err) {
    console.error('Alert count error:', err);
    res.status(500).json({ error: 'Failed to get alert count.' });
  }
});

/* ── PATCH /api/alerts/:id/read — Mark an alert as read ── */
router.patch('/:id/read', sessionGuard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid alert ID.' });
    }

    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Alert not found.' });

    match.status = 'accepted';
    await match.save();

    res.json({ message: 'Alert marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark alert as read.' });
  }
});

module.exports = router;
