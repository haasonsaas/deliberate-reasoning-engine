# Release Checklist

## 1. Push to GitHub
```bash
git push -u origin main
```

## 2. Publish to npm
```bash
npm publish --access public
```

## 3. Create GitHub Release
```bash
git tag v1.0.0
git push origin v1.0.0
```

Then go to: https://github.com/haasonsaas/deliberate-reasoning-engine/releases/new

## 4. Test Installation
```bash
npm install -g deliberate-reasoning-engine
```

## 5. Update Claude Desktop Config
```json
{
  "mcpServers": {
    "dre": {
      "command": "npx",
      "args": ["deliberate-reasoning-engine"]
    }
  }
}
```