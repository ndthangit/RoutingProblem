from __future__ import annotations

from typing import Any


def pytest_configure(config: Any) -> None:
    config._a_star_results = []


def pytest_terminal_summary(terminalreporter: Any, exitstatus: int, config: Any) -> None:
    results = getattr(config, "_a_star_results", [])
    if not results:
        return

    total_elapsed_ms = sum(float(item["elapsed_ms"]) for item in results)

    terminalreporter.section("A* route results", sep="-")
    terminalreporter.write_line(
        f"{'case':<12} {'depots':>8} {'found_len':>10} {'expected':>10} {'elapsed_ms':>12} {'status':>8}"
    )
    terminalreporter.write_line("-" * 67)
    for item in results:
        terminalreporter.write_line(
            f"{item['case_id']:<12} "
            f"{item['depots_count']:>8} "
            f"{str(item['found_len']):>10} "
            f"{item['expected_len']:>10} "
            f"{item['elapsed_ms']:>12.3f} "
            f"{item['status']:>8}"
        )
    terminalreporter.write_line("-" * 67)
    terminalreporter.write_line(f"{'TOTAL':<12} {'':>8} {'':>10} {'':>10} {total_elapsed_ms:>12.3f} {'':>8}")
