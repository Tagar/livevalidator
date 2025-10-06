# LiveValidator Control Panel

A modern web application for managing and monitoring data validation workflows across multiple database systems.

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (local or Databricks Lakebase)

### Setup

#### 1. Backend Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Configure environment
cp .env.example .env
# Edit .env with your database credentials
```

#### 2. Database Configuration

**For Local Development:**
```bash
# .env file
DB_DSN=postgresql://postgres:postgres@localhost:5432/livevalidator
DB_USE_SSL=false
```

**For Databricks Lakebase:**
```yaml
# Edit app.yaml env section:
env:
  - name: DB_DSN
    value: "postgresql://user:pass@instance.database.cloud.databricks.com:5432/databricks_postgres"
  - name: DB_USE_SSL
    value: "true"
  - name: DB_SSL_CA_FILE
    value: "backend/databricks-ca.pem"
```

Or set in Databricks UI: **App Configuration → Environment Variables**

#### 3. Initialize Database Schema

```bash
# Run DDL scripts to create tables
psql -f backend/sql/ddl.sql
psql -f backend/sql/grants.sql
```

#### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev  # Development server
npm run build  # Production build
```

#### 5. Run the Application

**Development Mode:**
```bash
# Terminal 1: Backend
source venv/bin/activate
uvicorn backend.app:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

**Production Mode (Databricks):**
```bash
# Backend serves both API and frontend
uvicorn backend.app:app --host 0.0.0.0 --port 8080
```

## 🏗️ Architecture

```
LiveValidator/
├── backend/
│   ├── app.py          # FastAPI application
│   ├── db.py           # Database connection pool
│   └── sql/
│       ├── ddl.sql     # Database schema
│       └── grants.sql  # Permission grants
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Main application
│   │   ├── components/             # UI components
│   │   ├── hooks/                  # React hooks
│   │   ├── services/               # API services
│   │   ├── utils/                  # Utility functions
│   │   └── constants/              # Configuration
│   └── dist/                       # Production build
└── .env                            # Environment config (local)
```

## 🌍 Environment Variables

### Local Development (.env file)
Create a `.env` file in the project root:
```bash
DB_DSN=postgresql://postgres:postgres@localhost:5432/livevalidator
DB_USE_SSL=false
```

### Databricks Deployment (app.yaml)
Configure in `app.yaml` under the `env` section or via Databricks UI:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_DSN` | PostgreSQL connection string | Databricks Lakebase | Yes |
| `DB_USE_SSL` | Enable SSL for database | `true` | No |
| `DB_SSL_CA_FILE` | Path to SSL CA certificate | `backend/databricks-ca.pem` | No |

## 📦 Features

- **Tables Management**: Configure and monitor table-level data comparisons
- **Query Management**: Define custom SQL queries for validation
- **Schedule Management**: Set up cron-based validation schedules
- **System Management**: Manage source and target database systems
- **CSV Bulk Upload**: Import multiple tables/queries via CSV
- **Real-time Triggers**: Manually trigger validation runs
- **Version Conflict Detection**: Optimistic locking for concurrent updates

## 🔒 Security Notes

- Never commit `.env` files or `.pem` certificates to git
- Use environment variables in Databricks for production credentials
- SSL is enabled by default for remote databases
- Local development can disable SSL for simplicity

## 🛠️ Development

### Running Tests
```bash
# Backend tests
pytest backend/tests/

# Frontend tests
cd frontend
npm test
```

### Code Quality
```bash
# Python linting
ruff check backend/

# JavaScript linting
cd frontend
npm run lint
```

## 📝 Contributing

See [CONTRIBUTING.md](contributing.md) for guidelines.

## 📄 License

Proprietary - NXP Semiconductors

## 🐛 Troubleshooting

**Database connection fails:**
- Check your `DB_DSN` is correct
- Verify SSL settings match your database (local = no SSL, Databricks = SSL)
- Ensure `databricks-ca.pem` exists if using SSL

**Frontend can't reach backend:**
- Check VITE_API environment variable
- Verify CORS settings in `backend/app.py`
- Ensure backend is running on expected port

**Build errors:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Python cache: `rm -rf backend/__pycache__`
- Rebuild: `npm run build`

