"""
Unified Startup Script for PacketPulse DPI System
=================================================
Launches and integrates:
 1. React Dashboard (npm run dev)
 2. FastAPI Backend (uvicorn)
 3. C++ DPI Engine (subprocess)

Run from the root of the project:
    python start.py
"""

import subprocess
import sys
import os
import time
import platform
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PacketPulse-Launcher")

def is_windows():
    return platform.system().lower() == "windows"

def find_cpp_engine():
    """Find the compiled C++ DPI engine binary."""
    candidates = [
        "dpi_engine.exe",
        "dpi_single_thread_cli.exe",
        "build/dpi_engine.exe",
        "build/dpi_single_thread_cli.exe",
        "dpi_engine",
        "build/dpi_single_thread_cli"
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None

def main():
    logger.info("Starting PacketPulse Unified System...")

    # 1. Start FastAPI Backend
    api_dir = os.path.join(os.getcwd(), "api")
    if not os.path.exists(api_dir):
        logger.error(f"API directory not found at {api_dir}. Run script from project root.")
        sys.exit(1)
        
    logger.info("Launching FastAPI Backend...")
    api_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=api_dir,
        stdout=sys.stdout,
        stderr=sys.stderr
    )

    # 2. Start React Dashboard
    dash_dir = os.path.join(os.getcwd(), "dashboard")
    logger.info("Launching React Dashboard...")
    shell_param = is_windows()
    dash_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=dash_dir,
        shell=shell_param,
        stdout=sys.stdout,
        stderr=sys.stderr
    )

    # 3. Run C++ Engine
    engine_bin = find_cpp_engine()
    engine_proc = None

    if engine_bin:
        logger.info(f"Using compiling DPI engine: {engine_bin}")
        pcap_in = "test_dpi.pcap"
        pcap_out = "output.pcap"
        json_out = "output.json"

        if not os.path.exists(pcap_in):
            logger.warning(f"Could not find {pcap_in} for DPI Engine. Generating it...")
            if os.path.exists("generate_test_pcap.py"):
                subprocess.run([sys.executable, "generate_test_pcap.py"], check=True)

        cmd = [engine_bin, pcap_in, pcap_out, "--json", json_out]
        logger.info(f"Spawning C++ Subprocess: {' '.join(cmd)}")
        
        # Run it via Popen so it operates in parallel.
        # It's a PCAP processor, so it will exit when done, but the backend's websocket 
        # auto-generator handles continuous simulated pushing when parsing finishes
        engine_proc = subprocess.Popen(
            cmd,
            stdout=sys.stdout,
            stderr=sys.stderr
        )
    else:
        logger.warning(
            "C++ DPI Engine binary not found! Please compile it following WINDOWS_SETUP.md. "
            "The backend will seamlessly fallback to simulated live data so the UI remains active."
        )

    # Wait for interruption
    try:
        logger.info("==================================================")
        logger.info(" SYSTEM ONLINE ")
        logger.info(" Dashboard URL: http://localhost:5173")
        logger.info(" Backend API:   http://localhost:8000")
        logger.info("==================================================")
        
        while True:
            time.sleep(1)
            # Check if any crucial process crashed
            if api_proc.poll() is not None:
                logger.error("FastAPI backend exited unexpectedly.")
                break
            if dash_proc.poll() is not None:
                logger.error("React dashboard exited unexpectedly.")
                break

    except KeyboardInterrupt:
        logger.info("Shutting down unified system...")
    
    finally:
        # Graceful Terminate
        logger.info("Terminating Dashboard...")
        dash_proc.terminate()
        logger.info("Terminating API...")
        api_proc.terminate()
        if engine_proc and engine_proc.poll() is None:
            logger.info("Terminating DPI Engine...")
            engine_proc.terminate()
            
        logger.info("System shutdown complete.")

if __name__ == "__main__":
    main()
