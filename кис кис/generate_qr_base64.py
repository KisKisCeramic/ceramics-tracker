#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генерация base64 QR-кодов для всех товаров."""

import qrcode
import base64
import io
import json
import os

PRODUCTS = [
    {"sku": "KM-001", "name": "Кружка Мята 350мл", "price": 1200, "stock": 25},
    {"sku": "KM-002", "name": "Кружка Лаванда 350мл", "price": 1200, "stock": 25},
    {"sku": "KM-003", "name": "Кружка Графит 350мл", "price": 1200, "stock": 20},
    {"sku": "KM-004", "name": "Тарелка Облако 24см", "price": 1800, "stock": 15},
    {"sku": "KM-005", "name": "Тарелка Солнце 24см", "price": 1800, "stock": 15},
    {"sku": "KM-006", "name": "Тарелка Песок 24см", "price": 1800, "stock": 15},
    {"sku": "KM-007", "name": "Ваза Дуб 22см", "price": 3500, "stock": 8},
    {"sku": "KM-008", "name": "Ваза Берёза 18см", "price": 2800, "stock": 10},
    {"sku": "KM-009", "name": "Кашпо Папоротник 14см", "price": 900, "stock": 30},
    {"sku": "KM-010", "name": "Кашпо Суккулент 10см", "price": 700, "stock": 35},
    {"sku": "KM-011", "name": "Чайник Туман 1л", "price": 4500, "stock": 5},
    {"sku": "KM-012", "name": "Сахарник Ягода", "price": 1500, "stock": 12},
    {"sku": "KM-013", "name": "Салатник Море 20см", "price": 2200, "stock": 10},
    {"sku": "KM-014", "name": "Супница Лес 1.5л", "price": 3800, "stock": 6},
    {"sku": "KM-015", "name": "Блюдо Аист 30см", "price": 2500, "stock": 8},
]

def generate_qr_base64(sku, size=200):
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(sku)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img = img.resize((size, size))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('ascii')

qr_data = {}
for p in PRODUCTS:
    qr_data[p['sku']] = generate_qr_base64(p['sku'])
    print(f"QR сгенерирован: {p['sku']}")

output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'qr_codes.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(qr_data, f, ensure_ascii=False, indent=2)
print(f'\nСохранено: {output_path}')
