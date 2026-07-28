from PIL import Image
import os

src = '/Users/zhushuai/WorkBuddy/2026-07-27-18-13-44/zos-workbench/icons/A_clean__minimalist_app_icon_f_2026-07-27T10-36-06.png'
out_dir = '/Users/zhushuai/WorkBuddy/2026-07-27-18-13-44/zos-workbench/icons'

img = Image.open(src).convert('RGBA')
w, h = img.size

# Crop to the icon square tightly (manual bounds from 1024x1024 source)
# This removes the gray background and any watermark outside the icon.
icon_box = (100, 100, 924, 924)  # 824x824 centered icon
square = img.crop(icon_box)

# Optional: if background gray still visible at edges, trim remaining uniform gray
def trim_transparent_or_gray(im, threshold=30):
    # Convert to RGB and find non-gray bounds
    rgb = im.convert('RGB')
    bg = rgb.getpixel((0, 0))
    w, h = rgb.size
    left, top, right, bottom = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = rgb.getpixel((x, y))
            if abs(r - bg[0]) > threshold or abs(g - bg[1]) > threshold or abs(b - bg[2]) > threshold:
                left = min(left, x); right = max(right, x)
                top = min(top, y); bottom = max(bottom, y)
    return im.crop((left, top, right + 1, bottom + 1))

square = trim_transparent_or_gray(square, threshold=25)

# Generate sizes
def save_icon(size, name, use_alpha=True):
    resized = square.resize((size, size), Image.LANCZOS)
    if not use_alpha:
        # Composite on white for touch icon
        bg = Image.new('RGBA', (size, size), (255, 255, 255, 255))
        bg.paste(resized, (0, 0), resized)
        resized = bg.convert('RGB')
    resized.save(os.path.join(out_dir, name))

save_icon(512, 'icon-512x512.png')
save_icon(192, 'icon-192x192.png')
save_icon(180, 'apple-touch-icon.png', use_alpha=False)

# Maskable icon: content within center ~75% for safe area
mask_size = 512
content_size = int(mask_size * 0.65)  # keep key content in 65% center, safe for 80% mask
mask = Image.new('RGBA', (mask_size, mask_size), (0, 0, 0, 0))
content = square.resize((content_size, content_size), Image.LANCZOS)
offset = (mask_size - content_size) // 2
mask.paste(content, (offset, offset))
mask.save(os.path.join(out_dir, 'icon-maskable-512x512.png'))

print('Icons generated:')
for name in ['icon-512x512.png', 'icon-192x192.png', 'apple-touch-icon.png', 'icon-maskable-512x512.png']:
    p = os.path.join(out_dir, name)
    print(f'  {name}: {os.path.getsize(p)} bytes, size {Image.open(p).size}')
