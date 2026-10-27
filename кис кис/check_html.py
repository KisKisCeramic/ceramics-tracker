#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка HTML-файла на ошибки."""

import re
import sys

with open(r'C:\кис кис\ceramics-tracker.html', 'r', encoding='utf-8') as f:
    content = f.read()

issues = []

# Check script tags
scripts = re.findall(r'<script[^>]*>', content)
print(f'Script tags: {len(scripts)}')
for i, s in enumerate(scripts):
    print(f'  {i}: {s[:100]}')

# Check for unclosed divs
opens = len(re.findall(r'<div', content))
closes = len(re.findall(r'</div>', content))
print(f'\nDiv tags: {opens} open, {closes} close')
if opens != closes:
    issues.append(f'Div mismatch: {opens} open vs {closes} close')

# Check for basic JS structure
js_start = content.find('<script>')
js_end = content.rfind('</script>')
if js_start != -1 and js_end != -1:
    js = content[js_start:js_end]
    # Check brace balance
    open_braces = js.count('{')
    close_braces = js.count('}')
    if open_braces != close_braces:
        issues.append(f'Brace mismatch: {open_braces} open vs {close_braces} close')
    # Check paren balance
    open_parens = js.count('(')
    close_parens = js.count(')')
    if open_parens != close_parens:
        issues.append(f'Paren mismatch: {open_parens} open vs {close_parens} close')
    # Check for init function
    if 'function init()' not in js:
        issues.append('init() function not found')
    if 'init();' not in js:
        issues.append('init() call not found')

if issues:
    print(f'\nIssues found:')
    for issue in issues:
        print(f'  - {issue}')
else:
    print(f'\nNo obvious issues found')

print(f'\nFile size: {len(content)} chars')
print(f'Lines: {content.count(chr(10))}')
