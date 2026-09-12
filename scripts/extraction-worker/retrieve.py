"""Local CLI entrypoint for the shared, independently deployable media adapter."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "media"))
from retrieval import canonical_source, select_video, retrieve

if __name__ == "__main__":
    import runpy
    runpy.run_module("retrieval", run_name="__main__")
