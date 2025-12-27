import { promises as fs } from "fs";
import path from "path";

interface Settings {
    "conventionalCommits.scopes"?: string[];
}

const SRC = path.resolve("src/gadgets");
const SETTINGS = path.resolve(".vscode/settings.json");

async function getScopes() {
    const entries = await fs.readdir(SRC, { withFileTypes: true });
    const scopes: string[] = [];

    for (const dir of entries.filter(d => d.isDirectory())) {
        scopes.push(dir.name);
    }

    return scopes.sort();
}

async function updateSettings(scopes: string[]) {
    let settings: Settings = {};

    try {
        settings = JSON.parse(await fs.readFile(SETTINGS, "utf8"));
    } catch {
        // settings.json 不存在时使用默认空对象
    }

    settings["conventionalCommits.scopes"] = scopes;

    await fs.writeFile(SETTINGS, JSON.stringify(settings, null, 4));
}

(async () => {
    const scopes = await getScopes();
    await updateSettings(scopes);
    console.log("Updated scopes:", scopes);
})();
