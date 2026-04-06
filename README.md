# SmartFind — Smart Campus Lost & Found Tracker

SmartFind is a web-based campus lost & found management system built with **Node.js**, **Express**, **MongoDB**, and **EJS**. It features image uploads, a campus map, fuzzy matching between lost & found items, a claim workflow with admin approval, and email alerts.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Runtime     | Node.js                             |
| Framework   | Express 4                           |
| Database    | MongoDB (Atlas) + Mongoose 8        |
| File Storage| GridFS (images stored in MongoDB)   |
| Templating  | EJS                                 |
| Auth        | bcrypt + express-session             |
| Email       | Nodemailer (SMTP)                   |
| Scheduling  | node-cron (match alert jobs)        |

---

## Project Structure

```
SmartFind/
├── server.js            # Entry point — connects DB, starts server
├── app.js               # Express app configuration & middleware
├── .env                 # Environment variables (do NOT commit)
├── package.json
├── models/              # Mongoose schemas (User, Item, Claim, Match)
├── routes/
│   ├── auth.js          # Register, Login, Logout
│   ├── items.js         # Report, Browse, Search, Map, Matches
│   ├── claims.js        # Submit, Approve, Reject claims
│   ├── alerts.js        # Match alerts
│   └── pages.js         # Page rendering routes
├── middleware/
│   ├── sessionGuard.js  # Auth protection
│   ├── adminGuard.js    # Admin-only protection
│   ├── rateLimiter.js   # Rate limiting
│   └── upload.js        # Multer image upload
├── services/
│   ├── gridfs.js        # GridFS image storage
│   ├── matchEngine.js   # Fuzzy matching engine
│   └── mailer.js        # Email service
├── cron/
│   └── matchAlertJob.js # Scheduled match alert cron job
├── views/
│   ├── pages/           # EJS page templates
│   └── partials/        # Shared partials (navbar, footer, etc.)
└── public/              # Static assets (CSS, JS, images)
```

---

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **MongoDB Atlas** account (or a local MongoDB instance)

---

## 🐳 Quick Start with Docker (Recommended)

> **No Node.js or MongoDB installation required.** Docker handles everything.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Steps

**1. Clone the repo**
```bash
git clone <repo-url>
cd SmartFind
```

**2. Create your `.env` file** from the example:
```bash
cp .env.example .env
```
Then edit `.env` — at minimum set `SESSION_SECRET` and your SMTP credentials.
> ⚠️ **Do NOT change `MONGO_URI`** — Docker Compose already sets it to point at the bundled MongoDB container.

**3. Build and start everything**
```bash
docker compose up --build
```

**4. Open in browser**
```
http://localhost:3000
```

**5. Stop everything**
```bash
docker compose down
```
> To also wipe the database volume: `docker compose down -v`

---

## Setup & Run (Without Docker)

### 1. Install Dependencies

```bash
cd SmartFind
npm install
```

### 2. Configure Environment Variables

Edit the `.env` file:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=Cluster01
SESSION_SECRET=your-secret-key
PORT=3000

# SMTP (for email notifications)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=              # Get from https://ethereal.email
SMTP_PASS=              # Get from https://ethereal.email

APP_URL=http://localhost:3000
```

### 3. Start the Server

**Production:**
```bash
npm start
```

**Development (auto-restart on changes):**
```bash
npm run dev
```

### 4. Open in Browser

```
http://localhost:3000
```

---

## Features Overview

| Feature             | Description                                                  |
|---------------------|--------------------------------------------------------------|
| User Authentication | Register/Login with hashed passwords & sessions              |
| Report Items        | Report lost or found items with image, location, tags        |
| Browse & Search     | Filter by type/category, full-text search, pagination        |
| Campus Map          | Interactive map with pins for all active items               |
| Fuzzy Matching      | Automatic matching between lost & found items by similarity  |
| Match Alerts        | Bell icon notifications when matches are found               |
| Claim Workflow      | Submit ownership proof → Admin approves/rejects              |
| Email Notifications | Emails on claim approval/rejection via SMTP                  |
| Admin Dashboard     | Manage pending claims, approve or reject with notes          |
| Rate Limiting       | Brute-force protection on login and other endpoints          |

---

## Step-by-Step Testing Workflow

Follow these steps in order to test every functionality end-to-end.

### Step 1 — Register Two Users

1. Open `http://localhost:3000/register`
2. Register **User A** (e.g., `alice@test.com`, password ≥ 8 chars)
3. Log out
4. Register **User B** (e.g., `bob@test.com`)
5. Log out

**Validation checks:**
- Try submitting with empty fields → should show errors
- Try password < 8 chars → should be rejected
- Try mismatched passwords → should be rejected
- Try registering with the same email again → should say "already exists"

---

### Step 2 — Login & Logout

1. Go to `http://localhost:3000/login`
2. Login as **User A**
3. Verify you see the navbar with your name
4. Log out → confirm you're redirected and session is cleared
5. Try visiting `/report` without logging in → should be blocked

**Validation checks:**
- Wrong email/password → "Invalid email or password"
- Rapid login attempts → rate limiter kicks in

---

### Step 3 — Report a Lost Item (User A)

1. Login as **User A**
2. Go to `http://localhost:3000/report`
3. Fill in:
   - Type: **Lost**
   - Category: e.g., **Electronics**
   - Name: e.g., "Blue Wireless Earbuds"
   - Description: (at least 20 characters) "Lost my blue wireless earbuds near the library entrance last Tuesday"
   - Tags: `blue, earbuds, wireless`
   - Location: click a spot on the map
   - Image: upload a JPEG/PNG/WebP image (< 5 MB)
4. Submit → should see "Item reported successfully!"

**Validation checks:**
- Missing name, description, or image → errors shown
- Description < 20 chars → rejected
- Image > 5 MB → rejected
- Submit the same item name within 10 minutes → "Duplicate submission detected"

---

### Step 4 — Report a Found Item (User B)

1. Log out of User A, login as **User B**
2. Go to `/report`
3. Fill in:
   - Type: **Found**
   - Category: **Electronics** (same as User A's lost item)
   - Name: "Wireless Earbuds" (similar to the lost item)
   - Description: "Found wireless earbuds on a bench near the main library"
   - Tags: `earbuds, wireless`
   - Location: pick a nearby spot on the map
   - Image: upload an image
4. Submit

> This should trigger the **fuzzy matching engine** in the background.

---

### Step 5 — Browse & Search Items

1. Go to `http://localhost:3000/items`
2. Verify both items appear in the list
3. Use the **type filter** → select "Lost" → only lost items shown
4. Use the **category filter** → select "Electronics" → filtered results
5. Type `earbuds` in the **search bar** → relevant results appear
6. Click on an item card → verify the detail page shows image, description, location, and reporter info

---

### Step 6 — Campus Map

1. Go to `http://localhost:3000/map`
2. Verify map loads with **pins** for the reported items
3. Click a pin → popup should show item name, category, and image preview
4. Zoom and pan to verify items are plotted at the correct locations

---

### Step 7 — Check Matches & Alerts

1. Login as **User A** (who reported the lost item)
2. Check the **alert/bell icon** in the navbar → should show unread count
3. Go to `http://localhost:3000/alerts` → verify the match alert is listed
4. Go to `http://localhost:3000/matches` → see the match with a confidence score
5. Click an alert to mark it as read → count decreases

---

### Step 8 — Submit a Claim

1. Login as **User A**
2. Open the found item (reported by User B)
3. Go to the claim page (or click "Claim" on the item detail)
4. Fill in:
   - **Proof of ownership**: (≥ 30 chars) "These are my earbuds, serial number XYZ123. I bought them from Amazon on March 1st."
   - **Proof image** (optional): upload receipt or photo
   - Contact phone (optional)
   - Pickup date (optional)
5. Submit → "Claim submitted successfully!" and item status changes to `claimed`

**Validation checks:**
- Proof text < 30 chars → rejected
- Try claiming the same item again → "You have already submitted a claim"
- Try claiming a resolved item → "This item has already been resolved"

---

### Step 9 — Admin: Approve or Reject Claims

> **Setup:** First, promote a user to admin by editing the `role` field in MongoDB Atlas:
> 1. Go to [MongoDB Atlas](https://cloud.mongodb.com) → your cluster → Collections → `users`
> 2. Find the user → click edit → change `role` from `"user"` to `"admin"` → save

1. Login as the **admin** user
2. Go to `http://localhost:3000/admin`
3. See the pending claim from Step 8
4. **Approve** the claim (optionally add admin notes)
   - Claim status → `approved`
   - Item status → `resolved`
   - Email sent to both claimant and reporter (if SMTP configured)
5. To test rejection: submit another claim on a different item, then **reject** it
   - Claim status → `rejected`
   - Item status → back to `active`

---

### Step 10 — Email Notifications

1. Create a free test inbox at [https://ethereal.email](https://ethereal.email)
2. Update `.env` with the generated credentials:
   ```env
   SMTP_USER=your-ethereal-user@ethereal.email
   SMTP_PASS=your-ethereal-password
   ```
3. Restart the server
4. Approve or reject a claim (Step 9)
5. Go to [https://ethereal.email/messages](https://ethereal.email/messages) → verify the email was received

---

### Step 11 — Security & Edge Cases

| Test                        | How                                          | Expected                    |
|-----------------------------|----------------------------------------------|-----------------------------|
| Unauthenticated access      | Visit `/report`, `/matches`, `/admin` logged out | Redirected / 401 error      |
| Non-admin visits admin page | Login as normal user → go to `/admin`        | 403 Forbidden               |
| Invalid item ID in URL      | Visit `/items/not-a-valid-id`                | 400 or 404 error            |
| Login rate limiter           | Rapidly attempt login 10+ times              | Request blocked             |
| 404 page                    | Visit `/nonexistent-page`                    | Custom 404 page shown       |

---

## Making a User Admin

```
MongoDB Atlas → Collections → users → find user → edit → set "role": "admin"
```

---

## API Endpoints Reference

### Auth
| Method | Endpoint              | Description          | Auth |
|--------|-----------------------|----------------------|------|
| POST   | `/api/auth/register`  | Register new user    | No   |
| POST   | `/api/auth/login`     | Login                | No   |
| POST   | `/api/auth/logout`    | Logout               | Yes  |

### Items
| Method | Endpoint              | Description                    | Auth  |
|--------|-----------------------|--------------------------------|-------|
| POST   | `/api/items`          | Report a lost/found item       | Yes   |
| GET    | `/api/items`          | List items (search, filter)    | No    |
| GET    | `/api/items/map`      | GeoJSON for map view           | No    |
| GET    | `/api/items/matches`  | Get matches for your items     | Yes   |
| GET    | `/api/items/:id`      | Single item detail             | No    |
| GET    | `/api/items/:id/image`| Stream item image              | No    |

### Claims
| Method | Endpoint                    | Description            | Auth   |
|--------|-----------------------------|------------------------|--------|
| POST   | `/api/claims`               | Submit a claim         | Yes    |
| GET    | `/api/claims/pending`       | List pending claims    | Admin  |
| GET    | `/api/claims/all`           | List all claims        | Admin  |
| PATCH  | `/api/claims/:id/approve`   | Approve a claim        | Admin  |
| PATCH  | `/api/claims/:id/reject`    | Reject a claim         | Admin  |

### Alerts
| Method | Endpoint                | Description              | Auth |
|--------|-------------------------|--------------------------|------|
| GET    | `/api/alerts`           | Fetch match alerts       | Yes  |
| GET    | `/api/alerts/count`     | Get unread alert count   | Yes  |
| PATCH  | `/api/alerts/:id/read`  | Mark alert as read       | Yes  |

---

## License

ISC
