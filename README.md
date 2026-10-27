# WorkTrack — Employee & Leave Management System

A full-stack web app where admins manage employees, departments and leave policies, and employees apply for leave and track balances. Built with Django REST Framework, React + TypeScript and PostgreSQL.

**Live demo:** _add your URL after deploying_ · **API docs:** `/api/docs/`

## Features
- JWT authentication with Admin and Employee roles, enforced on the server
- Employee profiles and department management (a department with employees cannot be deleted)
- Leave applications with approve / reject / cancel, working-day calculation (Mon–Fri) and per-year balances
- Dashboard with role-specific statistics (admin: totals, trends, pending queue; employee: balances, upcoming leave)
- Search, filtering, ordering and pagination on every list
- Server-side validation, database constraints and one consistent error format
- Responsive UI with loading, error and empty states
- Automated backend tests (pytest) and OpenAPI documentation (Swagger UI)

## Tech stack
| Layer | Tools |
|---|---|
| Backend | Python, Django 5.2, Django REST Framework, SimpleJWT, django-filter, drf-spectacular |
| Frontend | React, TypeScript, Vite, React Router, Axios |
| Database | PostgreSQL |
| Testing / tools | pytest, pytest-django, Postman, Git, GitHub Actions |

## Architecture
```
React + TS (Vite)  --HTTP/JSON + JWT-->  Django REST API  -->  PostgreSQL
```
Apps: `accounts` (users, auth), `employees` (departments, profiles), `leaves` (types, balances, requests, business rules in `services.py`), `dashboard` (statistics).

## Quick start (Windows PowerShell)
Prerequisites: Python 3.11+, Node.js 20.19+, PostgreSQL 15+, Git.

```powershell
# 1. Database (adjust the PostgreSQL version in the path)
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"
psql -U postgres -h localhost -c "CREATE USER worktrack_user WITH PASSWORD 'change_me_strong' CREATEDB;"
psql -U postgres -h localhost -c "CREATE DATABASE worktrack_db OWNER worktrack_user;"

# 2. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env        # then set SECRET_KEY (and DB_PASSWORD if changed)
python manage.py migrate
python manage.py seed_demo         # demo data (local use only)
python manage.py runserver

# 3. Frontend (second terminal)
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```
Open http://localhost:5173 (use `localhost`, not `127.0.0.1`).

Demo accounts created by `seed_demo` (local only): `demo_admin / Admin@12345`, `alice / Employee@123`.

## Environment variables
See `backend/.env.example` and `frontend/.env.example`. Key ones: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL` (or `DB_*`), `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `VITE_API_URL`.

## Tests
```powershell
cd backend
pytest
```
The database user needs `CREATEDB` because pytest creates `test_worktrack_db`. GitHub Actions runs the backend tests and the frontend build on every push.

## API documentation
- Swagger UI: `/api/docs/` · schema: `/api/schema/` · static copy: [`docs/openapi.yml`](docs/openapi.yml)
- Postman collection: [`docs/WorkTrack.postman_collection.json`](docs/WorkTrack.postman_collection.json)

| Area | Endpoints |
|---|---|
| Auth | `POST auth/login/`, `auth/refresh/`, `auth/logout/`, `GET auth/me/`, `POST auth/change-password/` |
| Org | `departments/`, `employees/` (+ `employees/me/`) |
| Leaves | `leave-types/`, `leave-balances/`, `leave-requests/` (+ `POST {id}/approve/`, `reject/`, `cancel/`) |
| Stats | `GET dashboard/` |

Lists return `{count, next, previous, results}` and accept `page`, `page_size`, `search`, `ordering` plus endpoint filters. Errors always look like `{"error": {"code", "message", "details"}}`.

## Design decisions
- **Server-enforced roles:** DRF permission classes protect every endpoint; frontend route guards are UX only.
- **Business rules in a service layer:** approval/cancellation run in transactions with row locks so balances cannot go negative or be double-deducted.
- **Database constraints:** unique keys, `end_date >= start_date`, `used_days <= total_days`.
- **Pending requests reserve balance** at apply time; days are deducted on approval and refunded on cancellation of approved leave.
- **Soft delete for employees:** deactivation blocks login but keeps leave history.
- **Single error envelope** so the frontend needs one parser.

## Limitations and future work
- No public-holiday calendar; leave days are Mon–Fri.
- Tokens are stored in `localStorage`; an httpOnly refresh-token cookie would be stronger.
- Changing a password does not revoke existing refresh tokens.
- Login throttling uses Django's per-process cache; use Redis for multi-instance deployments.
- Ideas: email notifications, half-day leave, calendar view, CSV export, frontend tests.

## Screenshots
_Add images to `docs/screenshots/` and link them here._