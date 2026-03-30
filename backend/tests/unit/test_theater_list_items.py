from types import SimpleNamespace

import pytest

from app.services import theater_list_items as service


def test_item_fingerprint_prefers_tmdb_id():
    assert service.item_fingerprint(11, "Arrival", "異星入境") == ("tmdb", 11)


def test_item_fingerprint_falls_back_to_normalized_title():
    assert service.item_fingerprint(0, "Spider-Man: Into the Spider-Verse", None) == (
        "title",
        "spidermanintothespiderverse",
    )


@pytest.mark.asyncio
async def test_enrich_theater_list_item_uses_exact_tmdb_search_match(monkeypatch):
    async def fake_search_movies(query: str, limit: int = 5):
        assert query == "Arrival"
        return [
            SimpleNamespace(tmdb_id=99, title_en="The Arrival", title_zh="天煞地球反擊戰"),
            SimpleNamespace(tmdb_id=11, title_en="Arrival", title_zh="異星入境"),
        ]

    async def fake_get_movie(tmdb_id: int):
        assert tmdb_id == 11
        return SimpleNamespace(
            tmdb_id=11,
            title_en="Arrival",
            title_zh="異星入境",
            poster_url="https://image.tmdb.org/t/p/w500/arrival.jpg",
            genres=["Science Fiction"],
            runtime_minutes=116,
        )

    monkeypatch.setattr(service, "search_movies", fake_search_movies)
    monkeypatch.setattr(service, "get_movie", fake_get_movie)

    item = service.TheaterListItemData(tmdb_id=0, title_en="Arrival")
    enriched = await service.enrich_theater_list_item(item)

    assert enriched.tmdb_id == 11
    assert enriched.title_zh == "異星入境"
    assert enriched.poster_url == "https://image.tmdb.org/t/p/w500/arrival.jpg"


@pytest.mark.asyncio
async def test_prepare_theater_list_items_dedupes_after_enrichment(monkeypatch):
    async def fake_enrich(item):
        if item.title_en == "Arrival":
            return service.TheaterListItemData(
                tmdb_id=11,
                title_en="Arrival",
                title_zh="異星入境",
                poster_url="https://image.tmdb.org/t/p/w500/arrival.jpg",
                genres=["Science Fiction"],
                runtime_minutes=116,
                match_tags=item.match_tags,
                note=item.note,
            )
        return item

    monkeypatch.setattr(service, "enrich_theater_list_item", fake_enrich)

    prepared = await service.prepare_theater_list_items(
        [
            service.TheaterListItemData(tmdb_id=0, title_en="Arrival"),
            service.TheaterListItemData(tmdb_id=11, title_en="Arrival"),
        ]
    )

    assert len(prepared) == 1
    assert prepared[0].poster_url == "https://image.tmdb.org/t/p/w500/arrival.jpg"


@pytest.mark.asyncio
async def test_enrich_theater_list_item_falls_back_to_first_result_when_needed(monkeypatch):
    async def fake_search_movies(query: str, limit: int = 5):
        assert query == "Herz"
        return [
            SimpleNamespace(tmdb_id=101, title_en="Her", title_zh="雲端情人"),
            SimpleNamespace(tmdb_id=102, title_en="Hero", title_zh="英雄"),
        ]

    async def fake_get_movie(tmdb_id: int):
        assert tmdb_id == 101
        return SimpleNamespace(
            tmdb_id=101,
            title_en="Her",
            title_zh="雲端情人",
            poster_url="https://image.tmdb.org/t/p/w500/her.jpg",
            genres=["Romance", "Sci-Fi"],
            runtime_minutes=126,
        )

    monkeypatch.setattr(service, "search_movies", fake_search_movies)
    monkeypatch.setattr(service, "get_movie", fake_get_movie)

    item = service.TheaterListItemData(tmdb_id=0, title_en="Herz")
    enriched = await service.enrich_theater_list_item(item)

    assert enriched.tmdb_id == 101
    assert enriched.title_en == "Her"
    assert enriched.poster_url == "https://image.tmdb.org/t/p/w500/her.jpg"


@pytest.mark.asyncio
async def test_enrich_theater_list_item_accepts_prefix_match(monkeypatch):
    async def fake_search_movies(query: str, limit: int = 5):
        assert query == "Burn"
        return [
            SimpleNamespace(tmdb_id=103, title_en="Burning", title_zh="燃燒烈愛"),
            SimpleNamespace(tmdb_id=104, title_en="The Burned Barns", title_zh="穀倉謎案"),
        ]

    async def fake_get_movie(tmdb_id: int):
        assert tmdb_id == 103
        return SimpleNamespace(
            tmdb_id=103,
            title_en="Burning",
            title_zh="燃燒烈愛",
            poster_url="https://image.tmdb.org/t/p/w500/burning.jpg",
            genres=["Drama"],
            runtime_minutes=148,
        )

    monkeypatch.setattr(service, "search_movies", fake_search_movies)
    monkeypatch.setattr(service, "get_movie", fake_get_movie)

    item = service.TheaterListItemData(tmdb_id=0, title_en="Burn")
    enriched = await service.enrich_theater_list_item(item)

    assert enriched.tmdb_id == 103
    assert enriched.poster_url == "https://image.tmdb.org/t/p/w500/burning.jpg"
