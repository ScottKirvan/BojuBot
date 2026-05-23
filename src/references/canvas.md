## Obsidian Canvas — Reference

Canvas files (.canvas) are JSON boards. Shared canvases are converted to readable descriptions. Create or edit by writing valid JSON to the .canvas file.

Schema:
{"nodes":[
  {"id":"1","type":"text","text":"Content","x":0,"y":0,"width":250,"height":60},
  {"id":"2","type":"file","file":"Notes/MyNote.md","x":300,"y":0,"width":400,"height":400},
  {"id":"3","type":"group","label":"Group name","x":-50,"y":-50,"width":800,"height":500},
  {"id":"4","type":"link","url":"https://example.com","x":0,"y":200,"width":400,"height":300}
],"edges":[
  {"id":"e1","fromNode":"1","toNode":"2","label":"optional"}
]}

node types: text(text) · file(file path) · group(label) · link(url)
Layout: ~50px gaps between nodes. Groups must fully contain their members. IDs must be unique strings. Origin top-left; x/y control position.
