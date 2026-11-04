"""Round trip through the mailbox: post an encrypted 'ping' as the app would, then collect it."""
import json, os, sys, urllib.request
sys.path.insert(0, ".")
import mailbox, readiness
pw = os.environ["READINESS_PASSPHRASE"]
env = readiness.encrypt({"date": "ping"}, pw)
req = urllib.request.Request(f"{mailbox.BASE}/{mailbox.topic(pw)}", data=json.dumps({"kind": "ping", "env": env}).encode(),
                             method="POST", headers={"User-Agent": "readiness-score/1.0"})
print("post:", urllib.request.urlopen(req, timeout=30).status)
cache = {}
print("collected:", mailbox.collect(cache, pw, readiness.decrypt))
