require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();

/* ── View Engine ── */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ── Middleware ── */
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ── Session ── */
app.use(session({
  name: 'sf_session',
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 2 * 60 * 60 // 2 hours
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 2 * 60 * 60 * 1000 // 2 hours
  }
}));

/* ── Make session data available to all EJS views ── */
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? {
    id: req.session.userId,
    role: req.session.role,
    displayName: req.session.displayName
  } : null;
  res.locals.alertCount = req.session.alertCount || 0;
  next();
});

/* ── Routes ── */
const pagesRouter = require('./routes/pages');
const authRouter = require('./routes/auth');
const itemsRouter = require('./routes/items');
const claimsRouter = require('./routes/claims');
const alertsRouter = require('./routes/alerts');

app.use('/', pagesRouter);
app.use('/api/auth', authRouter);
app.use('/api/items', itemsRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/alerts', alertsRouter);

/* ── 404 Handler ── */
app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Page Not Found' });
});

/* ── Error Handler ── */
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: err.message || 'Internal Server Error' });
  }
  res.status(status).render('pages/error', {
    title: 'Error',
    message: err.message || 'Something went wrong'
  });
});

module.exports = app;
