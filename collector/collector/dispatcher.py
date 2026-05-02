"""Dispatcher client for collector work discovery."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

import requests


@dataclass(frozen=True)
class DispatcherWork:
    id: str
    targets: list[str]
    profile: str
    with_assets: bool
    priority: int
    description: str = ""


def fetch_dispatcher_work(
    dispatcher_url: str,
    *,
    work_id: str = "",
    label: str = "",
    profile: str = "",
    random: str = "",
    timeout: float = 10.0,
) -> DispatcherWork:
    """Fetch one work item from a dispatcher /getwork endpoint."""
    base_url = dispatcher_url.rstrip("/")
    params = {"limit": "100"}
    if label:
        params["label"] = label
    if profile:
        params["profile"] = profile
    if random:
        params["random"] = random

    response = requests.get(f"{base_url}/getwork?{urlencode(params)}", timeout=timeout)
    response.raise_for_status()
    payload = response.json()

    work_items = payload.get("work")
    if not isinstance(work_items, list):
        raise ValueError("dispatcher response must include a work array")

    selected = None
    if work_id:
        selected = next((item for item in work_items if item.get("id") == work_id), None)
        if selected is None:
            raise ValueError(f"dispatcher did not return work id {work_id!r}")
    elif work_items:
        selected = work_items[0]

    if not isinstance(selected, dict):
        raise ValueError("dispatcher returned no matching work")

    return _parse_work_item(selected)


def _parse_work_item(item: dict) -> DispatcherWork:
    work_id = item.get("id")
    targets = item.get("targets")
    profile = item.get("profile")
    with_assets = item.get("withAssets")
    priority = item.get("priority")
    description = item.get("description", "")

    if not isinstance(work_id, str) or not work_id:
        raise ValueError("dispatcher work item id must be a non-empty string")
    if not isinstance(targets, list) or not targets or not all(isinstance(target, str) for target in targets):
        raise ValueError(f"dispatcher work item {work_id!r} must include target strings")
    if not isinstance(profile, str) or not profile:
        raise ValueError(f"dispatcher work item {work_id!r} must include a profile")
    if not isinstance(with_assets, bool):
        raise ValueError(f"dispatcher work item {work_id!r} must include withAssets")
    if not isinstance(priority, int):
        raise ValueError(f"dispatcher work item {work_id!r} must include integer priority")
    if not isinstance(description, str):
        raise ValueError(f"dispatcher work item {work_id!r} description must be a string")

    return DispatcherWork(
        id=work_id,
        targets=targets,
        profile=profile,
        with_assets=with_assets,
        priority=priority,
        description=description,
    )
