# GCP Staging Terraform

This module manages the GCP resources for the i-um staging API deployment.

## Managed resources

- Artifact Registry Docker repository
- Cloud Run staging API service
- Cloud Build manual deploy trigger
- Cloud Run runtime service account and IAM
- Cloud Build deploy service account and IAM
- Secret Manager IAM access for the pre-created staging PostgreSQL `DATABASE_URL` secret

## Pre-created resources

These are bootstrapped manually before Terraform runs:

- GCS backend bucket: `i-um-488511-terraform-state`
- Secret Manager secret and version: `i-um-staging-database-url`
- Cloud Build GitHub connection: `i-um-github`
- Cloud Build repository link: `twotwobread-i-um`
- Staging PostgreSQL database and connection string

Secret values are not stored in Terraform state.

## Commands

```bash
terraform -chdir=infra/terraform/gcp-staging init
terraform -chdir=infra/terraform/gcp-staging fmt -check
terraform -chdir=infra/terraform/gcp-staging validate
terraform -chdir=infra/terraform/gcp-staging plan
terraform -chdir=infra/terraform/gcp-staging apply
```

After apply, get the Cloud Run URL:

```bash
terraform -chdir=infra/terraform/gcp-staging output -raw cloud_run_url
```
