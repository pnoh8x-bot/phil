"""Run invariant tests without installing a test framework."""
from pathlib import Path
import runpy, sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
count=0
for path in sorted(Path(__file__).parent.glob('test_*.py')):
    for name,func in runpy.run_path(str(path)).items():
        if name.startswith('test_') and callable(func):
            func();count+=1;print('PASS',name)
print(f'{count} checks passed')
