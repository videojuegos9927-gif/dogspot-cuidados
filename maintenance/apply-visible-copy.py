"""Guarded text-only patch of a verified published build, not original TS source."""
from pathlib import Path
import hashlib, json, subprocess, sys

BASELINE = '9954363149991c8d61f8f4e2e0a61459731df59eccc80cf3b59c68ff96762691'
BUNDLE = 'index-DER3b9iC.js'
KEEP = '`Demo: iniciar cuidado y seguimiento`'

def apply(root: Path, mapping: Path) -> dict:
    original = (root / BUNDLE).read_bytes()
    if hashlib.sha256(original).hexdigest() != BASELINE:
        raise ValueError('Baseline changed; inspect before patching.')
    source = original.decode('utf-8')
    if source.count(KEEP) != 1:
        raise ValueError('Protected care-and-tracking action missing or ambiguous.')
    edits = json.loads(mapping.read_text(encoding='utf-8'))
    patched = source
    for edit in edits:
        old, new, count = edit['old'], edit['new'], edit['count']
        if source.count(old) != count or patched.count(old) != count:
            raise ValueError('Unexpected literal count: ' + old)
        if KEEP in old or 'demo-service' in old or 'demo_notice' in old:
            raise ValueError('Protected interface or identifier.')
        patched = patched.replace(old, new)
    assert patched.count(KEEP) == 1
    for key in ['demo-service', 'demo_notice', 'dogspot-state-v1', 'dogspot-sheets-pending-v1']:
        assert source.count(key) == patched.count(key), key
    data = patched.encode('utf-8')
    digest = hashlib.sha256(data).hexdigest()
    filename = 'index-copy-' + digest[:12] + '.js'
    (root / filename).write_bytes(data)
    subprocess.run(['node', '--check', str(root / filename)], check=True)
    index = root / 'index.html'
    html = index.read_text(encoding='utf-8')
    expected = 'src="./' + BUNDLE + '"'
    if html.count(expected) != 1:
        raise ValueError('Unexpected active bundle; do not overwrite newer publication.')
    index.write_text(html.replace(expected, 'src="./' + filename + '"'), encoding='utf-8')
    report = {'baseline_sha256': BASELINE, 'patched_sha256': digest, 'bundle': filename,
              'replacement_rules': len(edits), 'literal_occurrences': sum(x['count'] for x in edits),
              'protected_cta': KEEP[1:-1], 'scope': 'Presentation copy only; original build retained.'}
    (root / 'copy-change-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report

if __name__ == '__main__':
    apply(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
