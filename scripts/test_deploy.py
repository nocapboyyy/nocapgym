"""Exercise deployment control flow with real local Git and mocked server tools."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("deploy.sh").resolve()


class DeployTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="nocapgym-deploy-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.remote = self.root / "remote.git"
        self.seed = self.root / "seed"
        self.app = self.root / "app"
        self.log = self.root / "commands.log"
        self.env = {
            **os.environ,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Deploy test",
            "GIT_AUTHOR_EMAIL": "deploy@example.test",
            "GIT_COMMITTER_NAME": "Deploy test",
            "GIT_COMMITTER_EMAIL": "deploy@example.test",
            "APP_DIR": str(self.app),
            "NVM_DIR": str(self.root / "no-nvm"),
            "COMMAND_LOG": str(self.log),
        }
        self.git("init", "--bare", str(self.remote))
        self.git("init", "-b", "main", str(self.seed))
        (self.seed / "version.txt").write_text("initial\n")
        self.git("add", ".", cwd=self.seed)
        self.git("commit", "-m", "initial", cwd=self.seed)
        self.git("remote", "add", "origin", str(self.remote), cwd=self.seed)
        self.git("push", "origin", "main", cwd=self.seed)
        self.git("clone", "--branch", "main", str(self.remote), str(self.app))
        self.initial = self.git("rev-parse", "HEAD", cwd=self.app).strip()
        self.git("switch", "-c", "codex/test-feature", cwd=self.seed)
        self.feature = self.commit("feature")
        self.git("push", "origin", "codex/test-feature", cwd=self.seed)
        self.git("switch", "main", cwd=self.seed)
        self.latest = self.commit("latest main")
        self.git("push", "origin", "main", cwd=self.seed)

        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        mock = bin_dir / "mock"
        mock.write_text("""#!/usr/bin/env bash
name=${0##*/}
printf '%s' "$name" >> "$COMMAND_LOG"
printf ' %s' "$@" >> "$COMMAND_LOG"
printf '\\n' >> "$COMMAND_LOG"
if [[ "$name" == node ]]; then exit "${NODE_FAILURE:-0}"; fi
if [[ "$name $*" == "${FAIL_COMMAND:-}" ]]; then exit 1; fi
if [[ "$name" == sudo && "${1:-}" != -v ]]; then exec "$@"; fi
exit 0
""")
        mock.chmod(0o755)
        for command in ("flock", "sudo", "systemctl", "sqlite3", "curl", "node", "npm"):
            shutil.copyfile(mock, bin_dir / command)
            (bin_dir / command).chmod(0o755)
        self.env["PATH"] = str(bin_dir) + os.pathsep + os.environ["PATH"]

    def git(self, *args, cwd=None):
        return subprocess.run(
            ["git", *args], cwd=cwd, env=self.env, check=True,
            capture_output=True, text=True,
        ).stdout

    def commit(self, content):
        (self.seed / "version.txt").write_text(content + "\n")
        self.git("add", ".", cwd=self.seed)
        self.git("commit", "-m", content, cwd=self.seed)
        return self.git("rev-parse", "HEAD", cwd=self.seed).strip()

    def deploy(self, *args, **env):
        result = subprocess.run(
            ["bash", str(SCRIPT), *args], env={**self.env, **env},
            capture_output=True, text=True, timeout=15,
        )
        commands = self.log.read_text().splitlines() if self.log.exists() else []
        return result, commands

    def test_main_success_and_order(self):
        result, commands = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.app).strip(), self.latest)
        stop = commands.index("systemctl stop nocapgym-api")
        install = commands.index("npm ci --include=dev")
        migrate = commands.index("npm run prisma:migrate:deploy")
        start = commands.index("systemctl start nocapgym-api")
        health = next(i for i, command in enumerate(commands) if command.startswith("curl "))
        self.assertLess(stop, install)
        self.assertLess(install, migrate)
        self.assertLess(migrate, start)
        self.assertLess(start, health)
        state = (self.app / ".git/nocapgym-deploy-state").read_text()
        self.assertIn("previous_commit=" + self.initial, state)
        self.assertIn("target_commit=" + self.latest, state)

    def test_feature_branch_then_main(self):
        result, _ = self.deploy("codex/test-feature")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.app).strip(), self.feature)
        result, _ = self.deploy("main", HEALTH_URL="https://example.test/api/health")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.app).strip(), self.latest)
        self.assertIn("https://example.test/api/health", self.log.read_text())

    def test_checkout_can_remove_running_script(self):
        self.git("switch", "-c", "codex/with-script", cwd=self.seed)
        (self.seed / "scripts").mkdir()
        shutil.copyfile(SCRIPT, self.seed / "scripts/deploy.sh")
        self.git("add", ".", cwd=self.seed)
        self.git("commit", "-m", "add deploy script", cwd=self.seed)
        self.git("push", "origin", "codex/with-script", cwd=self.seed)
        self.git("fetch", "origin", "codex/with-script", cwd=self.app)
        self.git("switch", "--no-track", "--create", "codex/with-script", "FETCH_HEAD", cwd=self.app)
        result = subprocess.run(
            ["bash", str(self.app / "scripts/deploy.sh"), "main"],
            env=self.env, capture_output=True, text=True, timeout=15,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.app / "scripts/deploy.sh").exists())
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.app).strip(), self.latest)

    def test_preflight_failures_leave_service_untouched(self):
        for branch, env in (
            ("missing", {}), ("--bad", {}), ("main", {"NODE_FAILURE": "1"}),
            ("main", {"FAIL_COMMAND": "flock -n 9"}),
        ):
            with self.subTest(branch=branch, env=env):
                self.log.write_text("")
                result, commands = self.deploy(branch, **env)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any(command.startswith("systemctl ") for command in commands))
                self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.app).strip(), self.initial)

    def test_dirty_checkout_rejected(self):
        (self.app / "untracked.txt").write_text("keep me")
        result, commands = self.deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("systemctl stop nocapgym-api", commands)
        self.assertEqual((self.app / "untracked.txt").read_text(), "keep me")

    def test_local_commit_not_overwritten(self):
        (self.app / "local.txt").write_text("local work")
        self.git("add", ".", cwd=self.app)
        self.git("commit", "-m", "local", cwd=self.app)
        before = self.git("rev-parse", "HEAD", cwd=self.app)
        result, commands = self.deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git("rev-parse", "HEAD", cwd=self.app), before)
        self.assertNotIn("systemctl stop nocapgym-api", commands)

    def test_failed_install_build_or_migration_keeps_api_stopped(self):
        for command in ("npm ci --include=dev", "npm run build", "npm run prisma:migrate:deploy"):
            with self.subTest(command=command):
                self.log.write_text("")
                result, commands = self.deploy(FAIL_COMMAND=command)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(commands[-1], "systemctl stop nocapgym-api")
                self.assertNotIn("systemctl start nocapgym-api", commands)

    def test_failed_start_or_health_stops_api(self):
        for command in ("systemctl start nocapgym-api", "systemctl is-active --quiet nocapgym-api"):
            with self.subTest(command=command):
                self.log.write_text("")
                result, commands = self.deploy(FAIL_COMMAND=command)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(commands[-1], "systemctl stop nocapgym-api")
        # Obtain the exact curl command from a successful run, then fail it.
        _, commands = self.deploy()
        curl = next(command for command in commands if command.startswith("curl "))
        self.log.write_text("")
        result, commands = self.deploy(FAIL_COMMAND=curl)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(commands[-1], "systemctl stop nocapgym-api")


if __name__ == "__main__":
    unittest.main()
