# Upgrade Guide: Serverless Support & Direct Deploy Engine

This guide walks you through upgrading an existing LiveValidator deployment to support serverless compute, test connections, and the new Databricks direct deployment engine.

**Time estimate:** ~15 minutes

---

## Prerequisites

- Databricks CLI **v0.287.0+** (required for `catalogs` resource support)
  ```bash
  databricks --version  # check current
  brew upgrade databricks  # or your install method
  ```

---

## Step 1: Update `databricks.yml`

Apply the following changes to your `databricks.yml`. Reference `databricks.yml.example` for the full file.

### 1a. Add `engine: direct` under `bundle`

```yaml
bundle:
  name: LiveValidator
  engine: direct
```

### 1b. Add the `variables` block (below `workspace`)

```yaml
variables:
  serverless_version:
    description: The serverless environment version
    default: 5
```

### 1c. Add new job resources to the `apps.live_validator.resources` list

Add these alongside the existing `run-validation` and `fetch-lineage` entries:

```yaml
        - name: run-validation-serverless
          job:
            id: ${resources.jobs.run_validation_serverless.id}
            permission: 'CAN_MANAGE_RUN'
        - name: test-connection
          job:
            id: ${resources.jobs.test_connection.id}
            permission: 'CAN_MANAGE_RUN'
        - name: test-connection-serverless
          job:
            id: ${resources.jobs.test_connection_serverless.id}
            permission: 'CAN_MANAGE_RUN'
```

### 1d. Add `catalogs` and `schemas` under `resources`

Place after the `clusters` block:

```yaml
  catalogs:
    live_validator_data:
      name: live_validator_data
      comment: "Store LiveValidator information as Delta"
      grants:
        - principal: account users
          privileges:
            - USE CATALOG
            - SELECT
  schemas:
    entities:
      name: entities
      catalog_name: ${resources.catalogs.live_validator_data.name}
      comment: "Store point-in-time entity data"
```

> **Note:** Privileges use SQL syntax with spaces (`USE CATALOG`), not underscores.

---

## Step 2: Migrate from Terraform to Direct Deploy

The direct engine uses a different state file than Terraform. **Existing deployments must migrate their state before the first direct deploy.**

### For existing deployments (you've deployed before)

**2a.** Temporarily comment out the `catalogs` and `schemas` blocks you added in Step 1d.

**2b.** Deploy with the existing Terraform engine (syncs all other changes):

```bash
databricks bundle deploy -t <your-target>
```

**2c.** Migrate the state to the direct engine:

```bash
databricks bundle deployment migrate -t <your-target> --noplancheck
```

**2d.** Verify — this should show no changes (or zero deletes):

```bash
databricks bundle plan -t <your-target>
```

**2e.** Uncomment the `catalogs` and `schemas` blocks from Step 1d, then deploy again:

```bash
databricks bundle deploy -t <your-target>
```

### For new deployments (first time deploying)

No migration needed. The `engine: direct` setting handles everything automatically.

---

## Step 3: Deploy

```bash
databricks bundle deploy -t <your-target>
```

Then deploy the app:

```bash
databricks apps deploy live-validator -t <your-target>
```

---

## Step 4: Verify

```bash
databricks bundle plan -t <your-target>
```

Should show `0 to add, 0 to change, 0 to delete`. If 1-2 jobs show as "update" on the first plan after migration, deploy once more — this is normal post-migration state reconciliation.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `unknown field: catalogs` | CLI version too old. Upgrade to v0.287.0+ |
| `unknown field: engine` | CLI version too old. Upgrade to v0.287.0+ |
| `Catalog resources are only supported with direct deployment mode` | State still uses Terraform. Run the migration (Step 2) |
| `does not match the existing state (engine "terraform")` | Migration hasn't completed. Re-run Step 2 |
| Plan check fails during migrate | Comment out `catalogs`/`schemas`, migrate, then uncomment |
