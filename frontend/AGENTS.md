# HeroUI v3 local agent reference status

Target package: `@heroui/react@3.2.4` / `@heroui/styles@3.2.4`.

The required `heroui-cli agents-md --react` command was attempted during Task 1, but this execution sandbox had no registry/network access and the uploaded repository did not include `node_modules`. Version-sensitive APIs used in Task 1 were verified against the official HeroUI v3.2.4/current React documentation (Button, TextField, Drawer, AlertDialog, Dropdown, Toast). When dependencies are available locally, regenerate this file and `.heroui-docs/react/` with:

```bash
npx heroui-cli@3.0.4 agents-md --react --output AGENTS.md
```

Do not treat this fallback note as a replacement for generated local docs in a normal development environment.
