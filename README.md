# KeerthiStore

KeerthiStore is a full-stack e-commerce application with a browser-based storefront and a Node.js/Express API backed by MongoDB.

## Features

- Browse products, search by keyword, filter by category, sort by price, and view product details.
- Register and sign in with JWT-based authentication.
- Manage a personal shopping cart with stock-aware quantities and calculated totals.
- Submit delivery details at checkout and review order history and order confirmations.
- Manage products and customer orders through administrator pages and protected API routes.
- Responsive storefront pages for desktop and mobile layouts.

## Project structure

```text
backend/     Express API, MongoDB models, scripts, and tests
frontend/    Storefront HTML, CSS, JavaScript, and product images
postman/     Postman workspace resources
```

## Requirements

- Node.js and npm
- MongoDB (local or hosted)
- A modern browser

## Configure and run the backend

From the repository root, use PowerShell:

```powershell
Set-Location .\backend
npm ci
Copy-Item .env.example .env
```

Edit `backend/.env` and set your own MongoDB connection string, a long random JWT signing secret, and administrator credentials. Keep this file private; it is ignored by Git. The committed `.env.example` contains placeholders only.

Start the API from the `backend` directory:

```powershell
npm start
```

The API listens on `http://localhost:5000`. The frontend currently uses that address for API requests.

To create or update an administrator account, configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`, then run this from `backend`:

```powershell
npm run admin:create
```

To add the sample product catalog to the configured database:

```powershell
npm run seed:products
```

The seed script inserts missing sample products and leaves matching existing products unchanged.

## Serve the frontend

Open `frontend/index.html` using a local static web server, such as the Live Server extension in Visual Studio Code. Keep the backend running at `http://localhost:5000` while using the storefront.

## Tests

The backend test command is:

```powershell
npm test
```

This is a database-backed end-to-end suite, not an isolated unit test: it expects the API on `localhost:5000`, a configured MongoDB containing existing catalog and account data, and administrator credentials. It creates test records and changes data while exercising checkout and order management. Run it only against a dedicated test database and test server, never against a production or personal database.

## API overview

The API is mounted under `/api`:

| Area | Base path | Capabilities |
| --- | --- | --- |
| Users | `/api/users` | Registration, login, and authenticated profile |
| Products | `/api/products` | Product listing, search, category filtering, details, and administrator CRUD |
| Cart | `/api/cart` | View, add, update, remove, and clear cart items |
| Orders | `/api/orders` | Checkout, customer order history, and administrator order management |

Most user-specific routes require a JWT sent in the `Authorization: Bearer <token>` header. Administrator product and order-management routes also require an administrator account.

## Security

- Do not commit `.env` files, MongoDB credentials, JWT secrets, passwords, API keys, or private key files.
- Use unique, strong secrets and administrator passwords outside the repository.
- `.env.example` is a setup template only; replace each placeholder locally.
