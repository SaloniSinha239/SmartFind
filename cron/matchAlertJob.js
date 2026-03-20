const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const Match = require('../models/Match');
const Item = require('../models/Item');
const User = require('../models/User');
const { sendMatchAlert } = require('../services/mailer');

const LOG_PATH = path.join(__dirname, '..', 'logs', 'cron.log');

function logCron(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_PATH, entry);
  } catch (e) {
    console.error('Cron log write failed:', e.message);
  }
  console.log(`[CRON] ${message}`);
}

/**
 * Nightly match alert job — runs at 02:00 daily.
 * Finds unalerted pending matches with score >= 0.6 and sends emails.
 */
async function matchAlertJob() {
  logCron('Match alert job started');

  try {
    const matches = await Match.find({
      status: 'pending',
      alertSent: false,
      score: { $gte: 0.6 }
    })
      .populate({
        path: 'lostItemId',
        populate: { path: 'reportedBy', select: 'name email' }
      })
      .populate({
        path: 'foundItemId',
        populate: { path: 'reportedBy', select: 'name email' }
      });

    logCron(`Found ${matches.length} unalerted matches`);

    let sentCount = 0;
    for (const match of matches) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const matchUrl = `${appUrl}/dashboard/matches`;

      // Email to lost item reporter
      if (match.lostItemId?.reportedBy?.email) {
        const sent = await sendMatchAlert(
          match.lostItemId.reportedBy.email,
          match.lostItemId.reportedBy.name,
          {
            itemName: match.lostItemId.name,
            matchScore: match.score,
            matchUrl
          }
        );
        if (sent) sentCount++;
      }

      // Email to found item reporter
      if (match.foundItemId?.reportedBy?.email) {
        const sent = await sendMatchAlert(
          match.foundItemId.reportedBy.email,
          match.foundItemId.reportedBy.name,
          {
            itemName: match.foundItemId.name,
            matchScore: match.score,
            matchUrl
          }
        );
        if (sent) sentCount++;
      }

      // Mark as alerted
      match.alertSent = true;
      await match.save();
    }

    logCron(`Job complete. Sent ${sentCount} emails for ${matches.length} matches.`);
  } catch (err) {
    logCron(`ERROR: ${err.message}`);
  }
}

/**
 * Start all cron jobs.
 */
function startCronJobs() {
  // Nightly at 02:00
  cron.schedule('0 2 * * *', matchAlertJob);
  logCron('Cron jobs scheduled (matchAlertJob at 02:00 daily)');
}

module.exports = { startCronJobs, matchAlertJob };
