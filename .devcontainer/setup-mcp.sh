#!/bin/bash

echo "🚀 Setting up Supermemory MCP for ${PROJECT_NAME}..."

# Create MCP helper scripts
cat > /usr/local/bin/mcp << 'EOF'
#!/usr/bin/env node
const { Supermemory } = require('supermemory');

const sm = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

const action = process.argv[2];
const content = process.argv.slice(3).join(' ');

(async () => {
  if (action === 'search') {
    const results = await sm.search.execute({ q: content });
    results.results.forEach((r, i) => {
      console.log(`\n[${i+1}] ${r.chunks[0].content}`);
    });
  } else if (action === 'store') {
    await sm.memories.add({
      content,
      containerTags: ['copilot', process.env.PROJECT_NAME]
    });
    console.log('✅ Stored');
  } else if (action === 'context') {
    const results = await sm.search.execute({ 
      q: process.env.PROJECT_NAME,
      containerTags: [process.env.PROJECT_NAME]
    });
    results.results.forEach(r => console.log(r.chunks[0].content));
  } else {
    console.log('Usage: mcp [search|store|context] <text>');
  }
})();
EOF

chmod +x /usr/local/bin/mcp

# Auto-capture project summary on first setup
cat > /tmp/capture-project.js << 'SCRIPT'
const { Supermemory } = require('supermemory');
const fs = require('fs');
const { execSync } = require('child_process');

const sm = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY
});

(async () => {
  const projectName = process.env.PROJECT_NAME;
  
  // Capture package.json if exists
  let techStack = 'Unknown';
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    techStack = Object.keys(pkg.dependencies || {}).join(', ');
  }
  
  // Capture README summary
  let readmeSummary = '';
  if (fs.existsSync('README.md')) {
    readmeSummary = fs.readFileSync('README.md', 'utf8').slice(0, 500);
  }
  
  // Store initial context
  await sm.memories.add({
    content: `
Project: ${projectName}
Tech Stack: ${techStack}
README: ${readmeSummary}
Workspace opened: ${new Date().toISOString()}
    `,
    containerTags: [projectName, 'project-info', 'auto']
  });
  
  console.log('✅ Project context captured');
})();
SCRIPT

node /tmp/capture-project.js

echo "✅ MCP setup complete!"
