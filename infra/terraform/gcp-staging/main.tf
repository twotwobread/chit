locals {
  api_image_placeholder = "us-docker.pkg.dev/cloudrun/container/hello"
  cloudbuild_repository = "projects/${var.project_id}/locations/${var.cloud_build_region}/connections/${var.cloud_build_connection_name}/repositories/${var.cloud_build_repository_name}"
}

resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

data "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = var.database_secret_name

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository" "api" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repository
  description   = "i-um staging Docker images"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "cloud_run" {
  project      = var.project_id
  account_id   = "i-um-api-staging-run"
  display_name = "i-um staging API Cloud Run runtime"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "cloud_build" {
  project      = var.project_id
  account_id   = "i-um-api-staging-build"
  display_name = "i-um staging API Cloud Build deployer"

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "cloud_run_database_url" {
  project   = var.project_id
  secret_id = data.google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "cloud_build_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cloud_build.email}"
}

resource "google_project_iam_member" "cloud_build_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.cloud_build.email}"
}

resource "google_project_iam_member" "cloud_build_logs_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_build.email}"
}

resource "google_project_iam_member" "cloud_build_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${google_service_account.cloud_build.email}"
}

resource "google_service_account_iam_member" "cloud_build_can_act_as_cloud_run" {
  service_account_id = google_service_account.cloud_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.cloud_build.email}"
}

resource "google_artifact_registry_repository_iam_member" "cloud_run_artifact_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.api.location
  repository = google_artifact_registry_repository.api.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = var.cloud_run_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = local.api_image_placeholder

      ports {
        container_port = 8080
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = data.google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.cloud_run_database_url,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloudbuild_trigger" "api_deploy" {
  project         = var.project_id
  location        = var.cloud_build_region
  name            = "i-um-api-staging-deploy"
  description     = "Manual deploy trigger for the i-um staging API Cloud Run service."
  service_account = google_service_account.cloud_build.id

  source_to_build {
    repository = local.cloudbuild_repository
    ref        = "refs/heads/${var.deploy_branch}"
    repo_type  = "GITHUB"
  }

  git_file_source {
    path       = "cloudbuild.api.yaml"
    repository = local.cloudbuild_repository
    revision   = "refs/heads/${var.deploy_branch}"
    repo_type  = "GITHUB"
  }

  substitutions = {
    _REGION              = var.region
    _SERVICE_NAME        = var.cloud_run_service_name
    _ARTIFACT_REPOSITORY = var.artifact_registry_repository
    _IMAGE_NAME          = "api"
  }

  depends_on = [
    google_artifact_registry_repository.api,
    google_cloud_run_v2_service.api,
    google_project_iam_member.cloud_build_artifact_writer,
    google_project_iam_member.cloud_build_run_developer,
    google_project_iam_member.cloud_build_logs_writer,
    google_project_iam_member.cloud_build_builder,
    google_service_account_iam_member.cloud_build_can_act_as_cloud_run,
  ]
}
