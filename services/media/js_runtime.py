import os
import shutil
from pathlib import Path

def node_path():
    configured = os.environ.get('EXTRACTION_NODE') or shutil.which('node')
    if configured:
        return configured
    try:
        import nodejs_wheel
        bundled = Path(nodejs_wheel.__file__).parent / 'bin' / 'node'
        if bundled.is_file():
            return str(bundled)
    except ImportError:
        pass
    return 'node'
