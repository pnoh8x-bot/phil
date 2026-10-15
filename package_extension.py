"""Build the downloadable extension; no private league data is packaged."""
from pathlib import Path
import zipfile
root=Path(__file__).parent
with zipfile.ZipFile(root/'browser-extension.zip','w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted((root/'browser-extension').glob('*')):
        if file.is_file(): z.write(file, file.name)
