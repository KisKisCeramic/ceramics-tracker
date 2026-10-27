#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генератор QR-этикеток для керамики 'КераМика'.
Создаёт labels.pdf (сетка QR-кодов) и products.js (данные для приложения)."""

import json
import os
import tempfile
from datetime import datetime

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, black

# ── Каталог товаров ──────────────────────────────────────────
# Каждая строка = один товар (артикул уникален, он же содержимое QR-кода)
PRODUCTS = [
    {"sku": "KM-001", "name": 'Кружка "Мята" 350мл',       "price": 1200, "stock": 25},
    {"sku": "KM-002", "name": 'Кружка "Лаванда" 350мл',     "price": 1200, "stock": 25},
    {"sku": "KM-003", "name": 'Кружка "Графит" 350мл',      "price": 1200, "stock": 20},
    {"sku": "KM-004", "name": 'Тарелка "Облако" 24см',      "price": 1800, "stock": 15},
    {"sku": "KM-005", "name": 'Тарелка "Солнце" 24см',      "price": 1800, "stock": 15},
    {"sku": "KM-006", "name": 'Тарелка "Песок" 24см',       "price": 1800, "stock": 15},
    {"sku": "KM-007", "name": 'Ваза "Дуб" 22см',            "price": 3500, "stock": 8},
    {"sku": "KM-008", "name": 'Ваза "Берёза" 18см',         "price": 2800, "stock": 10},
    {"sku": "KM-009", "name": 'Кашпо "Папоротник" 14см',    "price": 900,  "stock": 30},
    {"sku": "KM-010", "name": 'Кашпо "Суккулент" 10см',     "price": 700,  "stock": 35},
    {"sku": "KM-011", "name": 'Чайник "Туман" 1л',         "price": 4500, "stock": 5},
    {"sku": "KM-012", "name": 'Сахарник "Ягода"',           "price": 1500, "stock": 12},
    {"sku": "KM-013", "name": 'Салатник "Море" 20см',       "price": 2200, "stock": 10},
    {"sku": "KM-014", "name": 'Супница "Лес" 1.5л',        "price": 3800, "stock": 6},
    {"sku": "KM-015", "name": 'Блюдо "Аист" 30см',          "price": 2500, "stock": 8},
]

# ── Шрифты с поддержкой кириллицы ──────────────────────────
FONT_REG, FONT_BOLD = 'Helvetica', 'Helvetica-Bold'
for reg, bold in [('Arial', 'Arial-Bold'), ('DejaVu', 'DejaVu-Bold')]:
    try:
        pdfmetrics.registerFont(TTFont(reg, f'C:/Windows/Fonts/{reg.lower().replace("dejavu", "dejavusans")}.ttf'))
        if bold == 'Arial-Bold':
            pdfmetrics.registerFont(TTFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf'))
        else:
            pdfmetrics.registerFont(TTFont('DejaVu-Bold', 'C:/Windows/Fonts/dejavusansbold.ttf'))
        FONT_REG, FONT_BOLD = reg, bold
        break
    except Exception:
        continue


def _qr_png(sku, path):
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(sku)
    qr.make(fit=True)
    qr.make_image(fill_color='black', back_color='white').save(path)


def generate_pdf(products, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    label_w, label_h = 58 * mm, 38 * mm
    cols, rows = 3, 6
    margin_x, margin_top = 16 * mm, 22 * mm
    gap_x, gap_y = 3 * mm, 3 * mm

    accent = HexColor('#2D5016')
    light = HexColor('#F4F4EC')

    per_page = cols * rows
    total_pages = (len(products) + per_page - 1) // per_page
    tmp = tempfile.mkdtemp()

    for page_num in range(total_pages):
        c.setFont(FONT_BOLD, 16)
        c.setFillColor(accent)
        c.drawString(margin_x, height - 11 * mm, 'КераМика — этикетки товаров')

        c.setFont(FONT_REG, 8)
        c.setFillColor(HexColor('#777777'))
        c.drawString(margin_x, height - 16 * mm,
                     f'Страница {page_num + 1} из {total_pages} · '
                     f'{datetime.now().strftime("%d.%m.%Y")} · '
                     f'Продано = отсканировать QR и нажать «Продано»')

        for i in range(per_page):
            idx = page_num * per_page + i
            if idx >= len(products):
                break

            p = products[idx]
            col, row = i % cols, i // cols
            x = margin_x + col * (label_w + gap_x)
            y = height - margin_top - (row + 1) * label_h - row * gap_y

            # фон этикетки
            c.setFillColor(light)
            c.roundRect(x, y, label_w, label_h, 2 * mm, fill=1, stroke=0)

            # QR-код
            qr_path = os.path.join(tmp, f'qr_{idx}.png')
            _qr_png(p['sku'], qr_path)
            qr_size = 20 * mm
            c.drawImage(qr_path, x + (label_w - qr_size) / 2,
                        y + label_h - qr_size - 2 * mm,
                        width=qr_size, height=qr_size)

            # артикул
            c.setFont(FONT_BOLD, 8)
            c.setFillColor(accent)
            c.drawCentredString(x + label_w / 2, y + label_h - qr_size - 5.5 * mm, p['sku'])

            # название (в 2 строки при необходимости)
            c.setFont(FONT_REG, 6.5)
            c.setFillColor(black)
            name = p['name']
            if len(name) > 24:
                words = name.split()
                mid = len(words) // 2
                c.drawCentredString(x + label_w / 2, y + label_h - qr_size - 9 * mm,
                                    ' '.join(words[:mid]))
                c.drawCentredString(x + label_w / 2, y + label_h - qr_size - 12 * mm,
                                    ' '.join(words[mid:]))
            else:
                c.drawCentredString(x + label_w / 2, y + label_h - qr_size - 9.5 * mm, name)

            # цена
            c.setFont(FONT_BOLD, 9)
            c.setFillColor(HexColor('#8B4513'))
            c.drawCentredString(x + label_w / 2, y + 4.5 * mm, f"{p['price']} ₽")

        # линии реза (пунктир)
        c.setStrokeColor(HexColor('#BBBBBB'))
        c.setLineWidth(0.4)
        c.setDash(2, 2)
        grid_right = margin_x + cols * label_w + (cols - 1) * gap_x
        grid_bottom = height - margin_top - rows * label_h - (rows - 1) * gap_y
        for col in range(1, cols):
            x = margin_x + col * (label_w + gap_x) - gap_x / 2
            c.line(x, grid_bottom, x, height - margin_top + 4 * mm)
        for row in range(1, rows):
            y = height - margin_top - row * label_h - row * gap_y + gap_y / 2
            c.line(margin_x, y, grid_right, y)

        if page_num < total_pages - 1:
            c.showPage()

    c.save()
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    print(f'PDF сохранён: {output_path}  ({len(products)} этикеток, {total_pages} стр.)')


def generate_js(products, output_path):
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('// Данные товаров — генерируется generate_labels.py\n')
        f.write('const PRODUCTS = ')
        json.dump(products, f, ensure_ascii=False, indent=2)
        f.write(';\n')
    print(f'JS сохранён: {output_path}')


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    generate_pdf(PRODUCTS, os.path.join(base, 'labels.pdf'))
    generate_js(PRODUCTS, os.path.join(base, 'products.js'))
    print('Готово! Файлы: labels.pdf, products.js')
