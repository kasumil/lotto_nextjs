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
        parts = header.split()
        if len(parts) != 5 or not parts[0].startswith(b':'):
            return False
        old, new = parts[0][1:], parts[1]
        if old not in (b'000000', b'100644') or new not in (b'000000', b'100644'):
            return False
        if parts[4] not in (b'A', b'M', b'D') or path not in PROSE:
            return False
    return True


def required(event, base, head):
    if event not in ('push', 'pull_request'):
        return True
    if any(not re.fullmatch('[0-9a-f]{40}', s or '') or set(s) == {'0'} for s in (base, head)):
        return True
    try:
        result = subprocess.run(['git', 'diff', '--raw', '--no-renames', '-z', base, head],
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
