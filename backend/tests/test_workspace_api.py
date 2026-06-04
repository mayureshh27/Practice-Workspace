"""Tests for workspace API endpoints.

Verifies response shapes match the frontend Zod schemas.
"""


def test_list_domains(client):
    """GET /api/domains returns seeded domains."""
    response = client.get("/api/domains")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 3
    # Check domain IDs match mockData.ts
    ids = {d["id"] for d in data}
    assert ids == {"robotics", "perception", "go-programming"}


def test_get_domain_robotics(client):
    """GET /api/domains/robotics returns the Robotics domain."""
    response = client.get("/api/domains/robotics")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "robotics"
    assert data["name"] == "Robotics"
    assert data["pinned"] is True
    # Should have 2 subjects
    assert len(data["subjects"]) == 2


def test_get_domain_not_found(client):
    """GET /api/domains/nonexistent returns 404."""
    response = client.get("/api/domains/nonexistent")
    assert response.status_code == 404


def test_get_subject(client):
    """GET /api/domains/robotics/subjects/modern-robotics returns Modern Robotics."""
    response = client.get("/api/domains/robotics/subjects/modern-robotics")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "modern-robotics"
    assert data["name"] == "Modern Robotics"
    assert len(data["chapters"]) == 4
    assert len(data["resources"]) == 3
    # Check camelCase serialisation for frontend compatibility
    assert "fileType" in str(data["resources"][0])


def test_get_subject_not_found(client):
    """GET with bad subject ID returns 404."""
    response = client.get("/api/domains/robotics/subjects/nonexistent")
    assert response.status_code == 404


def test_get_chapter(client):
    """GET chapter returns Configuration Space with topics."""
    response = client.get(
        "/api/domains/robotics/subjects/modern-robotics/chapters/c2"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "c2"
    assert data["name"] == "Chapter 2: Configuration Space"
    assert len(data["topics"]) == 3


def test_get_topic(client):
    """GET topic returns Degrees of Freedom."""
    response = client.get(
        "/api/domains/robotics/subjects/modern-robotics/chapters/c2/topics/deg-freedom"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "deg-freedom"
    assert data["name"] == "Degrees of Freedom"
    assert data["pinned"] is True
    # camelCase check
    assert "lastMessage" in data


def test_get_topic_not_found(client):
    """GET with bad topic ID returns 404."""
    response = client.get(
        "/api/domains/robotics/subjects/modern-robotics/chapters/c2/topics/nonexistent"
    )
    assert response.status_code == 404


def test_camel_case_serialisation(client):
    """Verify all response fields use camelCase matching frontend Zod schemas."""
    response = client.get("/api/domains/robotics/subjects/modern-robotics")
    data = response.json()
    # Resource should have fileType not file_type
    resource = data["resources"][0]
    assert "fileType" in resource
    assert "file_type" not in resource
    # Chapter should have topic with lastMessage not last_message
    topic = data["chapters"][0]["topics"][0]
    assert "lastMessage" in topic
    assert "last_message" not in topic
