import uuid


def new_id(prefix: str = "") -> str:
    """Generate a stable unique identifier with an optional prefix."""
    suffix = str(uuid.uuid4())
    return f"{prefix}-{suffix}" if prefix else suffix
