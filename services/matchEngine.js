const Item = require('../models/Item');
const Match = require('../models/Match');

/**
 * Find matches for a newly reported item.
 * Searches opposite-type active items using MongoDB text search.
 * Creates Match documents for scores >= 0.6.
 */
async function findMatches(item) {
  try {
    const oppositeType = item.type === 'lost' ? 'found' : 'lost';

    // Build search string from name and top-3 tags
    const searchTerms = [item.name, ...item.tags.slice(0, 3)].join(' ');

    if (!searchTerms.trim()) return [];

    // Text search on opposite-type active items
    const candidates = await Item.find(
      {
        $text: { $search: searchTerms },
        type: oppositeType,
        status: 'active',
        _id: { $ne: item._id }
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .populate('reportedBy', 'name email');

    if (candidates.length === 0) return [];

    // Normalize scores to 0-1 range
    const maxScore = candidates[0]._doc.score || 1;
    const results = [];

    for (const candidate of candidates) {
      const rawScore = candidate._doc.score || 0;
      const normalizedScore = Math.round((rawScore / Math.max(maxScore, 1)) * 100) / 100;

      // Only create match documents for score >= 0.6
      if (normalizedScore >= 0.6) {
        const lostItemId = item.type === 'lost' ? item._id : candidate._id;
        const foundItemId = item.type === 'found' ? item._id : candidate._id;

        // Upsert to avoid duplicates
        const match = await Match.findOneAndUpdate(
          { lostItemId, foundItemId },
          {
            $setOnInsert: {
              lostItemId,
              foundItemId,
              score: normalizedScore,
              status: 'pending',
              alertSent: false
            }
          },
          { upsert: true, new: true }
        );
        results.push(match);
      }
    }

    return results;
  } catch (err) {
    console.error('Match engine error:', err.message);
    return [];
  }
}

module.exports = { findMatches };
