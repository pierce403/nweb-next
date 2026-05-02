import hashlib
from pathlib import Path

import pytest

from collector.bundle import build_bundle
from collector.dispatcher import fetch_dispatcher_work
from collector.local_index import build_local_index_payload
from collector.nmap import normalize_targets, run_nmap
from collector.scanprint import canonicalize_record, merkle_root


def test_normalize_targets_accepts_ip_host_and_cidr():
    assert normalize_targets("ip:127.0.0.1, host:localhost, cidr:127.0.0.1/32") == [
        "127.0.0.1",
        "localhost",
        "127.0.0.1/32",
    ]


def test_normalize_targets_rejects_asn_for_now():
    with pytest.raises(ValueError, match="asn:"):
        normalize_targets("asn:AS13335")


def test_run_nmap_can_skip_host_discovery(monkeypatch, tmp_path: Path):
    calls = []

    def fake_run(command, check):
        calls.append((command, check))

    monkeypatch.setattr("collector.nmap.subprocess.run", fake_run)

    _started, _finished, command = run_nmap(["8.8.8.8"], "quick", tmp_path / "nmap.xml", no_ping=True)

    assert "-Pn" in command
    assert calls == [(command, True)]


def test_merkle_root_uses_canonical_json():
    records = [
        {"port": 443, "ip": "203.0.113.42", "state": "open"},
        {"state": "open", "ip": "203.0.113.43", "port": 80},
    ]
    leaf_a = hashlib.sha256(b'{"ip":"203.0.113.42","port":443,"state":"open"}').digest()
    leaf_b = hashlib.sha256(b'{"ip":"203.0.113.43","port":80,"state":"open"}').digest()

    assert canonicalize_record(records[0]) == '{"ip":"203.0.113.42","port":443,"state":"open"}'
    assert merkle_root(records) == "0x" + hashlib.sha256(leaf_a + leaf_b).hexdigest()


def test_build_bundle_writes_manifest_scanprint_and_raw_xml(tmp_path: Path):
    raw_xml = tmp_path / "nmap.xml"
    raw_xml.write_text("<nmaprun version='7.95'></nmaprun>", encoding="utf-8")
    records = [{"ip": "203.0.113.42", "port": 443, "state": "open"}]

    bundle = build_bundle(
        work_dir=tmp_path,
        raw_xml=raw_xml,
        records=records,
        namespace="nweb.io",
        dataset_type="nmap-quick",
        target_spec_cid="",
        tool_version="7.95",
        vantage="local/test",
        started_at=1,
        finished_at=2,
    )

    bundle_dir = bundle["bundle_dir"]
    assert (bundle_dir / "manifest.json").exists()
    assert (bundle_dir / "scanprint/scanprint.v0.jsonl").exists()
    assert (bundle_dir / "raw/nmap.xml").exists()
    assert bundle["manifest"]["scanprint"]["merkleRoot"] == merkle_root(records)
    assert bundle["manifest"]["scanprint"]["recordCount"] == 1


def test_fetch_dispatcher_work_selects_requested_item(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "work": [
                    {
                        "id": "one",
                        "targets": ["ip:127.0.0.1"],
                        "profile": "quick",
                        "withAssets": False,
                        "priority": 10,
                    },
                    {
                        "id": "two",
                        "targets": ["host:localhost"],
                        "profile": "top-100",
                        "withAssets": False,
                        "priority": 20,
                    },
                ]
            }

    calls = []

    def fake_get(url, timeout):
        calls.append((url, timeout))
        return Response()

    monkeypatch.setattr("collector.dispatcher.requests.get", fake_get)

    work = fetch_dispatcher_work("http://dispatcher.test", work_id="two", label="local", timeout=1)

    assert work.id == "two"
    assert work.targets == ["host:localhost"]
    assert work.profile == "top-100"
    assert calls == [("http://dispatcher.test/getwork?limit=100&label=local", 1)]


def test_fetch_dispatcher_work_can_request_random_ipv4(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "work": [
                    {
                        "id": "random-ipv4-8-8-8-8",
                        "targets": ["ip:8.8.8.8"],
                        "profile": "quick",
                        "withAssets": False,
                        "priority": 1,
                    },
                ]
            }

    calls = []

    def fake_get(url, timeout):
        calls.append((url, timeout))
        return Response()

    monkeypatch.setattr("collector.dispatcher.requests.get", fake_get)

    work = fetch_dispatcher_work("http://dispatcher.test", profile="quick", random="ipv4", timeout=1)

    assert work.id == "random-ipv4-8-8-8-8"
    assert work.targets == ["ip:8.8.8.8"]
    assert calls == [("http://dispatcher.test/getwork?limit=100&profile=quick&random=ipv4", 1)]


def test_build_local_index_payload_matches_analyst_submit_shape():
    records = [
        {
            "ts": 1,
            "ip": "127.0.0.1",
            "port": 631,
            "proto": "tcp",
            "state": "open",
            "service": "ipp",
            "product": "",
            "version": "",
            "tool": "nmap",
            "tool_version": "7.95",
            "options": "-T3 -F 127.0.0.1",
            "vantage": "local/test",
        }
    ]
    bundle = {
        "merkle_root": merkle_root(records),
        "manifest_sha256": "abc123",
    }

    payload = build_local_index_payload(
        bundle=bundle,
        records=records,
        targets=["127.0.0.1"],
        profile="quick",
        namespace="nweb.io",
        dataset_type="nmap-quick",
        cid="",
        target_spec_cid="",
        started_at=1,
        finished_at=2,
        tool_version="7.95",
        vantage="local/test",
        dispatcher_work_id="local-loopback-quick",
    )

    assert payload["uid"].startswith("local-")
    assert payload["status"] == "completed"
    assert payload["dataset_type"] == "nmap-quick"
    assert payload["extra"]["dispatcher_work_id"] == "local-loopback-quick"
    assert payload["records"] == [
        {
            "submission_uid": payload["uid"],
            "timestamp": 1,
            "ip": "127.0.0.1",
            "port": 631,
            "protocol": "tcp",
            "state": "open",
            "service": "ipp",
            "product": "",
            "version": "",
            "banner_sha256": "",
            "cert_fpr": "",
            "tls_ja3": "",
            "latency_ms": None,
            "tool": "nmap",
            "tool_version": "7.95",
            "options": "-T3 -F 127.0.0.1",
            "vantage": "local/test",
        }
    ]
