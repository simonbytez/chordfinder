// File: scripts/consolidate-codebase.js
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function consolidateCodebase(rootDir, outputFile, ignoreDirs = ['dist', '.git', '.history', '.gitattributes', '.vscode', 'node_modules', 'packages', 'k8s', 'documents', 'public', 'admin'], ignoreFiles = ['.gitignore', '.env', '.DS_Store', 'package-lock.json', 'PULL_REQUEST_TEMPLATE.md', 'consolidated_codebase.txt', 'Dockerfile']) {
  const output = await fsPromises.open(outputFile, 'w');

  async function processDirectory(dir) {
    const files = await fsPromises.readdir(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fsPromises.stat(fullPath);

      if (stat.isDirectory()) {
        if (!ignoreDirs.includes(file)) {
          await processDirectory(fullPath);
        }
      } else if (!ignoreFiles.includes(file)) {
        const relativePath = path.relative(rootDir, fullPath);
        await output.write(`--- FILE: ${relativePath} ---\n`);
        try {
          const content = await fsPromises.readFile(fullPath, 'utf8');
          await output.write(content);
        } catch (error) {
          await output.write(`[Error reading file: ${relativePath}]\n`);
        }
        await output.write('\n\n');
      }
    }
  }

  await processDirectory(rootDir);
  await output.close();
  console.log(`Codebase consolidated in ${outputFile}`);
}

function estimateClaudeTokens(text) {
  const rawTokens = text.split(/(\s+|[.,!?;:"'(){}\[\]<>])/);
  
  let tokens = [];
  let currentToken = '';
  
  for (let token of rawTokens) {
      if (token.trim() === '') {
          if (currentToken) {
              tokens.push(currentToken);
              currentToken = '';
          }
          tokens.push(token);
      } else if (token.length === 1) {
          if (currentToken) {
              tokens.push(currentToken);
              currentToken = '';
          }
          tokens.push(token);
      } else {
          currentToken += token;
          if (currentToken.length >= 4) {
              tokens.push(currentToken);
              currentToken = '';
          }
      }
  }
  
  if (currentToken) {
      tokens.push(currentToken);
  }
  
  tokens = tokens.filter(token => token.length > 0);
  
  const estimatedTokens = Math.ceil(tokens.length * 1.2);
  
  return estimatedTokens;
}

async function countTokensAndLines(filePath) {
  try {
      const content = await fsPromises.readFile(filePath, 'utf8');
      const tokenCount = estimateClaudeTokens(content);
      const lineCount = content.split('\n').length;
      console.log(`Estimated Claude token count: ${tokenCount}`);
      console.log(`Number of lines: ${lineCount}`);
  } catch (error) {
      console.error('Error reading file:', error);
  }
}

async function main() {
  const rootDirectory = path.resolve(__dirname, '..');
  const outputFile = path.join(rootDirectory, 'consolidated_codebase.txt');
  
  await consolidateCodebase(rootDirectory, outputFile);
  
  const consolidatedFilePath = path.join(rootDirectory, 'consolidated_codebase.txt');
  await countTokensAndLines(consolidatedFilePath);
}

main();