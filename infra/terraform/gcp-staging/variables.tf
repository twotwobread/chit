variable "project_id" {
  description = "GCP project id for staging resources."
  type        = string
  default     = "i-um-488511"
}

variable "region" {
  description = "Primary GCP region for Cloud Run and Artifact Registry."
  type        = string
  default     = "asia-northeast3"
}

variable "cloud_build_region" {
  description = "Cloud Build v2 connection and trigger region."
  type        = string
  default     = "asia-northeast3"
}

variable "deploy_branch" {
  description = "Default branch used by the manual Cloud Build trigger source."
  type        = string
  default     = "develop"
}

variable "cloud_run_service_name" {
  description = "Cloud Run staging API service name."
  type        = string
  default     = "i-um-api-staging"
}

variable "artifact_registry_repository" {
  description = "Artifact Registry Docker repository id."
  type        = string
  default     = "i-um-staging"
}

variable "database_secret_name" {
  description = "Existing Secret Manager secret id containing the staging PostgreSQL DATABASE_URL."
  type        = string
  default     = "i-um-staging-database-url"
}

variable "cloud_build_connection_name" {
  description = "Existing Cloud Build v2 GitHub connection name."
  type        = string
  default     = "i-um-github"
}

variable "cloud_build_repository_name" {
  description = "Existing Cloud Build v2 repository link name."
  type        = string
  default     = "twotwobread-i-um"
}

variable "cloud_run_max_instances" {
  description = "Max Cloud Run instances for staging. Keep this small to avoid exhausting Neon connections."
  type        = number
  default     = 2
}
