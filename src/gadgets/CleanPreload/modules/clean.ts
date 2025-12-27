import { getContent } from "./get.js";

async function clean() {
    const content = await getContent();
    return content.replace(/<!--[\s\S]*?-->/g, "");
}

export default clean();
