/**
 * Admin guard middleware — must be used AFTER sessionGuard.
 * Checks req.session.role === 'admin'; returns 403 otherwise.
 */
module.exports = function adminGuard(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return res.status(403).render('pages/error', {
    title: 'Forbidden',
    message: 'You do not have permission to access this page.'
  });
};
