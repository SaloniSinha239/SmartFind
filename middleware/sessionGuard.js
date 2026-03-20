/**
 * Session guard middleware — protects routes requiring authentication.
 * For API routes: returns 401 JSON. For page routes: redirects to /login.
 */
module.exports = function sessionGuard(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  return res.redirect('/login');
};
