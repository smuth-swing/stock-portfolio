import urllib.request
import json
import re

url = "https://raw.githubusercontent.com/search?q=CSPAQ13700InBlock1&type=code"
# Actually, I can just fetch it from github api or similar, but github requires auth.
# I'll just write a script to download the LS API mac/TR lists if available, or just check the CSPAQ13700 format.