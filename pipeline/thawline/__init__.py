"""Thawline data pipeline."""

import os

# Forecast backtests run one process per core. Keep each process's linear
# algebra single-threaded so the processes do not oversubscribe the CPU.
for _var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_var, "1")
