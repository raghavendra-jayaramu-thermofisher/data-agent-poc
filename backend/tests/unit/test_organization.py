from app.organizations.service import OrganizationService


def test_slugify_is_stable_and_safe() -> None:
    assert OrganizationService.slugify("  Acme & Sons / BI  ") == "acme-sons-bi"
    assert OrganizationService.slugify("!!!") == "workspace"
