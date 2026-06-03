from typing import Annotated, cast

from fastapi import Depends, Request

from app.state import AppState


def _get_app_state(request: Request) -> AppState:
    return cast("AppState", request.app.state.custom)

AppStateDep = Annotated[AppState, Depends(_get_app_state)]
