#!/usr/bin/env node

/**
 * CLI Tool for LLM Brand Visibility Tracking
 *
 * Usage:
 *   node cli.js create-run --config config.json --run 0
 *   node cli.js list-runs
 *   node cli.js get-summary <run-id>
 *   node cli.js export-report <run-id> --output report.json
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function createRun(configPath, runIndex = 0) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    if (!config.runs || !config.runs[runIndex]) {
      console.error(`❌ Run ${runIndex} not found in config`);
      process.exit(1);
    }

    const runConfig = config.runs[runIndex];
    console.log(`🚀 Creating run: ${runConfig.name}`);
    console.log(`   Prompts: ${runConfig.prompts.length}`);
    console.log(`   Brands: ${runConfig.brands.length}`);
    console.log(`   Models: ${runConfig.models.length}`);
    console.log('');

    const response = await axios.post(`${BASE_URL}/runs`, {
      prompts: runConfig.prompts,
      brands: runConfig.brands,
      models: runConfig.models,
      notes: runConfig.name,
      config: runConfig.config,
    });

    console.log('✅ Run created successfully!');
    console.log(`   Run ID: ${response.data.run._id}`);
    console.log(`   Status: ${response.data.run.status}`);
    console.log(`   Total tasks: ${response.data.run.totalPrompts}`);
    console.log('');
    console.log('💡 Track progress with:');
    console.log(`   node cli.js watch ${response.data.run._id}`);
    console.log('');

    return response.data.run;
  } catch (error) {
    console.error(
      '❌ Failed to create run:',
      error.response?.data || error.message,
    );
    process.exit(1);
  }
}

async function listRuns(page = 1, limit = 10) {
  try {
    const response = await axios.get(
      `${BASE_URL}/runs?page=${page}&limit=${limit}`,
    );

    console.log('📋 Recent Runs');
    console.log('='.repeat(80));
    console.log('');

    for (const run of response.data.data) {
      const progress =
        run.totalPrompts > 0
          ? `${run.completedPrompts}/${run.totalPrompts} (${Math.round((run.completedPrompts / run.totalPrompts) * 100)}%)`
          : 'N/A';

      const statusEmoji =
        {
          pending: '⏳',
          running: '▶️',
          completed: '✅',
          failed: '❌',
          partial: '⚠️',
        }[run.status] || '❓';

      console.log(`${statusEmoji} ${run._id}`);
      console.log(`   Status: ${run.status.toUpperCase()}`);
      console.log(`   Progress: ${progress}`);
      console.log(`   Notes: ${run.notes || 'N/A'}`);
      console.log(`   Created: ${new Date(run.createdAt).toLocaleString()}`);
      if (run.completedAt) {
        console.log(
          `   Completed: ${new Date(run.completedAt).toLocaleString()}`,
        );
      }
      console.log('');
    }

    console.log(
      `Page ${response.data.page} of ${Math.ceil(response.data.total / limit)}`,
    );
    console.log(`Total runs: ${response.data.total}`);
    console.log('');
  } catch (error) {
    console.error(
      '❌ Failed to list runs:',
      error.response?.data || error.message,
    );
    process.exit(1);
  }
}

async function watchRun(runId) {
  console.log(`👀 Watching run: ${runId}`);
  console.log('Press Ctrl+C to stop watching');
  console.log('');

  let lastStatus = null;
  let lastCompleted = 0;

  const interval = setInterval(async () => {
    try {
      const response = await axios.get(`${BASE_URL}/runs/${runId}`);
      const run = response.data;

      if (run.status !== lastStatus || run.completedPrompts !== lastCompleted) {
        const progress =
          run.totalPrompts > 0
            ? Math.round((run.completedPrompts / run.totalPrompts) * 100)
            : 0;

        const bar =
          '█'.repeat(Math.floor(progress / 2)) +
          '░'.repeat(50 - Math.floor(progress / 2));

        process.stdout.write(
          `\r${bar} ${progress}% | ${run.completedPrompts}/${run.totalPrompts} | Status: ${run.status.toUpperCase()}     `,
        );

        lastStatus = run.status;
        lastCompleted = run.completedPrompts;

        if (
          run.status === 'completed' ||
          run.status === 'failed' ||
          run.status === 'partial'
        ) {
          console.log('\n');
          console.log(`✅ Run ${run.status}!`);
          console.log('');
          console.log('💡 View summary with:');
          console.log(`   node cli.js get-summary ${runId}`);
          console.log('');
          clearInterval(interval);
          process.exit(0);
        }
      }
    } catch (error) {
      console.error(
        '\n❌ Failed to watch run:',
        error.response?.data || error.message,
      );
      clearInterval(interval);
      process.exit(1);
    }
  }, 2000);
}

async function getSummary(runId) {
  try {
    const response = await axios.get(`${BASE_URL}/runs/${runId}/summary`);
    const summary = response.data;

    console.log('📊 Run Summary');
    console.log('='.repeat(80));
    console.log('');

    console.log(`Run ID: ${summary.run._id}`);
    console.log(`Status: ${summary.run.status.toUpperCase()}`);
    console.log(
      `Progress: ${summary.run.completedPrompts}/${summary.run.totalPrompts}`,
    );
    console.log('');

    console.log('📈 Brand Visibility Metrics');
    console.log('-'.repeat(80));

    const sortedBrands = summary.brandMetrics.sort(
      (a, b) => b.totalMentions - a.totalMentions,
    );

    for (const brand of sortedBrands) {
      const rate = (brand.mentionRate * 100).toFixed(1);
      console.log(`\n${brand.brandName}`);
      console.log(`  Total Mentions: ${brand.totalMentions}`);
      console.log(`  Mention Rate: ${rate}%`);
      console.log(`  Prompts Analyzed: ${brand.byPrompt.length}`);
    }

    console.log('');
    console.log('💡 Export full report with:');
    console.log(`   node cli.js export-report ${runId} --output report.json`);
    console.log('');
  } catch (error) {
    console.error(
      '❌ Failed to get summary:',
      error.response?.data || error.message,
    );
    process.exit(1);
  }
}

async function exportReport(runId, outputPath) {
  try {
    const response = await axios.get(`${BASE_URL}/runs/${runId}/summary`);

    fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2));

    console.log(`✅ Report exported to: ${outputPath}`);
    console.log('');
  } catch (error) {
    console.error(
      '❌ Failed to export report:',
      error.response?.data || error.message,
    );
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];
const args = process.argv.slice(3);

function getArg(flag) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

// Route to appropriate function
switch (command) {
  case 'create-run':
    const configPath = getArg('--config') || 'config.example.json';
    const runIndex = parseInt(getArg('--run') || '0', 10);
    createRun(configPath, runIndex);
    break;

  case 'list-runs':
    const page = parseInt(getArg('--page') || '1', 10);
    const limit = parseInt(getArg('--limit') || '10', 10);
    listRuns(page, limit);
    break;

  case 'watch':
    if (!args[0]) {
      console.error('❌ Please provide a run ID');
      process.exit(1);
    }
    watchRun(args[0]);
    break;

  case 'get-summary':
    if (!args[0]) {
      console.error('❌ Please provide a run ID');
      process.exit(1);
    }
    getSummary(args[0]);
    break;

  case 'export-report':
    if (!args[0]) {
      console.error('❌ Please provide a run ID');
      process.exit(1);
    }
    const output = getArg('--output') || 'report.json';
    exportReport(args[0], output);
    break;

  default:
    console.log('LLM Brand Visibility Tracking CLI');
    console.log('');
    console.log('Usage:');
    console.log('  node cli.js create-run --config <path> --run <index>');
    console.log('  node cli.js list-runs [--page <n>] [--limit <n>]');
    console.log('  node cli.js watch <run-id>');
    console.log('  node cli.js get-summary <run-id>');
    console.log('  node cli.js export-report <run-id> --output <path>');
    console.log('');
    console.log('Examples:');
    console.log(
      '  node cli.js create-run --config config.example.json --run 0',
    );
    console.log('  node cli.js list-runs');
    console.log('  node cli.js watch 674d9c1e5f8a3b2d4c5e6f7a');
    console.log('  node cli.js get-summary 674d9c1e5f8a3b2d4c5e6f7a');
    console.log(
      '  node cli.js export-report 674d9c1e5f8a3b2d4c5e6f7a --output report.json',
    );
    console.log('');
    process.exit(command ? 1 : 0);
}
