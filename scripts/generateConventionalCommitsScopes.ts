import { Buffer } from 'buffer';
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import { Octokit } from 'octokit';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

const SRC = path.resolve('src/gadgets');

async function getScopes() {
    const entries = await fs.readdir(SRC, { withFileTypes: true });
    const scopes: string[] = [];

    for (const dir of entries.filter(d => d.isDirectory())) {
        scopes.push(dir.name);
    }

    return scopes.sort();
}

async function getData() {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner: 'Saoutax',
        repo: 'MWGadgets',
        path: '.vscode/settings.json',
    });

    if (Array.isArray(data) || data.type !== 'file') {
        throw new Error('Expected file type but got different type.');
    }

    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');

    return {
        settings: JSON.parse(decoded),
        sha: data.sha,
    };
}

(async () => {
    const branch = process.env.TARGET_BRANCH || 'main';

    const { settings, sha } = await getData();
    const scopes = await getScopes();

    const oldScopes = settings['conventionalCommits.scopes'] || [];
    const scopesEqual =
        Array.isArray(oldScopes) &&
        oldScopes.length === scopes.length &&
        oldScopes.every((scope, item) => scope === scopes[item]);

    if (scopesEqual) {
        console.log('No changes in scopes, skipping commit.');
        return;
    }

    settings['conventionalCommits.scopes'] = scopes;

    const content = Buffer.from(JSON.stringify(settings, null, 4), 'utf-8').toString('base64');

    await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: 'Saoutax',
        repo: 'MWGadgets',
        path: '.vscode/settings.json',
        message: 'chore: auto generate conventionalCommits.scopes',
        content,
        sha,
        branch,
    });

    console.log('Updated conventionalCommits.scopes and committed.');
})();
