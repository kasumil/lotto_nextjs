"""Fail closed: only two reviewed prose paths may avoid a release build."""
import os
import re
import subprocess

PROSE = {b'README.md', b'docs/deployment.md'}


def prose_only(raw):
    fields = raw.split(b'\0')
    if not fields or fields[-1] != b'':
        return False
    fields.pop()
    if not fields or len(fields) % 2:
        return False
    for header, path in zip(fields[::2], fields[1::2]):
        match = re.fullmatch(
            rb':(000000|100644) (000000|100644) ([0-9a-f]{40}) ([0-9a-f]{40}) ([AMD])',
            header)
        if match is None or path not in PROSE:
            return False
        old, new, old_id, new_id, status = match.groups()
        modes = {b'A': (b'000000', b'100644'),
                 b'M': (b'100644', b'100644'),
                 b'D': (b'100644', b'000000')}
        if (old, new) != modes[status]:
            return False
        zero = b'0' * 40
        if (old_id == zero) != (old == b'000000') or (new_id == zero) != (new == b'000000'):
            return False
        if status == b'M' and old_id == new_id:
            return False
    return True


def required(event, base, head):
    if event not in ('push', 'pull_request'):
        return True
    if any(not re.fullmatch('[0-9a-f]{40}', s or '') or set(s) == {'0'} for s in (base, head)):
        return True
    try:
        result = subprocess.run(['git', 'diff', '--raw', '--no-abbrev', '--no-renames', '-z', base, head],
                                check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return not prose_only(result.stdout)
    except (OSError, subprocess.CalledProcessError):
        return True


if __name__ == '__main__':
    value = required(os.getenv('EVENT'), os.getenv('BASE_SHA'), os.getenv('HEAD_SHA'))
    output = 'required=' + str(value).lower() + '\n'
    with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
        stream.write(output)
    print(output.strip())
