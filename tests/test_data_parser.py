"""
Zaytri — Test Suite for Data Parser Agent

Tests the DataParserAgent with the reference test dataset (20 rows).
Run with: pytest tests/test_data_parser.py -v
"""

import pytest
import os
from pathlib import Path


# ── Test helpers ─────────────────────────────────────────────────────────────

TEST_CSV_PATH = Path(__file__).parent / "test_calendar_data.csv"

def load_test_csv():
    """Load the test CSV as a string."""
    return TEST_CSV_PATH.read_text()


# ── Test: Column normalization ───────────────────────────────────────────────

def test_normalize_column_name():
    from agents.data_parser_agent import _normalize_column_name
    
    assert _normalize_column_name("Date") == "date"
    assert _normalize_column_name("Scheduled Date") == "scheduled_date"
    assert _normalize_column_name("Brand") == "brand"
    assert _normalize_column_name("Content_Type") == "content_type"
    assert _normalize_column_name("Topic") == "topic"
    assert _normalize_column_name("Platforms") == "platforms"
    assert _normalize_column_name("Approval_Required") == "approval_required"
    assert _normalize_column_name("Default hastags") == "default_hashtags"  # handles typo
    assert _normalize_column_name("Generated Hashtags") == "generated_hashtags"


# ── Test: Boolean parser ────────────────────────────────────────────────────

def test_parse_bool():
    from agents.data_parser_agent import _parse_bool
    
    assert _parse_bool("TRUE") is True
    assert _parse_bool("true") is True
    assert _parse_bool("YES") is True
    assert _parse_bool("1") is True
    assert _parse_bool("FALSE") is False
    assert _parse_bool("false") is False
    assert _parse_bool("NO") is False
    assert _parse_bool("0") is False
    assert _parse_bool("") is False
    assert _parse_bool(True) is True
    assert _parse_bool(False) is False


# ── Test: Platform parser ───────────────────────────────────────────────────

def test_parse_platforms():
    from agents.data_parser_agent import _parse_platforms
    
    result = _parse_platforms("LinkedIn, X, Instagram")
    assert "linkedin" in result
    assert "twitter" in result  # X → twitter
    assert "instagram" in result
    assert len(result) == 3
    
    result = _parse_platforms("Instagram, Facebook")
    assert "instagram" in result
    assert "facebook" in result
    
    result = _parse_platforms("")
    assert result == []


# ── Test: Hashtag parser ────────────────────────────────────────────────────

def test_parse_hashtags():
    from agents.data_parser_agent import _parse_hashtags
    
    result = _parse_hashtags("#zaytri")
    assert result == ["#zaytri"]
    
    result = _parse_hashtags("#zaytri,#productdemo")
    assert "#zaytri" in result
    assert "#productdemo" in result
    
    result = _parse_hashtags("")
    assert result == []
    
    # Without hash prefix
    result = _parse_hashtags("zaytri")
    assert result == ["#zaytri"]


# ── Test: Date parser ───────────────────────────────────────────────────────

def test_parse_date():
    from agents.data_parser_agent import _parse_date
    
    assert _parse_date("3/1/2026") == "2026-03-01"
    assert _parse_date("3/15/2026") == "2026-03-15"
    assert _parse_date("2026-03-01") == "2026-03-01"
    assert _parse_date("") is None
    assert _parse_date(None) is None


# ── Test: Full CSV parsing ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_csv_parsing():
    from agents.data_parser_agent import DataParserAgent
    
    parser = DataParserAgent()
    csv_data = load_test_csv()
    
    result = await parser.parse_csv_string(csv_data)
    
    assert result["total_rows"] == 20
    assert "rows" in result
    assert "columns" in result
    
    rows = result["rows"]
    
    # Check first row
    row1 = rows[0]
    assert row1["brand"] == "Zaytri"
    assert row1["topic"] == "Multi-agent AI system overview"
    assert "linkedin" in row1["platforms"]
    assert "twitter" in row1["platforms"]
    assert "instagram" in row1["platforms"]
    assert row1["approval_required"] is True
    assert row1["content_type"] == "Build in Public"
    assert "#zaytri" in row1["default_hashtags"]
    
    # Check second row (different brand, no approval)
    row2 = rows[1]
    assert row2["brand"] == "Abhishek Singh"
    assert row2["approval_required"] is False
    assert len(row2["platforms"]) == 2
    
    # Check multi-hashtag row (row 4: #zaytri,#productdemo)
    row4 = rows[3]
    assert len(row4["default_hashtags"]) == 2
    assert "#zaytri" in row4["default_hashtags"]
    assert "#productdemo" in row4["default_hashtags"]


# ── Test: Multi-brand validation ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_brand():
    from agents.data_parser_agent import DataParserAgent
    
    parser = DataParserAgent()
    csv_data = load_test_csv()
    result = await parser.parse_csv_string(csv_data)
    rows = result["rows"]
    
    brands = set(r["brand"] for r in rows)
    assert "Zaytri" in brands
    assert "Abhishek Singh" in brands
    
    zaytri_count = sum(1 for r in rows if r["brand"] == "Zaytri")
    abhishek_count = sum(1 for r in rows if r["brand"] == "Abhishek Singh")
    assert zaytri_count + abhishek_count == 20


# ── Test: Multi-platform routing ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_multi_platform_routing():
    from agents.data_parser_agent import DataParserAgent
    
    parser = DataParserAgent()
    csv_data = load_test_csv()
    result = await parser.parse_csv_string(csv_data)
    rows = result["rows"]
    
    all_platforms = set()
    for r in rows:
        all_platforms.update(r["platforms"])
    
    # Should have at least these platforms
    assert "linkedin" in all_platforms
    assert "twitter" in all_platforms
    assert "instagram" in all_platforms
    assert "facebook" in all_platforms
    assert "youtube" in all_platforms
    assert "medium" in all_platforms


# ── Test: Approval logic ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_approval_toggle():
    from agents.data_parser_agent import DataParserAgent
    
    parser = DataParserAgent()
    csv_data = load_test_csv()
    result = await parser.parse_csv_string(csv_data)
    rows = result["rows"]
    
    approval_count = sum(1 for r in rows if r["approval_required"])
    no_approval_count = sum(1 for r in rows if not r["approval_required"])
    
    assert approval_count == 10  # 10 TRUE
    assert no_approval_count == 10  # 10 FALSE


# ── Test: JSON parsing ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_json_parsing():
    from agents.data_parser_agent import DataParserAgent
    import json
    
    parser = DataParserAgent()
    
    test_data = json.dumps([
        {"topic": "AI Overview", "platform": "instagram", "brand": "Test"},
        {"topic": "Deep Dive", "platform": "linkedin", "brand": "Test"},
    ])
    
    result = await parser.parse_json_data(test_data)
    
    assert result["total_rows"] == 2
    assert result["rows"][0]["topic"] == "AI Overview"
    assert result["rows"][1]["topic"] == "Deep Dive"


# ── Test: Empty data handling ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_empty_csv():
    from agents.data_parser_agent import DataParserAgent
    
    parser = DataParserAgent()
    result = await parser.parse_csv_string("")
    
    assert result["total_rows"] == 0
    assert len(result["parse_errors"]) > 0


# ── Test: CSV file bytes ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_csv_bytes():
    from agents.data_parser_agent import DataParserAgent
    
    parser = DataParserAgent()
    csv_bytes = load_test_csv().encode("utf-8")
    
    result = await parser.parse_csv_file(csv_bytes)
    
    assert result["total_rows"] == 20
