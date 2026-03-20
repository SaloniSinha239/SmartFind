const express = require('express');
const router = express.Router();
const sessionGuard = require('../middleware/sessionGuard');
const adminGuard = require('../middleware/adminGuard');
const Item = require('../models/Item');
const User = require('../models/User');

/* ── Public Pages ── */

router.get('/', async (req, res) => {
  try {
    const recentItems = await Item.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(6)
      .populate('reportedBy', 'name')
      .lean();
    const totalItems = await Item.countDocuments();
    const totalUsers = await User.countDocuments();
    const resolved = await Item.countDocuments({ status: 'resolved' });

    res.render('pages/index', {
      title: 'SmartFind — Campus Lost & Found',
      recentItems,
      stats: { totalItems, totalUsers, resolved }
    });
  } catch (err) {
    res.render('pages/index', {
      title: 'SmartFind — Campus Lost & Found',
      recentItems: [],
      stats: { totalItems: 0, totalUsers: 0, resolved: 0 }
    });
  }
});

router.get('/items', async (req, res) => {
  res.render('pages/items', { title: 'Browse Items — SmartFind' });
});

router.get('/items/:id', async (req, res) => {
  res.render('pages/itemDetail', { title: 'Item Detail — SmartFind', itemId: req.params.id });
});

router.get('/map', (req, res) => {
  res.render('pages/map', { title: 'Campus Map — SmartFind' });
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('pages/login', { title: 'Login — SmartFind' });
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('pages/register', { title: 'Register — SmartFind' });
});

/* ── Protected Pages ── */

router.get('/report', sessionGuard, (req, res) => {
  res.render('pages/report', { title: 'Report Item — SmartFind' });
});

router.get('/dashboard/matches', sessionGuard, (req, res) => {
  res.render('pages/matches', { title: 'My Matches — SmartFind' });
});

router.get('/dashboard/alerts', sessionGuard, (req, res) => {
  res.render('pages/alerts', { title: 'Alerts — SmartFind' });
});

router.get('/claim/:itemId', sessionGuard, (req, res) => {
  res.render('pages/claim', { title: 'Submit Claim — SmartFind', itemId: req.params.itemId });
});

/* ── Admin Pages ── */

router.get('/admin', sessionGuard, adminGuard, (req, res) => {
  res.render('pages/admin', { title: 'Admin Panel — SmartFind' });
});

module.exports = router;
