import os
from PIL import Image

def main():
    frames_dir = 'temp-demo-frames'
    files = sorted([os.path.join(frames_dir, f) for f in os.listdir(frames_dir) if f.endswith('.png')])
    if not files:
        raise RuntimeError("No frames found in temp-demo-frames")

    images = [Image.open(f).convert('RGB') for f in files]
    
    # 3.5 seconds per slide = 3500ms
    duration = 3500
    out_path = os.path.join('assets', 'demo.gif')
    
    # Save as animated GIF with palette quantization for compact size
    images[0].save(
        out_path,
        save_all=True,
        append_images=images[1:],
        duration=duration,
        loop=0,
        optimize=True
    )
    
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Generated {out_path} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    main()
