import json

with open("request.json", encoding="utf-8") as f:
    raw = f.read()

try:
    json.loads(raw)
    print("Valid JSON")
except json.JSONDecodeError as e:
    print("Error:", e.msg)
    print("Line:", e.lineno)
    print("Column:", e.colno)
    print("Position:", e.pos)
    print("Context:", repr(raw[max(0, e.pos-40):e.pos+40]))