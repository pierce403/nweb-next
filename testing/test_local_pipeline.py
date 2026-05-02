"""Tests for the local dispatcher -> collector -> Analyst indexing path."""

import sqlite3
from pathlib import Path


def test_runner_scripts_exist_and_are_executable():
    root = Path(__file__).resolve().parents[1]

    for script_name in ("run-dispatcher.sh", "run-collector.sh"):
        script = root / script_name
        assert script.exists()
        assert script.stat().st_mode & 0o111


def test_run_collector_defaults_to_dispatcher_and_analyst_submit_endpoint():
    root = Path(__file__).resolve().parents[1]
    script = (root / "run-collector.sh").read_text(encoding="utf-8")

    assert 'DISPATCHER_URL="${DISPATCHER_URL:-http://127.0.0.1:7778}"' in script
    assert 'INDEX_URL="${INDEX_URL:-http://127.0.0.1:3000/api/submit}"' in script
    assert 'ANALYST_URL="${ANALYST_URL:-${INDEX_URL%/api/submit}}"' in script
    assert 'RANDOM_IPV4="${RANDOM_IPV4:-1}"' in script
    assert 'CONTINUOUS="${CONTINUOUS:-0}"' in script
    assert 'NO_PING="${NO_PING:-1}"' in script
    assert "--dispatcher-url" in script
    assert "--index-url" in script
    assert "--random-ipv4" in script
    assert "--targets" in script
    assert "--no-ping" in script


def test_dispatcher_default_work_keeps_safe_local_default():
    root = Path(__file__).resolve().parents[1]
    work = (root / "dispatcher/work/default.json").read_text(encoding="utf-8")

    assert "local-loopback-quick" in work
    assert "ip:127.0.0.1" in work
    assert "safe-default" in work


def test_default_analyst_database_has_no_seeded_demo_rows():
    root = Path(__file__).resolve().parents[1]
    db_path = root / "analyst/nweb-analyst.db"

    if not db_path.exists():
        return

    with sqlite3.connect(db_path) as db:
        non_local_submissions = db.execute("select count(*) from submissions where uid not like 'local-%'").fetchone()[0]
        non_local_records = db.execute("select count(*) from records where submission_uid not like 'local-%'").fetchone()[0]

    assert non_local_submissions == 0
    assert non_local_records == 0
