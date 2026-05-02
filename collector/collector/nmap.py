"""nmap execution and XML parsing."""

import ipaddress
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path


PROFILE_ARGS = {
    "quick": ["-T3", "-F"],
    "top-100": ["-T3", "--top-ports", "100"],
    "top-1000": ["-T3", "--top-ports", "1000"],
    "full": ["-T3", "-p-"],
}

PROFILE_DATASET_TYPES = {
    "quick": "nmap-quick",
    "top-100": "nmap-quick",
    "top-1000": "nmap-top1k",
    "full": "nmap-full",
}


def normalize_targets(targets: str) -> list[str]:
    """Parse comma-separated target specs into nmap target arguments."""
    parsed = []
    for raw_target in targets.split(","):
        target = raw_target.strip()
        if not target:
            continue

        if target.startswith("cidr:"):
            target = target.removeprefix("cidr:")
        elif target.startswith("ip:"):
            target = target.removeprefix("ip:")
        elif target.startswith("host:"):
            target = target.removeprefix("host:")
        elif target.startswith("asn:"):
            raise ValueError("asn: target expansion is not implemented yet; use cidr:, ip:, or host:")

        if "/" in target:
            ipaddress.ip_network(target, strict=False)
        parsed.append(target)

    if not parsed:
        raise ValueError("at least one target is required")
    return parsed


def run_nmap(targets: list[str], profile: str, output_xml: Path, *, no_ping: bool = False) -> tuple[int, int, list[str]]:
    """Run nmap and write XML output."""
    if profile not in PROFILE_ARGS:
        raise ValueError(f"unknown nmap profile: {profile}")

    output_xml.parent.mkdir(parents=True, exist_ok=True)
    started_at = int(time.time())
    ping_args = ["-Pn"] if no_ping else []
    command = ["nmap", "-oX", str(output_xml), *ping_args, *PROFILE_ARGS[profile], *targets]
    subprocess.run(command, check=True)
    finished_at = int(time.time())
    return started_at, finished_at, command


def parse_nmap_xml(xml_path: Path, *, vantage: str, options: str) -> tuple[list[dict], str]:
    """Parse nmap XML into scanprint records and return nmap version."""
    root = ET.parse(xml_path).getroot()
    nmap_version = root.attrib.get("version", "")
    records: list[dict] = []

    for host in root.findall("host"):
        address = host.find("address")
        if address is None:
            continue
        ip = address.attrib.get("addr")
        if not ip:
            continue

        for port in host.findall("./ports/port"):
            state_el = port.find("state")
            service_el = port.find("service")
            state = state_el.attrib.get("state", "unknown") if state_el is not None else "unknown"
            service = service_el.attrib if service_el is not None else {}

            records.append(
                {
                    "ts": int(time.time()),
                    "ip": ip,
                    "port": int(port.attrib["portid"]),
                    "proto": port.attrib.get("protocol", "tcp"),
                    "state": state,
                    "service": service.get("name", ""),
                    "product": service.get("product", ""),
                    "version": service.get("version", ""),
                    "banner_sha256": "",
                    "cert_fpr": "",
                    "tls_ja3": "",
                    "latency_ms": None,
                    "tool": "nmap",
                    "tool_version": nmap_version,
                    "options": options,
                    "vantage": vantage,
                }
            )

    return records, nmap_version
