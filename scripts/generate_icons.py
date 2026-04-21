#!/usr/bin/env python3
"""Generates icon-16.png, icon-48.png, icon-128.png for CarbonLens.
Draws a simple leaf on a green circle. No third-party dependencies (stdlib only)."""

import struct, zlib, math, os

def write_png(width, height, pixels):
    """Write a minimal valid RGBA PNG file."""
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA

    raw = b''
    for row in pixels:
        raw += b'\x00'  # filter: None
        for (r, g, b, a) in row:
            raw += bytes([r, g, b, a])

    idat = zlib.compress(raw, 9)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

def lerp(a, b, t): return a + (b - a) * t

def draw_icon(size):
    pixels = []
    cx = cy = size / 2
    r = size / 2 - 0.5

    # Colors
    GREEN_BG = (46, 125, 50)      # #2e7d32
    LEAF_COLOR = (255, 255, 255)  # white leaf
    BORDER = (30, 90, 34)         # darker green border

    for y in range(size):
        row = []
        for x in range(size):
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            dist = math.sqrt(dx*dx + dy*dy)

            if dist > r:
                row.append((0, 0, 0, 0))  # transparent
                continue

            # Anti-alias circle edge
            alpha = min(1.0, max(0.0, (r - dist) * 2))

            # Draw leaf shape using parametric test
            # Leaf: roughly y < -cx + |x| style curve, scaled to icon
            nx = dx / r  # normalized -1..1
            ny = dy / r  # normalized -1..1

            # Leaf occupies upper-right region with a teardrop shape
            # Translate so leaf center is slightly up-right
            lx = nx - 0.15
            ly = ny + 0.1
            # Leaf is an ellipse rotated ~45 degrees
            cos45 = math.sqrt(2)/2
            rx = lx * cos45 + ly * cos45
            ry = -lx * cos45 + ly * cos45
            in_leaf = (rx/0.55)**2 + (ry/0.28)**2 < 1.0

            # Stem: thin vertical line at bottom of leaf
            in_stem = abs(lx + 0.05) < 0.04 and ly > 0.0 and ly < 0.25

            if in_leaf or in_stem:
                br, bg, bb = LEAF_COLOR
            else:
                br, bg, bb = GREEN_BG

            row.append((
                int(br * alpha),
                int(bg * alpha),
                int(bb * alpha),
                int(255 * alpha)
            ))
        pixels.append(row)
    return pixels

output_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')
for size in [16, 48, 128]:
    pixels = draw_icon(size)
    data = write_png(size, size, pixels)
    path = os.path.join(output_dir, f'icon-{size}.png')
    with open(path, 'wb') as f:
        f.write(data)
    print(f'Written {path} ({size}x{size})')
