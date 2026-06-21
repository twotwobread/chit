output "cloud_run_url" {
  description = "Public Cloud Run staging API URL."
  value       = google_cloud_run_v2_service.api.uri
}

output "cloud_build_trigger_name" {
  description = "Manual Cloud Build trigger name for API deploys."
  value       = google_cloudbuild_trigger.api_deploy.name
}

output "artifact_registry_repository" {
  description = "Artifact Registry Docker repository id."
  value       = google_artifact_registry_repository.api.repository_id
}

output "cloud_run_runtime_service_account" {
  description = "Cloud Run runtime service account email."
  value       = google_service_account.cloud_run.email
}

output "cloud_build_service_account" {
  description = "Cloud Build deploy service account email."
  value       = google_service_account.cloud_build.email
}
