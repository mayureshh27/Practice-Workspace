class PracDaGoException(Exception):
    """Base exception for all application errors."""
    pass

class ChatTurnError(PracDaGoException):
    """Raised when the tutor agent fails to process a chat turn."""
    pass

class SessionEndError(PracDaGoException):
    """Raised when ending a session and generating a summary fails."""
    pass
