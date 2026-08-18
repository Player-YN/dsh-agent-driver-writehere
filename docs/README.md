# README images

These files are the cover, GitHub social preview, and in-README figures.

| File | Role |
| --- | --- |
| `banner.html` → `banner.png` | README hero (2560×1280 @2x) |
| `banner.html` → `og.png` | GitHub social preview (1280×640) |
| `loop.html` → `loop.png` | One scheduler tick |
| `card-tree.html` → `card-tree.png` | Card tree schematic |

`card-tree.png` is a schematic. Card fill and stroke match the live sidebar (`packages/ui-article-tree`). It is not a capture of a private session.

Regenerate:

```powershell
.\docs\render.ps1
```
