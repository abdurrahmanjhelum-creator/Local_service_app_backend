import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PYTHON_SOURCE = BACKEND_ROOT / "python_ai" / "src"
sys.path.insert(0, str(PYTHON_SOURCE))

from localserve_ai.main import app  # noqa: E402
