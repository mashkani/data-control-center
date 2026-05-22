"""Execute chart-shaped SQL against DuckDB (mirrors frontend chart SQL generators).

When chart SQL changes, update golden SQL here and in frontend chartSql/chartUtils tests
in the same PR. See CONTRIBUTING.md — Chart SQL fixtures.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.config import Settings
from app.models.api import QueryRequest
from app.services.query import execute_query
from app.services.registry import DatasetRegistry
from app.services.workspace import Workspace

FIXTURE_CSV = Path(__file__).resolve().parent / "fixtures" / "chart_orders.csv"
VIEW_NAME = "chart_orders"


@pytest.fixture()
def chart_registry(tmp_path: Path) -> DatasetRegistry:
    settings = Settings(
        workspace_db_path=tmp_path / "w.duckdb",
        allow_arbitrary_registration_paths=True,
    )
    ws = Workspace(settings)
    reg = DatasetRegistry(ws, settings)
    reg.register_path(FIXTURE_CSV)
    ds = reg.list_all()[0]
    assert ds.view_name == VIEW_NAME
    return reg


# mirrors frontend chartUtils.test.ts: builds bar SQL for count-only and aggregated measures with top N
_BAR_COUNT_SQL = """
WITH _dcc_bar_ranked AS (
  SELECT CAST(region AS VARCHAR) AS x, count(*) AS sort_value
  FROM chart_orders
  WHERE region IS NOT NULL
  GROUP BY 1
  ORDER BY sort_value DESC
  LIMIT 10
)
SELECT CAST(region AS VARCHAR) AS x, count(*) AS count
FROM chart_orders
INNER JOIN _dcc_bar_ranked ON CAST(region AS VARCHAR) = _dcc_bar_ranked.x
WHERE region IS NOT NULL
GROUP BY 1
ORDER BY max(_dcc_bar_ranked.sort_value) DESC;
"""

# mirrors frontend chartUtils.test.ts: builds bar SQL (sum measure + max sort_value regression)
_BAR_SUM_SQL = """
WITH _dcc_bar_ranked AS (
  SELECT CAST(region AS VARCHAR) AS x, sum("gross revenue") AS sort_value
  FROM chart_orders
  WHERE region IS NOT NULL AND "gross revenue" IS NOT NULL
  GROUP BY 1
  ORDER BY sort_value DESC
  LIMIT 15
)
SELECT CAST(region AS VARCHAR) AS x, sum("gross revenue") AS "gross revenue"
FROM chart_orders
INNER JOIN _dcc_bar_ranked ON CAST(region AS VARCHAR) = _dcc_bar_ranked.x
WHERE region IS NOT NULL AND "gross revenue" IS NOT NULL
GROUP BY 1
ORDER BY max(_dcc_bar_ranked.sort_value) DESC;
"""

# mirrors frontend chartUtils.test.ts: builds bar split SQL and grouped bar chart options
_BAR_SPLIT_SQL = """
WITH _dcc_bar_ranked AS (
  SELECT CAST(region AS VARCHAR) AS x, avg("gross revenue") AS sort_value
  FROM chart_orders
  WHERE region IS NOT NULL AND "gross revenue" IS NOT NULL
  GROUP BY 1
  ORDER BY sort_value DESC
  LIMIT 5
)
SELECT CAST(region AS VARCHAR) AS x, CAST(team AS VARCHAR) AS split, avg("gross revenue") AS value
FROM chart_orders
INNER JOIN _dcc_bar_ranked ON CAST(region AS VARCHAR) = _dcc_bar_ranked.x
WHERE region IS NOT NULL AND "gross revenue" IS NOT NULL AND team IS NOT NULL
GROUP BY 1, 2
ORDER BY max(_dcc_bar_ranked.sort_value) DESC, x, split;
"""

# mirrors frontend chartUtils.test.ts: builds quoted aggregate SQL with bucketing
_LINE_AGG_SQL = """
SELECT date_trunc('month', "order date") AS x,
  avg("gross revenue") AS "gross revenue",
  avg(profit) AS profit
FROM chart_orders
WHERE "order date" IS NOT NULL
GROUP BY 1
ORDER BY x
LIMIT 5000;
"""

# mirrors frontend chartUtils.test.ts: builds integer histogram SQL
_HISTOGRAM_INT_SQL = """
WITH _dcc_stats AS (
  SELECT CAST(min(profit) AS BIGINT) AS min_v, CAST(max(profit) AS BIGINT) AS max_v
  FROM chart_orders
  WHERE profit IS NOT NULL
),
_dcc_shape AS (
  SELECT
    min_v,
    max_v,
    max_v - min_v + 1 AS domain_size,
    least(12, max_v - min_v + 1) AS bucket_count,
    CAST(floor((max_v - min_v + 1)::DOUBLE / least(12, max_v - min_v + 1)) AS BIGINT) AS base_width,
    (max_v - min_v + 1) % least(12, max_v - min_v + 1) AS extra_bins
  FROM _dcc_stats
  WHERE min_v IS NOT NULL
),
_dcc_ranges AS (
  SELECT
    range::INTEGER AS bin_index,
    min_v + range * base_width + least(range, extra_bins) AS lower_bound,
    min_v + range * base_width + least(range, extra_bins) + base_width
      + CASE WHEN extra_bins > range THEN 1 ELSE 0 END - 1 AS upper_bound
  FROM _dcc_shape, range(bucket_count)
),
_dcc_counts AS (
  SELECT
    _dcc_ranges.bin_index,
    count(*) AS count
  FROM chart_orders
  CROSS JOIN _dcc_ranges
  WHERE profit IS NOT NULL
    AND CAST(profit AS BIGINT) BETWEEN _dcc_ranges.lower_bound AND _dcc_ranges.upper_bound
  GROUP BY 1
)
SELECT
  _dcc_ranges.bin_index,
  _dcc_ranges.lower_bound,
  _dcc_ranges.upper_bound,
  coalesce(_dcc_counts.count, 0) AS count
FROM _dcc_ranges
LEFT JOIN _dcc_counts ON _dcc_counts.bin_index = _dcc_ranges.bin_index
ORDER BY _dcc_ranges.bin_index
LIMIT 5000;
"""

# mirrors frontend chartUtils.test.ts: builds scatter SQL without grouping
_SCATTER_SQL = """
SELECT "gross revenue" AS x, profit AS y
FROM chart_orders
WHERE "gross revenue" IS NOT NULL AND profit IS NOT NULL
ORDER BY x
LIMIT 5000;
"""


@pytest.mark.parametrize(
    ("case_id", "sql", "min_rows"),
    [
        ("bar_count", _BAR_COUNT_SQL, 1),
        ("bar_sum", _BAR_SUM_SQL, 1),
        ("bar_split", _BAR_SPLIT_SQL, 1),
        ("line_aggregate", _LINE_AGG_SQL, 1),
        ("histogram_integer", _HISTOGRAM_INT_SQL, 1),
        ("scatter", _SCATTER_SQL, 1),
    ],
)
def test_chart_sql_executes_in_duckdb(
    chart_registry: DatasetRegistry,
    case_id: str,
    sql: str,
    min_rows: int,
) -> None:
    del case_id
    out = execute_query(chart_registry, Settings(), QueryRequest(sql=sql))
    assert out.error is None, out.error
    assert out.row_count >= min_rows
