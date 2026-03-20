const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

/**
 * Send a match alert email.
 */
async function sendMatchAlert(toEmail, toName, matchData) {
  const { itemName, matchScore, matchUrl, thumbnailUrl } = matchData;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;">🔍 SmartFind Match Alert</h1>
      </div>
      <div style="padding:24px;">
        <p>Hi <strong>${toName}</strong>,</p>
        <p>We found a potential match for your item!</p>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:4px 0;"><strong>Item:</strong> ${itemName}</p>
          <p style="margin:4px 0;"><strong>Match Score:</strong> 
            <span style="background:#6366f1;color:#fff;padding:2px 8px;border-radius:4px;">${Math.round(matchScore * 100)}%</span>
          </p>
        </div>
        <a href="${matchUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px;">
          View Match Details →
        </a>
      </div>
      <div style="background:#1e293b;padding:16px;text-align:center;font-size:12px;color:#94a3b8;">
        SmartFind — Smart Campus Lost & Found Tracker
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: '"SmartFind" <noreply@smartfind.campus>',
      to: toEmail,
      subject: `🔍 Match Found: ${itemName}`,
      html
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

/**
 * Send claim status email (approved or rejected).
 */
async function sendClaimStatusEmail(toEmail, toName, claimData) {
  const { itemName, status, message } = claimData;
  const isApproved = status === 'approved';
  const statusColor = isApproved ? '#22c55e' : '#ef4444';
  const statusText = isApproved ? 'Approved ✅' : 'Rejected ❌';

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,${statusColor},${isApproved ? '#16a34a' : '#dc2626'});padding:24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;">Claim ${statusText}</h1>
      </div>
      <div style="padding:24px;">
        <p>Hi <strong>${toName}</strong>,</p>
        <p>Your claim for <strong>${itemName}</strong> has been <strong>${status}</strong>.</p>
        ${message ? `<p style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">${message}</p>` : ''}
        ${isApproved ? '<p>Please visit the campus lost & found office to collect your item.</p>' : '<p>If you believe this is an error, please contact the admin.</p>'}
      </div>
      <div style="background:#1e293b;padding:16px;text-align:center;font-size:12px;color:#94a3b8;">
        SmartFind — Smart Campus Lost & Found Tracker
      </div>
    </div>
  `;

  try {
    await getTransporter().sendMail({
      from: '"SmartFind" <noreply@smartfind.campus>',
      to: toEmail,
      subject: `Claim ${statusText} — ${itemName}`,
      html
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

module.exports = { sendMatchAlert, sendClaimStatusEmail, getTransporter };
