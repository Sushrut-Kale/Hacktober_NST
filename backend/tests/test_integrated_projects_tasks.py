"""Tests for integrated Project and Task persistence endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base, get_db
from backend.app.main import app

# Isolated in-memory SQLite database dedicated to this test suite
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def client():
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def test_create_and_retrieve_project(client):
    """Test registering a project and retrieving it by ID."""
    resp = client.post(
        "/api/projects",
        json={
            "name": "Integration Project",
            "root_path": "/workspace/sample",
            "repository_url": "https://github.com/org/sample.git",
        },
    )
    assert resp.status_code == 201
    project_id = resp.json()["id"]

    get_resp = client.get(f"/api/projects/{project_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Integration Project"
    assert get_resp.json()["analysis_status"] == "PENDING"


def test_list_projects(client):
    """Test listing registered projects."""
    client.post("/api/projects", json={"name": "Project A", "root_path": "/a"})
    client.post("/api/projects", json={"name": "Project B", "root_path": "/b"})

    resp = client.get("/api/projects")
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) >= 2


def test_create_task_under_project(client):
    """Test creating and retrieving a task associated with an existing project."""
    proj_resp = client.post("/api/projects", json={"name": "Parent", "root_path": "/parent"})
    project_id = proj_resp.json()["id"]

    task_resp = client.post(
        "/api/tasks",
        json={
            "project_id": project_id,
            "title": "Build Parser",
            "description": "Parse AST",
            "acceptance_criteria": "AST generated",
        },
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["id"]

    get_task_resp = client.get(f"/api/tasks/{task_id}")
    assert get_task_resp.status_code == 200
    assert get_task_resp.json()["title"] == "Build Parser"
    assert get_task_resp.json()["status"] == "PLANNED"


def test_create_task_rejects_nonexistent_project(client):
    """Test creating a task for nonexistent project returns 404."""
    resp = client.post(
        "/api/tasks",
        json={
            "project_id": "nonexistent-proj-id",
            "title": "Orphaned Task",
        },
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_list_project_tasks(client):
    """Test listing all tasks belonging to a specific project."""
    proj_resp = client.post("/api/projects", json={"name": "Proj With Tasks", "root_path": "/pwt"})
    project_id = proj_resp.json()["id"]

    client.post("/api/tasks", json={"project_id": project_id, "title": "Task 1"})
    client.post("/api/tasks", json={"project_id": project_id, "title": "Task 2"})

    tasks_resp = client.get(f"/api/projects/{project_id}/tasks")
    assert tasks_resp.status_code == 200
    assert len(tasks_resp.json()) == 2
