#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Глубокая диагностика HTML-файла."""

import re

with open(r'C:\кис кис\android.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    content = ''.join(lines)

issues = []

# 1. Check for encoding issues (replacement characters)
if '\ufffd' in content:
    issues.append('Encoding issues found (replacement characters)')

# 2. Check for unclosed tags (basic)
void_tags = {'br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'}
for tag in ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav', 'form']:
    opens = len(re.findall(r'<' + tag + r'[\s>]', content))
    closes = len(re.findall(r'</' + tag + r'>', content))
    if opens != closes:
        issues.append(f'Tag mismatch: {tag} - {opens} opens, {closes} closes')

# 3. Check for common JS issues
js_blocks = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
for i, js in enumerate(js_blocks):
    if not js.strip():
        continue
    # Check brace balance
    if js.count('{') != js.count('}'):
        issues.append(f'JS block {i}: brace mismatch ({js.count("{")} vs {js.count("}")})')
    # Check bracket balance
    if js.count('[') != js.count(']'):
        issues.append(f'JS block {i}: bracket mismatch')
    # Check paren balance
    if js.count('(') != js.count(')'):
        issues.append(f'JS block {i}: paren mismatch ({js.count("(")} vs {js.count(")")})')
    # Check quote balance
    if js.count("'") % 2 != 0:
        issues.append(f'JS block {i}: odd number of single quotes')
    if js.count('"') % 2 != 0:
        issues.append(f'JS block {i}: odd number of double quotes')

# 4. Check for common issues
if 'function init()' not in content:
    issues.append('init() function not found')

# 5. Check for event listeners on non-existent elements
ids = set(re.findall(r'id="([^"]+)"', content))
for match in re.finditer(r"getElementById\('([^']+)'\)", content):
    elem_id = match.group(1)
    if elem_id not in ids and not elem_id.startswith("'"):
        issues.append(f'getElementById references non-existent ID: {elem_id}')

# 6. Check script placement
body_end = content.rfind('</body>')
script_positions = [m.start() for m in re.finditer(r'<script', content)]
for pos in script_positions:
    if pos > body_end:
        issues.append('Script tag found after </body>')

print('=== Диагностика ===')
if issues:
    print(f'Найдено проблем: {len(issues)}')
    for issue in issues:
        print(f'  ❌ {issue}')
else:
    print('✅ Проблем не найдено')

print(f'\nСтрок: {len(lines)}')
print(f'Размер: {len(content)} символов')
print(f'JS блоков: {len(js_blocks)}')
print(f'ID элементов: {len(ids)}')
