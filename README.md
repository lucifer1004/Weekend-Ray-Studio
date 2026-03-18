# NVIDIA Kaizen UI Design Library

This is a Design Library project for NVIDIA's Kaizen UI (KUI) design system.

## Setup

### NPM Registry Configuration

This project uses NVIDIA's private npm registry. The `.npmrc` file is configured:

```
@kui:registry=https://edge.urm.nvidia.com/artifactory/api/npm/sw-ngc-cloud-npm-local/
@nv-brand-assets:registry=https://edge.urm.nvidia.com/artifactory/api/npm/sw-ngc-cloud-npm-local/
//edge.urm.nvidia.com/artifactory/api/npm/sw-ngc-cloud-npm-local/:_authToken=${NVIDIA_EDGE_NPM_TOKEN}
//edge.urm.nvidia.com/artifactory/api/npm/sw-ngc-cloud-npm-local/:email=colep@nvidia.com
//edge.urm.nvidia.com/artifactory/api/npm/sw-ngc-cloud-npm-local/:always-auth=true
```

The `NVIDIA_EDGE_NPM_TOKEN` must be set as a build secret in Workspace Settings → Build Secrets.

### Install Dependencies

```bash
npm install @kui/foundations-react @kui/foundations-tailwind-plugin
```

## Documentation Structure

### `.lovable/system.md`

The main knowledge file for AI agents. Contains:
- Installation & setup instructions
- Best practices and guidelines
- Theme variables and color palette
- Component reference with URLs for on-demand docs

### Component Documentation

Individual component docs are hosted at:
```
https://webassets.nvidia.com/kaizen-ui-foundations/docs/components/{ComponentName}.md
```

**Traversal Instructions for LLMs:**
1. Before implementing any KUI component, fetch its documentation from the URL above
2. Each doc contains: description, examples (copy-paste ready), and props table
3. Use the examples as templates - they are tested and correct

### Additional Resources

- Full foundations doc: `https://webassets.nvidia.com/kaizen-ui-foundations/docs/llms.md`
- Installation guide: `https://webassets.nvidia.com/kaizen-ui-foundations/docs/installation.md`
- Icon list: `https://webassets.nvidia.com/kaizen-ui-foundations/docs/icon-list.md`

## Technologies

- Vite + React + TypeScript
- Kaizen UI (`@kui/foundations-react`)
- Tailwind CSS with KUI plugin (`@kui/foundations-tailwind-plugin`)
