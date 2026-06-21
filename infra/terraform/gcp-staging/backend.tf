terraform {
  backend "gcs" {
    bucket = "i-um-488511-terraform-state"
    prefix = "gcp-staging"
  }
}
