const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Item = require('../models/Item');
const Match = require('../models/Match');
const sessionGuard = require('../middleware/sessionGuard');
const upload = require('../middleware/upload');
const { uploadToGridFS, getFileStream } = require('../services/gridfs');
const { findMatches } = require('../services/matchEngine');

/* ── POST /api/items — Report a lost/found item ── */
router.post('/', sessionGuard, upload.single('image'), async (req, res) => {
  try {
    const { type, category, name, description, tags, locationLng, locationLat, locationLabel, contactEmail, privateNotes } = req.body;

    // Handle base64 image from AJAX or multipart file upload
    let imageBuffer, imageMimetype, imageFilename;

    if (req.file) {
      imageBuffer = req.file.buffer;
      imageMimetype = req.file.mimetype;
      imageFilename = req.file.originalname;
    } else if (req.body.imageBase64) {
      // Extract base64 data
      const matches = req.body.imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Invalid image format.' });
      }
      imageMimetype = matches[1];
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(imageMimetype)) {
        return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed.' });
      }
      imageBuffer = Buffer.from(matches[2], 'base64');
      imageFilename = `upload_${Date.now()}.${imageMimetype.split('/')[1]}`;
    } else {
      return res.status(400).json({ error: 'Image is required.' });
    }

    // Check image size (5 MB)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image must be under 5 MB.' });
    }

    // Server-side validation
    if (!type || !['lost', 'found'].includes(type)) {
      return res.status(400).json({ error: 'Item type must be "lost" or "found".' });
    }
    if (!category || !['electronics', 'clothing', 'accessories', 'documents', 'other'].includes(category)) {
      return res.status(400).json({ error: 'Valid category is required.' });
    }
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Item name is required.' });
    }
    if (!description || description.trim().length < 20) {
      return res.status(400).json({ error: 'Description must be at least 20 characters.' });
    }
    if (description.length > 1000) {
      return res.status(400).json({ error: 'Description cannot exceed 1000 characters.' });
    }

    const lng = parseFloat(locationLng);
    const lat = parseFloat(locationLat);
    if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'Valid location coordinates are required.' });
    }

    // Check for duplicate submission (same user, same name, within 10 minutes)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const duplicate = await Item.findOne({
      reportedBy: req.session.userId,
      name: name.trim(),
      createdAt: { $gte: tenMinAgo }
    });
    if (duplicate) {
      return res.status(429).json({ error: 'Duplicate submission detected. Please wait before reporting the same item.' });
    }

    // Strip HTML from description
    const cleanDesc = description.replace(/<[^>]*>/g, '');

    // Parse tags
    const parsedTags = tags
      ? (typeof tags === 'string' ? tags.split(',') : tags).map(t => t.trim().toLowerCase()).filter(Boolean)
      : [];

    // Upload image to GridFS
    const gridfsId = await uploadToGridFS(imageBuffer, imageFilename, imageMimetype);

    // Create item
    const item = await Item.create({
      type,
      category,
      name: name.trim(),
      description: cleanDesc,
      tags: parsedTags,
      gridfsId,
      location: { type: 'Point', coordinates: [lng, lat] },
      locationLabel: locationLabel || '',
      reportedBy: req.session.userId,
      contactEmail: contactEmail || '',
      privateNotes: privateNotes || '',
      status: 'active'
    });

    // Trigger match engine asynchronously
    findMatches(item).catch(err => console.error('Async match error:', err.message));

    res.status(201).json({
      message: 'Item reported successfully!',
      itemId: item._id
    });
  } catch (err) {
    console.error('Report item error:', err);
    if (err.name === 'MulterError') {
      return res.status(413).json({ error: 'Image must be under 5 MB.' });
    }
    res.status(500).json({ error: 'Failed to report item. Please try again.' });
  }
});

/* ── GET /api/items — List items with search + filter ── */
router.get('/', async (req, res) => {
  try {
    const { search, type, category, status, page = 1, limit = 12, sort = 'newest' } = req.query;
    const filter = {};

    if (type && ['lost', 'found'].includes(type)) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;
    else filter.status = 'active';

    let query;
    let sortObj = { createdAt: -1 };

    if (search && search.trim()) {
      filter.$text = { $search: search.trim() };
      query = Item.find(filter, { score: { $meta: 'textScore' } });
      if (sort === 'relevance') {
        sortObj = { score: { $meta: 'textScore' } };
      }
    } else {
      query = Item.find(filter);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Item.countDocuments(filter.$text ? filter : filter);

    const items = await query
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reportedBy', 'name')
      .lean();

    res.json({
      items,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('List items error:', err);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

/* ── GET /api/items/map — Geospatial query for map ── */
router.get('/map', async (req, res) => {
  try {
    const { lat, lng, radius = 2 } = req.query;
    let filter = { status: 'active' };

    if (lat && lng) {
      const radiusKm = parseFloat(radius);
      const radiusRadians = radiusKm / 6378.1; // Earth radius in km
      filter.location = {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusRadians]
        }
      };
    }

    const items = await Item.find(filter)
      .select('type name category location locationLabel gridfsId createdAt')
      .lean();

    // Convert to GeoJSON FeatureCollection
    const features = items.map(item => ({
      type: 'Feature',
      geometry: item.location,
      properties: {
        id: item._id,
        type: item.type,
        name: item.name,
        category: item.category,
        locationLabel: item.locationLabel,
        imageUrl: `/api/items/${item._id}/image`,
        createdAt: item.createdAt
      }
    }));

    res.json({ type: 'FeatureCollection', features });
  } catch (err) {
    console.error('Map query error:', err);
    res.status(500).json({ error: 'Failed to fetch map data.' });
  }
});

/* ── GET /api/items/matches — Get matches for current user's items ── */
router.get('/matches', sessionGuard, async (req, res) => {
  try {
    const userItems = await Item.find({ reportedBy: req.session.userId }).select('_id');
    const userItemIds = userItems.map(i => i._id);

    const matches = await Match.find({
      $or: [
        { lostItemId: { $in: userItemIds } },
        { foundItemId: { $in: userItemIds } }
      ],
      status: { $ne: 'dismissed' }
    })
      .populate('lostItemId', 'name category gridfsId locationLabel createdAt')
      .populate('foundItemId', 'name category gridfsId locationLabel createdAt')
      .sort({ score: -1 })
      .lean();

    res.json({ matches });
  } catch (err) {
    console.error('Fetch matches error:', err);
    res.status(500).json({ error: 'Failed to fetch matches.' });
  }
});

/* ── GET /api/items/:id — Get single item ── */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID.' });
    }
    const item = await Item.findById(req.params.id)
      .populate('reportedBy', 'name email')
      .lean();
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    res.json({ item });
  } catch (err) {
    console.error('Get item error:', err);
    res.status(500).json({ error: 'Failed to fetch item.' });
  }
});

/* ── GET /api/items/:id/image — Stream image from GridFS ── */
router.get('/:id/image', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID.' });
    }
    const item = await Item.findById(req.params.id).select('gridfsId').lean();
    if (!item || !item.gridfsId) {
      return res.status(404).json({ error: 'Image not found.' });
    }

    const stream = getFileStream(item.gridfsId);
    stream.on('error', () => res.status(404).json({ error: 'Image not found in storage.' }));
    stream.pipe(res);
  } catch (err) {
    console.error('Get image error:', err);
    res.status(500).json({ error: 'Failed to fetch image.' });
  }
});

module.exports = router;
