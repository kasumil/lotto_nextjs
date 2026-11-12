import importlib.util
import unittest
from unittest.mock import patch
import subprocess
import tempfile
import os
from pathlib import Path

spec = importlib.util.spec_from_file_location('scope', __file__.replace('test-release-scope.py', 'release-scope.py'))
scope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scope)


def raw(path, old='100644', new='100644', status='M'):
    return f':{old} {new} abc123 def456 {status}\0{path}\0'.encode()


class Tests(unittest.TestCase):
    def test_prose(self):
        for path in scope.PROSE:
            for old, new, status in [('100644','100644','M'),('000000','100644','A'),('100644','000000','D')]:
                self.assertTrue(scope.prose_only(raw(path.decode(), old, new, status)))
        self.assertTrue(scope.prose_only(raw('README.md') + raw('docs/deployment.md')))

    def test_code_security_and_unknown(self):
        for path in ['src/app/page.tsx','package-lock.json','Dockerfile','.github/workflows/build-publish-ghcr.yml',
                     'scripts/release-scope.py','docs/security.md','docs/other.md','README.md/evil','readme.md','README.md\nevil']:
            self.assertFalse(scope.prose_only(raw(path)))
            self.assertFalse(scope.prose_only(raw('README.md') + raw(path)))

    def test_nonregular_and_malformed(self):
        for mode in ['120000','160000','100755']:
            self.assertFalse(scope.prose_only(raw('README.md', new=mode)))
        for data in [b'',b'x',b'\0',raw('README.md')[:-1],raw('README.md',status='R100')]:
            self.assertFalse(scope.prose_only(data))

    def test_event_and_missing_revision(self):
        for event, base in [('workflow_dispatch','a'*40),('push','0'*40),('push','bad'),('pull_request',None)]:
            self.assertTrue(scope.required(event, base, 'b'*40))

    def test_git_failure(self):
        with patch.object(scope.subprocess, 'run', side_effect=subprocess.CalledProcessError(1,'git')):
            self.assertTrue(scope.required('push','a'*40,'b'*40))

    def test_diff_classification(self):
        for event in ['push','pull_request']:
            with patch.object(scope.subprocess,'run',return_value=subprocess.CompletedProcess([],0,raw('README.md'))):
                self.assertFalse(scope.required(event,'a'*40,'b'*40))

class TrustedBaseTests(unittest.TestCase):
    def test_candidate_cannot_replace_classifier(self):
        trusted = Path(__file__).with_name('release-scope.py').read_bytes()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root).decode().strip()
            git('init', '-q')
            git('config', 'user.name', 'Fixture')
            git('config', 'user.email', 'fixture@example.invalid')
            (root / 'scripts').mkdir()
            (root / 'scripts/release-scope.py').write_bytes(trusted)
            (root / 'README.md').write_text('before')
            git('add', '.')
            git('commit', '-qm', 'trusted base')
            base = git('rev-parse', 'HEAD')
            (root / 'README.md').write_text('after')
            git('add', '.')
            git('commit', '-qm', 'prose')
            prose = git('rev-parse', 'HEAD')
            (root / 'scripts/release-scope.py').write_text("raise RuntimeError('untrusted HEAD executed')")
            (root / 'scripts/test-release-scope.py').write_text('# candidate tests cannot authorize release')
            git('add', '.')
            git('commit', '-qm', 'tampered candidate')
            malicious = git('rev-parse', 'HEAD')
            trusted_file = root / 'trusted.py'
            trusted_file.write_bytes(subprocess.check_output(['git','show',base+':scripts/release-scope.py'],cwd=root))
            for head, expected in [(prose,'required=false'),(malicious,'required=true')]:
                output = root / 'output'
                output.write_text('')
                env = dict(os.environ, EVENT='pull_request', BASE_SHA=base, HEAD_SHA=head, GITHUB_OUTPUT=str(output))
                subprocess.run(['python3', str(trusted_file)], cwd=root, env=env, check=True, stdout=subprocess.PIPE)
                self.assertEqual(output.read_text().strip(), expected)

if __name__ == '__main__':
    unittest.main()
