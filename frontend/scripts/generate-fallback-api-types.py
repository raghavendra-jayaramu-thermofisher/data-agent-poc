#!/usr/bin/env python3
"""Offline fallback generator for the checked-in OpenAPI snapshot.

Normal development uses `npm run api:generate` / openapi-typescript. This script exists
only so restricted/offline build environments can keep the contract mechanically derived
from the same OpenAPI JSON instead of introducing handwritten feature DTOs.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/api/generated/openapi.json'
OUTPUT = ROOT / 'src/api/generated/schema.ts'
spec = json.loads(SOURCE.read_text())

def q(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)

def ts(schema: dict[str, Any] | None) -> str:
    if not schema:
        return 'unknown'
    if '$ref' in schema:
        name = schema['$ref'].rsplit('/', 1)[-1]
        return f'components["schemas"][{q(name)}]'
    if 'const' in schema:
        return json.dumps(schema['const'])
    if 'enum' in schema:
        values = ' | '.join(json.dumps(v) for v in schema['enum'])
        return values or 'never'
    if 'anyOf' in schema:
        return ' | '.join(f'({ts(item)})' for item in schema['anyOf'])
    if 'oneOf' in schema:
        return ' | '.join(f'({ts(item)})' for item in schema['oneOf'])
    if 'allOf' in schema:
        return ' & '.join(f'({ts(item)})' for item in schema['allOf'])
    typ = schema.get('type')
    if isinstance(typ, list):
        return ' | '.join(ts({**schema, 'type': item}) for item in typ)
    if typ == 'string':
        return 'string'
    if typ in ('integer', 'number'):
        return 'number'
    if typ == 'boolean':
        return 'boolean'
    if typ == 'null':
        return 'null'
    if typ == 'array':
        return f'Array<{ts(schema.get("items"))}>'
    if typ == 'object' or 'properties' in schema or 'additionalProperties' in schema:
        props = schema.get('properties') or {}
        required = set(schema.get('required') or [])
        chunks: list[str] = []
        for name, sub in props.items():
            optional = '' if name in required else '?'
            chunks.append(f'{q(name)}{optional}: {ts(sub)};')
        if chunks:
            base = '{ ' + ' '.join(chunks) + ' }'
            additional = schema.get('additionalProperties')
            if isinstance(additional, dict):
                return f'({base} & Record<string, {ts(additional)}>)'
            return base
        additional = schema.get('additionalProperties')
        if isinstance(additional, dict):
            return f'Record<string, {ts(additional)}>'
        return 'Record<string, unknown>'
    return 'unknown'

def operation_type(op: dict[str, Any]) -> str:
    sections: list[str] = []
    parameters = op.get('parameters') or []
    grouped: dict[str, list[dict[str, Any]]] = {}
    for param in parameters:
        grouped.setdefault(param['in'], []).append(param)
    if grouped:
        inner = []
        for location, params in grouped.items():
            members = []
            for param in params:
                optional = '' if param.get('required') else '?'
                members.append(f'{q(param["name"])}{optional}: {ts(param.get("schema"))};')
            required_location = any(p.get('required') for p in params)
            inner.append(f'{q(location)}{"" if required_location else "?"}: {{ {" ".join(members)} }};')
        sections.append(f'parameters: {{ {" ".join(inner)} }};')
    request = op.get('requestBody')
    if request:
        optional = '' if request.get('required') else '?'
        content = ' '.join(f'{q(content_type)}: {ts(value.get("schema"))};' for content_type, value in request.get('content', {}).items())
        sections.append(f'requestBody{optional}: {{ content: {{ {content} }} }};')
    response_members = []
    for status, response in op.get('responses', {}).items():
        content = response.get('content') or {}
        if content:
            content_members = ' '.join(f'{q(content_type)}: {ts(value.get("schema"))};' for content_type, value in content.items())
            response_members.append(f'{q(str(status))}: {{ content: {{ {content_members} }} }};')
        else:
            response_members.append(f'{q(str(status))}: {{ content?: never }};')
    sections.append(f'responses: {{ {" ".join(response_members)} }};')
    return '{ ' + ' '.join(sections) + ' }'

lines = [
    '/**',
    ' * AUTO-GENERATED OFFLINE FALLBACK from src/api/generated/openapi.json.',
    ' * Normal development should regenerate this file with `npm run api:generate`',
    ' * using pinned openapi-typescript@7.13.0.',
    ' */',
    'export interface components {',
    '  schemas: {',
]
for name, schema in spec.get('components', {}).get('schemas', {}).items():
    lines.append(f'    {q(name)}: {ts(schema)};')
lines += ['  };', '}','', 'export interface paths {']
for path, item in spec['paths'].items():
    lines.append(f'  {q(path)}: {{')
    for method, op in item.items():
        if method.lower() not in {'get','put','post','delete','patch','options','head','trace'}:
            continue
        lines.append(f'    {method.lower()}: {operation_type(op)};')
    lines.append('  };')
lines += ['}', '']
OUTPUT.write_text('\n'.join(lines))
print(f'Generated {OUTPUT} from {SOURCE} ({len(spec["paths"])} paths)')
