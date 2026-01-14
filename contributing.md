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

#### Production Build (Databricks)
```bash
# Build frontend
cd src/app/frontend
npm run build

# Deploy to Databricks (from repo root)
# The backend will serve both API and frontend from /dist
databricks bundle deploy
```

## Environment Configuration Details

### How It Works
- **Local**: `src/app/backend/db.py` loads `.env` using `python-dotenv`
- **Databricks**: Environment variables are configured in the Databricks App UI
- **Code**: Uses `os.getenv()` which works in both environments

### Supported Environment Variables
| Variable | Description | Default | Local | Databricks |
|----------|-------------|---------|-------|------------|
| `DB_DSN` | PostgreSQL connection string | Lakebase fallback | `.env` | App UI |
| `DB_USE_SSL` | Enable SSL for database | `true` | `.env` | App UI |
| `DB_SSL_CA_FILE` | Path to SSL CA certificate | `src/app/backend/databricks-ca.pem` | `.env` | App UI |

### Security Notes
- Never commit `.env` files to git (already in `.gitignore`)
- Never commit `.pem` certificates to git (already in `.gitignore`)
- Use Databricks secrets for sensitive credentials in production
- Local development can disable SSL for simplicity