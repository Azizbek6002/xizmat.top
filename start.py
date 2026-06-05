import argparse
import os
import signal
import socket
import subprocess
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
BACKEND_PORT = 5000
FRONTEND_PORT = 3000


def npm_cmd():
    return "npm.cmd" if os.name == "nt" else "npm"


def is_port_open(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def pids_for_port(port):
    if os.name != "nt":
        return []
    try:
        output = subprocess.check_output(["netstat", "-ano"], text=True, encoding="utf-8", errors="ignore")
    except Exception:
        return []

    pids = set()
    marker = f":{port}"
    for line in output.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0].upper() == "TCP" and marker in parts[1] and parts[3].upper() == "LISTENING":
            try:
                pids.add(int(parts[-1]))
            except ValueError:
                pass
    return sorted(pids)


def stop_port_processes(port):
    for pid in pids_for_port(port):
        print(f"[stop] port {port} pid={pid}")
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def wait_for_port(name, port, timeout=45):
    start = time.time()
    while time.time() - start < timeout:
        if is_port_open(port):
            print(f"[ok] {name} is ready on port {port}")
            return True
        time.sleep(0.5)
    print(f"[warn] {name} did not answer on port {port} after {timeout}s")
    return False


def run_step(command, cwd):
    print(f"[run] {' '.join(command)}")
    subprocess.run(command, cwd=cwd, check=True)


def ensure_dependencies(skip_install=False):
    checks = [
        ("backend", BACKEND_DIR),
        ("frontend", FRONTEND_DIR),
    ]
    for name, folder in checks:
        if (folder / "node_modules").exists():
            print(f"[ok] {name} dependencies found")
            continue
        if skip_install:
            print(f"[warn] {name}/node_modules is missing; run npm install in {folder}")
            continue
        print(f"[setup] Installing {name} dependencies...")
        run_step([npm_cmd(), "install"], folder)


def open_log(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    return open(path, "a", encoding="utf-8")


def start_process(name, command, cwd, log_path):
    log = open_log(log_path)
    log.write(f"\n\n--- {name} started at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
    log.flush()

    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdout=log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        creationflags=creationflags,
    )
    print(f"[start] {name} pid={process.pid}")
    return process, log


def stop_process(name, process):
    if process.poll() is not None:
        return
    print(f"[stop] {name}")
    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            process.terminate()
        process.wait(timeout=8)
    except Exception:
        process.kill()


def process_is_down(process, port):
    if process is None:
        return False
    if process.poll() is None:
        return False
    return not is_port_open(port)


def main():
    parser = argparse.ArgumentParser(description="Start HizmatTop backend and frontend.")
    parser.add_argument("--skip-install", action="store_true", help="Do not run npm install when node_modules is missing.")
    parser.add_argument("--seed", action="store_true", help="Reset and seed the SQLite database before starting.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open the frontend URL in a browser.")
    args = parser.parse_args()

    if not BACKEND_DIR.exists() or not FRONTEND_DIR.exists():
        print("[error] Run this script from the HizmatTop project root.")
        return 1

    ensure_dependencies(skip_install=args.skip_install)

    if args.seed:
        run_step([npm_cmd(), "run", "seed"], BACKEND_DIR)

    if is_port_open(BACKEND_PORT):
        print(f"[info] Backend port {BACKEND_PORT} is already in use; not starting another backend.")
        backend = None
        backend_log = None
    else:
        backend, backend_log = start_process(
            "backend",
            [npm_cmd(), "run", "dev"],
            BACKEND_DIR,
            BACKEND_DIR / "backend-dev.log",
        )

    if is_port_open(FRONTEND_PORT):
        print(f"[info] Frontend port {FRONTEND_PORT} is already in use; not starting another frontend.")
        frontend = None
        frontend_log = None
    else:
        frontend, frontend_log = start_process(
            "frontend",
            [npm_cmd(), "start"],
            FRONTEND_DIR,
            FRONTEND_DIR / "frontend-dev.log",
        )

    wait_for_port("Backend API", BACKEND_PORT)
    wait_for_port("Frontend", FRONTEND_PORT, timeout=90)

    print("\nHizmatTop is running:")
    print(f"  Frontend: http://127.0.0.1:{FRONTEND_PORT}")
    print(f"  Backend:  http://127.0.0.1:{BACKEND_PORT}/api/health")
    print("\nPress Ctrl+C to stop processes started by this script.")

    if not args.no_browser:
        try:
            import webbrowser
            webbrowser.open(f"http://127.0.0.1:{FRONTEND_PORT}")
        except Exception:
            pass

    processes = [
        ("frontend", frontend, FRONTEND_PORT),
        ("backend", backend, BACKEND_PORT),
    ]
    logs = [frontend_log, backend_log]

    try:
        while True:
            for name, process, port in processes:
                if process_is_down(process, port):
                    print(f"[error] {name} stopped with code {process.returncode}")
                    return process.returncode or 1
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        for name, process, port in processes:
            if process is not None:
                stop_process(name, process)
            stop_port_processes(port)
        for log in logs:
            if log is not None:
                log.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
