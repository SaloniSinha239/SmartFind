const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const User = require('../models/User');
const sessionGuard = require('../middleware/sessionGuard');
const adminGuard = require('../middleware/adminGuard');
const upload = require('../middleware/upload');
const { uploadToGridFS } = require('../services/gridfs');
const { sendClaimStatusEmail } = require('../services/mailer');

/* ── POST /api/claims — Submit a claim ── */
router.post('/', sessionGuard, upload.single('proofImage'), async (req, res) => {
  try {
    const { itemId, proofText, contactPhone, pickupDate } = req.body;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Valid item ID is required.' });
    }
    if (!proofText || proofText.trim().length < 30) {
      return res.status(400).json({ error: 'Proof of ownership must be at least 30 characters.' });
    }

    // Check item exists and is active or claimed-by-others
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (item.status === 'resolved') {
      return res.status(400).json({ error: 'This item has already been resolved.' });
    }

    // Check for duplicate claim
    const existing = await Claim.findOne({ itemId, claimantId: req.session.userId });
    if (existing) {
      return res.status(409).json({ error: 'You have already submitted a claim for this item.' });
    }

    // Handle optional proof image
    let proofImageId = null;
    if (req.file) {
      proofImageId = await uploadToGridFS(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    // Create claim
    const claim = await Claim.create({
      itemId,
      claimantId: req.session.userId,
      proofText: proofText.trim(),
      proofImageId,
      contactPhone: contactPhone || '',
      pickupDate: pickupDate || null,
      status: 'pending'
    });

    // Update item status
    item.status = 'claimed';
    await item.save();

    res.status(201).json({ message: 'Claim submitted successfully!', claimId: claim._id });
  } catch (err) {
    console.error('Claim error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already submitted a claim for this item.' });
    }
    res.status(500).json({ error: 'Failed to submit claim.' });
  }
});

/* ── GET /api/claims/pending — Admin: list pending claims ── */
router.get('/pending', sessionGuard, adminGuard, async (req, res) => {
  try {
    const claims = await Claim.find({ status: 'pending' })
      .populate('itemId')
      .populate('claimantId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ claims });
  } catch (err) {
    console.error('Fetch claims error:', err);
    res.status(500).json({ error: 'Failed to fetch claims.' });
  }
});

/* ── GET /api/claims/all — Admin: list all claims ── */
router.get('/all', sessionGuard, adminGuard, async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('itemId')
      .populate('claimantId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ claims });
  } catch (err) {
    console.error('Fetch all claims error:', err);
    res.status(500).json({ error: 'Failed to fetch claims.' });
  }
});

/* ── PATCH /api/claims/:id/approve — Admin approve claim ── */
router.patch('/:id/approve', sessionGuard, adminGuard, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const claim = await Claim.findById(req.params.id).session(session);
    if (!claim) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Claim not found.' });
    }
    if (claim.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Claim has already been processed.' });
    }

    claim.status = 'approved';
    claim.adminNotes = req.body.adminNotes || '';
    claim.resolvedAt = new Date();
    await claim.save({ session });

    const item = await Item.findById(claim.itemId).session(session);
    if (item) {
      item.status = 'resolved';
      await item.save({ session });
    }

    await session.commitTransaction();

    // Send emails (outside transaction)
    const claimant = await User.findById(claim.claimantId);
    if (claimant && item) {
      sendClaimStatusEmail(claimant.email, claimant.name, {
        itemName: item.name,
        status: 'approved',
        message: claim.adminNotes
      }).catch(err => console.error('Claim email error:', err.message));
    }

    // Email the reporter too
    if (item) {
      const reporter = await User.findById(item.reportedBy);
      if (reporter) {
        sendClaimStatusEmail(reporter.email, reporter.name, {
          itemName: item.name,
          status: 'approved',
          message: `The item "${item.name}" has been claimed and resolved.`
        }).catch(err => console.error('Reporter email error:', err.message));
      }
    }

    res.json({ message: 'Claim approved successfully.' });
  } catch (err) {
    await session.abortTransaction();
    console.error('Approve claim error:', err);
    res.status(500).json({ error: 'Failed to approve claim.' });
  } finally {
    session.endSession();
  }
});

/* ── PATCH /api/claims/:id/reject — Admin reject claim ── */
router.patch('/:id/reject', sessionGuard, adminGuard, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const claim = await Claim.findById(req.params.id).session(session);
    if (!claim) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Claim not found.' });
    }
    if (claim.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Claim has already been processed.' });
    }

    claim.status = 'rejected';
    claim.adminNotes = req.body.adminNotes || '';
    claim.resolvedAt = new Date();
    await claim.save({ session });

    const item = await Item.findById(claim.itemId).session(session);
    if (item) {
      item.status = 'active';
      await item.save({ session });
    }

    await session.commitTransaction();

    // Send rejection email
    const claimant = await User.findById(claim.claimantId);
    if (claimant && item) {
      sendClaimStatusEmail(claimant.email, claimant.name, {
        itemName: item.name,
        status: 'rejected',
        message: claim.adminNotes
      }).catch(err => console.error('Reject email error:', err.message));
    }

    res.json({ message: 'Claim rejected.' });
  } catch (err) {
    await session.abortTransaction();
    console.error('Reject claim error:', err);
    res.status(500).json({ error: 'Failed to reject claim.' });
  } finally {
    session.endSession();
  }
});

module.exports = router;
