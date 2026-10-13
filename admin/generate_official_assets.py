import os
import base64
from PIL import Image, ImageDraw

def generate_assets():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, '..'))
    
    src_dark_path = os.path.join(project_root, 'src', 'assets', 'logo', 'logo_dark.png')
    src_light_path = os.path.join(project_root, 'src', 'assets', 'logo', 'logo_light.png')
    assets_dir = os.path.join(script_dir, 'assets')
    os.makedirs(assets_dir, exist_ok=True)
    
    # 1. Load official source PNGs
    logo_dark = Image.open(src_dark_path).convert('RGBA')
    logo_light = Image.open(src_light_path).convert('RGBA')
    
    # Save direct copies to admin/assets
    logo_dark.save(os.path.join(assets_dir, 'logo_dark.png'), 'PNG')
    logo_light.save(os.path.join(assets_dir, 'logo_light.png'), 'PNG')
    logo_dark.save(os.path.join(assets_dir, 'logo.png'), 'PNG')
    print("Saved logo.png, logo_dark.png, logo_light.png")

    # 2. Generate 1024x1024 premium Desktop App Icon (icon.png)
    canvas_size = 1024
    icon_img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    
    padding = 32
    sq_size = canvas_size - 2 * padding  # 960x960
    radius = 216
    
    # Squircle mask
    mask = Image.new('L', (sq_size, sq_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (sq_size - 1, sq_size - 1)], radius=radius, fill=255)
    
    # Sleek dark background gradient
    sq_bg = Image.new('RGBA', (sq_size, sq_size), (0, 0, 0, 0))
    sq_draw = ImageDraw.Draw(sq_bg)
    for y in range(sq_size):
        t = y / sq_size
        r = int(37 * (1 - t) + 14 * t)
        g = int(38 * (1 - t) + 15 * t)
        b = int(44 * (1 - t) + 18 * t)
        sq_draw.line([(0, y), (sq_size, y)], fill=(r, g, b, 255))
        
    # Subtle radial center glow
    glow = Image.new('RGBA', (sq_size, sq_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    center = sq_size // 2
    for rad in range(320, 0, -8):
        alpha = int(22 * (1 - rad / 320))
        glow_draw.ellipse([center - rad, center - rad, center + rad, center + rad], fill=(255, 255, 255, alpha))
    sq_bg = Image.alpha_composite(sq_bg, glow)
    
    # Inner border for premium glass feel
    border_img = Image.new('RGBA', (sq_size, sq_size), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border_img)
    border_draw.rounded_rectangle([(1, 1), (sq_size - 2, sq_size - 2)], radius=radius, outline=(255, 255, 255, 32), width=2)
    sq_bg = Image.alpha_composite(sq_bg, border_img)
    
    # Paste squircle onto canvas with mask
    icon_img.paste(sq_bg, (padding, padding), mask)
    
    # Resize official logo to 640x640 with high quality LANCZOS
    target_logo_size = 640
    logo_resized = logo_dark.resize((target_logo_size, target_logo_size), Image.Resampling.LANCZOS)
    logo_x = (canvas_size - target_logo_size) // 2
    logo_y = (canvas_size - target_logo_size) // 2
    icon_img.paste(logo_resized, (logo_x, logo_y), logo_resized)
    
    icon_png_path = os.path.join(assets_dir, 'icon.png')
    icon_img.save(icon_png_path, 'PNG')
    print(f"Saved {icon_png_path}")
    
    # 3. Generate Windows multi-resolution icon.ico
    icon_ico_path = os.path.join(assets_dir, 'icon.ico')
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    icon_img.save(icon_ico_path, format='ICO', sizes=ico_sizes)
    print(f"Saved {icon_ico_path}")
    
    # 4. Generate official SVG logo (logo.svg)
    # Using base64 embedded official pixel-perfect vector representation
    with open(os.path.join(assets_dir, 'logo_dark.png'), 'rb') as f:
        b64_dark = base64.b64encode(f.read()).decode('utf-8')
        
    svg_path = os.path.join(assets_dir, 'logo.svg')
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="100%" height="100%">
  <!-- Sara AI Official Brand Logo -->
  <image href="data:image/png;base64,{b64_dark}" width="192" height="192" preserveAspectRatio="xMidYMid meet" />
</svg>
'''
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"Saved {svg_path}")

if __name__ == '__main__':
    generate_assets()
