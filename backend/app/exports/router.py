from fastapi import APIRouter, Depends
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from app.auth.dependencies import get_current_organization
from app.exports.excel import ExcelTableExport, build_excel, export_filename

EXCEL_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
router = APIRouter(prefix="/exports", tags=["exports"])


@router.post(
    "/excel",
    response_class=Response,
    dependencies=[Depends(get_current_organization)],
    responses={
        200: {"content": {EXCEL_MEDIA_TYPE: {"schema": {"type": "string", "format": "binary"}}}}
    },
)
async def export_excel(table: ExcelTableExport) -> Response:
    # Exports only the submitted table; it never queries a datasource or expands its scope.
    content = await run_in_threadpool(build_excel, table)
    return Response(
        content,
        media_type=EXCEL_MEDIA_TYPE,
        headers={
            "Content-Disposition": f'attachment; filename="{export_filename(table.title)}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
