# Contributing

## Dev set-up - Running the app locally

### 1. Setup Postgres
To set up your environment on local, you will need to first set up your local postgres database.

Assuming Mac,
```bash
brew install postgresql@16
brew services start postgresql@16
```

Test using:
```bash
psql postgres
```

Now we gotta install the tables and do the grants. We have a script for it:
```bash
psql -d postgres -a -f src/app/backend/sql/ddl.sql
psql -d postgres -a -f src/app/backend/sql/grants.sql
```

### 2. Configure Environment Variables

#### For Local Development
Create a `.env` file in the project root (copy from template):
```bash
cp .env.template .env
```

Edit `.env` if needed with your local database credentials. Existing values should be fine:
```bash
# .env
PGHOST=localhost
PGPORT=5432
PGDATABASE=postgres
DB_USE_SSL=false
```

**Note:** The `.env` file is gitignored and will not be committed.

### 3. Install Backend Dependencies
```bash
# Create virtual environment (from repo root)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install package in editable mode
cd src/app
pip install -e .
```

### 4. Install Frontend Dependencies
```bash
cd src/app/frontend
npm install
```

### 5. Run the Application

#### Development Mode (Local)
```bash
# Terminal 1: Start backend (from src/app)
source venv/bin/activate
cd src/app
uvicorn backend.app:app --reload --port 8000
```

The frontend will be available at `http://localhost:8000`.

### 6. Setup Database
```
psql postgres -c "CREATE USER apprunner WITH PASSWORD 'beepboop123';

CREATE SCHEMA IF NOT EXISTS control;
GRANT USAGE ON SCHEMA control to apprunner;
GRANT apprunner TO CURRENT_USER;
ALTER SCHEMA control OWNER TO apprunner;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA control TO apprunner;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA control TO apprunner;

ALTER DEFAULT PRIVILEGES IN SCHEMA control 
GRANT USAGE, SELECT ON SEQUENCES TO apprunner;"
```

Followed by:
```
psql -d postgres -a -f path/to/your/LiveValidator/src/app/backend/sql/ddl.sql
psql -d postgres -a -f path/to/your/LiveValidator/src/app/backend/sql/grants.sql
```

### 7. Seed Database Tables
```
psql -d postgres -a -f path/to/your/LiveValidator/src/app/backend/sql/seed_test_data.sql
```

#### Production Build (Databricks)
```bash
# Build frontend
cd src/app/frontend
npm run build

# Deploy to Databricks (from repo root)
# The backend will serve both API and frontend from /dist
databricks bundle deploy
```

## Notes

- **Local** uses `.env` file (loaded by `python-dotenv`), **Databricks** uses the App UI for env vars
- Never commit `.env` or `.pem` files (already gitignored)