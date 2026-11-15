#!/bin/bash
# Double-click (macOS) or run ./start.command to play Living World.
cd "$(dirname "$0")"
PORT=8417
( sleep 1; open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null ) &
python3 serve.py $PORT
