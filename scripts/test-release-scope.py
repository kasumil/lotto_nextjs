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
    old_id = '0'*40 if old == '000000' else 'a'*40
    new_id = '0'*40 if new == '000000' else 'b'*40
    return f':{old} {new} {old_id} {new_id} {status}\0{path}\0'.encode()


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

    def test_malformed_object_ids(self):
        valid = raw('README.md')
        for oid in [b'abc123', b'g'*40, b'A'*40, b'a'*39, b'a'*41, b'0'*40]:
            for original in [b'a'*40, b'b'*40]:
                with self.subTest(oid=oid, original=original):
                    self.assertFalse(scope.prose_only(valid.replace(original, oid)))
        self.assertFalse(scope.prose_only(valid.replace(b'b'*40, b'a'*40)))

    def test_status_mode_and_zero_id_consistency(self):
        expected = {'A': ('000000', '100644'), 'M': ('100644', '100644'),
                    'D': ('100644', '000000')}
        for status in expected:
            for old in ['000000', '100644']:
                for new in ['000000', '100644']:
                    with self.subTest(status=status, old=old, new=new):
                        self.assertEqual(scope.prose_only(raw('README.md', old, new, status)),
                                         (old, new) == expected[status])
        for old, new, status in [('000000', '100644', 'A'), ('100644', '000000', 'D')]:
            self.assertFalse(scope.prose_only(raw('README.md', old, new, status).replace(b'0'*40, b'c'*40)))

    def test_event_and_missing_revision(self):
        for event, base in [('workflow_dispatch','a'*40),('push','0'*40),('push','bad'),('pull_request',None)]:
            self.assertTrue(scope.required(event, base, 'b'*40))

    def test_git_failure(self):
        with patch.object(scope.subprocess, 'run', side_effect=subprocess.CalledProcessError(1,'git')):
            self.assertTrue(scope.required('push','a'*40,'b'*40))

    def test_missing_git_and_invalid_head(self):
        with patch.object(scope.subprocess, 'run', side_effect=FileNotFoundError('git')):
            self.assertTrue(scope.required('push', 'a'*40, 'b'*40))
        for head in [None, '', '0'*40, 'bad', 'B'*40]:
            with self.subTest(head=head), patch.object(scope.subprocess, 'run') as run:
                self.assertTrue(scope.required('pull_request', 'a'*40, head))
                run.assert_not_called()

    def test_previous_nonregular_mode_and_empty_diff(self):
        for old in ['120000', '160000', '100755']:
            self.assertFalse(scope.prose_only(raw('README.md', old=old)))
        with patch.object(scope.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'')):
            self.assertTrue(scope.required('push', 'a'*40, 'b'*40))

    def test_diff_classification(self):
        for event in ['push','pull_request']:
            with patch.object(scope.subprocess,'run',return_value=subprocess.CompletedProcess([],0,raw('README.md'))):
                self.assertFalse(scope.required(event,'a'*40,'b'*40))

class TrustedBaseTests(unittest.TestCase):
    def test_workflow_bootstrap_without_trusted_classifier(self):
        # Execute the workflow's actual decision shell, without Actions or a network.
        workflow = Path(__file__).resolve().parents[1] / '.github/workflows/build-publish-ghcr.yml'
        block = workflow.read_text().split('        run: |\n', 1)[1].split('\n\n  verify:', 1)[0]
        script = '\n'.join(line[10:] for line in block.splitlines())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                            'commit', '--allow-empty', '-qm', 'base without classifier'], cwd=root, check=True)
            base = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip()
            for event, revision in [('push', base), ('workflow_dispatch', ''), ('push', '0'*40)]:
                output = root / 'output'
                output.write_text('')
                env = dict(os.environ, EVENT=event, BASE_SHA=revision, HEAD_SHA=base,
                           GITHUB_OUTPUT=str(output), RUNNER_TEMP=str(root))
                subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], cwd=root,
                               env=env, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                self.assertEqual(output.read_text().strip(), 'required=true')

    def test_workflow_trusted_classifier_error_fails_closed(self):
        workflow = Path(__file__).resolve().parents[1] / '.github/workflows/build-publish-ghcr.yml'
        block = workflow.read_text().split('        run: |\n', 1)[1].split('\n\n  verify:', 1)[0]
        script = '\n'.join(line[10:] for line in block.splitlines())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            (root / 'scripts').mkdir()
            (root / 'scripts/release-scope.py').write_text(
                "import os\nwith open(os.environ['GITHUB_OUTPUT'], 'a') as f: f.write('required=false\\n')\nraise RuntimeError('classifier failed')\n")
            subprocess.run(['git', '-C', str(root), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture',
                            '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base'], check=True)
            base = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
            output = root / 'output'
            output.write_text('')
            env = dict(os.environ, EVENT='push', BASE_SHA=base, HEAD_SHA=base,
                       GITHUB_OUTPUT=str(output), RUNNER_TEMP=str(root))
            subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], cwd=root,
                           env=env, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(output.read_text().strip(), 'required=true')

    def test_workflow_trusted_classifier_output_contract(self):
        workflow = Path(__file__).resolve().parents[1] / '.github/workflows/build-publish-ghcr.yml'
        block = workflow.read_text().split('        run: |\n', 1)[1].split('\n\n  verify:', 1)[0]
        script = '\n'.join(line[10:] for line in block.splitlines())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            (root / 'scripts').mkdir()
            classifier = root / 'scripts/release-scope.py'
            for source, expected in [
                (Path(__file__).with_name('release-scope.py').read_text(), 'required=false'),
                ("import os\nopen(os.environ['GITHUB_OUTPUT'], 'a').write('required=false\\nrequired=true\\n')\n", 'required=true'),
            ]:
                classifier.write_text(source)
                (root / 'README.md').write_text('prose')
                subprocess.run(['git', '-C', str(root), 'add', '.'], check=True)
                subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture',
                                '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'trusted'], check=True)
                base = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
                (root / 'README.md').write_text('updated prose')
                subprocess.run(['git', '-C', str(root), 'add', 'README.md'], check=True)
                subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture',
                                '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'docs only'], check=True)
                head = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
                output = root / 'output'
                output.write_text('')
                env = dict(os.environ, EVENT='push', BASE_SHA=base, HEAD_SHA=head,
                           GITHUB_OUTPUT=str(output), RUNNER_TEMP=str(root))
                subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], cwd=root,
                               env=env, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                self.assertEqual(output.read_text().strip(), expected)

    def test_real_git_add_modify_delete_and_rename(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root).decode().strip()
            git('init', '-q')
            git('config', 'user.name', 'Fixture')
            git('config', 'user.email', 'fixture@example.invalid')
            git('config', 'core.abbrev', '5')
            git('commit', '--allow-empty', '-qm', 'empty')
            previous = git('rev-parse', 'HEAD')
            original_cwd = os.getcwd()
            try:
                os.chdir(root)
                self.assertTrue(scope.required('push', previous, previous))
                for operation in ['add', 'modify', 'delete', 'restore', 'rename']:
                    if operation in ['add', 'restore']:
                        (root / 'README.md').write_text('before')
                    elif operation == 'modify':
                        (root / 'README.md').write_text('after')
                    elif operation == 'delete':
                        (root / 'README.md').unlink()
                    else:
                        (root / 'README.md').rename(root / 'app.py')
                    git('add', '-A')
                    git('commit', '-qm', operation)
                    head = git('rev-parse', 'HEAD')
                    with self.subTest(operation=operation):
                        self.assertEqual(scope.required('push', previous, head), operation == 'rename')
                    previous = head
            finally:
                os.chdir(original_cwd)

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
